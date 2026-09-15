/**
 * Extracts and maps relational schema graph from a connected database adapter.
 */
export class SchemaExtractor {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Generates the complete schema graph with tables, columns, relations, and ERD layout coordinates.
   */
  extractSchema() {
    const tableNames = this.adapter.getTableNames();
    const tables = [];
    const relations = [];

    // Calculate layout grid for visual canvas
    const COLS = Math.ceil(Math.sqrt(tableNames.length || 1));
    const SPACING_X = 320;
    const SPACING_Y = 280;

    tableNames.forEach((tableName, index) => {
      const rawCols = this.adapter.getTableColumns(tableName);
      const rawFks = this.adapter.getTableForeignKeys(tableName);
      const rowCount = this.adapter.getTableRowCount(tableName);

      const columns = rawCols.map(c => ({
        name: c.name,
        type: c.type || 'TEXT',
        isPrimaryKey: c.pk > 0,
        notNull: c.notnull === 1,
        defaultValue: c.dflt_value
      }));

      // Grid position for visual ERD nodes
      const colIndex = index % COLS;
      const rowIndex = Math.floor(index / COLS);
      const x = 40 + colIndex * SPACING_X;
      const y = 40 + rowIndex * SPACING_Y;

      tables.push({
        name: tableName,
        columns,
        rowCount,
        position: { x, y }
      });

      // Record foreign key connections
      rawFks.forEach(fk => {
        relations.push({
          id: `rel_${tableName}_${fk.from}_to_${fk.table}_${fk.to}`,
          fromTable: tableName,
          fromColumn: fk.from,
          toTable: fk.table,
          toColumn: fk.to,
          onUpdate: fk.on_update,
          onDelete: fk.on_delete
        });
      });
    });

    return {
      tableCount: tables.length,
      totalRelations: relations.length,
      tables,
      relations
    };
  }
}
