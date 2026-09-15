/**
 * AI Query & Reasoning Engine for TalkToDB.
 * Leverages Google Gemini, OpenAI, or Groq LLMs to synthesize complex multi-table SQL,
 * self-heal syntax errors, and generate executive data summaries.
 */
export class AiEngine {
  constructor({
    apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || null,
    provider = 'gemini', // 'gemini' | 'openai' | 'groq'
    model = 'gemini-1.5-flash'
  } = {}) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;
  }

  setCredentials({ apiKey, provider = 'gemini', model = null }) {
    this.apiKey = apiKey;
    this.provider = provider;
    if (model) this.model = model;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  /**
   * Translates natural language prompt to complex SQL using the LLM with full schema context.
   */
  async generateQuery({ prompt, schema, sampleData = {}, errorContext = null }) {
    if (!this.hasApiKey()) {
      throw new Error('No AI API Key configured. Please enter a Gemini or OpenAI API Key in AI Settings.');
    }

    const schemaContext = this.formatSchemaPrompt(schema);

    const systemPrompt = `You are an elite SQL Database Architect & Data Analyst specializing in SQLite.
Your job is to translate natural English questions into precise, efficient, valid SQLite queries, explain their logic in plain language, and provide a 2-sentence executive business summary.

DATABASE SCHEMA:
${schemaContext}

${errorContext ? `PREVIOUS ATTEMPT FAILED WITH ERROR:
Query: ${errorContext.sql}
Error: ${errorContext.error}
Please fix the SQL query to resolve this error.` : ''}

USER QUESTION: "${prompt}"

OUTPUT FORMAT REQUIREMENTS:
You must respond with ONLY a valid, raw JSON object (no markdown backticks, no wrapping text) with this exact schema:
{
  "sql": "SELECT ...;",
  "explanation": "Step-by-step logic in simple words (bullet points or numbers).",
  "executiveSummary": "2-sentence plain English takeaway summarizing what this query reveals.",
  "recommendedChart": "bar" | "pie" | "line" | "table",
  "chartConfig": {
    "labelKey": "column_for_x_axis_or_label",
    "valueKey": "column_for_y_axis_or_metric",
    "chartTitle": "Title for the visual chart"
  }
}`;

    if (this.provider === 'gemini') {
      return await this.callGemini(systemPrompt);
    } else if (this.provider === 'openai' || this.provider === 'groq') {
      return await this.callOpenAiCompatible(systemPrompt);
    } else {
      throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  /**
   * Calls Google Gemini REST API.
   */
  async callGemini(promptText) {
    const modelName = this.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return this.parseJsonResponse(rawText);
  }

  /**
   * Calls OpenAI or Groq chat completions API.
   */
  async callOpenAiCompatible(promptText) {
    const baseUrl = this.provider === 'groq' 
      ? 'https://api.groq.com/openai/v1/chat/completions' 
      : 'https://api.openai.com/v1/chat/completions';
    
    const modelName = this.model || (this.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${this.provider.toUpperCase()} API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content || '{}';
    return this.parseJsonResponse(rawText);
  }

  /**
   * Cleans and safely parses JSON responses.
   */
  parseJsonResponse(rawText) {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json/i, '').replace(/```$/i, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```/i, '').replace(/```$/i, '').trim();
    }

    try {
      const parsed = JSON.parse(clean);
      return {
        sql: parsed.sql?.trim() || 'SELECT 1;',
        explanation: parsed.explanation || 'Query generated by AI.',
        executiveSummary: parsed.executiveSummary || 'Data retrieved successfully.',
        recommendedChart: parsed.recommendedChart || 'table',
        chartConfig: parsed.chartConfig || null,
        isAiGenerated: true
      };
    } catch (e) {
      throw new Error(`Failed to parse AI JSON response: ${clean}`);
    }
  }

  /**
   * Formats the relational database schema into clean documentation for the LLM.
   */
  formatSchemaPrompt(schema) {
    let text = '';
    for (const table of schema.tables || []) {
      text += `Table: "${table.name}" (${table.rowCount || 0} rows)\n`;
      text += `Columns:\n`;
      for (const col of table.columns || []) {
        const pk = col.isPrimaryKey ? ' [PRIMARY KEY]' : '';
        const nn = col.notNull ? ' NOT NULL' : '';
        text += `  - ${col.name} (${col.type})${pk}${nn}\n`;
      }
      text += '\n';
    }

    if (schema.relations && schema.relations.length > 0) {
      text += `Foreign Key Relationships:\n`;
      for (const rel of schema.relations) {
        text += `  - "${rel.fromTable}"."${rel.fromColumn}" ➔ "${rel.toTable}"."${rel.toColumn}"\n`;
      }
    }

    return text;
  }
}
