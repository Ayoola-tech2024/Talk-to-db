import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SqliteAdapter } from './engine/sqlite-adapter.js';
import { SchemaExtractor } from './engine/schema-extractor.js';
import { NlToSqlEngine } from './engine/nl-to-sql.js';
import { TableStatistics } from './engine/statistics.js';
import { AiEngine } from './engine/ai-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createDbLensApp(config = {}) {
  const app = express();
  const { dbPath = ':memory:', defaultDataset = 'university', port = 4300 } = config;

  let adapter = new SqliteAdapter(dbPath);

  // If memory database and default dataset specified, seed it
  if (dbPath === ':memory:' || defaultDataset) {
    const datasetPath = path.join(__dirname, 'datasets', `${defaultDataset}.sql`);
    try {
      adapter.loadSqlFile(datasetPath);
    } catch (err) {
      console.error(`Failed to seed default dataset '${defaultDataset}':`, err.message);
    }
  }

  let schemaExtractor = new SchemaExtractor(adapter);
  let cachedSchema = schemaExtractor.extractSchema();
  let nlEngine = new NlToSqlEngine(cachedSchema);
  let statisticsEngine = new TableStatistics(adapter);
  let aiEngine = new AiEngine();

  app.use(express.json());

  // Static Studio UI
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // --- REST APIs ---

  // 1. Get database schema graph for visual ERD
  app.get('/api/schema', (req, res) => {
    cachedSchema = schemaExtractor.extractSchema();
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
  app.post('/api/query', (req, res) => {
    const { sql } = req.body || {};
    if (!sql) {
      return res.status(400).json({ error: 'SQL query string is required' });
    }

    // Strict Read-Only Safety Guard: Blocks any mutation or destructive commands
    const sanitized = sql.trim().toLowerCase();
    const forbiddenKeywords = ['drop ', 'delete ', 'truncate ', 'alter ', 'update ', 'insert into', 'create table', 'vacuum'];
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
      const rows = adapter.query(sql);
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
      rows = adapter.query(translation.sql);
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
          rows = adapter.query(healed.sql);
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

    res.json({
      success: true,
      prompt,
      sql: translation.sql,
      explanation: translation.explanation,
      executiveSummary: translation.executiveSummary || `Retrieved ${rows.length} records matching your query.`,
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
  app.get('/api/table/:name/rows', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    const rows = adapter.getTableSampleRows(req.params.name, limit);
    res.json({ tableName: req.params.name, count: rows.length, rows });
  });

  // 5. Get table statistical quality profile
  app.get('/api/table/:name/stats', (req, res) => {
    const profile = statisticsEngine.profileTable(req.params.name);
    res.json(profile);
  });

  // 6. Load a different demo dataset
  app.post('/api/dataset/load', (req, res) => {
    const { dataset = 'university' } = req.body || {};
    const datasetPath = path.join(__dirname, 'datasets', `${dataset}.sql`);

    try {
      // Recreate adapter in-memory with new dataset
      adapter = new SqliteAdapter(':memory:');
      adapter.loadSqlFile(datasetPath);

      schemaExtractor = new SchemaExtractor(adapter);
      cachedSchema = schemaExtractor.extractSchema();
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

  return app;
}
