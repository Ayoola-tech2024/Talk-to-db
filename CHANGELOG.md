# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
