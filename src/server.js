import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SqliteAdapter } from './engine/sqlite-adapter.js';
import { SchemaExtractor } from './engine/schema-extractor.js';
import { NlToSqlEngine } from './engine/nl-to-sql.js';
import { TableStatistics } from './engine/statistics.js';

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

  // 2. Execute raw SQL query
  app.post('/api/query', (req, res) => {
    const { sql } = req.body || {};
    if (!sql) {
      return res.status(400).json({ error: 'SQL query string is required' });
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

  // 3. Ask a question in plain English (Natural Language to SQL)
  app.post('/api/ask', (req, res) => {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const translation = nlEngine.translate(prompt);
    const startTime = Date.now();

    try {
      const rows = adapter.query(translation.sql);
      const durationMs = Date.now() - startTime;
      res.json({
        success: true,
        prompt,
        sql: translation.sql,
        explanation: translation.explanation,
        primaryTable: translation.primaryTable,
        rowCount: rows.length,
        durationMs,
        rows
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      res.json({
        success: false,
        prompt,
        sql: translation.sql,
        explanation: translation.explanation,
        error: err.message,
        durationMs,
        rows: []
      });
    }
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
