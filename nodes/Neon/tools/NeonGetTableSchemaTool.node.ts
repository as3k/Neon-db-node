import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { configureNeon } from '../transport';
import type { NeonNodeCredentials } from '../helpers/interface';
import { measureExecutionTime } from './shared/formatters';
import { validateTableName } from './shared/validators';

export class NeonGetTableSchemaTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neon Get Table Schema Tool',
		name: 'neonGetTableSchemaTool',
		icon: 'file:../neon.svg',
		group: ['transform'],
		version: 1,
		description:
			'Get detailed schema information about a table including columns, data types, constraints, and indexes. Essential for understanding table structure before performing operations.',
		defaults: {
			name: 'Neon Get Table Schema',
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
				default: '',
				required: true,
				description: 'The name of the table to inspect',
				placeholder: 'users',
				hint: 'The name of the table to get schema information for',
			},
			{
				displayName: 'Include Details',
				name: 'includeDetails',
				type: 'multiOptions',
				options: [
					{
						name: 'Columns',
						value: 'columns',
						description: 'Column names, types, and nullable status',
					},
					{
						name: 'Primary Keys',
						value: 'primaryKeys',
						description: 'Primary key constraints',
					},
					{
						name: 'Foreign Keys',
						value: 'foreignKeys',
						description: 'Foreign key relationships',
					},
					{
						name: 'Indexes',
						value: 'indexes',
						description: 'Table indexes',
					},
					{
						name: 'Constraints',
						value: 'constraints',
						description: 'Check and unique constraints',
					},
				],
				default: ['columns', 'primaryKeys'],
				description: 'What schema details to include in the response',
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
			const includeDetails = this.getNodeParameter('includeDetails', 0) as string[];

			const tableValidation = validateTableName(table);
			if (!tableValidation.valid) {
				return [
					[
						{
							json: {
								success: false,
								error: tableValidation.errors?.join('; ') || 'Invalid table name',
								table,
							},
						},
					],
				];
			}

			const credentials = (await this.getCredentials('neonApi')) as NeonNodeCredentials;
			const { db } = await configureNeon(credentials, {});

			const schemaInfo: IDataObject = {
				schema,
				table,
			};

			// Get column information
			if (includeDetails.includes('columns')) {
				const columnsQuery = `
					SELECT 
						column_name,
						data_type,
						character_maximum_length,
						column_default,
						is_nullable,
						udt_name
					FROM information_schema.columns
					WHERE table_schema = $1 AND table_name = $2
					ORDER BY ordinal_position;
				`;

				const columns = await db.any(columnsQuery, [schema, table]);
				schemaInfo.columns = columns.map((col: any) => ({
					name: col.column_name,
					type: col.data_type,
					udtName: col.udt_name,
					maxLength: col.character_maximum_length,
					nullable: col.is_nullable === 'YES',
					default: col.column_default,
				}));
			}

			// Get primary key information
			if (includeDetails.includes('primaryKeys')) {
				const pkQuery = `
					SELECT a.attname AS column_name
					FROM pg_index i
					JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
					WHERE i.indrelid = $1::regclass AND i.indisprimary;
				`;

				const primaryKeys = await db.any(pkQuery, [`"${schema}"."${table}"`]);
				schemaInfo.primaryKeys = primaryKeys.map((pk: any) => pk.column_name);
			}

			// Get foreign key information
			if (includeDetails.includes('foreignKeys')) {
				const fkQuery = `
					SELECT
						kcu.column_name,
						ccu.table_schema AS foreign_table_schema,
						ccu.table_name AS foreign_table_name,
						ccu.column_name AS foreign_column_name,
						rc.update_rule,
						rc.delete_rule
					FROM information_schema.key_column_usage AS kcu
					JOIN information_schema.referential_constraints AS rc
						ON kcu.constraint_name = rc.constraint_name
					JOIN information_schema.constraint_column_usage AS ccu
						ON rc.constraint_name = ccu.constraint_name
					WHERE kcu.table_schema = $1 AND kcu.table_name = $2;
				`;

				const foreignKeys = await db.any(fkQuery, [schema, table]);
				schemaInfo.foreignKeys = foreignKeys.map((fk: any) => ({
					column: fk.column_name,
					referencesSchema: fk.foreign_table_schema,
					referencesTable: fk.foreign_table_name,
					referencesColumn: fk.foreign_column_name,
					onUpdate: fk.update_rule,
					onDelete: fk.delete_rule,
				}));
			}

			// Get index information
			if (includeDetails.includes('indexes')) {
				const indexQuery = `
					SELECT
						i.relname AS index_name,
						a.attname AS column_name,
						ix.indisunique AS is_unique,
						ix.indisprimary AS is_primary
					FROM pg_class t
					JOIN pg_index ix ON t.oid = ix.indrelid
					JOIN pg_class i ON i.oid = ix.indexrelid
					JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
					WHERE t.relkind = 'r'
						AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)
						AND t.relname = $2
					ORDER BY i.relname, a.attnum;
				`;

				const indexes = await db.any(indexQuery, [schema, table]);
				
				// Group indexes by name
				const indexMap = new Map<string, any>();
				for (const idx of indexes) {
					if (!indexMap.has(idx.index_name)) {
						indexMap.set(idx.index_name, {
							name: idx.index_name,
							columns: [],
							unique: idx.is_unique,
							primary: idx.is_primary,
						});
					}
					indexMap.get(idx.index_name).columns.push(idx.column_name);
				}

				schemaInfo.indexes = Array.from(indexMap.values());
			}

			// Get constraint information
			if (includeDetails.includes('constraints')) {
				const constraintQuery = `
					SELECT
						tc.constraint_name,
						tc.constraint_type,
						cc.check_clause
					FROM information_schema.table_constraints AS tc
					LEFT JOIN information_schema.check_constraints AS cc
						ON tc.constraint_name = cc.constraint_name
					WHERE tc.table_schema = $1 AND tc.table_name = $2
						AND tc.constraint_type IN ('CHECK', 'UNIQUE');
				`;

				const constraints = await db.any(constraintQuery, [schema, table]);
				schemaInfo.constraints = constraints.map((c: any) => ({
					name: c.constraint_name,
					type: c.constraint_type,
					definition: c.check_clause,
				}));
			}

			const executionTime = measureExecutionTime(startTime);

			const response = {
				success: true,
				operation: 'getTableSchema',
				...schemaInfo,
				metadata: {
					executionTime,
					timestamp: new Date().toISOString(),
				},
			};

			return [[{ json: response }]];
		} catch (error) {
			const table = this.getNodeParameter('table', 0, '') as string;
			return [
				[
					{
						json: {
							success: false,
							operation: 'getTableSchema',
							error: (error as Error).message,
							table,
							timestamp: new Date().toISOString(),
						},
					},
				],
			];
		}
	}
}
