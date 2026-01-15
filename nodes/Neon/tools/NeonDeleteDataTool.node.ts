import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { configureNeon } from '../transport';
import type { NeonNodeCredentials } from '../helpers/interface';
import {
	formatModificationResponse,
	formatToolError,
	measureExecutionTime,
} from './shared/formatters';
import { validateTableName, validateWhereClause } from './shared/validators';

export class NeonDeleteDataTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neon Delete Data Tool',
		name: 'neonDeleteDataTool',
		icon: 'file:../neon.svg',
		group: ['transform'],
		version: 1,
		description:
			'Delete records from Neon database tables. Supports row deletion, table truncation, and table dropping. Use with caution.',
		defaults: {
			name: 'Neon Delete Data',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.AiTool],
		credentials: [
			{
				name: 'neonApi',
				required: true,
			},
		],
		properties: [
		{
			displayName: 'Schema',
			name: 'schema',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getSchemas',
			},
			default: 'public',
			required: true,
			description: 'The database schema containing the table (usually "public")',
		},
		{
			displayName: 'Table',
			name: 'table',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getTables',
			},
			default: '={{ $fromAI("table", "The name of the database table to delete from") }}',
			required: true,
			description: 'The name of the table to delete from',
			placeholder: 'users',
		},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{
						name: 'Delete Rows',
						value: 'delete',
						description: 'Delete specific rows matching WHERE conditions',
					},
					{
						name: 'Truncate Table',
						value: 'truncate',
						description: 'Remove all rows from the table (fast, but cannot be rolled back)',
					},
					{
						name: 'Drop Table',
						value: 'drop',
						description: 'Delete the entire table including its structure (DESTRUCTIVE)',
					},
				],
				default: 'delete',
				description: 'The type of deletion to perform',
			},
		{
			displayName: 'Where Conditions',
			name: 'whereConditions',
			type: 'string',
			default: '={{ $fromAI("whereConditions", "SQL WHERE clause to specify which rows to delete") }}',
			description:
				'SQL WHERE clause to specify which rows to delete. Required for "Delete Rows" mode.',
			placeholder: "age < 18 OR status = 'inactive'",
			displayOptions: {
				show: {
					mode: ['delete'],
				},
			},
		},
			{
				displayName: 'Confirm Destructive Operation',
				name: 'confirmDestructive',
				type: 'boolean',
				default: false,
				description:
					'Whether to confirm this destructive operation. MUST be set to true for TRUNCATE and DROP operations.',
				displayOptions: {
					show: {
						mode: ['truncate', 'drop'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getSchemas(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
					try {
						const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
						const { db } = await configureNeon(credentials, {});

						const query = `
							SELECT schema_name
							FROM information_schema.schemata
							WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
							ORDER BY schema_name;
						`;

						const schemas = await db.any(query);

						return schemas.map((schema: { schema_name: string }) => ({
							name: schema.schema_name,
							value: schema.schema_name,
						}));
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`Failed to load schemas: ${(error as Error).message}`,
						);
					}
				},

				async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
					try {
						const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
						const { db } = await configureNeon(credentials, {});

						const schema = this.getNodeParameter('schema', 'public') as string;

						const query = `
							SELECT table_name
							FROM information_schema.tables
							WHERE table_schema = $1
							AND table_type = 'BASE TABLE'
							ORDER BY table_name;
						`;

						const tables = await db.any(query, [schema]);

						return tables.map((table: { table_name: string }) => ({
							name: table.table_name,
							value: table.table_name,
						}));
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`Failed to load tables: ${(error as Error).message}`,
						);
					}
				},
			},
		};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const startTime = Date.now();

		try {
			const schema = this.getNodeParameter('schema', 0) as string;
			const table = this.getNodeParameter('table', 0) as string;
			const mode = this.getNodeParameter('mode', 0) as 'delete' | 'truncate' | 'drop';
			const whereConditions = this.getNodeParameter('whereConditions', 0, '') as string;
			const confirmDestructive = this.getNodeParameter('confirmDestructive', 0, false) as boolean;

			const tableValidation = validateTableName(table);
			if (!tableValidation.valid) {
				const errorResponse = formatToolError(
					'delete',
					new Error(tableValidation.errors?.join('; ') || 'Invalid table name'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			if (mode === 'delete') {
				if (!whereConditions || whereConditions.trim() === '') {
					const errorResponse = formatToolError(
						'delete',
						new Error(
							'WHERE conditions are required for DELETE operations. To delete all rows, use TRUNCATE mode instead.',
						),
						table,
					);
					return [[{ json: errorResponse }]];
				}

				const whereValidation = validateWhereClause(whereConditions);
				if (!whereValidation.valid) {
					const errorResponse = formatToolError(
						'delete',
						new Error(whereValidation.errors?.join('; ') || 'Invalid WHERE clause'),
						table,
					);
					return [[{ json: errorResponse }]];
				}
			}

			if ((mode === 'truncate' || mode === 'drop') && !confirmDestructive) {
				const errorResponse = formatToolError(
					'delete',
					new Error(
						`${mode.toUpperCase()} is a destructive operation. Set "confirmDestructive" to true to proceed.`,
					),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
			const { db } = await configureNeon(credentials, {});

			let query: string;
			let affectedRows = 0;

			switch (mode) {
				case 'delete':
					query = `DELETE FROM "${schema}"."${table}" WHERE ${whereConditions}`;
					const deleteResult = await db.result(query);
					affectedRows = deleteResult.rowCount || 0;
					break;

				case 'truncate':
					query = `TRUNCATE TABLE "${schema}"."${table}"`;
					await db.none(query);
					affectedRows = -1;
					break;

				case 'drop':
					query = `DROP TABLE "${schema}"."${table}"`;
					await db.none(query);
					affectedRows = -1;
					break;
			}

			const executionTime = measureExecutionTime(startTime);

			const response = formatModificationResponse('delete', affectedRows, table, undefined, {
				executionTime,
			});

			return [[{ json: response }]];
		} catch (error) {
			const table = this.getNodeParameter('table', 0, '') as string;
			const errorResponse = formatToolError('delete', error as Error, table);
			return [[{ json: errorResponse }]];
		}
	}
}
