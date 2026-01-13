## ADDED Requirements

### Requirement: AI Tool Registry

The node SHALL expose individual database operations as distinct AI agent tools that can be discovered and invoked by n8n AI Agent nodes.

#### Scenario: Tool discovery

- **WHEN** an AI Agent node queries available tools
- **THEN** the Neon node SHALL return a list of available database operation tools (Select, Insert, Update, Delete, Execute Query)
- **AND** each tool SHALL have a unique identifier, name, and description

#### Scenario: Tool metadata includes parameter schemas

- **WHEN** an AI Agent requests tool details
- **THEN** each tool SHALL include a JSON schema defining required and optional parameters
- **AND** schemas SHALL include field types, descriptions, and validation rules

### Requirement: Select Query Tool

The node SHALL provide a "Select Query" tool that allows AI agents to query database tables using natural language specifications.

#### Scenario: Basic table query

- **WHEN** AI agent invokes the Select Query tool with table name "users"
- **THEN** the tool SHALL return all rows from the users table
- **AND** results SHALL be formatted as JSON array of objects

#### Scenario: Filtered query with conditions

- **WHEN** AI agent specifies WHERE conditions like "age > 18 AND status = 'active'"
- **THEN** the tool SHALL construct and execute a parameterized query with those filters
- **AND** only matching rows SHALL be returned

#### Scenario: Column selection

- **WHEN** AI agent specifies columns to return (e.g., "id, name, email")
- **THEN** the tool SHALL return only the specified columns
- **AND** exclude other columns from the result

#### Scenario: Sorted results

- **WHEN** AI agent specifies sort order (e.g., "ORDER BY created_at DESC")
- **THEN** results SHALL be returned in the specified order

#### Scenario: Limited results

- **WHEN** AI agent specifies a limit (e.g., "return 10 rows")
- **THEN** the tool SHALL return at most the specified number of rows

### Requirement: Insert Data Tool

The node SHALL provide an "Insert Data" tool that allows AI agents to add new records to database tables.

#### Scenario: Insert single row

- **WHEN** AI agent provides table name and column-value pairs
- **THEN** a new row SHALL be inserted into the specified table
- **AND** the tool SHALL return the inserted row including any auto-generated fields

#### Scenario: Insert multiple rows

- **WHEN** AI agent provides an array of row objects
- **THEN** all rows SHALL be inserted in a single operation
- **AND** the tool SHALL return all inserted rows

#### Scenario: Handle duplicate keys

- **WHEN** insert would violate unique constraints
- **THEN** the tool SHALL return a clear error message
- **OR** if skipOnConflict option is enabled, silently skip the conflicting row

#### Scenario: Type coercion

- **WHEN** AI agent provides string values for numeric/date columns
- **THEN** the tool SHALL attempt automatic type conversion
- **AND** return validation errors if conversion fails

### Requirement: Update Data Tool

The node SHALL provide an "Update Data" tool that allows AI agents to modify existing database records.

#### Scenario: Update with WHERE clause

- **WHEN** AI agent specifies columns to update and WHERE conditions
- **THEN** only rows matching the WHERE clause SHALL be updated
- **AND** the tool SHALL return count of affected rows

#### Scenario: Update all rows

- **WHEN** AI agent provides update values without WHERE clause
- **THEN** the tool SHALL require explicit confirmation or safety flag
- **AND** warn about potential data loss

#### Scenario: Update non-existent rows

- **WHEN** WHERE clause matches no rows
- **THEN** the tool SHALL return zero affected rows
- **AND** not throw an error

### Requirement: Delete Data Tool

The node SHALL provide a "Delete Data" tool that allows AI agents to remove records from database tables.

#### Scenario: Delete with WHERE clause

- **WHEN** AI agent specifies WHERE conditions for deletion
- **THEN** only matching rows SHALL be deleted
- **AND** the tool SHALL return count of deleted rows

#### Scenario: Delete all rows

- **WHEN** AI agent attempts to delete without WHERE clause
- **THEN** the tool SHALL require explicit safety confirmation
- **OR** reject the operation with a warning

#### Scenario: Truncate table

- **WHEN** AI agent explicitly requests table truncation
- **THEN** all rows SHALL be removed efficiently
- **AND** table structure SHALL remain intact

#### Scenario: Drop table

- **WHEN** AI agent requests table deletion with dropTable flag
- **THEN** the tool SHALL delete the entire table including structure
- **AND** require explicit confirmation

### Requirement: Execute Custom SQL Tool

The node SHALL provide an "Execute Query" tool that allows AI agents to run arbitrary SQL statements with parameter binding.

#### Scenario: Parameterized SELECT query

- **WHEN** AI agent provides SQL with placeholders (e.g., "SELECT \* FROM users WHERE id = $1")
- **AND** supplies parameter values
- **THEN** the tool SHALL execute the query with safe parameter binding
- **AND** return query results

#### Scenario: Data modification query

- **WHEN** AI agent executes INSERT/UPDATE/DELETE via custom SQL
- **THEN** the tool SHALL execute the statement
- **AND** return affected row count

#### Scenario: Multiple statements

- **WHEN** AI agent provides multiple SQL statements separated by semicolons
- **THEN** the tool SHALL execute them in sequence (if queryMode allows)
- **OR** reject multi-statement queries in single mode

#### Scenario: SQL injection prevention

- **WHEN** AI agent provides SQL with user-generated content
- **THEN** the tool SHALL only execute queries using parameter binding
- **AND** never allow string interpolation of user values

### Requirement: Tool Error Handling

All AI tools SHALL provide clear, actionable error messages when operations fail.

#### Scenario: Connection failure

- **WHEN** database connection fails
- **THEN** the tool SHALL return error message with connection details (without exposing credentials)
- **AND** suggest checking connection configuration

#### Scenario: Invalid table or column names

- **WHEN** AI agent references non-existent table or column
- **THEN** the tool SHALL return specific error identifying the invalid identifier
- **AND** optionally suggest similar valid names if available

#### Scenario: SQL syntax errors

- **WHEN** custom query has syntax errors
- **THEN** the tool SHALL return the database error message
- **AND** include the query (with parameters masked) for debugging

#### Scenario: Permission errors

- **WHEN** database user lacks necessary permissions
- **THEN** the tool SHALL return permission denied error
- **AND** specify which operation was denied

### Requirement: Tool Response Formatting

All AI tools SHALL return responses in a consistent, LLM-friendly format.

#### Scenario: Successful query response

- **WHEN** a query operation succeeds
- **THEN** response SHALL include:
  - `success: true`
  - `data`: array of result rows
  - `rowCount`: number of rows returned
  - Optional metadata (execution time, columns)

#### Scenario: Successful modification response

- **WHEN** an insert/update/delete succeeds
- **THEN** response SHALL include:
  - `success: true`
  - `affectedRows`: count of changed rows
  - `data`: inserted/updated rows (if available)

#### Scenario: Error response

- **WHEN** any operation fails
- **THEN** response SHALL include:
  - `success: false`
  - `error`: human-readable error message
  - `errorType`: categorized error type (connection, syntax, permission, etc.)
  - `details`: additional context (without sensitive data)

### Requirement: Tool Security

All AI tools SHALL maintain the same security standards as the regular node operations.

#### Scenario: Credential validation

- **WHEN** any tool is invoked
- **THEN** valid Neon database credentials MUST be present
- **AND** connection MUST use SSL

#### Scenario: Parameter sanitization

- **WHEN** tool receives input parameters
- **THEN** all values MUST be validated before use
- **AND** SQL injection attack vectors MUST be prevented via parameter binding

#### Scenario: Query result size limits

- **WHEN** query could return very large result sets
- **THEN** tool SHOULD apply reasonable limits (configurable)
- **AND** warn if results are truncated

#### Scenario: Operation timeouts

- **WHEN** a database operation takes too long
- **THEN** the tool SHALL timeout after a configurable duration
- **AND** return a timeout error to the AI agent
