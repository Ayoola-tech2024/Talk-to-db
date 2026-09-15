// TalkToDB Interactive Studio Client
let schemaData = { tables: [], relations: [] };
let selectedTableName = null;
let currentQueryRows = [];
let isAiActive = false;
let currentDbInfo = null;

// DOM Elements
const activeDatasetLabel = document.getElementById('activeDatasetLabel');
const datasetSwitcher = document.getElementById('datasetSwitcher');
const seedMockDataBtn = document.getElementById('seedMockDataBtn');
const promptChipsContainer = document.getElementById('promptChipsContainer');
const erdTableCount = document.getElementById('erdTableCount');
const erdRelationCount = document.getElementById('erdRelationCount');
const erdSvgCanvas = document.getElementById('erdSvgCanvas');
const erdTablesContainer = document.getElementById('erdTablesContainer');

const openAiModalBtn = document.getElementById('openAiModalBtn');
const aiStatusDot = document.getElementById('aiStatusDot');
const aiModal = document.getElementById('aiModal');
const closeAiModalBtn = document.getElementById('closeAiModalBtn');
const cancelAiModalBtn = document.getElementById('cancelAiModalBtn');
const saveAiSettingsBtn = document.getElementById('saveAiSettingsBtn');
const aiProviderSelect = document.getElementById('aiProviderSelect');
const aiApiKeyInput = document.getElementById('aiApiKeyInput');
const activeModeBadge = document.getElementById('activeModeBadge');

const nlPromptInput = document.getElementById('nlPromptInput');
const askNlBtn = document.getElementById('askNlBtn');
const sqlEditor = document.getElementById('sqlEditor');
const runCustomSqlBtn = document.getElementById('runCustomSqlBtn');
const queryErrorAlert = document.getElementById('queryErrorAlert');
const queryErrorMessage = document.getElementById('queryErrorMessage');
const queryExplanationBox = document.getElementById('queryExplanationBox');
const executiveStoryText = document.getElementById('executiveStoryText');
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
  await checkAiStatus();
  await loadDbInfo();
  await loadSchema();

  // Run initial query based on loaded schema
  runInitialQuery();
}

// Load Database Info
async function loadDbInfo() {
  try {
    const res = await fetch('/api/info');
    currentDbInfo = await res.json();

    if (currentDbInfo.isCustom) {
      activeDatasetLabel.innerText = `${currentDbInfo.dbName} (Custom Schema)`;
      // Add custom option to switcher if not present
      if (!Array.from(datasetSwitcher.options).some(o => o.value === 'custom')) {
        const opt = document.createElement('option');
        opt.value = 'custom';
        opt.innerText = `📄 ${currentDbInfo.dbName}`;
        datasetSwitcher.prepend(opt);
      }
      datasetSwitcher.value = 'custom';
    } else {
      activeDatasetLabel.innerText = currentDbInfo.dbName;
      datasetSwitcher.value = currentDbInfo.dbName.includes('Solar') ? 'ecommerce' : 'university';
    }
  } catch (err) {
    console.error('Failed to load DB info:', err);
  }
}

// Generate smart prompt chips based on actual tables
function renderDynamicPromptChips() {
  if (!promptChipsContainer) return;
  promptChipsContainer.innerHTML = '<span class="text-slate-500 mr-1">Try:</span>';

  const tableNames = (schemaData.tables || []).map(t => t.name.toLowerCase());
  let suggestions = [];

  if (tableNames.includes('orders') || tableNames.includes('products')) {
    if (tableNames.includes('orders')) suggestions.push('Show all orders');
    if (tableNames.includes('products')) suggestions.push('Top 5 products by price');
    if (tableNames.includes('users')) suggestions.push('List registered users');
    if (tableNames.includes('orders') && tableNames.includes('users')) suggestions.push('Orders with customer details');
  } else if (tableNames.includes('students')) {
    suggestions.push('Top 5 students with highest GPA');
    suggestions.push('Average score in Database Systems');
    suggestions.push('Instructors with salary above 1300000');
    suggestions.push('List students with their department');
  } else {
    // Generic fallback for any arbitrary database schema
    schemaData.tables.slice(0, 4).forEach(t => {
      suggestions.push(`Show records from ${t.name}`);
    });
  }

  suggestions.forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'prompt-chip bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer';
    btn.innerText = text;
    btn.addEventListener('click', () => {
      nlPromptInput.value = text;
      executeNlQuery(text);
    });
    promptChipsContainer.appendChild(btn);
  });
}

function runInitialQuery() {
  if (!schemaData.tables || schemaData.tables.length === 0) return;
  const tableNames = schemaData.tables.map(t => t.name.toLowerCase());

  if (tableNames.includes('orders')) {
    executeNlQuery('Show all orders');
  } else if (tableNames.includes('students')) {
    executeNlQuery('Top 5 students with highest GPA');
  } else {
    executeNlQuery(`Show records from ${schemaData.tables[0].name}`);
  }
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

  // Seed Mock Data Button
  if (seedMockDataBtn) {
    seedMockDataBtn.addEventListener('click', async () => {
      seedMockDataBtn.disabled = true;
      seedMockDataBtn.innerHTML = '<span>⏳</span> <span>Seeding...</span>';

      try {
        const res = await fetch('/api/seed-mock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 10 })
        });
        const data = await res.json();
        if (data.success) {
          await loadSchema();
          await loadDbInfo();
          renderDynamicPromptChips();
          runInitialQuery();
          alert(`🌱 Success! Generated realistic mock data across ${Object.keys(data.seeded).length} tables!`);
        }
      } catch (err) {
        alert('Failed to seed mock data: ' + err.message);
      } finally {
        seedMockDataBtn.disabled = false;
        seedMockDataBtn.innerHTML = '<span>🌱</span> <span>Seed Mock Data</span>';
      }
    });
  }

  // AI Modal Controls
  openAiModalBtn.addEventListener('click', () => aiModal.classList.remove('hidden'));
  closeAiModalBtn.addEventListener('click', () => aiModal.classList.add('hidden'));
  cancelAiModalBtn.addEventListener('click', () => aiModal.classList.add('hidden'));

  saveAiSettingsBtn.addEventListener('click', async () => {
    const apiKey = aiApiKeyInput.value.trim();
    const provider = aiProviderSelect.value;
    saveAiSettingsBtn.disabled = true;
    saveAiSettingsBtn.innerText = 'Saving...';

    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, provider })
      });
      const data = await res.json();
      aiModal.classList.add('hidden');
      await checkAiStatus();
      if (data.hasApiKey) {
        alert(`AI Engine activated with ${provider.toUpperCase()}! Try asking a complex query now.`);
      }
    } catch (err) {
      alert('Failed to save AI config: ' + err.message);
    } finally {
      saveAiSettingsBtn.disabled = false;
      saveAiSettingsBtn.innerText = '💾 Save & Activate AI';
    }
  });

  // Dataset Switcher
  datasetSwitcher.addEventListener('change', async () => {
    const ds = datasetSwitcher.value;
    if (ds === 'custom') return;

    activeDatasetLabel.innerText = ds === 'university' ? 'University Student DB' : 'Solar E-Commerce DB';
    await fetch('/api/dataset/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset: ds })
    });
    await loadSchema();
    await loadDbInfo();
    renderDynamicPromptChips();
    runInitialQuery();
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
    navigator.clipboard.writeText(sqlEditor.value);
    copySqlBtn.innerText = '✅ Copied!';
    setTimeout(() => { copySqlBtn.innerText = '📋 Copy'; }, 2000);
  });

  // Run Custom Edited SQL Button
  runCustomSqlBtn.addEventListener('click', () => {
    const rawSql = sqlEditor.value.trim();
    if (rawSql) executeCustomSqlQuery(rawSql);
  });

  // Ctrl+Enter in SQL Editor
  sqlEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const rawSql = sqlEditor.value.trim();
      if (rawSql) executeCustomSqlQuery(rawSql);
    }
  });

  // Export CSV Button
  exportCsvBtn.addEventListener('click', exportTableToCsv);
}

// Check AI Status
async function checkAiStatus() {
  try {
    const res = await fetch('/api/ai/status');
    const data = await res.json();
    isAiActive = data.hasApiKey;

    if (isAiActive) {
      aiStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      activeModeBadge.innerText = `🤖 AI Active (${data.provider})`;
      activeModeBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50';
    } else {
      aiStatusDot.className = 'w-2 h-2 rounded-full bg-slate-500';
      activeModeBadge.innerText = '⚡ Local Heuristic Mode';
      activeModeBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700';
    }
  } catch {
    aiStatusDot.className = 'w-2 h-2 rounded-full bg-slate-500';
  }
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
    renderDynamicPromptChips();
  } catch (err) {
    console.error('Failed to load schema:', err);
  }
}

// Render Interactive ERD Diagram
let activeTablePositions = {};

function renderErdDiagram() {
  erdTablesContainer.innerHTML = '';
  erdSvgCanvas.innerHTML = '';

  activeTablePositions = {};

  schemaData.tables.forEach((table, index) => {
    // Retain previous dragged position if exists, otherwise initial grid position
    const posX = activeTablePositions[table.name]?.x ?? table.position.x;
    const posY = activeTablePositions[table.name]?.y ?? table.position.y;
    activeTablePositions[table.name] = { x: posX, y: posY };

    const card = document.createElement('div');
    card.id = `erd-node-${table.name}`;
    card.className = 'erd-table-card';
    card.style.left = `${posX}px`;
    card.style.top = `${posY}px`;

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
      <div class="erd-table-header p-3 border-b border-slate-800 bg-slate-900/95 rounded-t-xl flex items-center justify-between">
        <div class="flex items-center gap-2 pointer-events-none">
          <span class="text-xs">🗃️</span>
          <span class="font-bold text-xs text-slate-100">${table.name}</span>
        </div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 pointer-events-none">${table.rowCount} rows</span>
      </div>
      <div class="max-h-60 overflow-y-auto custom-scroll">
        ${colsHtml}
      </div>
      <div class="p-2 border-t border-slate-800/60 bg-slate-950/40 rounded-b-xl flex justify-end">
        <button class="view-table-btn text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer">
          Inspect Data ➔
        </button>
      </div>
    `;

    // View Table Button handler
    card.querySelector('.view-table-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.nav-tab[data-tab="table"]').click();
      selectTableForProfile(table.name);
    });

    // Make table draggable
    makeTableCardDraggable(card, table.name);

    erdTablesContainer.appendChild(card);
  });

  drawRelationshipCurves(activeTablePositions);
}

// Drag and drop handler for ERD table cards
function makeTableCardDraggable(card, tableName) {
  const header = card.querySelector('.erd-table-header');
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function onMouseDown(e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    isDragging = true;
    card.classList.add('dragging');

    startX = e.clientX;
    startY = e.clientY;
    initialLeft = parseInt(card.style.left, 10) || 0;
    initialTop = parseInt(card.style.top, 10) || 0;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const newLeft = Math.max(10, initialLeft + dx);
    const newTop = Math.max(10, initialTop + dy);

    card.style.left = `${newLeft}px`;
    card.style.top = `${newTop}px`;

    activeTablePositions[tableName] = { x: newLeft, y: newTop };
    drawRelationshipCurves(activeTablePositions);
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    card.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  header.addEventListener('mousedown', onMouseDown);
}

// Draw Bezier Curves between foreign key connected tables
function drawRelationshipCurves(positions) {
  let svgPaths = '';

  schemaData.relations.forEach(rel => {
    const fromPos = positions[rel.fromTable];
    const toPos = positions[rel.toTable];

    if (fromPos && toPos) {
      const cardWidth = 270;
      
      // Calculate dynamic anchor points depending on relative table position
      let startX = fromPos.x + cardWidth;
      let startY = fromPos.y + 40;
      let endX = toPos.x;
      let endY = toPos.y + 40;

      // If fromTable is to the right of toTable, connect from left to right
      if (fromPos.x > toPos.x + cardWidth) {
        startX = fromPos.x;
        endX = toPos.x + cardWidth;
      }

      const dx = Math.abs(endX - startX) * 0.5;
      const controlX1 = startX < endX ? startX + dx : startX - dx;
      const controlY1 = startY;
      const controlX2 = startX < endX ? endX - dx : endX + dx;
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
  askNlBtn.innerText = 'Analyzing...';
  queryErrorAlert.classList.add('hidden');

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, useAi: true })
    });

    const data = await res.json();
    sqlEditor.value = data.sql || 'SELECT * FROM students;';
    
    queryExplanationBox.innerHTML = (data.explanation || 'Selects matching records.')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-200">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="text-emerald-400 bg-slate-900 px-1 rounded font-mono text-[11px]">$1</code>')
      .replace(/\n/g, '<br>');

    executiveStoryText.innerHTML = (data.executiveSummary || 'Query executed successfully.')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-300 font-bold">$1</strong>');

    if (!data.success && data.error) {
      queryErrorAlert.classList.remove('hidden');
      queryErrorMessage.innerText = data.error;
    } else {
      queryErrorAlert.classList.add('hidden');
    }

    queryRowCountBadge.innerText = `${data.rowCount || 0} row${data.rowCount === 1 ? '' : 's'} found`;
    queryDurationBadge.innerText = `(${data.durationMs || 0}ms - ${data.mode || 'local'})`;

    currentQueryRows = data.rows || [];
    renderDataTable(currentQueryRows, queryTableHead, queryTableBody);
  } catch (err) {
    queryErrorAlert.classList.remove('hidden');
    queryErrorMessage.innerText = err.message;
  } finally {
    askNlBtn.disabled = false;
    askNlBtn.innerText = '🚀 Run Query';
  }
}

// Execute Custom Edited SQL directly
async function executeCustomSqlQuery(sql) {
  runCustomSqlBtn.disabled = true;
  runCustomSqlBtn.innerText = 'Running...';
  queryErrorAlert.classList.add('hidden');

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const data = await res.json();

    if (data.success) {
      queryErrorAlert.classList.add('hidden');
      queryRowCountBadge.innerText = `${data.rowCount || 0} row${data.rowCount === 1 ? '' : 's'} found`;
      queryDurationBadge.innerText = `(${data.durationMs || 0}ms - manual SQL)`;
      
      executiveStoryText.innerHTML = `Custom SQL executed successfully. Returned <strong class="text-emerald-300">${data.rowCount}</strong> row(s).`;
      queryExplanationBox.innerHTML = `Manually executed SQL statement against the active database.`;

      currentQueryRows = data.rows || [];
      renderDataTable(currentQueryRows, queryTableHead, queryTableBody);
    } else {
      queryErrorAlert.classList.remove('hidden');
      queryErrorMessage.innerText = data.error || 'SQL syntax or execution error.';
      queryRowCountBadge.innerText = '0 rows';
      currentQueryRows = [];
      renderDataTable([], queryTableHead, queryTableBody);
    }
  } catch (err) {
    queryErrorAlert.classList.remove('hidden');
    queryErrorMessage.innerText = err.message;
  } finally {
    runCustomSqlBtn.disabled = false;
    runCustomSqlBtn.innerText = '▶ Run SQL';
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

  const [statsRes, rowsRes] = await Promise.all([
    fetch(`/api/table/${tableName}/stats`).then(r => r.json()),
    fetch(`/api/table/${tableName}/rows?limit=50`).then(r => r.json())
  ]);

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
