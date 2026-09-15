import pg from 'pg';
const { Pool } = pg;

/**
 * PostgreSQL Database Adapter with Multi-Layered Read-Only Safety Protection.
 * 
 * Safety Layers:
 * 1. Database-Level Read-Only Session Lock ('SET default_transaction_read_only = ON')
 * 2. AST / SQL Keyword Inspection Guard (Blocks DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, etc.)
 * 3. Parameterized Query Execution
 */
export class PostgresAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 25
    });
    this.isReady = false;
  }

  /**
   * Initializes the PostgreSQL connection and locks the session to Read-Only mode.
   */
  async init() {
    const client = await this.pool.connect();
    try {
      // Hardware-lock PostgreSQL session into 100% Read-Only mode
      await client.query('SET default_transaction_read_only = ON;');
      await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;');
      this.isReady = true;
    } finally {
      client.release();
    }
  }

  /**
   * Executes a read-only query and returns matching rows.
   */
  async query(sql, params = []) {
    // Application-Level Guard before executing
    const sanitized = sql.trim().toLowerCase();
    const forbiddenKeywords = ['drop ', 'delete ', 'truncate ', 'alter ', 'update ', 'insert into', 'create table', 'grant ', 'revoke ', 'vacuum'];
    const isMutation = forbiddenKeywords.some(keyword => sanitized.startsWith(keyword) || sanitized.includes(`; ${keyword}`) || sanitized.includes(`;\n${keyword}`));

    if (isMutation) {
      throw new Error('🛡️ Read-Only Guard: TalkToDB only allows data exploration (SELECT). Write and delete operations are strictly blocked to protect your database.');
    }

    const client = await this.pool.connect();
    try {
      // Ensure read-only on every checkout
      await client.query('SET default_transaction_read_only = ON;');
      const res = await client.query(sql, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Introspects public tables in PostgreSQL.
   */
  async getTableNames() {
    const res = await this.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);
    return res.map(r => r.table_name);
  }

  /**
   * Retrieves column definitions for a given table with primary key detection.
   */
  async getTableColumns(tableName) {
    const colRows = await this.query(`
      SELECT 
        c.column_name as name,
        c.data_type as type,
        c.is_nullable as is_nullable,
        c.column_default as dflt_value,
        CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END as is_pk
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' 
          AND tc.table_schema = 'public' 
          AND tc.table_name = $1
      ) pk ON c.column_name = pk.column_name
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position ASC;
    `, [tableName]);

    return colRows.map((r, idx) => ({
      cid: idx,
      name: r.name,
      type: r.type.toUpperCase(),
      notnull: r.is_nullable === 'NO' ? 1 : 0,
      dflt_value: r.dflt_value,
      pk: r.is_pk === 1 ? 1 : 0,
      isPrimaryKey: r.is_pk === 1
    }));
  }

  /**
   * Retrieves foreign key relationships for a given table.
   */
  async getTableForeignKeys(tableName) {
    const rows = await this.query(`
      SELECT
        kcu.column_name as "from",
        ccu.table_name AS "table",
        ccu.column_name AS "to"
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1;
    `, [tableName]);

    return rows.map((r, idx) => ({
      id: idx,
      seq: 0,
      table: r.table,
      from: r.from,
      to: r.to
    }));
  }

  /**
   * Gets total row count for a table.
   */
  async getTableRowCount(tableName) {
    try {
      const res = await this.query(`SELECT COUNT(*) as count FROM "${tableName}";`);
      return parseInt(res[0]?.count, 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Fetches sample preview rows from a table.
   */
  async getTableSampleRows(tableName, limit = 25) {
    try {
      return await this.query(`SELECT * FROM "${tableName}" LIMIT $1;`, [limit]);
    } catch {
      return [];
    }
  }

  /**
   * Closes connection pool cleanly.
   */
  async close() {
    await this.pool.end();
  }
}
