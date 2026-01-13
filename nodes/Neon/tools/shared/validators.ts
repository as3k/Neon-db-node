import type { ValidationResult } from './types';

export function validateTableName(table: string): ValidationResult {
	const errors: string[] = [];

	if (!table || table.trim() === '') {
		errors.push('Table name is required');
		return { valid: false, errors };
	}

	if (table.includes(';') || table.includes('--') || table.includes('/*')) {
		errors.push('Table name contains invalid characters (possible SQL injection attempt)');
		return { valid: false, errors };
	}

	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
		errors.push(
			'Table name must start with a letter or underscore and contain only letters, numbers, and underscores',
		);
		return { valid: false, errors };
	}

	return { valid: true };
}

export function validateColumnName(column: string): ValidationResult {
	const errors: string[] = [];

	if (column === '*') {
		return { valid: true };
	}

	if (!column || column.trim() === '') {
		errors.push('Column name is required');
		return { valid: false, errors };
	}

	if (column.includes(';') || column.includes('--') || column.includes('/*')) {
		errors.push('Column name contains invalid characters (possible SQL injection attempt)');
		return { valid: false, errors };
	}

	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
		errors.push(
			'Column name must start with a letter or underscore and contain only letters, numbers, and underscores',
		);
		return { valid: false, errors };
	}

	return { valid: true };
}

export function validateColumnList(columns: string): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!columns || columns.trim() === '') {
		return { valid: true };
	}

	if (columns.trim() === '*') {
		return { valid: true };
	}

	const columnArray = columns.split(',').map((col) => col.trim());

	for (const column of columnArray) {
		const validation = validateColumnName(column);
		if (!validation.valid) {
			errors.push(...(validation.errors || []));
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return { valid: true, warnings };
}

export function validateWhereClause(whereClause: string | undefined): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!whereClause || whereClause.trim() === '') {
		return { valid: true };
	}

	const dangerous = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE', '; '];

	const upperClause = whereClause.toUpperCase();
	for (const keyword of dangerous) {
		if (upperClause.includes(keyword)) {
			errors.push(`WHERE clause contains potentially dangerous keyword: ${keyword}`);
		}
	}

	if (whereClause.includes('--') || whereClause.includes('/*')) {
		errors.push('WHERE clause contains SQL comment syntax (possible injection attempt)');
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return { valid: true, warnings };
}

export function validateLimit(limit: number | undefined): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (limit === undefined) {
		return { valid: true };
	}

	if (limit < 1) {
		errors.push('Limit must be at least 1');
		return { valid: false, errors };
	}

	if (limit > 10000) {
		warnings.push('Limit is very high (>10000). Consider using pagination for large result sets.');
	}

	return { valid: true, warnings };
}

export function validateSqlQuery(query: string): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!query || query.trim() === '') {
		errors.push('SQL query is required');
		return { valid: false, errors };
	}

	const upperQuery = query.trim().toUpperCase();

	const allowedFirstWords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'];
	const firstWord = upperQuery.split(/\s+/)[0];

	if (!allowedFirstWords.includes(firstWord)) {
		errors.push(`Query must start with one of: ${allowedFirstWords.join(', ')}`);
		return { valid: false, errors };
	}

	const dangerous = [
		'DROP TABLE',
		'DROP DATABASE',
		'TRUNCATE',
		'ALTER TABLE',
		'CREATE TABLE',
		'CREATE DATABASE',
		'GRANT',
		'REVOKE',
	];

	for (const keyword of dangerous) {
		if (upperQuery.includes(keyword)) {
			errors.push(`Query contains dangerous operation: ${keyword}`);
		}
	}

	const semicolons = (query.match(/;/g) || []).length;
	if (semicolons > 1 || (semicolons === 1 && !query.trim().endsWith(';'))) {
		errors.push('Multiple SQL statements in one query are not allowed');
		return { valid: false, errors };
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return { valid: true, warnings };
}
