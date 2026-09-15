import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SqliteAdapter } from './engine/sqlite-adapter.js';
import { PostgresAdapter } from './engine/postgres-adapter.js';
import { SchemaExtractor } from './engine/schema-extractor.js';
import { NlToSqlEngine } from './engine/nl-to-sql.js';
import { TableStatistics } from './engine/statistics.js';
import { AiEngine } from './engine/ai-engine.js';
import { MockSeeder } from './engine/mock-seeder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createDbLensApp(config = {}) {
  const app = express();
  const { dbPath = ':memory:', defaultDataset = null, customSqlFile = null, port = 4300 } = config;

  let adapter;
  let isPostgres = false;

  if (typeof dbPath === 'string' && (dbPath.startsWith('postgres://') || dbPath.startsWith('postgresql://'))) {
    adapter = new PostgresAdapter(dbPath);
    await adapter.init();
    isPostgres = true;
  } else {
    adapter = new SqliteAdapter(dbPath);

    // If custom SQL file provided, seed it into the adapter
    if (customSqlFile && fs.existsSync(customSqlFile)) {
      try {
        adapter.loadSqlFile(customSqlFile);
      } catch (err) {
        console.error(`Failed to load custom SQL file '${customSqlFile}':`, err.message);
      }
    } else if (defaultDataset) {
      const datasetPath = path.join(__dirname, 'datasets', `${defaultDataset}.sql`);
      try {
        adapter.loadSqlFile(datasetPath);
      } catch (err) {
        console.error(`Failed to seed default dataset '${defaultDataset}':`, err.message);
      }
    }
  }

  let schemaExtractor = new SchemaExtractor(adapter);
  let cachedSchema = await schemaExtractor.extractSchema();
  let nlEngine = new NlToSqlEngine(cachedSchema);
  let statisticsEngine = new TableStatistics(adapter);
  let aiEngine = new AiEngine();

  app.use(express.json());

  // Static Studio UI
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // --- REST APIs ---

  // 0. Get Active Database Info
  app.get('/api/info', async (req, res) => {
    let dbName = 'University Student DB';
    let isCustom = false;
    if (isPostgres) {
      try {
        const u = new URL(dbPath);
        dbName = `PostgreSQL Live (${u.pathname.replace('/', '') || 'db'} on ${u.hostname})`;
      } catch {
        dbName = 'PostgreSQL Live DB';
      }
      isCustom = true;
    } else if (customSqlFile) {
      dbName = path.basename(customSqlFile);
      isCustom = true;
    } else if (dbPath !== ':memory:') {
      dbName = path.basename(dbPath);
      isCustom = true;
    } else if (defaultDataset) {
      dbName = defaultDataset === 'ecommerce' ? 'Solar E-Commerce DB' : 'University Student DB';
    }

    const tableNames = await adapter.getTableNames();
    const counts = await Promise.all(tableNames.map(t => adapter.getTableRowCount(t)));
    const totalRows = counts.reduce((sum, c) => sum + c, 0);

    res.json({
      dbName,
      isCustom,
      isPostgres,
      sourcePath: customSqlFile || (dbPath !== ':memory:' ? dbPath : null),
      tableCount: tableNames.length,
      totalRows,
      tables: tableNames
    });
  });

  // Seed Mock Data into empty tables (disabled for live PostgreSQL for safety)
  app.post('/api/seed-mock', async (req, res) => {
    if (isPostgres) {
      return res.status(403).json({
        success: false,
        error: '🛡️ Safety Notice: Seed Mock Data is disabled on live remote PostgreSQL databases to guarantee 100% data integrity.'
      });
    }

    const { count = 10 } = req.body || {};
    const seeder = new MockSeeder(adapter);
    const results = seeder.seedAllTables(count);
    cachedSchema = await schemaExtractor.extractSchema();
    nlEngine = new NlToSqlEngine(cachedSchema);
    statisticsEngine = new TableStatistics(adapter);

    let totalRows = 0;
    for (const t of adapter.getTableNames()) {
      totalRows += adapter.getTableRowCount(t);
    }

    res.json({
      success: true,
      message: `Successfully generated realistic sample records across ${Object.keys(results).length} tables!`,
      seeded: results,
      totalRows,
      schema: cachedSchema
    });
  });

  // 1. Get database schema graph for visual ERD
  app.get('/api/schema', async (req, res) => {
    cachedSchema = await schemaExtractor.extractSchema();
    nlEngine = new NlToSqlEngine(cachedSchema);
    res.json(cachedSchema);
  });

  // 2. Configure AI Engine Credentials
  app.post('/api/ai/config', (req, res) => {
    const { apiKey, provider = 'gemini', model = null } = req.body || {};
    aiEngine.setCredentials({ apiKey, provider, model });
    res.json({
      success: true,
      hasApiKey: aiEngine.hasApiKey(),
      provider: aiEngine.provider,
      model: aiEngine.model
    });
  });

  // 3. Get AI Status
  app.get('/api/ai/status', (req, res) => {
    res.json({
      hasApiKey: aiEngine.hasApiKey(),
      provider: aiEngine.provider,
      model: aiEngine.model
    });
  });

  // 4. Execute raw SQL query with strict Read-Only Safety Guard
  app.post('/api/query', async (req, res) => {
    const { sql } = req.body || {};
    if (!sql) {
      return res.status(400).json({ error: 'SQL query string is required' });
    }

    // Strict Read-Only Safety Guard: Blocks any mutation or destructive commands
    const sanitized = sql.trim().toLowerCase();
    const forbiddenKeywords = ['drop ', 'delete ', 'truncate ', 'alter ', 'update ', 'insert into', 'create table', 'grant ', 'revoke ', 'vacuum'];
    const isMutation = forbiddenKeywords.some(keyword => sanitized.startsWith(keyword) || sanitized.includes(`; ${keyword}`) || sanitized.includes(`;\n${keyword}`));

    if (isMutation) {
      return res.status(403).json({
        success: false,
        sql,
        error: '🛡️ Read-Only Guard: TalkToDB only allows data exploration (SELECT/PRAGMA). Write and delete operations are strictly blocked to protect your database.',
        durationMs: 0
      });
    }

    const startTime = Date.now();
    try {
      const rows = await adapter.query(sql);
      const durationMs = Date.now() - startTime;
      res.json({
        success: true,
        sql,
        rowCount: rows.length,
        durationMs,
        rows
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      res.status(400).json({
        success: false,
        sql,
        error: err.message,
        durationMs
      });
    }
  });

  // 5. Ask a question in plain English (Dual-Mode: AI or Built-in Heuristic)
  app.post('/api/ask', async (req, res) => {
    const { prompt, useAi = true } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const startTime = Date.now();
    let translation = null;
    let modeUsed = 'heuristic';

    // 1. Attempt AI synthesis if configured and requested
    if (useAi && aiEngine.hasApiKey()) {
      try {
        translation = await aiEngine.generateQuery({
          prompt,
          schema: cachedSchema
        });
        modeUsed = `ai (${aiEngine.provider})`;
      } catch (aiErr) {
        console.warn('AI query generation failed, falling back to heuristic engine:', aiErr.message);
      }
    }

    // 2. Fallback to built-in heuristic translator if AI not available
    if (!translation) {
      translation = nlEngine.translate(prompt);
      modeUsed = 'local heuristic';
    }

    // 3. Execute SQL with Self-Healing Loop if AI is available
    let rows = [];
    let queryError = null;

    try {
      rows = await adapter.query(translation.sql);
    } catch (execErr) {
      queryError = execErr.message;

      // Self-Healing Loop with AI if active
      if (modeUsed.startsWith('ai') && aiEngine.hasApiKey()) {
        try {
          const healed = await aiEngine.generateQuery({
            prompt,
            schema: cachedSchema,
            errorContext: { sql: translation.sql, error: queryError }
          });
          rows = await adapter.query(healed.sql);
          translation = healed;
          queryError = null;
          modeUsed += ' (auto-healed)';
        } catch (healErr) {
          queryError = healErr.message;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    if (queryError) {
      return res.json({
        success: false,
        prompt,
        sql: translation.sql,
        explanation: translation.explanation,
        executiveSummary: 'Unable to execute query due to syntax/schema mismatch.',
        error: queryError,
        durationMs,
        mode: modeUsed,
        rows: []
      });
    }

    let executiveSummary = translation.executiveSummary;
    if (rows.length === 0) {
      const primaryTable = translation.primaryTable;
      if (primaryTable) {
        const tableTotal = await adapter.getTableRowCount(primaryTable);
        if (tableTotal === 0) {
          executiveSummary = `Executed successfully. Note: Table '${primaryTable}' currently has 0 rows in this schema. Click '🌱 Seed Mock Data' in the toolbar to populate sample records for instant testing!`;
        } else {
          executiveSummary = `Executed successfully, but no records matched the given filter criteria.`;
        }
      } else {
        executiveSummary = `Executed successfully. Returned 0 row(s).`;
      }
    } else if (!executiveSummary) {
      executiveSummary = `Retrieved ${rows.length} records matching your query.`;
    }

    res.json({
      success: true,
      prompt,
      sql: translation.sql,
      explanation: translation.explanation,
      executiveSummary,
      recommendedChart: translation.recommendedChart || 'table',
      chartConfig: translation.chartConfig || null,
      primaryTable: translation.primaryTable || null,
      rowCount: rows.length,
      durationMs,
      mode: modeUsed,
      rows
    });
  });

  // 4. Get table preview rows
  app.get('/api/table/:name/rows', async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    const rows = await adapter.getTableSampleRows(req.params.name, limit);
    res.json({ tableName: req.params.name, count: rows.length, rows });
  });

  // 5. Get table statistical quality profile
  app.get('/api/table/:name/stats', async (req, res) => {
    const profile = await statisticsEngine.profileTable(req.params.name);
    res.json(profile);
  });

  // 6. Load a different demo dataset
  app.post('/api/dataset/load', async (req, res) => {
    const { dataset = 'university' } = req.body || {};
    const datasetPath = path.join(__dirname, 'datasets', `${dataset}.sql`);

    try {
      // Recreate adapter in-memory with new dataset
      adapter = new SqliteAdapter(':memory:');
      adapter.loadSqlFile(datasetPath);

      schemaExtractor = new SchemaExtractor(adapter);
      cachedSchema = await schemaExtractor.extractSchema();
      nlEngine = new NlToSqlEngine(cachedSchema);
      statisticsEngine = new TableStatistics(adapter);

      res.json({ success: true, dataset, schema: cachedSchema });
    } catch (err) {
      res.status(500).json({ error: `Failed to load dataset: ${err.message}` });
    }
  });

  // Fallback to index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.adapter = adapter;

  return app;
}
