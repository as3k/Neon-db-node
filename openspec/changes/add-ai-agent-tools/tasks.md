## 1. Research & Design

- [x] 1.1 Review n8n AI Agent tool integration patterns from librarian research results
- [x] 1.2 Examine existing n8n nodes with AI tool support (e.g., HTTP Request, Code, built-in tools)
- [x] 1.3 Design tool schema structure for each operation (Select, Insert, Update, Delete, Execute Query)
- [x] 1.4 Define parameter mappings from tool inputs to operation parameters
- [x] 1.5 Design consistent response format for all tools

## 2. Core Tool Infrastructure

- [x] 2.1 Create `nodes/Neon/tools/` directory structure
- [x] 2.2 Create base tool interface/types in `nodes/Neon/tools/types.ts`
- [x] 2.3 Implement tool registry system to expose available tools
- [x] 2.4 Add tool metadata generator (name, description, schema for each operation)
- [x] 2.5 Implement tool parameter validation layer

## 3. Select Query Tool

- [x] 3.1 Create tool schema for Select operation in `nodes/Neon/tools/select.tool.ts`
- [x] 3.2 Add parameter definitions: table, columns, where, sort, limit
- [x] 3.3 Implement tool-to-operation adapter that converts tool params to node params
- [x] 3.4 Add response formatter for query results (LLM-friendly format)
- [x] 3.5 Write natural language description optimized for LLM understanding

## 4. Insert Data Tool

- [x] 4.1 Create tool schema for Insert operation in `nodes/Neon/tools/insert.tool.ts`
- [x] 4.2 Add parameter definitions: table, rows (single or array), options
- [x] 4.3 Implement type coercion logic for AI-provided values
- [x] 4.4 Add response formatter returning inserted rows
- [x] 4.5 Handle conflict resolution (skipOnConflict) in tool parameters

## 5. Update Data Tool

- [x] 5.1 Create tool schema for Update operation in `nodes/Neon/tools/update.tool.ts`
- [x] 5.2 Add parameter definitions: table, values, where conditions
- [x] 5.3 Add safety checks for update-all scenarios (missing WHERE clause)
- [x] 5.4 Implement response formatter with affected row count
- [x] 5.5 Add validation for WHERE clause requirement

## 6. Delete Data Tool

- [x] 6.1 Create tool schema for Delete operation in `nodes/Neon/tools/delete.tool.ts`
- [x] 6.2 Add parameter definitions: table, where, mode (delete/truncate/drop)
- [x] 6.3 Implement safety confirmations for destructive operations
- [x] 6.4 Add response formatter with deletion statistics
- [x] 6.5 Handle different deletion modes (row delete, truncate, drop table)

## 7. Execute Query Tool

- [x] 7.1 Create tool schema for Execute Query in `nodes/Neon/tools/executeQuery.tool.ts`
- [x] 7.2 Add parameter definitions: query, parameters (for $1, $2, etc.), options
- [x] 7.3 Implement SQL injection prevention validation
- [x] 7.4 Add support for multiple query modes (single, transaction, independent)
- [x] 7.5 Create dual response format (query results vs modification stats)

## 8. Error Handling & Messaging

- [x] 8.1 Create error categorization system (connection, syntax, permission, validation)
- [x] 8.2 Implement LLM-friendly error message formatter
- [x] 8.3 Add error recovery suggestions in error responses
- [x] 8.4 Ensure no credential leakage in error messages
- [x] 8.5 Add debugging context (query with masked params) for troubleshooting

## 9. Security & Validation

- [x] 9.1 Audit all tool inputs for SQL injection vectors
- [x] 9.2 Implement parameter binding enforcement (no string interpolation)
- [x] 9.3 Add result size limits and truncation handling
- [x] 9.4 Implement operation timeouts for long-running queries
- [x] 9.5 Add rate limiting considerations (if applicable)

## 10. Integration & Node Updates

- [x] 10.1 Update `Neon.node.ts` to register tool definitions
- [x] 10.2 Add tool invocation routing in execute() method
- [x] 10.3 Ensure backward compatibility with existing workflow usage
- [x] 10.4 Update node description with tool capabilities
- [x] 10.5 Test tool invocation from AI Agent node

## 11. Testing

- [x] 11.1 Write unit tests for each tool schema
- [x] 11.2 Write integration tests for tool invocation flow
- [x] 11.3 Test parameter validation and error cases
- [x] 11.4 Test security scenarios (injection attempts, invalid inputs)
- [ ] 11.5 Test with actual AI Agent node workflows
- [x] 11.6 Test all tool response formats

## 12. Documentation

- [x] 12.1 Update README.md with AI Agent tool capabilities
- [x] 12.2 Add examples of using each tool with AI Agent node
- [x] 12.3 Document tool schemas and parameters
- [x] 12.4 Add troubleshooting guide for common AI agent scenarios
- [x] 12.5 Update CHANGELOG with new feature

## 13. Validation & Polish

- [x] 13.1 Run `openspec validate add-ai-agent-tools --strict`
- [x] 13.2 Run full test suite (`npm test`)
- [x] 13.3 Run linter (`npm run lint`)
- [ ] 13.4 Test in local n8n instance with AI Agent workflows
- [ ] 13.5 Verify no breaking changes to existing workflows
