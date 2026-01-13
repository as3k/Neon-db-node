# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- AI Agent Tools support with five dedicated tool nodes:
  - **Neon Select Query Tool** - Natural language database queries
  - **Neon Insert Data Tool** - Record insertion with automatic type handling
  - **Neon Update Data Tool** - Safe record updates with WHERE clause validation
  - **Neon Delete Data Tool** - Deletion operations with safety confirmations
  - **Neon Execute SQL Tool** - Custom SQL execution with injection prevention
- LLM-optimized error messages with recovery suggestions
- Error categorization system (10 error types)
- Comprehensive input validation with SQL injection prevention
- Structured JSON responses for all AI tool operations
- Response formatters for query and modification operations
- Execution time tracking for performance monitoring
- Result truncation handling for large datasets

### Changed

- Updated README with comprehensive AI Agent tools documentation
- Added environment variable requirement for community package tool usage

## [1.0.0] - Initial Release

### Added

- Core CRUD operations (INSERT, SELECT, UPDATE, DELETE)
- Execute Query operation with parameter binding
- Schema introspection (automatic table and column discovery)
- Dynamic credential management with connection testing
- SSL-enforced connections for security
- Parameterized queries preventing SQL injection
- Multiple execution modes (Single, Transaction, Independent)
- Resource mapping support
- List search functionality
- Load options for dynamic dropdowns
