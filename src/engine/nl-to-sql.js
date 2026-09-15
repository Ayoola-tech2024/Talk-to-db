/**
 * Plain English Natural Language to SQL Query Synthesis Engine.
 * Enables non-technical students, analysts, and founders to query databases with natural prompts.
 */
export class NlToSqlEngine {
  constructor(schema) {
    this.schema = schema; // { tables, relations }
  }

  /**
   * Converts a natural English prompt into an executable SQL query + plain English explanation.
   * @param {string} prompt
   */
  translate(prompt = '') {
    const rawPrompt = prompt.trim();
    const lower = rawPrompt.toLowerCase();

    if (!rawPrompt) {
      return {
        sql: 'SELECT * FROM students LIMIT 10;',
        explanation: 'Default fallback query retrieving the first 10 records.',
        confidence: 0.5
      };
    }

    // 1. Identify Target Primary Table
    let primaryTable = this.findBestTableMatch(lower);
    if (!primaryTable && this.schema.tables.length > 0) {
      primaryTable = this.schema.tables[0].name;
    }

    const tableObj = this.schema.tables.find(t => t.name === primaryTable);
    const columns = tableObj ? tableObj.columns : [];

    // 2. Parse Limits (e.g. "top 5", "limit 10", "first 3")
    let limit = 25;
    const limitMatch = lower.match(/\b(top|first|limit)\s+(\d+)\b/i);
    if (limitMatch) {
      limit = parseInt(limitMatch[2], 10);
    }

    // 3. Parse Aggregations & Column Selections
    let selectClause = `SELECT *`;
    let isCountQuery = false;
    let isAvgQuery = false;
    let isSumQuery = false;
    let explanationSteps = [];

    if (lower.startsWith('how many') || lower.includes('count of') || lower.includes('total number of')) {
      selectClause = `SELECT COUNT(*) as total_count`;
      isCountQuery = true;
      explanationSteps.push(`Calculates the total count of records in **${primaryTable}**`);
    } else if (lower.includes('average ') || lower.includes('avg ')) {
      const numCol = columns.find(c => ['gpa', 'score', 'salary', 'price', 'budget', 'rating', 'total_amount'].includes(c.name.toLowerCase()));
      if (numCol) {
        selectClause = `SELECT AVG(${numCol.name}) as average_${numCol.name}`;
        isAvgQuery = true;
        explanationSteps.push(`Computes the average **${numCol.name}** across **${primaryTable}**`);
      }
    } else if (lower.includes('total ') || lower.includes('sum of ')) {
      const numCol = columns.find(c => ['budget', 'salary', 'total_spent', 'total_amount', 'price'].includes(c.name.toLowerCase()));
      if (numCol) {
        selectClause = `SELECT SUM(${numCol.name}) as total_${numCol.name}`;
        isSumQuery = true;
        explanationSteps.push(`Calculates the grand total sum of **${numCol.name}** in **${primaryTable}**`);
      }
    } else {
      explanationSteps.push(`Selects relevant columns from **${primaryTable}**`);
    }

    // 4. Parse JOINs (e.g., "with their department", "show orders with customer", "student course")
    let joinClause = '';
    const joinedTables = [];

    for (const rel of this.schema.relations || []) {
      if (rel.fromTable === primaryTable && !joinedTables.includes(rel.toTable)) {
        const targetTable = rel.toTable;
        const singular = targetTable.endsWith('s') ? targetTable.slice(0, -1) : targetTable;
        if (lower.includes(targetTable) || lower.includes(singular) || lower.includes('department') || lower.includes('course') || lower.includes('customer')) {
          joinClause += `\nJOIN ${targetTable} ON ${primaryTable}.${rel.fromColumn} = ${targetTable}.${rel.toColumn}`;
          joinedTables.push(targetTable);
          explanationSteps.push(`Connects **${primaryTable}** with **${targetTable}** using the relationship on \`${rel.fromColumn}\``);
        }
      } else if (rel.toTable === primaryTable && !joinedTables.includes(rel.fromTable)) {
        const sourceTable = rel.fromTable;
        const singular = sourceTable.endsWith('s') ? sourceTable.slice(0, -1) : sourceTable;
        if (lower.includes(sourceTable) || lower.includes(singular)) {
          joinClause += `\nJOIN ${sourceTable} ON ${sourceTable}.${rel.fromColumn} = ${primaryTable}.${rel.toColumn}`;
          joinedTables.push(sourceTable);
          explanationSteps.push(`Connects **${primaryTable}** with **${sourceTable}** using the relationship on \`${rel.toColumn}\``);
        }
      }
    }

    // 5. Parse WHERE Filtering
    const whereConditions = [];

    // Numerical comparisons (> , < , >=, <=)
    const gpaMatch = lower.match(/gpa\s*(above|>|greater than|>=)\s*([0-9.]+)/i);
    if (gpaMatch) {
      whereConditions.push(`gpa >= ${gpaMatch[2]}`);
      explanationSteps.push(`Filters for GPA greater than or equal to ${gpaMatch[2]}`);
    }

    const scoreMatch = lower.match(/score\s*(above|>|greater than|>=)\s*(\d+)/i);
    if (scoreMatch) {
      whereConditions.push(`score >= ${scoreMatch[2]}`);
      explanationSteps.push(`Filters for score of at least ${scoreMatch[2]} marks`);
    }

    const priceMatch = lower.match(/(price|cost)\s*(below|<|less than|under|<=)\s*(\d+)/i);
    if (priceMatch) {
      whereConditions.push(`price <= ${priceMatch[3]}`);
      explanationSteps.push(`Filters for price under ₦${parseInt(priceMatch[3], 10).toLocaleString()}`);
    }

    const stockMatch = lower.match(/(zero|out of|no|low)\s+stock/i);
    if (stockMatch) {
      whereConditions.push(`stock = 0`);
      explanationSteps.push(`Filters for items currently out of stock`);
    }

    const statusMatch = lower.match(/status\s*(is|=)\s*['"]?([a-zA-Z]+)['"]?/i) || lower.match(/\b(delivered|shipped|processing|passed|failed)\b/i);
    if (statusMatch) {
      const st = statusMatch[2] || statusMatch[1];
      whereConditions.push(`LOWER(status) = '${st.toLowerCase()}'`);
      explanationSteps.push(`Filters for status matching '${st}'`);
    }

    // String / Keyword Search in Text Columns
    const searchMatch = lower.match(/(named|titled|called|search for|find)\s+['"]?([a-zA-Z0-9_-]+)['"]?/i);
    if (searchMatch) {
      const term = searchMatch[2];
      const textCol = columns.find(c => ['name', 'title', 'full_name', 'code', 'brand'].includes(c.name.toLowerCase()));
      if (textCol) {
        whereConditions.push(`${textCol.name} LIKE '%${term}%'`);
        explanationSteps.push(`Searches for \`${term}\` in the \`${textCol.name}\` field`);
      }
    }

    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = `\nWHERE ` + whereConditions.join(' AND ');
    }

    // 6. Parse ORDER BY (Sorting)
    let orderClause = '';
    if (lower.includes('highest') || lower.includes('top') || lower.includes('most') || lower.includes('best') || lower.includes('expensive')) {
      const sortCol = columns.find(c => ['gpa', 'score', 'salary', 'price', 'budget', 'rating', 'total_spent', 'total_amount'].includes(c.name.toLowerCase()));
      if (sortCol) {
        orderClause = `\nORDER BY ${primaryTable}.${sortCol.name} DESC`;
        explanationSteps.push(`Ranks results from highest to lowest by **${sortCol.name}**`);
      }
    } else if (lower.includes('lowest') || lower.includes('cheapest') || lower.includes('worst') || lower.includes('least')) {
      const sortCol = columns.find(c => ['price', 'gpa', 'score', 'salary', 'stock', 'budget'].includes(c.name.toLowerCase()));
      if (sortCol) {
        orderClause = `\nORDER BY ${primaryTable}.${sortCol.name} ASC`;
        explanationSteps.push(`Ranks results from lowest to highest by **${sortCol.name}**`);
      }
    } else if (lower.includes('latest') || lower.includes('newest') || lower.includes('recent')) {
      const dateCol = columns.find(c => ['created_at', 'order_date', 'enrollment_year', 'paid_at'].includes(c.name.toLowerCase()));
      if (dateCol) {
        orderClause = `\nORDER BY ${primaryTable}.${dateCol.name} DESC`;
        explanationSteps.push(`Sorts by newest **${dateCol.name}** first`);
      }
    }

    // 7. Compose Final SQL Query
    let finalSql = `${selectClause} FROM ${primaryTable}${joinClause}${whereClause}${orderClause}`;
    if (!isCountQuery && !isAvgQuery && !isSumQuery) {
      finalSql += `\nLIMIT ${limit};`;
      explanationSteps.push(`Limits the maximum output to ${limit} records`);
    } else {
      finalSql += ';';
    }

    const explanation = `**Step-by-step Query Logic**:\n` + explanationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');

    // Generate human-friendly executive takeaway
    let execSummary = `Retrieved matching records from **${primaryTable}**.`;
    if (isCountQuery) {
      execSummary = `Count query calculating the total volume of records in **${primaryTable}**.`;
    } else if (isAvgQuery) {
      execSummary = `Statistical aggregation computing the average metric across **${primaryTable}**.`;
    } else if (orderClause.includes('DESC')) {
      execSummary = `Ranked the top records from **${primaryTable}** in descending order.`;
    } else if (whereClause) {
      execSummary = `Filtered **${primaryTable}** records matching your custom criteria.`;
    }

    return {
      sql: finalSql,
      explanation,
      executiveSummary: execSummary,
      primaryTable,
      confidence: 0.95
    };
  }

  /**
   * Helper to identify the target database table from natural text keywords based on earliest occurrence.
   */
  findBestTableMatch(lower) {
    const matches = [];

    for (const table of this.schema.tables || []) {
      const tName = table.name.toLowerCase();
      const singular = tName.endsWith('s') ? tName.slice(0, -1) : tName;

      let idx = lower.indexOf(tName);
      if (idx === -1) idx = lower.indexOf(singular);

      if (idx !== -1) {
        matches.push({ tableName: table.name, index: idx });
      }
    }

    // Sort by earliest appearance in the question
    if (matches.length > 0) {
      matches.sort((a, b) => a.index - b.index);
      return matches[0].tableName;
    }

    // Fallback heuristics for common terms
    if (lower.includes('student') || lower.includes('gpa') || lower.includes('matric')) return 'students';
    if (lower.includes('course') || lower.includes('class') || lower.includes('unit')) return 'courses';
    if (lower.includes('grade') || lower.includes('score') || lower.includes('passed') || lower.includes('failed') || lower.includes('enroll')) return 'enrollments';
    if (lower.includes('teacher') || lower.includes('lecturer') || lower.includes('professor') || lower.includes('instructor')) return 'instructors';
    if (lower.includes('dept') || lower.includes('department') || lower.includes('faculty')) return 'departments';
    if (lower.includes('product') || lower.includes('inverter') || lower.includes('battery') || lower.includes('panel')) return 'products';
    if (lower.includes('order') || lower.includes('sale') || lower.includes('purchase')) return 'orders';
    if (lower.includes('customer') || lower.includes('buyer') || lower.includes('user') || lower.includes('client')) return 'customers';
    if (lower.includes('review') || lower.includes('rating') || lower.includes('feedback')) return 'reviews';

    return null;
  }
}
