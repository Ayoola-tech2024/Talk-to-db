import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite Database Adapter utilizing Node's built-in DatabaseSync engine.
 * Includes PostgreSQL, MySQL, and Generic DDL normalization for schema dumps.
 */
export class SqliteAdapter {
  constructor(dbPath = ':memory:') {
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
  }

  /**
   * Executes a multi-statement SQL script (such as DDL or seed dump) with dialect normalization.
   */
  execScript(sql) {
    const normalized = this.normalizeDdl(sql);
    
    // Split into individual statements to safely execute and skip dialect-specific non-critical errors
    const statements = normalized
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        this.db.exec(stmt + ';');
      } catch (err) {
        // Only log if it's a table creation error
        if (stmt.toLowerCase().startsWith('create table')) {
          console.warn(`[SqliteAdapter] Table creation warning: ${err.message} in statement: ${stmt.slice(0, 60)}...`);
        }
      }
    }
  }

  /**
   * Normalizes PostgreSQL, MySQL, and generic SQL DDL syntax to valid SQLite syntax.
   */
  normalizeDdl(sql) {
    let clean = sql;

    // 1. Remove comments
    clean = clean.replace(/--.*$/gm, '');
    clean = clean.replace(/\/\*[\s\S]*?\*\//gm, '');

    // 2. Remove PostgreSQL-specific commands (Extensions, Policies, RLS, Functions, Triggers) without crossing statement boundaries
    clean = clean.replace(/CREATE\s+EXTENSION[^;]*?;/gi, '');
    clean = clean.replace(/ALTER\s+TABLE[^;]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY[^;]*?;/gi, '');
    clean = clean.replace(/ALTER\s+TABLE[^;]*?ADD\s+COLUMN[^;]*?;/gi, '');
    clean = clean.replace(/CREATE\s+POLICY[^;]*?;/gi, '');
    clean = clean.replace(/DROP\s+POLICY[^;]*?;/gi, '');
    clean = clean.replace(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION[\s\S]*?\$\$[\s\S]*?\$\$\s*(LANGUAGE\s+\w+)?;?/gi, '');
    clean = clean.replace(/RETURNS\s+TRIGGER[\s\S]*?\$\$[\s\S]*?\$\$\s*(LANGUAGE\s+\w+)?;?/gi, '');
    clean = clean.replace(/CREATE\s+TRIGGER[^;]*?;/gi, '');

    // 3. Remove "public." prefix
    clean = clean.replace(/\bpublic\.([a-zA-Z0-9_]+)\b/g, '$1');

    // 4. Normalize PostgreSQL / MySQL Data Types to SQLite Types
    clean = clean.replace(/\bUUID\b/gi, 'TEXT');
    clean = clean.replace(/\bJSONB\b/gi, 'TEXT');
    clean = clean.replace(/\bTIMESTAMPTZ\b/gi, 'TEXT');
    clean = clean.replace(/\bTIMESTAMP\b/gi, 'TEXT');
    clean = clean.replace(/\bVARCHAR\(\d+\)/gi, 'TEXT');
    clean = clean.replace(/\bSERIAL\b/gi, 'INTEGER');
    clean = clean.replace(/\bBIGSERIAL\b/gi, 'INTEGER');
    clean = clean.replace(/\bBIGINT\b/gi, 'INTEGER');
    clean = clean.replace(/\bDOUBLE\s+PRECISION\b/gi, 'REAL');

    // 5. Normalize Default Expressions
    clean = clean.replace(/DEFAULT\s+gen_random_uuid\(\)/gi, 'DEFAULT (lower(hex(randomblob(16))))');
    clean = clean.replace(/DEFAULT\s+now\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP');

    return clean;
  }

  /**
   * Loads and executes an external .sql file.
   */
  loadSqlFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    this.execScript(content);
  }

  /**
   * Executes a SELECT or read query and returns all matching rows as plain objects.
   */
  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Introspects the database and returns a list of all user table names.
   */
  getTableNames() {
    const rows = this.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC;
    `);
    return rows.map(r => r.name);
  }

  /**
   * Retrieves column definitions for a given table via PRAGMA table_info.
   */
  getTableColumns(tableName) {
    return this.query(`PRAGMA table_info("${tableName}");`);
  }

  /**
   * Retrieves foreign key relationships for a given table via PRAGMA foreign_key_list.
   */
  getTableForeignKeys(tableName) {
    return this.query(`PRAGMA foreign_key_list("${tableName}");`);
  }

  /**
   * Gets total row count for a table.
   */
  getTableRowCount(tableName) {
    try {
      const res = this.query(`SELECT COUNT(*) as count FROM "${tableName}";`);
      return res[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Fetches sample preview rows from a table.
   */
  getTableSampleRows(tableName, limit = 25) {
    try {
      return this.query(`SELECT * FROM "${tableName}" LIMIT ?;`, [limit]);
    } catch {
      return [];
    }
  }

  /**
   * Closes the database connection cleanly.
   */
  close() {
    this.db.close();
  }
}
