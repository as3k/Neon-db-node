import type { IDataObject } from 'n8n-workflow';
import type { ToolErrorResponse, ToolErrorType } from './types';

export function categorizeError(error: Error | IDataObject): ToolErrorType {
	const message = (error as Error).message || (error as IDataObject).message;
	const errorMessage = typeof message === 'string' ? message.toLowerCase() : '';
	const errorCode = (error as IDataObject).code;
	const errorCodeStr = typeof errorCode === 'string' ? errorCode : String(errorCode || '');

	if (
		errorCodeStr === 'ECONNREFUSED' ||
		errorCodeStr === 'ENOTFOUND' ||
		errorCodeStr === 'ETIMEDOUT'
	) {
		return 'connection_error';
	}

	if (
		errorCodeStr === '28P01' ||
		errorMessage.includes('authentication') ||
		errorMessage.includes('password')
	) {
		return 'authentication_error';
	}

	if (
		errorCodeStr === '42P01' ||
		(errorMessage.includes('does not exist') && errorMessage.includes('relation'))
	) {
		return 'invalid_table';
	}

	if (
		errorCodeStr === '42703' ||
		(errorMessage.includes('does not exist') && errorMessage.includes('column'))
	) {
		return 'invalid_column';
	}

	if (errorCodeStr === '42501' || errorMessage.includes('permission denied')) {
		return 'permission_denied';
	}

	if (errorCodeStr.startsWith('42') || errorMessage.includes('syntax error')) {
		return 'syntax_error';
	}

	if (errorCodeStr === '23505' || errorCodeStr === '23503' || errorCodeStr.startsWith('23')) {
		return 'constraint_violation';
	}

	if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
		return 'timeout';
	}

	if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
		return 'validation_error';
	}

	return 'unknown_error';
}

export function getRecoverySuggestion(
	errorType: ToolErrorType,
	error: Error | IDataObject,
): string | undefined {
	const message = (error as Error).message || (error as IDataObject).message;
	const errorMessage = typeof message === 'string' ? message : '';

	switch (errorType) {
		case 'connection_error':
			return 'Check that the database host is accessible and the port is correct. Verify network connectivity.';

		case 'authentication_error':
			return 'Verify the database username and password are correct. Check if the database user has proper permissions.';

		case 'invalid_table': {
			const tableMatch = errorMessage.match(/relation "([^"]+)" does not exist/);
			if (tableMatch) {
				return `Table "${tableMatch[1]}" does not exist. Check the table name and schema.`;
			}
			return 'Check that the table name is correct and exists in the specified schema.';
		}

		case 'invalid_column': {
			const columnMatch = errorMessage.match(/column "([^"]+)" does not exist/);
			if (columnMatch) {
				return `Column "${columnMatch[1]}" does not exist in the table. Verify the column name.`;
			}
			return 'Check that all column names are correct and exist in the table.';
		}

		case 'syntax_error':
			return 'Review the SQL syntax for errors. Check for missing commas, quotes, or keywords.';

		case 'constraint_violation':
			if (errorMessage.includes('unique')) {
				return 'A unique constraint was violated. The value already exists. Consider using an UPDATE instead or enabling skipOnConflict.';
			}
			if (errorMessage.includes('foreign key')) {
				return 'A foreign key constraint was violated. Ensure referenced records exist in the related table.';
			}
			return 'A database constraint was violated. Check unique constraints, foreign keys, and NOT NULL requirements.';

		case 'permission_denied':
			return 'The database user does not have permission for this operation. Grant the necessary privileges.';

		case 'timeout':
			return 'The query took too long to execute. Consider adding more specific filters or optimizing the query.';

		case 'validation_error':
			return 'One or more parameters are invalid. Check the parameter types and values.';

		default:
			return undefined;
	}
}

export function formatToolError(
	operation: string,
	error: Error | IDataObject,
	table?: string,
): ToolErrorResponse {
	const errorType = categorizeError(error);
	const suggestion = getRecoverySuggestion(errorType, error);
	const errorCode = (error as IDataObject).code;
	const errorCodeStr = typeof errorCode === 'string' ? errorCode : undefined;

	const message = (error as Error).message || (error as IDataObject).message;
	const sanitizedMessage = typeof message === 'string' ? message : 'An unknown error occurred';

	return {
		success: false,
		operation,
		table,
		error: sanitizedMessage,
		errorType,
		suggestion,
		sqlState: errorCodeStr,
		details: {
			timestamp: new Date().toISOString(),
		},
	};
}
