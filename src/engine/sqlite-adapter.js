import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite Database Adapter utilizing Node's built-in DatabaseSync engine.
 */
export class SqliteAdapter {
  constructor(dbPath = ':memory:') {
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
  }

  /**
   * Executes a multi-statement SQL script (such as DDL or seed dump).
   */
  execScript(sql) {
    this.db.exec(sql);
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
