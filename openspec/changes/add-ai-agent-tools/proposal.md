# Change: Add AI Agent Tools Support

## Why

The Neon node currently has `usableAsTool: true` which makes the entire node available as a single monolithic tool to AI agents. However, this approach presents the agent with ALL operations and parameters at once, making it difficult for LLMs to:

- Understand when to use which operation
- Provide the correct parameters for each operation type
- Receive clear, operation-specific guidance

Based on research of n8n's AI tool architecture, the best practice is to create **separate tool nodes** for each operation (similar to how n8n provides HTTP Request Tool, Code Tool, etc.), rather than exposing a single multipurpose node.

**Current State:**

- Node is marked `usableAsTool: true` but presents a confusing multi-operation interface
- AI agents must navigate resource/operation selection which is designed for human UI interaction
- Parameter schemas mix all operations together

**Desired State:**

- Create individual tool sub-nodes: Select Tool, Insert Tool, Update Tool, Delete Tool, Execute Query Tool
- Each tool has focused parameters and clear natural language descriptions
- Tools connect to AI Agent nodes via `NodeConnectionTypes.AiTool`
- Each tool provides operation-specific validation and LLM-optimized responses

## What Changes

**New Tool Nodes** (5 separate `.node.ts` files):

- Create dedicated tool node for each operation following n8n's tool sub-node pattern
- Each tool uses `NodeConnectionTypes.AiTool` output type
- Tools accept `NodeConnectionTypes.Main` input for optional context
- All tools share Neon database credentials

**Tool-Specific Adaptations:**

- **Select Query Tool**: Query tables with natural language filter descriptions
- **Insert Data Tool**: Add records with automatic type coercion from LLM-provided values
- **Update Data Tool**: Modify records with safety guards for mass updates
- **Delete Data Tool**: Remove records with confirmation patterns for destructive operations
- **Execute SQL Tool**: Run custom queries with enhanced parameter binding visibility

**Infrastructure:**

- Create `nodes/Neon/tools/` directory for tool nodes
- Implement shared utilities for credential handling, parameter validation, response formatting
- Add tool-specific descriptions optimized for LLM comprehension (using `$fromAI()` pattern)
- Each tool maintains same security standards (SSL, parameter binding, input validation)

## Impact

**Affected specs**: New capability `ai-tools` (no existing specs to modify)

**Affected code**:

- **New files**: Five tool node files in `nodes/Neon/tools/`:
  - `SelectQueryTool.node.ts`
  - `InsertDataTool.node.ts`
  - `UpdateDataTool.node.ts`
  - `DeleteDataTool.node.ts`
  - `ExecuteSqlTool.node.ts`
- **Shared utilities**: `nodes/Neon/tools/shared/` for common formatting, validation, error handling
- **Package.json**: Register new tool nodes in `n8n.nodes` array
- **Main node**: Optionally update `Neon.node.ts` to remove `usableAsTool: true` (tools replace it)

**Breaking changes**: None

- Existing Neon node workflows continue working unchanged
- New tool nodes are separate additions
- Users can choose between workflow node or tool nodes

**Migration required**: No

- Tool nodes are opt-in
- Existing workflows unaffected

**Testing required**:

- Unit tests for each tool node
- Integration tests with AI Agent node
- Security validation (injection prevention)
- Parameter validation edge cases
- Error handling scenarios

**Environment variable**:

- Community node tool usage may require `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` in deployment environments

## Benefits

- Enable AI agents to autonomously interact with Neon databases
- Provide natural language interface to database operations
- Improve n8n AI Agent capabilities with persistent data storage
- Allow conversational data manipulation workflows
- Maintain full security through parameterized queries

## Risks

- Tool descriptions must be clear enough for LLMs to use correctly
- Parameter validation becomes critical (AI agents may provide unexpected inputs)
- Need to ensure SQL injection protection remains intact
- Tool response formats must be structured for LLM comprehension
