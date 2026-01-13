import type { IDataObject } from 'n8n-workflow';
import type { ToolQuerySuccessResponse, ToolModificationSuccessResponse } from './types';

export { formatToolError } from './errors';

export function formatQueryResponse(
	operation: 'select' | 'executeQuery',
	data: IDataObject[],
	table?: string,
	options?: {
		executionTime?: string;
		maxRows?: number;
	},
): ToolQuerySuccessResponse {
	const rowCount = data.length;
	const truncated = options?.maxRows ? rowCount >= options.maxRows : false;

	const columns = data.length > 0 ? Object.keys(data[0]) : [];

	return {
		success: true,
		operation,
		table,
		rowCount,
		data,
		columns,
		executionTime: options?.executionTime,
		truncated,
	};
}

export function formatModificationResponse(
	operation: 'insert' | 'update' | 'delete' | 'executeQuery',
	affectedRows: number,
	table?: string,
	data?: IDataObject[],
	options?: {
		executionTime?: string;
	},
): ToolModificationSuccessResponse {
	return {
		success: true,
		operation,
		table,
		affectedRows,
		data,
		executionTime: options?.executionTime,
	};
}

export function measureExecutionTime(startTime: number): string {
	const duration = Date.now() - startTime;
	if (duration < 1000) {
		return `${duration}ms`;
	}
	return `${(duration / 1000).toFixed(2)}s`;
}
