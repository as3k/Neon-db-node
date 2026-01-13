![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-neon

This is an n8n community node. It lets you use Neon Database in your n8n workflows.

Neon is a serverless PostgreSQL database that automatically scales to zero and provides instant branching. This node enables you to perform CRUD operations, execute custom SQL queries, and integrate Neon databases directly into your n8n automation workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[AI Agent Tools](#ai-agent-tools)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[AI Agent Tools Usage](#ai-agent-tools-usage)  
[Resources](#resources)  
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

**Quick Installation:**

1. In your n8n instance, go to Settings > Community Nodes
2. Click "Install a community node"
3. Enter: `n8n-nodes-neon`
4. Click Install

## Operations

The Neon node provides comprehensive database operations:

### Core CRUD Operations

- **INSERT** - Insert new records with auto-mapping or manual column mapping
- **SELECT** - Query data with filtering, sorting, and column selection
- **UPDATE** - Update existing records with multi-column matching
- **DELETE** - Delete records, truncate tables, or drop tables entirely

### Advanced Features

- **Execute Query** - Run custom SQL queries with parameter binding
- **Schema Introspection** - Automatic discovery of schemas, tables, and columns
- **Parameterized Queries** - Secure SQL execution preventing injection attacks
- **Execution Modes** - Single, Transaction, and Independent execution strategies

### AI Agent Tools

The Neon node includes five dedicated AI Agent tools that enable LLMs to autonomously interact with your Neon databases. These tools are optimized for natural language processing and provide LLM-friendly responses.

**Available Tools:**

- **Neon Select Query Tool** - Query data with natural language filtering and sorting
- **Neon Insert Data Tool** - Insert records with automatic type handling
- **Neon Update Data Tool** - Update records with safety validations
- **Neon Delete Data Tool** - Delete operations with destructive action confirmations
- **Neon Execute SQL Tool** - Run custom SQL with injection prevention

**Features:**

- LLM-optimized parameter descriptions and error messages
- Automatic SQL injection prevention
- Structured JSON responses with success indicators
- Error categorization with recovery suggestions
- Parameter validation and type coercion

See the [AI Agent Tools](#ai-agent-tools-usage) section below for usage examples.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

Create, Read, Update, Delete operations for database rows, plus custom SQL query execution with parameter binding. The node also provides dynamic schema introspection for automatic table and column discovery.

## Credentials

To use this node, you need a Neon database account and connection details.

**Prerequisites:**

1. Sign up for a [Neon account](https://neon.tech/)
2. Create a new project and database
3. Note your connection details

**Required connection parameters:**

- **Host** - Your Neon database host (e.g., `ep-xxx-pooler.region.aws.neon.tech`)
- **Port** - Database port (default: 5432)
- **Database** - Database name
- **Username** - Database username
- **Password** - Database password
- **SSL** - SSL mode (required for Neon)

The node enforces SSL connections for security and uses parameter binding to prevent SQL injection.

## Compatibility

- **Minimum n8n version**: 1.0.0
- **Tested with**: n8n 1.104.2 (Self Hosted)
- **Node.js**: 20+ (required by n8n)
- **Database**: Neon PostgreSQL (compatible with PostgreSQL 15+)

## Usage

### Basic Node Usage

Add the Neon node to your workflow, configure your database credentials using the "Test Connection" button, and select your operation. The node automatically discovers your database schema and provides dynamic table and column selection.

For custom SQL queries, use the "Execute Query" operation with parameter binding:

```sql
SELECT * FROM users WHERE active = true
INSERT INTO logs (message, timestamp) VALUES ($1, $2)
UPDATE products SET price = $1 WHERE id = $2
```

### AI Agent Tools Usage

Use Neon AI Agent tools in your n8n workflows with the AI Agent node to give LLMs autonomous database access.

**Important**: To use AI Agent tools with community nodes, set this environment variable in your n8n instance:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

#### Example 1: Query Data with Natural Language

Connect the **Neon Select Query Tool** to an AI Agent node. The LLM can query your database using natural language instructions:

**AI Agent prompt**: "Find all active users created in the last 30 days, sorted by email"

**Tool parameters automatically generated:**

```json
{
	"schema": "public",
	"table": "users",
	"columns": "*",
	"whereConditions": "active = true AND created_at > NOW() - INTERVAL '30 days'",
	"sortBy": "email",
	"sortDirection": "ASC",
	"limit": 100
}
```

**Response format:**

```json
{
  "success": true,
  "operation": "select",
  "table": "users",
  "rowCount": 42,
  "data": [...],
  "columns": ["id", "email", "active", "created_at"],
  "executionTime": "45ms",
  "truncated": false
}
```

#### Example 2: Insert Records with Type Coercion

Use the **Neon Insert Data Tool** for creating records. The tool handles JSON parsing and type conversion automatically:

**AI Agent prompt**: "Create a new user with email john@example.com and mark them as active"

**Tool parameters:**

```json
{
	"schema": "public",
	"table": "users",
	"data": {
		"email": "john@example.com",
		"active": true,
		"created_at": "2024-01-15T10:30:00Z"
	},
	"returnData": true
}
```

**Response:**

```json
{
	"success": true,
	"operation": "insert",
	"table": "users",
	"affectedRows": 1,
	"data": [
		{
			"id": 123,
			"email": "john@example.com",
			"active": true,
			"created_at": "2024-01-15T10:30:00Z"
		}
	]
}
```

#### Example 3: Update with Safety Checks

The **Neon Update Data Tool** requires WHERE conditions to prevent accidental mass updates:

**AI Agent prompt**: "Update the user with email john@example.com to set active = false"

**Tool parameters:**

```json
{
	"schema": "public",
	"table": "users",
	"values": {
		"active": false,
		"updated_at": "NOW()"
	},
	"whereConditions": "email = 'john@example.com'",
	"returnData": true
}
```

**Note**: If `whereConditions` is empty, the tool returns a validation error preventing mass updates.

#### Example 4: Safe Deletion with Modes

The **Neon Delete Data Tool** supports multiple deletion modes with confirmations:

**Delete specific rows:**

```json
{
	"schema": "public",
	"table": "logs",
	"mode": "delete",
	"whereConditions": "created_at < NOW() - INTERVAL '90 days'"
}
```

**Truncate table** (requires confirmation):

```json
{
	"schema": "public",
	"table": "temp_data",
	"mode": "truncate",
	"confirmDestructive": true
}
```

**Drop table** (requires confirmation):

```json
{
	"schema": "public",
	"table": "old_table",
	"mode": "drop",
	"confirmDestructive": true
}
```

#### Example 5: Custom SQL with Injection Prevention

The **Neon Execute SQL Tool** validates queries to prevent dangerous operations:

**AI Agent prompt**: "Run a complex join query to get user statistics"

**Tool parameters:**

```json
{
	"query": "SELECT u.email, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.active = $1 GROUP BY u.email",
	"parameters": [true],
	"queryMode": "single"
}
```

**Blocked patterns** (returns error):

- `DROP`, `TRUNCATE`, `ALTER` statements
- Multiple statements (unless using transaction mode)
- SQL injection patterns

#### Error Handling

All tools return structured errors with recovery suggestions:

**Example error response:**

```json
{
	"success": false,
	"operation": "select",
	"table": "users",
	"error": "relation \"public.users\" does not exist",
	"errorType": "invalid_table",
	"suggestion": "Check that the table name is correct and exists in the specified schema.",
	"sqlState": "42P01",
	"details": {
		"timestamp": "2024-01-15T10:30:00.000Z"
	}
}
```

**Error types:**

- `connection_error` - Database connectivity issues
- `authentication_error` - Invalid credentials
- `invalid_table` - Table not found
- `invalid_column` - Column not found
- `syntax_error` - SQL syntax problems
- `constraint_violation` - Unique/foreign key violations
- `permission_denied` - Insufficient privileges
- `timeout` - Query execution timeout
- `validation_error` - Invalid parameters
- `unknown_error` - Other errors

#### Best Practices

1. **Always use WHERE conditions** for UPDATE and DELETE operations
2. **Enable `returnData`** when you need to see inserted/updated records
3. **Set appropriate `limit`** values to prevent large result sets
4. **Use parameter binding** with Execute SQL Tool (avoid string concatenation)
5. **Review error suggestions** for troubleshooting guidance
6. **Test destructive operations** with confirmations before automating

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Neon Database documentation](https://neon.tech/docs)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [n8n Postgres node reference](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Postgres)

## Version history

**v1.0.0** - Initial release with basic CRUD operations, custom SQL queries, and schema introspection.

## License

[MIT](https://github.com/n8n-io/n8n-nodes-starter/blob/master/LICENSE.md)
