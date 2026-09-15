# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-15

### Added

- **Live Remote PostgreSQL Database Connectivity**: Direct exploration of cloud PostgreSQL databases (InsForge, Supabase, Neon, AWS RDS, Render) via connection URL.
- **Triple-Layer Read-Only Safety Protection**:
  1. *Database Engine Lock*: Session characteristics set to `TRANSACTION READ ONLY` on connection.
  2. *Application-Level AST Inspection*: Blocks any `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `VACUUM` queries with HTTP 403.
  3. *Zero-Write Safety*: Prohibits mock data injection or destructive commands on remote production databases.
- **Concurrent Schema Introspection**: Parallel table extraction across network pools for fast visual ERD rendering on 20+ table schemas.

## [1.2.0] - 2026-09-15

### Added

- **Interactive Drag-and-Drop ERD**: Freely reposition table nodes anywhere on the canvas with smooth real-time SVG bezier curve updates.
- **Editable SQL Code Editor**: Direct SQL query refinement with syntax-styled textarea, `Ctrl+Enter` execution shortcut, and instant execution results.
- **Strict Read-Only Guard**: Protects production databases from accidental mutation by blocking `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, and `TRUNCATE` operations with HTTP 403.
- **Universal PostgreSQL / MySQL DDL Compatibility**: Normalizes complex PostgreSQL dumps (including extensions, RLS policies, triggers, functions, `UUID`, `JSONB`, `TIMESTAMPTZ`, and `DOUBLE PRECISION`) for instant in-memory exploration.
- **Custom SQL Dump Loading in CLI**: Support for passing external schema dump paths directly into `talk-to-db <schema.sql>`.

## [1.1.0] - 2026-09-15

### Added

- **AI Engine (Google Gemini, OpenAI, Groq)**: Translates natural language questions to multi-table SQL queries with deep schema context
- **Self-Healing SQL Loop**: Automatically detects SQLite syntax errors, re-prompts the AI with the error message, and self-corrects the query
- **Executive Data Storytelling**: Generates a 2-sentence plain English takeaway answering the business question directly
- **Dual-Mode Execution**: Seamlessly falls back to the built-in heuristic engine when running offline without an API key
- **AI Settings Modal**: In-browser API key manager with live provider switcher and connection indicator
- **Interactive Visual Chart Suggestions**: Recommends Bar, Pie, and Line charts based on query results

## [1.0.0] - 2026-09-15

### Added

- Native SQLite `DatabaseSync` engine integration with zero binary compilation overhead
- Schema extractor computing table columns, data types, primary keys, and foreign key relations
- Interactive SVG ERD diagram canvas with bezier curve relationship lines
- Plain English Natural Language to SQL query synthesis engine with step-by-step logic explanations
- Automated table statistics and data completeness profiling
- Built-in sample datasets (University Student Records & Solar E-Commerce Marketplace)
- Web Studio UI on port `4300` with 3 core tabs (Schema ERD, Plain English AI Query, Data Explorer)
- 1-click CSV query export
- CLI command runner (`db-lens <file>`, `--demo`, `--port`)
- E2E integration test suite
