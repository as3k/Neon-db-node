# Project Context

## Purpose

This is an n8n community node that enables integration between n8n workflows and Neon Database (serverless PostgreSQL). The node provides CRUD operations, custom SQL query execution, and automatic schema introspection for workflow automation scenarios.

**Key Goals:**

- Provide seamless Neon Database integration within n8n workflows
- Support all standard database operations (SELECT, INSERT, UPDATE, DELETE, custom queries)
- Enable secure, parameterized SQL execution to prevent injection attacks
- Automatic schema discovery for user-friendly dynamic dropdowns
- Follow n8n community node best practices and conventions

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.8+ (strict mode enabled)
- **Framework**: n8n workflow automation platform (v1.0.0+)
- **Database**: PostgreSQL via `pg` and `pg-promise` libraries
- **Build Tools**: TypeScript compiler, Gulp (for icon processing)
- **Testing**: Jest 30+ with ts-jest
- **Linting**: ESLint with n8n-nodes-base plugin
- **Formatting**: Prettier

## Project Conventions

### Code Style

**Formatting (enforced by Prettier):**

- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line structures
- Tabs for indentation (tab width: 2)
- Print width: 100 characters
- Arrow function parentheses: always
- Line endings: LF

**TypeScript:**

- Strict mode enabled with all strict flags
- No implicit `any` types
- Explicit return types where beneficial
- Use type imports: `import type { ... }`
- Target: ES2019
- Module: CommonJS (for n8n compatibility)

**Naming Conventions:**

- PascalCase for classes and interfaces (e.g., `INodeType`, `NeonNodeCredentials`)
- camelCase for variables, functions, and methods
- SCREAMING_SNAKE_CASE for constants
- File names match class names: `Neon.node.ts` for `Neon` class
- Credential files: `*.credentials.ts`
- Operation files: `*.operation.ts`

### Architecture Patterns

**n8n Node Structure:**

```
nodes/Neon/
├── Neon.node.ts              # Main node class with execute() method
├── neon.node.json            # Node metadata
├── actions/
│   └── operations/           # Separated operation files
│       ├── index.ts          # Aggregates operation descriptions
│       ├── select.operation.ts
│       ├── insert.operation.ts
│       ├── update.operation.ts
│       ├── delete.operation.ts
│       └── executeQuery.operation.ts
├── methods/                  # n8n lifecycle methods
│   ├── loadOptions.ts        # Dynamic dropdown loaders
│   ├── listSearch.ts         # Resource locator searches
│   ├── resourceMapping.ts    # Field mapping utilities
│   └── credentialTest.ts     # Connection validation
├── helpers/
│   ├── interface.ts          # Shared TypeScript interfaces
│   └── utils.ts              # Utility functions
└── transport/
    └── index.ts              # Database connection setup
```

**Separation of Concerns:**

- Main node file (`Neon.node.ts`) handles routing and credential fetching
- Operation files contain specific business logic (SELECT, INSERT, etc.)
- Transport layer manages database connections
- Methods directory provides n8n integration points
- No business logic in the main node execute() method

**Database Connection:**

- Use `pg-promise` for query execution
- SSL enforced for Neon connections
- Parameter binding for all user inputs (prevents SQL injection)
- Connection pooling handled by pg-promise
- Transactions supported via `queryMode` options

**Error Handling:**

- Use n8n's `NodeOperationError` for user-facing errors
- Include context (operation, resource) in error messages
- Validate inputs before database operations
- Graceful handling of connection failures

### Testing Strategy

- Jest as test runner with ts-jest for TypeScript
- Test files colocated with source (when present)
- Coverage tracking enabled (`jest --coverage`)
- Watch mode available for development (`npm run test:watch`)
- Tests should cover:
  - Operation logic (CRUD operations)
  - Parameter validation
  - Error scenarios
  - SQL query generation

### Git Workflow

- Standard git workflow (no specific branching strategy documented)
- Conventional commits preferred (inferred from changelog format)
- Pre-publish checks: build, lint, tests must pass
- Version bumps require changelog updates

## Domain Context

### n8n Platform Knowledge

- **Node Lifecycle**: Nodes implement `INodeType` interface with `description` and `execute()` method
- **Parameters**: Node behavior configured via `properties` array in description
- **Credentials**: Separate credential classes with `testedBy` validation
- **Resource/Operation Pattern**: Two-level selection (Resource → Operation)
- **Dynamic UI**: `loadOptions`, `listSearch`, `resourceMapping` enable dynamic dropdowns
- **Execution Context**: Use `this` context in execute() to access n8n APIs
- **Items Processing**: Input comes as `INodeExecutionData[]`, output must match format

### Neon Database Specifics

- Serverless PostgreSQL with automatic scaling
- SSL required for all connections
- Connection pooling important for serverless efficiency
- Instant branching feature (not yet exposed in node)
- Compatible with standard PostgreSQL 15+ features
- Parameterized queries use `$1, $2, ...` placeholder syntax

### n8n Community Node Requirements

- Must have `n8n-community-node-package` in package.json keywords
- Follow n8n-nodes-base ESLint rules (enforced via plugin)
- Icon must be SVG format
- Credentials must have documentation URL and test function
- Operations must have `action` descriptions for better UX
- Node must be usable as AI tool (`usableAsTool: true`)

## Important Constraints

### Technical Constraints

- **Node.js Version**: 20.15+ (enforced by engines field)
- **n8n Compatibility**: Must support n8n API version 1
- **Module Format**: CommonJS (n8n requirement)
- **No Frontend Dependencies**: Node runs in backend only
- **Synchronous Patterns**: n8n prefers Promise-based async, avoid callbacks

### Security Constraints

- **Always use parameterized queries** - NEVER string concatenation for SQL
- **SSL enforced** for Neon connections
- **No credential leakage** in error messages
- **Validate all user inputs** before database operations
- **No arbitrary code execution** from user inputs

### n8n Constraints

- Errors must be thrown as `NodeOperationError` with node context
- Parameters must have `displayName`, `name`, `type`, and usually `default`
- Resource/operation pattern strongly recommended for CRUD nodes
- Credential class name must match credential reference + 'Api' suffix
- No breaking changes without major version bump

### Publishing Constraints

- Package name must start with `n8n-nodes-`
- Must build successfully before publish (`npm run build`)
- Must pass ESLint rules from `.eslintrc.prepublish.js`
- Files whitelist: only `dist/` directory published
- Must have valid n8n section in package.json

## External Dependencies

### Runtime Dependencies

- **pg** (^8.11.3): Core PostgreSQL driver
- **pg-promise** (^11.6.0): Promise-based PostgreSQL client with advanced features
- **lodash** (^4.17.21): Utility functions
- **uuid** (^9.0.1): Unique identifier generation

### Peer Dependencies

- **n8n-workflow** (\*): Required by all n8n nodes, provides core types and utilities

### Development Dependencies

- **@typescript-eslint/parser** (~8.32.0): TypeScript parsing for ESLint
- **eslint-plugin-n8n-nodes-base** (^1.16.3): n8n-specific linting rules
- **@types/pg**, **@types/lodash**, **@types/uuid**: TypeScript definitions
- **jest**, **ts-jest**: Testing framework
- **prettier**: Code formatting
- **gulp**: Build automation (icon processing)

### External Services

- **Neon Database**: Primary integration target (neon.tech)
- **npm Registry**: Package distribution
- **n8n Community Nodes**: Installation and discovery platform

### API/SDK Dependencies

- Uses standard PostgreSQL protocol (no Neon-specific SDK)
- Connection string format: `postgres://user:pass@host:port/db?sslmode=require`
- Query syntax: Standard PostgreSQL SQL with parameterization
