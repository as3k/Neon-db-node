# AI Agent Tools - Manual Testing Guide

## Prerequisites

1. **n8n Instance**: Running n8n (version 1.0.0+)
2. **Environment Variable**: `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`
3. **Neon Database**: Active Neon PostgreSQL database with test data
4. **Package Installed**: This package installed in n8n

## Setup

### 1. Configure n8n

```bash
# Set environment variable
export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true

# Start n8n (if self-hosted)
n8n start

# Or add to .env file
echo "N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true" >> .env
```

### 2. Install Package

**Option A: Local Testing**

```bash
# In this package directory
npm run build
npm link

# In n8n directory
npm link n8n-nodes-neon
```

**Option B: From npm**

```bash
# In n8n UI: Settings > Community Nodes > Install
# Enter: n8n-nodes-neon
```

### 3. Create Test Database Schema

```sql
CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  message TEXT,
  level VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert test data
INSERT INTO users (email, name, active) VALUES
  ('alice@example.com', 'Alice Smith', true),
  ('bob@example.com', 'Bob Jones', true),
  ('charlie@example.com', 'Charlie Brown', false);
```

## Test Cases

### Test 1: Neon Select Query Tool

**Objective**: Verify basic SELECT queries work with AI Agent

**Workflow Setup**:

1. Add AI Agent node
2. Connect Neon Select Query Tool
3. Configure Neon credentials

**AI Agent Prompt**:

```
Find all active users and show their email and name
```

**Expected Tool Parameters**:

```json
{
	"schema": "public",
	"table": "users",
	"columns": "email, name",
	"whereConditions": "active = true",
	"limit": 100
}
```

**Expected Response**:

```json
{
	"success": true,
	"operation": "select",
	"table": "users",
	"rowCount": 2,
	"data": [
		{ "email": "alice@example.com", "name": "Alice Smith" },
		{ "email": "bob@example.com", "name": "Bob Jones" }
	],
	"columns": ["email", "name"],
	"executionTime": "45ms",
	"truncated": false
}
```

**Validation**:

- [ ] Tool appears in AI Agent tool list
- [ ] Tool invoked successfully
- [ ] Response format matches spec
- [ ] Data correctly filtered
- [ ] Execution time present

---

### Test 2: Neon Insert Data Tool

**Objective**: Verify record insertion with type handling

**AI Agent Prompt**:

```
Create a new user with email dave@example.com, name Dave Wilson, and mark them as active
```

**Expected Tool Parameters**:

```json
{
	"schema": "public",
	"table": "users",
	"data": {
		"email": "dave@example.com",
		"name": "Dave Wilson",
		"active": true
	},
	"returnData": true
}
```

**Expected Response**:

```json
{
	"success": true,
	"operation": "insert",
	"table": "users",
	"affectedRows": 1,
	"data": [
		{
			"id": 4,
			"email": "dave@example.com",
			"name": "Dave Wilson",
			"active": true,
			"created_at": "2024-01-15T10:30:00.000Z"
		}
	]
}
```

**Validation**:

- [ ] Record created in database
- [ ] ID assigned correctly
- [ ] Types handled properly (boolean, timestamp)
- [ ] Response includes inserted data
- [ ] Verify with manual SELECT

---

### Test 3: Neon Update Data Tool

**Objective**: Verify safe updates with WHERE validation

**AI Agent Prompt**:

```
Update the user dave@example.com to set active = false
```

**Expected Tool Parameters**:

```json
{
	"schema": "public",
	"table": "users",
	"values": {
		"active": false
	},
	"whereConditions": "email = 'dave@example.com'",
	"returnData": true
}
```

**Expected Response**:

```json
{
	"success": true,
	"operation": "update",
	"table": "users",
	"affectedRows": 1,
	"data": [
		{
			"id": 4,
			"email": "dave@example.com",
			"name": "Dave Wilson",
			"active": false,
			"created_at": "2024-01-15T10:30:00.000Z"
		}
	]
}
```

**Validation**:

- [ ] Only specified record updated
- [ ] WHERE clause enforced
- [ ] Updated data returned
- [ ] Other records unchanged

---

### Test 4: Neon Delete Data Tool

**Objective**: Verify deletion with safety confirmations

**Test 4a: Delete with WHERE clause**

**AI Agent Prompt**:

```
Delete the user with email dave@example.com
```

**Expected Tool Parameters**:

```json
{
	"schema": "public",
	"table": "users",
	"mode": "delete",
	"whereConditions": "email = 'dave@example.com'"
}
```

**Test 4b: Truncate (should require confirmation)**

**AI Agent Prompt**:

```
Truncate the logs table
```

**Expected Tool Parameters**:

```json
{
	"schema": "public",
	"table": "logs",
	"mode": "truncate",
	"confirmDestructive": true
}
```

**Validation**:

- [ ] Delete mode works with WHERE
- [ ] Truncate requires confirmation
- [ ] Error if confirmation missing
- [ ] DROP mode requires confirmation

---

### Test 5: Neon Execute SQL Tool

**Objective**: Verify custom SQL with injection prevention

**Test 5a: Valid Query**

**AI Agent Prompt**:

```
Run a query to get user count by active status
```

**Expected Tool Parameters**:

```json
{
	"query": "SELECT active, COUNT(*) as count FROM users GROUP BY active",
	"queryMode": "single"
}
```

**Test 5b: Injection Attempt (should fail)**

**Manual Test**: Try to inject SQL

```json
{
	"query": "SELECT * FROM users; DROP TABLE users",
	"queryMode": "single"
}
```

**Expected Response**: Error

```json
{
	"success": false,
	"operation": "executeQuery",
	"error": "Multiple SQL statements in one query are not allowed",
	"errorType": "validation_error"
}
```

**Validation**:

- [ ] Valid queries execute
- [ ] Multiple statements blocked
- [ ] DROP/TRUNCATE/ALTER blocked
- [ ] SQL comments rejected
- [ ] Parameter binding works

---

### Test 6: Error Handling

**Objective**: Verify LLM-friendly error messages

**Test 6a: Invalid Table**

**Parameters**:

```json
{
	"schema": "public",
	"table": "nonexistent_table",
	"columns": "*"
}
```

**Expected Response**:

```json
{
	"success": false,
	"operation": "select",
	"table": "nonexistent_table",
	"error": "relation \"public.nonexistent_table\" does not exist",
	"errorType": "invalid_table",
	"suggestion": "Check that the table name is correct and exists in the specified schema.",
	"sqlState": "42P01"
}
```

**Test 6b: Invalid Column**

**Test 6c: Constraint Violation (unique)**

**Test 6d: Permission Denied**

**Validation**:

- [ ] Error categorized correctly
- [ ] Recovery suggestion provided
- [ ] SQL state code included
- [ ] No credential leakage
- [ ] Timestamp present

---

### Test 7: Complex AI Scenarios

**Test 7a: Multi-step workflow**

**AI Agent Prompt**:

```
1. Find all inactive users
2. For each inactive user, create a log entry with message "User inactive check"
3. Count total log entries created
```

**Expected Behavior**: AI Agent chains multiple tool calls

**Test 7b: Natural language filtering**

**AI Agent Prompt**:

```
Show me users created in the last 7 days who are active
```

**Expected Tool Translation**: Converts to proper WHERE clause

**Validation**:

- [ ] Multi-tool workflows execute
- [ ] Context maintained between calls
- [ ] Natural language translated correctly
- [ ] Edge cases handled

---

## Validation Checklist

### Integration

- [ ] All 5 tools appear in n8n AI Agent tool picker
- [ ] Tools have proper icons (neon.svg)
- [ ] Tool descriptions are clear and LLM-friendly
- [ ] Credentials work with all tools

### Functionality

- [ ] SELECT queries return correct data
- [ ] INSERT creates records properly
- [ ] UPDATE modifies only intended records
- [ ] DELETE requires WHERE or confirmation
- [ ] Execute SQL validates queries

### Security

- [ ] SQL injection patterns blocked
- [ ] Dangerous operations require confirmation
- [ ] Parameter binding enforced
- [ ] No credential exposure in errors
- [ ] Input validation working

### Performance

- [ ] Execution time tracked
- [ ] Large result sets truncated
- [ ] Queries complete within timeout
- [ ] Response times acceptable

### Error Handling

- [ ] All 10 error types tested
- [ ] Recovery suggestions helpful
- [ ] Errors don't break workflow
- [ ] LLM can understand errors

### AI Agent Compatibility

- [ ] Tools invoked by natural language
- [ ] Parameters mapped correctly
- [ ] Responses parseable by LLM
- [ ] Multi-step workflows function
- [ ] Context preserved between calls

## Troubleshooting

### Tool Not Appearing

```bash
# Check environment variable
echo $N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE

# Restart n8n
n8n stop
export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
n8n start
```

### Connection Errors

- Verify Neon credentials
- Check database host/port
- Ensure SSL enabled
- Test with manual query node first

### Tool Invocation Fails

- Check n8n console logs
- Verify node registration in package.json
- Ensure build succeeded
- Check dist/ contains compiled nodes

### Parameter Validation Errors

- Review validator logic in shared/validators.ts
- Check error messages for guidance
- Verify input format matches schema

## Success Criteria

All tests pass when:

1. ✅ All 5 tools visible and invokable
2. ✅ CRUD operations work correctly
3. ✅ Security validations prevent injection
4. ✅ Error handling provides useful feedback
5. ✅ AI Agent can use natural language successfully
6. ✅ Multi-step workflows execute properly
7. ✅ Performance metrics tracked
8. ✅ No breaking changes to existing workflows

## Reporting Results

After completing tests, document:

- n8n version tested
- Node.js version
- Database version
- Test results (pass/fail for each)
- Any issues encountered
- Performance observations
- Suggested improvements

Save results to: `openspec/changes/add-ai-agent-tools/TEST_RESULTS.md`
