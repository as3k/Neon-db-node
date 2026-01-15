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
import { validateTableName } from './shared/validators';

export class NeonInsertDataTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neon Insert Data Tool',
		name: 'neonInsertDataTool',
		icon: 'file:../neon.svg',
		group: ['transform'],
		version: 1,
		description:
			'Insert new records into Neon database tables. Supports single or multiple row inserts with automatic type handling.',
		defaults: {
			name: 'Neon Insert Data',
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
			default: '={{ $fromAI("table", "The name of the database table to insert data into") }}',
			required: true,
			description: 'The name of the table to insert into',
			placeholder: 'users',
		},
		{
			displayName: 'Data',
			name: 'data',
			type: 'json',
			default: '={{ $fromAI("data", "JSON object or array of objects to insert into the table") }}',
			required: true,
			description: 'JSON object or array of objects to insert. Example: {"name": "John", "email": "john@example.com"}.',
			typeOptions: {
				rows: 10,
			},
		},
			{
				displayName: 'Skip On Conflict',
				name: 'skipOnConflict',
				type: 'boolean',
				default: false,
				description: 'Whether to skip rows that violate unique constraints instead of failing',
			},
			{
				displayName: 'Return Data',
				name: 'returnData',
				type: 'boolean',
				default: true,
				description: 'Whether to return the inserted rows (including auto-generated IDs)',
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
			const dataParam = this.getNodeParameter('data', 0) as string | IDataObject | IDataObject[];
			const skipOnConflict = this.getNodeParameter('skipOnConflict', 0, false) as boolean;
			const returnData = this.getNodeParameter('returnData', 0, true) as boolean;

			const tableValidation = validateTableName(table);
			if (!tableValidation.valid) {
				const errorResponse = formatToolError(
					'insert',
					new Error(tableValidation.errors?.join('; ') || 'Invalid table name'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			let dataToInsert: IDataObject[];
			try {
				const parsed = typeof dataParam === 'string' ? JSON.parse(dataParam) : dataParam;
				dataToInsert = Array.isArray(parsed) ? parsed : [parsed];
			} catch (error) {
				const errorResponse = formatToolError(
					'insert',
					new Error('Invalid JSON data format'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			if (dataToInsert.length === 0) {
				const errorResponse = formatToolError(
					'insert',
					new Error('No data provided for insert'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
			const { db } = await configureNeon(credentials, {});

			const firstRow = dataToInsert[0];
			const columns = Object.keys(firstRow);

			if (columns.length === 0) {
				const errorResponse = formatToolError(
					'insert',
					new Error('Data object has no columns'),
					table,
				);
				return [[{ json: errorResponse }]];
			}

			const columnList = columns.map((col) => `"${col}"`).join(', ');
			const placeholders = dataToInsert
				.map((_, rowIndex) => {
					const rowPlaceholders = columns
						.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`)
						.join(', ');
					return `(${rowPlaceholders})`;
				})
				.join(', ');

			let query = `INSERT INTO "${schema}"."${table}" (${columnList}) VALUES ${placeholders}`;

			if (skipOnConflict) {
				query += ' ON CONFLICT DO NOTHING';
			}

			if (returnData) {
				query += ' RETURNING *';
			}

			const values: unknown[] = [];
			for (const row of dataToInsert) {
				for (const col of columns) {
					values.push(row[col]);
				}
			}

			const result = returnData ? await db.any(query, values) : await db.result(query, values);

			const executionTime = measureExecutionTime(startTime);

			const affectedRows = returnData
				? (result as IDataObject[]).length
				: (result as any).rowCount || 0;

			const response = formatModificationResponse(
				'insert',
				affectedRows,
				table,
				returnData ? (result as IDataObject[]) : undefined,
				{ executionTime },
			);

			return [[{ json: response }]];
		} catch (error) {
			const table = this.getNodeParameter('table', 0, '') as string;
			const errorResponse = formatToolError('insert', error as Error, table);
			return [[{ json: errorResponse }]];
		}
	}
}
