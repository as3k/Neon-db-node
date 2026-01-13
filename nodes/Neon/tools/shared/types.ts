import type { IDataObject } from 'n8n-workflow';
import type { NeonDatabase } from '../../helpers/interface';

// ============================================================================
// AI TOOL RESPONSE TYPES
// ============================================================================

/**
 * Error categories for AI-friendly error handling
 * Helps LLMs understand the type of failure and how to recover
 */
export type ToolErrorType =
	| 'connection_error'
	| 'authentication_error'
	| 'invalid_table'
	| 'invalid_column'
	| 'syntax_error'
	| 'constraint_violation'
	| 'permission_denied'
	| 'timeout'
	| 'validation_error'
	| 'unknown_error';

/**
 * Standardized error response for AI tools
 * Provides structured information to help LLMs understand and recover from failures
 */
export type ToolErrorResponse = {
	success: false;
	operation: string;
	table?: string;
	error: string; // Human-readable error message
	errorType: ToolErrorType; // Categorized error type
	suggestion?: string; // Recovery suggestion
	sqlState?: string; // PostgreSQL error code
	details?: IDataObject; // Additional context (without sensitive data)
};

/**
 * Standardized success response for query operations (SELECT)
 */
export type ToolQuerySuccessResponse = {
	success: true;
	operation: 'select' | 'executeQuery';
	table?: string;
	rowCount: number;
	data: IDataObject[];
	executionTime?: string;
	truncated?: boolean; // If result set was limited
	columns?: string[]; // Column names in the result
};

/**
 * Standardized success response for modification operations (INSERT, UPDATE, DELETE)
 */
export type ToolModificationSuccessResponse = {
	success: true;
	operation: 'insert' | 'update' | 'delete' | 'executeQuery';
	table?: string;
	affectedRows: number;
	data?: IDataObject[]; // Returned rows (for INSERT/UPDATE with RETURNING clause)
	executionTime?: string;
};

/**
 * Union type of all possible AI tool responses
 */
export type ToolResponse =
	| ToolQuerySuccessResponse
	| ToolModificationSuccessResponse
	| ToolErrorResponse;

// ============================================================================
// AI TOOL EXECUTION CONTEXT
// ============================================================================

/**
 * Execution context passed to AI tool operations
 * Contains database connection and operational settings
 */
export type ToolExecutionContext = {
	db: NeonDatabase;
	schema: string;
	table: string;
	operation: string;
	maxRows?: number; // Result limit for queries
	timeout?: number; // Query timeout in milliseconds
};

// ============================================================================
// AI TOOL PARAMETER TYPES
// ============================================================================

/**
 * Parameters for SELECT query tool
 */
export type SelectQueryParams = {
	schema: string;
	table: string;
	columns?: string; // Comma-separated column names or '*'
	whereConditions?: string; // SQL WHERE clause
	sortBy?: string; // Column to sort by
	sortDirection?: 'ASC' | 'DESC';
	limit?: number;
};

/**
 * Parameters for INSERT data tool
 */
export type InsertDataParams = {
	schema: string;
	table: string;
	data: IDataObject | IDataObject[]; // Single row or array of rows
	skipOnConflict?: boolean;
	returnData?: boolean; // Whether to return inserted rows
};

/**
 * Parameters for UPDATE data tool
 */
export type UpdateDataParams = {
	schema: string;
	table: string;
	values: IDataObject; // Columns to update with new values
	whereConditions: string; // Required WHERE clause
	returnData?: boolean; // Whether to return updated rows
};

/**
 * Parameters for DELETE data tool
 */
export type DeleteDataParams = {
	schema: string;
	table: string;
	whereConditions?: string; // Optional WHERE clause (requires confirmation if missing)
	mode?: 'delete' | 'truncate' | 'drop'; // Deletion mode
	confirmDestructive?: boolean; // Explicit confirmation for dangerous operations
};

/**
 * Parameters for EXECUTE SQL tool
 */
export type ExecuteSqlParams = {
	query: string; // SQL query with $1, $2, etc. placeholders
	parameters?: Array<string | number | boolean | null>; // Parameter values
	queryMode?: 'single' | 'transaction' | 'independently';
};

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Database column value that can be provided by AI agents
 * Supports automatic type coercion from LLM-provided values
 */
export type ToolColumnValue = string | number | boolean | null | IDataObject | string[];

/**
 * Validation result for tool parameters
 */
export type ValidationResult = {
	valid: boolean;
	errors?: string[];
	warnings?: string[];
};
