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
import { formatQueryResponse, formatToolError, measureExecutionTime } from './shared/formatters';
import {
	validateTableName,
	validateColumnList,
	validateWhereClause,
	validateLimit,
} from './shared/validators';

export class NeonSelectQueryTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neon Select Query Tool',
		name: 'neonSelectQueryTool',
		icon: 'file:../neon.svg',
		group: ['transform'],
		version: 1,
		description:
			'Query data from Neon database tables with filtering and sorting. Use this tool to retrieve records matching specific criteria.',
		defaults: {
			name: 'Neon Select Query',
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
			description: 'The database schema containing the table',
		},
		{
			displayName: 'Table',
			name: 'table',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getTables',
			},
			default: '={{ $fromAI("table", "The name of the database table to query") }}',
			required: true,
			description: 'The name of the table to query',
			placeholder: 'users',
		},
		{
			displayName: 'Columns',
			name: 'columns',
			type: 'string',
			default: '={{ $fromAI("columns", "Comma-separated column names or * for all columns", "*") }}',
			description: 'Comma-separated list of column names to return. Use "*" for all columns.',
			placeholder: 'ID, name, email, created_at',
		},
		{
			displayName: 'Where Conditions',
			name: 'whereConditions',
			type: 'string',
			default: '={{ $fromAI("whereConditions", "SQL WHERE clause conditions to filter results", "") }}',
			description: 'SQL WHERE clause conditions to filter results. Example: age > 18 AND status = \'active\'.',
			placeholder: "age > 18 AND status = 'active'",
		},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'string',
				default: '',
				description: 'Column name to sort results by',
				placeholder: 'created_at',
			},
			{
				displayName: 'Sort Direction',
				name: 'sortDirection',
				type: 'options',
				options: [
					{
						name: 'Ascending',
						value: 'ASC',
					},
					{
						name: 'Descending',
						value: 'DESC',
					},
				],
				default: 'ASC',
				description: 'Direction to sort the results',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: {
					minValue: 1,
				},
				description: 'Max number of results to return',
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
			const columns = this.getNodeParameter('columns', 0, '*') as string;
			const whereConditions = this.getNodeParameter('whereConditions', 0, '') as string;
			const sortBy = this.getNodeParameter('sortBy', 0, '') as string;
			const sortDirection = this.getNodeParameter('sortDirection', 0, 'ASC') as 'ASC' | 'DESC';
			const limit = this.getNodeParameter('limit', 0, 100) as number;

			const tableValidation = validateTableName(table);
			if (!tableValidation.valid) {
				const errorResponse = formatToolError(
					'select',
					new Error(tableValidation.errors?.join('; ') || 'Invalid table name'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const columnsValidation = validateColumnList(columns);
			if (!columnsValidation.valid) {
				const errorResponse = formatToolError(
					'select',
					new Error(columnsValidation.errors?.join('; ') || 'Invalid column names'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const whereValidation = validateWhereClause(whereConditions);
			if (!whereValidation.valid) {
				const errorResponse = formatToolError(
					'select',
					new Error(whereValidation.errors?.join('; ') || 'Invalid WHERE clause'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const limitValidation = validateLimit(limit);
			if (!limitValidation.valid) {
				const errorResponse = formatToolError(
					'select',
					new Error(limitValidation.errors?.join('; ') || 'Invalid limit'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
			const { db } = await configureNeon(credentials, {});

			const columnList = columns.trim() === '*' ? '*' : columns;

			let query = `SELECT ${columnList} FROM "${schema}"."${table}"`;
			const values: Array<string | number> = [];

			if (whereConditions && whereConditions.trim() !== '') {
				query += ` WHERE ${whereConditions}`;
			}

			if (sortBy && sortBy.trim() !== '') {
				query += ` ORDER BY "${sortBy}" ${sortDirection}`;
			}

			query += ` LIMIT ${limit}`;

			const data = await db.any(query, values);

			const executionTime = measureExecutionTime(startTime);

			const response = formatQueryResponse('select', data, table, {
				executionTime,
				maxRows: limit,
			});

			return [[{ json: response }]];
		} catch (error) {
			const table = this.getNodeParameter('table', 0, '') as string;
			const errorResponse = formatToolError('select', error as Error, table);
			return [[{ json: errorResponse }]];
		}
	}
}
