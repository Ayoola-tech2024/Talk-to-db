# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
