import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { SqliteAdapter } from '../src/engine/sqlite-adapter.js';
import { SchemaExtractor } from '../src/engine/schema-extractor.js';
import { NlToSqlEngine } from '../src/engine/nl-to-sql.js';
import { TableStatistics } from '../src/engine/statistics.js';
import { createDbLensApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('TalkToDB — Complete E2E Database Exploration & Natural Language Suite', async (t) => {

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

    // Verify foreign key connection
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

  await t.test('5. Live Studio Express Server Endpoints', async () => {
    const app = createDbLensApp({ port: 4350, defaultDataset: 'university' });
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(4350, resolve));

    try {
      // 1. Test /api/schema
      const schemaRes = await fetch('http://localhost:4350/api/schema');
      assert.equal(schemaRes.status, 200);
      const schemaData = await schemaRes.json();
      assert.equal(schemaData.tableCount, 5);

      // 2. Test /api/ask with natural prompt
      const askRes = await fetch('http://localhost:4350/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Top 2 students with highest GPA' })
      });
      assert.equal(askRes.status, 200);
      const askData = await askRes.json();
      assert.equal(askData.success, true);
      assert.equal(askData.rowCount, 2);
      assert.equal(askData.rows[0].full_name, 'Ayoola Damisile');
      assert.equal(askData.rows[0].gpa, 4.88);

      // 3. Test /api/dataset/load to switch to ecommerce
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

});
