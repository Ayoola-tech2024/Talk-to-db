// db-lens Interactive Studio Client
let schemaData = { tables: [], relations: [] };
let selectedTableName = null;
let currentQueryRows = [];

// DOM Elements
const activeDatasetLabel = document.getElementById('activeDatasetLabel');
const datasetSwitcher = document.getElementById('datasetSwitcher');
const erdTableCount = document.getElementById('erdTableCount');
const erdRelationCount = document.getElementById('erdRelationCount');
const erdSvgCanvas = document.getElementById('erdSvgCanvas');
const erdTablesContainer = document.getElementById('erdTablesContainer');

const nlPromptInput = document.getElementById('nlPromptInput');
const askNlBtn = document.getElementById('askNlBtn');
const generatedSqlViewer = document.getElementById('generatedSqlViewer');
const queryExplanationBox = document.getElementById('queryExplanationBox');
const queryRowCountBadge = document.getElementById('queryRowCountBadge');
const queryDurationBadge = document.getElementById('queryDurationBadge');
const queryTableHead = document.getElementById('queryTableHead');
const queryTableBody = document.getElementById('queryTableBody');
const copySqlBtn = document.getElementById('copySqlBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');

const tableSelectorList = document.getElementById('tableSelectorList');
const currentSelectedTableName = document.getElementById('currentSelectedTableName');
const currentSelectedTableRowCount = document.getElementById('currentSelectedTableRowCount');
const tableStatsGrid = document.getElementById('tableStatsGrid');
const previewTableHead = document.getElementById('previewTableHead');
const previewTableBody = document.getElementById('previewTableBody');

// Initialize Studio
async function init() {
  setupEventListeners();
  await loadSchema();
  // Run default query
  executeNlQuery('Show all students with their GPA');
}

// Setup Event Listeners
function setupEventListeners() {
  // Tab Switching
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(b => {
        b.classList.remove('active', 'bg-slate-800', 'text-emerald-400');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'bg-slate-800', 'text-emerald-400');
      btn.classList.remove('text-slate-400');

      const targetTab = btn.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));

      if (targetTab === 'erd') {
        document.getElementById('tabContentErd').classList.remove('hidden');
        renderErdDiagram();
      } else if (targetTab === 'assistant') {
        document.getElementById('tabContentAssistant').classList.remove('hidden');
      } else if (targetTab === 'table') {
        document.getElementById('tabContentTable').classList.remove('hidden');
        if (schemaData.tables.length > 0 && !selectedTableName) {
          selectTableForProfile(schemaData.tables[0].name);
        }
      }
    });
  });

  // Dataset Switcher
  datasetSwitcher.addEventListener('change', async () => {
    const ds = datasetSwitcher.value;
    activeDatasetLabel.innerText = ds === 'university' ? 'University Database' : 'E-Commerce Database';
    await fetch('/api/dataset/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset: ds })
    });
    await loadSchema();
    if (ds === 'university') {
      nlPromptInput.placeholder = 'e.g., Top 5 students with highest GPA, or courses in Business Information Technology';
      executeNlQuery('Top 5 students with highest GPA');
    } else {
      nlPromptInput.placeholder = 'e.g., Top 5 customers who spent the most, or products out of stock';
      executeNlQuery('Top 5 customers who spent the most');
    }
  });

  // Natural Language Ask Button
  askNlBtn.addEventListener('click', () => {
    const prompt = nlPromptInput.value.trim();
    if (prompt) executeNlQuery(prompt);
  });

  nlPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const prompt = nlPromptInput.value.trim();
      if (prompt) executeNlQuery(prompt);
    }
  });

  // Quick Prompt Chips
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      nlPromptInput.value = chip.innerText.trim();
      executeNlQuery(chip.innerText.trim());
    });
  });

  // Copy SQL Button
  copySqlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(generatedSqlViewer.innerText);
    copySqlBtn.innerText = '✅ Copied!';
    setTimeout(() => { copySqlBtn.innerText = '📋 Copy SQL'; }, 2000);
  });

  // Export CSV Button
  exportCsvBtn.addEventListener('click', exportTableToCsv);
}

// Load Schema
async function loadSchema() {
  try {
    const res = await fetch('/api/schema');
    schemaData = await res.json();
    erdTableCount.innerText = schemaData.tableCount || 0;
    erdRelationCount.innerText = schemaData.totalRelations || 0;
    renderErdDiagram();
    renderTableSelector();
  } catch (err) {
    console.error('Failed to load schema:', err);
  }
}

// Render Interactive ERD Diagram
function renderErdDiagram() {
  erdTablesContainer.innerHTML = '';
  erdSvgCanvas.innerHTML = '';

  const tablePositions = {};

  schemaData.tables.forEach(table => {
    tablePositions[table.name] = table.position;

    const card = document.createElement('div');
    card.id = `erd-node-${table.name}`;
    card.className = 'erd-table-card cursor-pointer';
    card.style.left = `${table.position.x}px`;
    card.style.top = `${table.position.y}px`;

    const colsHtml = table.columns.map(col => `
      <div class="erd-column-row hover:bg-slate-800/60">
        <div class="flex items-center gap-1.5">
          ${col.isPrimaryKey ? '<span class="text-amber-400 text-xs" title="Primary Key">🔑</span>' : '<span class="text-slate-600">▪</span>'}
          <span class="${col.isPrimaryKey ? 'text-amber-300 font-bold' : 'text-slate-200'}">${col.name}</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">${col.type}</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="p-3 border-b border-slate-800 bg-slate-900/90 rounded-t-xl flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs">🗃️</span>
          <span class="font-bold text-xs text-slate-100">${table.name}</span>
        </div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">${table.rowCount} rows</span>
      </div>
      <div class="max-h-60 overflow-y-auto custom-scroll">
        ${colsHtml}
      </div>
    `;

    card.addEventListener('click', () => {
      // Switch to Table profiler
      document.querySelector('.nav-tab[data-tab="table"]').click();
      selectTableForProfile(table.name);
    });

    erdTablesContainer.appendChild(card);
  });

  // Render SVG foreign key connection bezier curves
  drawRelationshipCurves(tablePositions);
}

// Draw Bezier Curves between foreign key connected tables
function drawRelationshipCurves(positions) {
  let svgPaths = '';

  schemaData.relations.forEach(rel => {
    const fromPos = positions[rel.fromTable];
    const toPos = positions[rel.toTable];

    if (fromPos && toPos) {
      const startX = fromPos.x + 260; // Right side of from table
      const startY = fromPos.y + 35;
      const endX = toPos.x;          // Left side of to table
      const endY = toPos.y + 35;

      const controlX1 = startX + 50;
      const controlY1 = startY;
      const controlX2 = endX - 50;
      const controlY2 = endY;

      const d = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

      svgPaths += `
        <path class="erd-relation-line" d="${d}">
          <title>${rel.fromTable}.${rel.fromColumn} ➔ ${rel.toTable}.${rel.toColumn}</title>
        </path>
      `;
    }
  });

  erdSvgCanvas.innerHTML = svgPaths;
}

// Execute Natural Language Query
async function executeNlQuery(prompt) {
  askNlBtn.disabled = true;
  askNlBtn.innerText = 'Thinking...';

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    generatedSqlViewer.innerText = data.sql || 'SELECT * FROM students;';
    queryExplanationBox.innerHTML = (data.explanation || 'Selects matching records.')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-200">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="text-emerald-400 bg-slate-900 px-1 rounded font-mono text-[11px]">$1</code>')
      .replace(/\n/g, '<br>');

    queryRowCountBadge.innerText = `${data.rowCount || 0} row${data.rowCount === 1 ? '' : 's'} found`;
    queryDurationBadge.innerText = `(${data.durationMs || 0}ms)`;

    currentQueryRows = data.rows || [];
    renderDataTable(currentQueryRows, queryTableHead, queryTableBody);
  } catch (err) {
    console.error('Failed to execute NL query:', err);
  } finally {
    askNlBtn.disabled = false;
    askNlBtn.innerText = '🚀 Run Query';
  }
}

// Render Generic Data Table
function renderDataTable(rows, theadElem, tbodyElem) {
  if (!rows || rows.length === 0) {
    theadElem.innerHTML = '<tr><th class="p-3 text-slate-500">No columns</th></tr>';
    tbodyElem.innerHTML = '<tr><td class="p-8 text-center text-slate-500">No matching records found.</td></tr>';
    return;
  }

  const columns = Object.keys(rows[0]);

  theadElem.innerHTML = `
    <tr>
      ${columns.map(c => `<th class="p-3 text-slate-300 font-semibold">${c}</th>`).join('')}
    </tr>
  `;

  tbodyElem.innerHTML = rows.map(r => `
    <tr class="hover:bg-slate-800/40">
      ${columns.map(c => {
        const val = r[c];
        const displayVal = val === null ? '<span class="text-slate-600 italic">null</span>' : val;
        return `<td class="p-3 text-slate-200 break-words">${displayVal}</td>`;
      }).join('')}
    </tr>
  `).join('');
}

// Render Table Selector Sidebar
function renderTableSelector() {
  tableSelectorList.innerHTML = schemaData.tables.map(t => `
    <div onclick="selectTableForProfile('${t.name}')" class="table-select-item p-3 cursor-pointer hover:bg-slate-800/50 flex items-center justify-between text-xs ${t.name === selectedTableName ? 'active' : ''}">
      <span class="font-medium text-slate-200">${t.name}</span>
      <span class="font-mono text-[10px] text-slate-500">${t.rowCount} rows</span>
    </div>
  `).join('');
}

// Select Table for Quality Profiling & Preview
async function selectTableForProfile(tableName) {
  selectedTableName = tableName;
  renderTableSelector();

  currentSelectedTableName.innerText = tableName;
  
  const tableObj = schemaData.tables.find(t => t.name === tableName);
  currentSelectedTableRowCount.innerText = `${tableObj ? tableObj.rowCount : 0} rows`;

  // Fetch stats & rows
  const [statsRes, rowsRes] = await Promise.all([
    fetch(`/api/table/${tableName}/stats`).then(r => r.json()),
    fetch(`/api/table/${tableName}/rows?limit=50`).then(r => r.json())
  ]);

  // Render quality metric cards
  const totalCols = statsRes.columns ? statsRes.columns.length : 0;
  const zeroNullCols = (statsRes.columns || []).filter(c => c.nullCount === 0).length;
  const dataQualityScore = totalCols > 0 ? Math.round((zeroNullCols / totalCols) * 100) : 100;

  tableStatsGrid.innerHTML = `
    <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col">
      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Rows</span>
      <span class="text-lg font-bold font-mono text-emerald-400">${statsRes.rowCount || 0}</span>
    </div>
    <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col">
      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Columns</span>
      <span class="text-lg font-bold font-mono text-cyan-400">${totalCols}</span>
    </div>
    <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col">
      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Completeness Score</span>
      <span class="text-lg font-bold font-mono text-teal-400">${dataQualityScore}%</span>
    </div>
    <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col">
      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Primary Key</span>
      <span class="text-xs font-bold font-mono text-amber-300 mt-1 truncate">
        ${(statsRes.columns || []).find(c => c.isPrimaryKey)?.name || 'None'}
      </span>
    </div>
  `;

  // Render preview table rows
  renderDataTable(rowsRes.rows || [], previewTableHead, previewTableBody);
}

// Export Query Table to CSV
function exportTableToCsv() {
  if (!currentQueryRows || currentQueryRows.length === 0) {
    alert('No data to export.');
    return;
  }

  const headers = Object.keys(currentQueryRows[0]);
  const csvContent = [
    headers.join(','),
    ...currentQueryRows.map(row => headers.map(h => {
      let val = row[h] === null ? '' : String(row[h]);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `query_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Start
init();
