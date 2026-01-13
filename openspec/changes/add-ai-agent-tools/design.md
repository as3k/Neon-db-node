# AI Agent Tools - Design Document

## Context

n8n supports AI agent workflows where LLMs can call tools to perform actions. The research shows n8n's approach is to create **dedicated tool nodes** (not just marking existing nodes with `usableAsTool: true`). Tools connect to AI Agent nodes via `NodeConnectionTypes.AiTool`.

**Key Findings from Research:**

- n8n converts nodes marked `usableAsTool` to LangChain-compatible tools
- Best practice: Create separate focused tool nodes (like HTTP Request Tool, Code Tool)
- Tools use `$fromAI()` pattern for LLM-populated parameters
- Community nodes may need `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` environment variable

## Goals

1. Create five separate tool nodes, one per database operation
2. Each tool provides focused, LLM-friendly parameter schemas
3. Maintain security (SQL injection prevention, SSL, parameter binding)
4. Provide clear error messages that help LLMs recover from failures
5. Format responses optimally for LLM consumption

## Non-Goals

- Not modifying the existing Neon workflow node (remains unchanged)
- Not creating a single multipurpose tool (violates n8n's focused-tool pattern)
- Not exposing schema introspection to tools initially (reduces attack surface)

## Decisions

### Decision 1: Separate Tool Nodes vs. Single Node with usableAsTool

**Chosen**: Create five separate tool nodes (SelectQueryTool, InsertDataTool, etc.)

**Rationale**:

- n8n's pattern: Dedicated tool nodes (HTTP Request Tool, Code Tool, Call Workflow Tool)
- Simpler for LLMs: Each tool has single purpose with focused parameters
- Better descriptions: Each can have operation-specific guidance
- Clearer validation: Operation-specific parameter requirements
- Follows principle of least privilege: Tools only expose what they need

**Alternatives considered**:

- Single node with `usableAsTool.replacements`: Would still present complex operation selection to LLM
- Multiple tools from one node via conditional logic: Not supported by n8n's tool architecture

**Evidence**:

- n8n built-in tools are all single-purpose nodes
- Librarian research shows `usableAsTool.replacements` are for tweaking descriptions, not multi-tool exposure

### Decision 2: Tool Node Architecture

**Structure**:

```
nodes/Neon/tools/
├── SelectQueryTool.node.ts
├── InsertDataTool.node.ts
├── UpdateDataTool.node.ts
├── DeleteDataTool.node.ts
├── ExecuteSqlTool.node.ts
└── shared/
    ├── types.ts              # Shared interfaces
    ├── credentials.ts        # Credential helper
    ├── validators.ts         # Input validation
    ├── formatters.ts         # Response formatting
    └── errors.ts             # Error handling
```

**Each tool node will**:

- Implement `INodeType` interface
- Define inputs: `[NodeConnectionTypes.Main]` (optional, for context)
- Define outputs: `[NodeConnectionTypes.AiTool]`
- Reference `neonApi` credentials
- Include focused `properties` array for that operation only
- Reuse existing operation logic from `actions/operations/`

### Decision 3: Parameter Schema Design

**Pattern**: Use natural language parameter names with clear descriptions

**Example (Select Query Tool)**:

```typescript
properties: [
	{
		displayName: 'Table Name',
		name: 'tableName',
		type: 'string',
		default: '',
		description: 'The name of the database table to query',
		required: true,
	},
	{
		displayName: 'Columns to Select',
		name: 'columns',
		type: 'string',
		default: '*',
		description: 'Comma-separated column names, or * for all columns. Example: id,name,email',
	},
	{
		displayName: 'Filter Conditions',
		name: 'whereConditions',
		type: 'string',
		default: '',
		description: "SQL WHERE clause conditions. Example: age > 18 AND status = 'active'",
	},
	// ... more focused parameters
];
```

**Using `$fromAI()`**: Allow LLMs to populate parameters dynamically based on research docs pattern

### Decision 4: Schema/Table Discovery

**Chosen**: Do NOT expose schema introspection methods to tool nodes initially

**Rationale**:

- Security: Reduces information disclosure
- Simplicity: Tools require explicit table names (forces AI to know schema)
- Future extension: Can add discovery tool later if needed

**Trade-off**: AI agents must be told table names in system prompts or via RAG

### Decision 5: Response Format

**Chosen**: Structured JSON responses with success/error/data fields

**Format**:

```typescript
// Success response (query)
{
  success: true,
  operation: 'select',
  table: 'users',
  rowCount: 42,
  data: [ /* array of row objects */ ],
  executionTime: '15ms'
}

// Success response (modification)
{
  success: true,
  operation: 'insert',
  table: 'users',
  affectedRows: 3,
  data: [ /* inserted rows with IDs */ ]
}

// Error response
{
  success: false,
  operation: 'update',
  error: 'Column "age" does not exist',
  errorType: 'invalid_column',
  suggestion: 'Available columns: id, name, email, created_at',
  sqlState: '42703'
}
```

**Rationale**: Consistent structure helps LLMs understand results and handle errors

### Decision 6: Security Patterns

**Mandatory patterns**:

1. **Always use parameter binding**: Never string concatenation
2. **SSL enforced**: Inherit from existing Neon node behavior
3. **Input validation**: Validate all parameters before execution
4. **Query timeouts**: Prevent long-running queries
5. **Result limits**: Default max rows (e.g., 1000) with override option
6. **Sanitize errors**: Don't leak credentials in error messages

**Example implementation**:

```typescript
// GOOD: Parameter binding
const query = 'SELECT * FROM users WHERE id = $1';
await db.any(query, [userId]);

// BAD: Never do this (string interpolation)
const query = `SELECT * FROM users WHERE id = ${userId}`;
```

### Decision 7: Error Handling for LLMs

**Pattern**: Categorized errors with recovery suggestions

**Error categories**:

- `connection_error`: Database unreachable
- `authentication_error`: Credential issues
- `invalid_table`: Table doesn't exist
- `invalid_column`: Column doesn't exist
- `syntax_error`: SQL syntax problem
- `constraint_violation`: Unique/foreign key violations
- `permission_denied`: Insufficient privileges
- `timeout`: Query too slow

**Each error includes**:

- Human-readable message
- Error type category
- Recovery suggestion when possible
- SQL state code (for debugging)
- No sensitive data (credentials, full queries)

## Risks / Trade-offs

### Risk: LLM provides malformed SQL

**Mitigation**:

- Strict parameter validation before execution
- Use parameterized queries exclusively
- Validate WHERE clauses against safe patterns
- Provide clear error messages to guide correction

### Risk: Accidental data deletion

**Mitigation**:

- Delete Tool requires explicit WHERE clause (reject empty conditions)
- Add confirmation patterns for TRUNCATE/DROP operations
- Log all modification operations
- Consider dry-run mode for updates/deletes

### Risk: Performance issues from unbounded queries

**Mitigation**:

- Default LIMIT on all SELECT queries
- Query timeout configuration
- Warn when limit exceeded
- Consider pagination for large result sets

### Risk: Information disclosure via error messages

**Mitigation**:

- Sanitize all error messages
- Don't include full queries in errors
- Mask parameter values
- Don't expose internal database structure unnecessarily

## Migration Plan

### Phase 1: Development

1. Create tool node files (5 nodes)
2. Implement shared utilities
3. Write unit tests
4. Local testing with AI Agent node

### Phase 2: Testing

1. Integration tests with various AI agent scenarios
2. Security audit (injection attempts, boundary conditions)
3. Performance testing (query timeouts, large results)
4. Error handling coverage

### Phase 3: Documentation

1. Update README with tool usage examples
2. Create AI Agent workflow examples
3. Document tool schemas and parameters
4. Add troubleshooting guide

### Phase 4: Release

1. Register tool nodes in package.json
2. Update version and changelog
3. Publish to npm
4. Document environment variable requirement if needed

### Rollback Plan

- Tools are additive; removal doesn't affect existing workflows
- Can deprecate tool nodes in future version if needed
- No data migration required

## Open Questions

1. **Should we expose UPSERT as a separate tool?**
   - Pro: Useful operation for AI agents (insert-or-update pattern)
   - Con: Adds complexity, not commonly understood by LLMs
   - Decision: Add in v2 if there's demand

2. **Should Execute Query Tool allow multi-statement queries?**
   - Pro: More flexible for complex operations
   - Con: Security risk, harder to validate
   - Recommendation: Start with single-statement only, add flag later if needed

3. **Result set size limits?**
   - Default: 1000 rows max
   - Configurable: Yes, via tool parameter
   - Hard limit: 10,000 rows (prevent memory issues)

4. **Should tools support transactions?**
   - Not initially: Adds complexity
   - Future: Could add "begin transaction" / "commit" / "rollback" tools
   - Current approach: Each tool operation is atomic

5. **How to handle schema evolution?**
   - Tools don't cache schema information
   - Each query is validated against current schema
   - AI agents should handle "column not found" errors gracefully
