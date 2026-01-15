import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { configureNeon } from '../transport';
import type { NeonNodeCredentials } from '../helpers/interface';
import {
	formatQueryResponse,
	formatModificationResponse,
	formatToolError,
	measureExecutionTime,
} from './shared/formatters';
import { validateSqlQuery } from './shared/validators';

export class NeonExecuteSqlTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neon Execute SQL Tool',
		name: 'neonExecuteSqlTool',
		icon: 'file:../neon.svg',
		group: ['transform'],
		version: 1,
		description:
			'Execute custom SQL queries on Neon database with parameter binding. Supports SELECT, INSERT, UPDATE, DELETE, and WITH queries.',
		defaults: {
			name: 'Neon Execute SQL',
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
			displayName: 'Query',
			name: 'query',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				rows: 10,
			},
			description: 'SQL query to execute. Use $1, $2, etc. for parameter placeholders. Example: SELECT * FROM users WHERE id = $1',
			placeholder: 'SELECT * FROM users WHERE status = $1',
			hint: 'SQL query to execute. Use $1, $2, etc. for parameterized queries',
		},
		{
			displayName: 'Parameters',
			name: 'parameters',
			type: 'json',
			default: '[]',
			description: 'JSON array of parameters for parameterized queries. Example: ["active", 30]',
			placeholder: '["active", 30]',
			hint: 'JSON array of parameters for the SQL query (optional)',
		},
			{
				displayName: 'Query Mode',
				name: 'queryMode',
				type: 'options',
				options: [
					{
						name: 'Single',
						value: 'single',
						description: 'Execute one query at a time',
					},
					{
						name: 'Transaction',
						value: 'transaction',
						description: 'Execute in a transaction (rollback on error)',
					},
					{
						name: 'Independently',
						value: 'independently',
						description: 'Execute each query separately (continue on errors)',
					},
				],
				default: 'single',
				description: 'How to execute the query',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const startTime = Date.now();

		try {
			const query = this.getNodeParameter('query', 0) as string;
			const parametersParam = this.getNodeParameter('parameters', 0, '[]') as string | unknown[];
			const queryMode = this.getNodeParameter('queryMode', 0, 'single') as string;

			const queryValidation = validateSqlQuery(query);
			if (!queryValidation.valid) {
				const errorResponse = formatToolError(
					'executeQuery',
					new Error(queryValidation.errors?.join('; ') || 'Invalid SQL query'),
				);
				return [[{ json: errorResponse }]];
			}

			let parameters: unknown[];
			try {
				parameters =
					typeof parametersParam === 'string' ? JSON.parse(parametersParam) : parametersParam;
			} catch (error) {
				const errorResponse = formatToolError(
					'executeQuery',
					new Error('Invalid JSON format for parameters'),
				);
				return [[{ json: errorResponse }]];
			}

			if (!Array.isArray(parameters)) {
				const errorResponse = formatToolError(
					'executeQuery',
					new Error('Parameters must be an array'),
				);
				return [[{ json: errorResponse }]];
			}

			const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
			const { db } = await configureNeon(credentials, { queryMode: queryMode as any });

			const upperQuery = query.trim().toUpperCase();
			const isSelectQuery = upperQuery.startsWith('SELECT') || upperQuery.startsWith('WITH');

			let result: unknown;

			if (queryMode === 'transaction') {
				result = await db.tx(async (t) => {
					return isSelectQuery ? t.any(query, parameters) : t.result(query, parameters);
				});
			} else {
				result = isSelectQuery
					? await db.any(query, parameters)
					: await db.result(query, parameters);
			}

			const executionTime = measureExecutionTime(startTime);

			if (isSelectQuery) {
				const data = result as IDataObject[];
				const response = formatQueryResponse('executeQuery', data, undefined, {
					executionTime,
				});
				return [[{ json: response }]];
			} else {
				const affectedRows = (result as any).rowCount || 0;
				const response = formatModificationResponse(
					'executeQuery',
					affectedRows,
					undefined,
					undefined,
					{ executionTime },
				);
				return [[{ json: response }]];
			}
		} catch (error) {
			const errorResponse = formatToolError('executeQuery', error as Error);
			return [[{ json: errorResponse }]];
		}
	}
}
