/**
 * Generates automated statistical summaries and quality profiles for database tables.
 */
export class TableStatistics {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Generates a complete data profile for a single table.
   */
  async profileTable(tableName) {
    const rowCount = await this.adapter.getTableRowCount(tableName);
    const columns = await this.adapter.getTableColumns(tableName);
    const colProfiles = [];

    if (rowCount === 0) {
      return {
        tableName,
        rowCount: 0,
        columns: columns.map(c => ({ name: c.name, type: c.type, nullCount: 0, nullRate: 0, distinctCount: 0 }))
      };
    }

    for (const col of columns) {
      try {
        const statsQuery = `
          SELECT 
            COUNT(CASE WHEN "${col.name}" IS NULL THEN 1 END) as null_count,
            COUNT(DISTINCT "${col.name}") as distinct_count
          FROM "${tableName}";
        `;
        const res = (await this.adapter.query(statsQuery))[0] || { null_count: 0, distinct_count: 0 };
        const nullCount = parseInt(res.null_count, 10) || 0;
        const nullRate = Math.round((nullCount / rowCount) * 100);
        const distinctCount = parseInt(res.distinct_count, 10) || 0;

        colProfiles.push({
          name: col.name,
          type: col.type || 'TEXT',
          isPrimaryKey: col.pk > 0,
          nullCount,
          nullRate,
          distinctCount
        });
      } catch {
        colProfiles.push({
          name: col.name,
          type: col.type || 'TEXT',
          isPrimaryKey: col.pk > 0,
          nullCount: 0,
          nullRate: 0,
          distinctCount: 0
        });
      }
    }

    return {
      tableName,
      rowCount,
      columns: colProfiles
    };
  }
}
