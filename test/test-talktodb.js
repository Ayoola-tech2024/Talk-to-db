import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { SqliteAdapter } from '../src/engine/sqlite-adapter.js';
import { SchemaExtractor } from '../src/engine/schema-extractor.js';
import { NlToSqlEngine } from '../src/engine/nl-to-sql.js';
import { TableStatistics } from '../src/engine/statistics.js';
import { AiEngine } from '../src/engine/ai-engine.js';
import { createDbLensApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('TalkToDB — Complete E2E Database Exploration, AI & Natural Language Suite', async (t) => {

  let adapter;
  let schema;

  await t.test('1. SqliteAdapter & University Dataset Seeding', () => {
    adapter = new SqliteAdapter(':memory:');
    const sqlPath = path.join(__dirname, '..', 'src', 'datasets', 'university.sql');
    adapter.loadSqlFile(sqlPath);

    const tables = adapter.getTableNames();
    assert.ok(tables.includes('students'));
    assert.ok(tables.includes('departments'));
    assert.ok(tables.includes('courses'));
    assert.ok(tables.includes('instructors'));
    assert.ok(tables.includes('enrollments'));

    const studentCount = adapter.getTableRowCount('students');
    assert.equal(studentCount, 6);
  });

  await t.test('2. SchemaExtractor & Relationship Graph', () => {
    const extractor = new SchemaExtractor(adapter);
    schema = extractor.extractSchema();

    assert.equal(schema.tableCount, 5);
    assert.ok(schema.totalRelations >= 4);

    const studentsTable = schema.tables.find(t => t.name === 'students');
    assert.ok(studentsTable);
    const pkCol = studentsTable.columns.find(c => c.isPrimaryKey);
    assert.equal(pkCol.name, 'student_id');

    const studentDeptRel = schema.relations.find(r => r.fromTable === 'students' && r.toTable === 'departments');
    assert.ok(studentDeptRel);
    assert.equal(studentDeptRel.fromColumn, 'dept_id');
  });

  await t.test('3. Table Statistics & Quality Profiler', () => {
    const statsEngine = new TableStatistics(adapter);
    const profile = statsEngine.profileTable('students');

    assert.equal(profile.tableName, 'students');
    assert.equal(profile.rowCount, 6);
    assert.ok(profile.columns.length >= 6);

    const gpaCol = profile.columns.find(c => c.name === 'gpa');
    assert.equal(gpaCol.nullCount, 0);
    assert.equal(gpaCol.nullRate, 0);
  });

  await t.test('4. Plain English Natural Language to SQL Translation', () => {
    const nlEngine = new NlToSqlEngine(schema);

    // Test 1: Ranking / Top N
    const res1 = nlEngine.translate('Top 3 students with highest GPA');
    assert.ok(res1.sql.includes('SELECT * FROM students'));
    assert.ok(res1.sql.includes('ORDER BY students.gpa DESC'));
    assert.ok(res1.sql.includes('LIMIT 3'));

    // Test 2: Aggregation
    const res2 = nlEngine.translate('How many courses are there');
    assert.ok(res2.sql.includes('SELECT COUNT(*) as total_count FROM courses'));

    // Test 3: Filtering condition
    const res3 = nlEngine.translate('Show instructors with salary above 1300000');
    assert.ok(res3.sql.includes('FROM instructors'));

    // Test 4: Joins
    const res4 = nlEngine.translate('List students with their department');
    assert.ok(res4.sql.includes('JOIN departments ON students.dept_id = departments.dept_id'));
  });

  await t.test('5. AI Engine Schema Formatting & Fallback Protection', () => {
    const aiEngine = new AiEngine();
    assert.equal(aiEngine.hasApiKey(), false);

    const formatted = aiEngine.formatSchemaPrompt(schema);
    assert.ok(formatted.includes('Table: "students"'));
    assert.ok(formatted.includes('Table: "departments"'));
    assert.ok(formatted.includes('Foreign Key Relationships'));

    aiEngine.setCredentials({ apiKey: 'test_gemini_key_12345678', provider: 'gemini' });
    assert.equal(aiEngine.hasApiKey(), true);
    assert.equal(aiEngine.provider, 'gemini');
  });

  await t.test('6. Live Studio Express Server Endpoints & AI Config', async () => {
    const app = createDbLensApp({ port: 4350, defaultDataset: 'university' });
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(4350, resolve));

    try {
      // 1. Test /api/schema
      const schemaRes = await fetch('http://localhost:4350/api/schema');
      assert.equal(schemaRes.status, 200);
      const schemaData = await schemaRes.json();
      assert.equal(schemaData.tableCount, 5);

      // 2. Test /api/ai/config & /api/ai/status
      const aiConfigRes = await fetch('http://localhost:4350/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'mock_key_9999', provider: 'gemini' })
      });
      assert.equal(aiConfigRes.status, 200);
      const aiStatus = await aiConfigRes.json();
      assert.equal(aiStatus.hasApiKey, true);

      // 3. Test /api/ask with natural prompt (fallback heuristic gracefully if mock key)
      const askRes = await fetch('http://localhost:4350/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Top 2 students with highest GPA', useAi: false })
      });
      assert.equal(askRes.status, 200);
      const askData = await askRes.json();
      assert.equal(askData.success, true);
      assert.equal(askData.rowCount, 2);
      assert.equal(askData.rows[0].full_name, 'Ayoola Damisile');
      assert.equal(askData.rows[0].gpa, 4.88);
      assert.ok(askData.executiveSummary);

      // 4. Test Read-Only Safety Guard on destructive query
      const deleteAttempt = await fetch('http://localhost:4350/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'DELETE FROM students WHERE id = 1;' })
      });
      assert.equal(deleteAttempt.status, 403);
      const deleteData = await deleteAttempt.json();
      assert.equal(deleteData.success, false);
      assert.ok(deleteData.error.includes('Read-Only Guard'));

      // 5. Test /api/dataset/load to switch to ecommerce
      const swapRes = await fetch('http://localhost:4350/api/dataset/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: 'ecommerce' })
      });
      assert.equal(swapRes.status, 200);
      const swapData = await swapRes.json();
      assert.equal(swapData.success, true);
      assert.ok(swapData.schema.tables.some(t => t.name === 'products'));
    } finally {
      await new Promise((resolve) => server.close(resolve));
      adapter.close();
    }
  });

  await t.test('7. Custom PostgreSQL DDL Schema Loading (BuySolar schema test)', async () => {
    const customSchemaPath = path.resolve('C:\\Users\\Martins Udek\\Desktop\\buysolar.ng\\sql\\schema.sql');
    const customApp = createDbLensApp({ port: 4351, customSqlFile: customSchemaPath });
    const customServer = http.createServer(customApp);

    await new Promise((resolve) => customServer.listen(4351, resolve));

    try {
      const res = await fetch('http://localhost:4351/api/schema');
      assert.equal(res.status, 200);
      const schemaData = await res.json();
      assert.ok(schemaData.tableCount >= 8);
      assert.ok(schemaData.tables.some(t => t.name === 'users'));
      assert.ok(schemaData.tables.some(t => t.name === 'orders'));
      assert.ok(schemaData.tables.some(t => t.name === 'products'));
      // Test /api/info
      const infoRes = await fetch('http://localhost:4351/api/info');
      assert.equal(infoRes.status, 200);
      const info = await infoRes.json();
      assert.equal(info.isCustom, true);
      assert.ok(info.tableCount >= 8);

      // Test /api/seed-mock to populate empty custom tables
      const seedRes = await fetch('http://localhost:4351/api/seed-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 5 })
      });
      assert.equal(seedRes.status, 200);
      const seedData = await seedRes.json();
      assert.equal(seedData.success, true);
      assert.ok(seedData.totalRows > 0);

      // Verify query on orders now returns seeded rows
      const queryRes = await fetch('http://localhost:4351/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT * FROM orders LIMIT 10;' })
      });
      assert.equal(queryRes.status, 200);
      const queryData = await queryRes.json();
      assert.equal(queryData.success, true);
      assert.ok(queryData.rowCount > 0);
    } finally {
      await new Promise((resolve) => customServer.close(resolve));
    }
  });

});
