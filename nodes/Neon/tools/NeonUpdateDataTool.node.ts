import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
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

export class NeonUpdateDataTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neon Update Data Tool',
		name: 'neonUpdateDataTool',
		icon: 'file:../neon.svg',
		group: ['transform'],
		version: 1,
		description:
			'Update existing records in Neon database tables. Requires WHERE conditions to specify which rows to update.',
		defaults: {
			name: 'Neon Update Data',
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
			default: '',
			required: true,
			description: 'The name of the table to update',
			placeholder: 'users',
			hint: 'The name of the database table to update',
		},
		{
			displayName: 'Values',
			name: 'values',
			type: 'json',
			default: '',
			required: true,
			description: 'JSON object with column names and new values. Example: {"name": "John Updated", "status": "active"}.',
			placeholder: '{"name": "John Updated", "status": "active"}',
			hint: 'JSON object with column names and new values to update',
			typeOptions: {
				rows: 5,
			},
		},
		{
			displayName: 'Where Conditions',
			name: 'whereConditions',
			type: 'string',
			default: '',
			required: true,
			description: 'SQL WHERE clause to specify which rows to update. Example: ID = 123 OR email = \'user@example.com\'.',
			placeholder: 'id = 123',
			hint: 'SQL WHERE clause to specify which rows to update',
		},
			{
				displayName: 'Return Data',
				name: 'returnData',
				type: 'boolean',
				default: false,
				description: 'Whether to return the updated rows',
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
			const valuesParam = this.getNodeParameter('values', 0) as string | IDataObject;
			const whereConditions = this.getNodeParameter('whereConditions', 0) as string;
			const returnData = this.getNodeParameter('returnData', 0, false) as boolean;

			const tableValidation = validateTableName(table);
			if (!tableValidation.valid) {
				const errorResponse = formatToolError(
					'update',
					new Error(tableValidation.errors?.join('; ') || 'Invalid table name'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			if (!whereConditions || whereConditions.trim() === '') {
				const errorResponse = formatToolError(
					'update',
					new Error(
						'WHERE conditions are required for UPDATE operations. To update all rows, explicitly provide "1=1" as the condition.',
					),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const whereValidation = validateWhereClause(whereConditions);
			if (!whereValidation.valid) {
				const errorResponse = formatToolError(
					'update',
					new Error(whereValidation.errors?.join('; ') || 'Invalid WHERE clause'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			let valuesToUpdate: IDataObject;
			try {
				valuesToUpdate = typeof valuesParam === 'string' ? JSON.parse(valuesParam) : valuesParam;
			} catch (error) {
				const errorResponse = formatToolError(
					'update',
					new Error('Invalid JSON format for values'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const columns = Object.keys(valuesToUpdate);
			if (columns.length === 0) {
				const errorResponse = formatToolError(
					'update',
					new Error('No columns provided to update'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
			const { db } = await configureNeon(credentials, {});

			const setClause = columns.map((col, index) => `"${col}" = $${index + 1}`).join(', ');

			let query = `UPDATE "${schema}"."${table}" SET ${setClause} WHERE ${whereConditions}`;

			if (returnData) {
				query += ' RETURNING *';
			}

			const values = columns.map((col) => valuesToUpdate[col]);

			const result = returnData ? await db.any(query, values) : await db.result(query, values);

			const executionTime = measureExecutionTime(startTime);

			const affectedRows = returnData
				? (result as IDataObject[]).length
				: (result as any).rowCount || 0;

			const response = formatModificationResponse(
				'update',
				affectedRows,
				table,
				returnData ? (result as IDataObject[]) : undefined,
				{ executionTime },
			);

			return [[{ json: response }]];
		} catch (error) {
			const table = this.getNodeParameter('table', 0, '') as string;
			const errorResponse = formatToolError('update', error as Error, table);
			return [[{ json: errorResponse }]];
		}
	}
}
