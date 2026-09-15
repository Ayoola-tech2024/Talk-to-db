/**
 * Intelligent Mock Data Generator for TalkToDB.
 * Generates realistic context-aware sample records for custom schemas (e-commerce, solar, fintech, users, orders, etc.)
 */
export class MockSeeder {
  constructor(adapter) {
    this.adapter = adapter;
  }

  seedTable(tableName, count = 10) {
    const cols = this.adapter.getTableColumns(tableName);
    if (!cols || cols.length === 0) return 0;

    const lowerName = tableName.toLowerCase();

    // Check if table already has data
    const existing = this.adapter.getTableRowCount(tableName);
    if (existing > 0) return existing;

    const rowsToInsert = [];

    for (let i = 1; i <= count; i++) {
      const row = {};
      for (const col of cols) {
        const cName = col.name.toLowerCase();
        const cType = (col.type || '').toUpperCase();

        if (col.isPrimaryKey || col.pk) {
          if (cType.includes('INT')) {
            row[col.name] = i;
          } else {
            row[col.name] = `${lowerName.slice(0, 3)}-${1000 + i}`;
          }
          continue;
        }

        // Context-aware value synthesis
        if (cName.includes('email')) {
          const names = ['ayoola', 'fatima', 'emeka', 'chidi', 'zainab', 'bolanle', 'tunde', 'ade', 'ngozi', 'khalid'];
          row[col.name] = `${names[(i - 1) % names.length]}${i}@example.com`;
        } else if (cName === 'name' || cName.includes('full_name') || cName.includes('delivery_name')) {
          const names = ['Ayoola Damisile', 'Fatima Bello', 'Emeka Okafor', 'Chidi Nwosu', 'Zainab Aliyu', 'Bolanle Adeleke', 'Tunde Bakare', 'Ade Johnson', 'Ngozi Eze', 'Khalid Ibrahim'];
          row[col.name] = names[(i - 1) % names.length];
        } else if (cName.includes('phone')) {
          row[col.name] = `+234 80${(12345678 + i * 1111).toString().slice(0, 8)}`;
        } else if (cName.includes('city')) {
          const cities = ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt', 'Enugu', 'Kano', 'Abeokuta'];
          row[col.name] = cities[(i - 1) % cities.length];
        } else if (cName.includes('state')) {
          const states = ['Lagos State', 'FCT', 'Oyo State', 'Rivers State', 'Enugu State', 'Kano State', 'Ogun State'];
          row[col.name] = states[(i - 1) % states.length];
        } else if (cName.includes('address')) {
          row[col.name] = `${12 + i} Victoria Island Boulevard, Lagos`;
        } else if (cName.includes('status')) {
          const statuses = ['delivered', 'confirmed', 'shipped', 'paid', 'pending'];
          row[col.name] = statuses[(i - 1) % statuses.length];
        } else if (cName.includes('payment_method')) {
          row[col.name] = i % 2 === 0 ? 'paystack' : 'bank-transfer';
        } else if (cName === 'subtotal' || cName === 'total' || cName.includes('price') || cName.includes('amount') || cName.includes('salary') || cName.includes('fee')) {
          if (cName.includes('fee')) {
            row[col.name] = 15000;
          } else {
            const prices = [350000, 750000, 1200000, 2400000, 480000, 890000, 1550000];
            row[col.name] = prices[(i - 1) % prices.length];
          }
        } else if (cName.includes('items')) {
          row[col.name] = JSON.stringify([
            { product_id: 'inv-3kva-mppt', product_name: '3.5kVA / 24V Pure Sine Wave MPPT Inverter', price: 480000, quantity: 1, subtotal: 480000 },
            { product_id: 'bat-200ah-lifepo4', product_name: '200Ah 12V LiFePO4 Lithium Battery', price: 350000, quantity: 2, subtotal: 700000 }
          ]);
        } else if (cName.includes('category')) {
          const cats = ['Inverters', 'Lithium Batteries', 'Solar Panels', 'Charge Controllers', 'Solar Generators', 'Accessories'];
          row[col.name] = cats[(i - 1) % cats.length];
        } else if (cName.includes('brand')) {
          const brands = ['Felicity Solar', 'Growatt', 'Must Energy', 'Luminous', 'Victron', 'Huawei'];
          row[col.name] = brands[(i - 1) % brands.length];
        } else if (cName.includes('rating')) {
          row[col.name] = Number((4.0 + (i % 10) * 0.1).toFixed(1));
        } else if (cName.includes('review_count') || cName.includes('stock_count') || cName.includes('quantity')) {
          row[col.name] = 5 + (i * 3);
        } else if (cName.includes('in_stock') || cName.includes('featured') || cName.includes('active')) {
          row[col.name] = 1; // True in SQLite
        } else if (cName.includes('user_id')) {
          try {
            const uRows = this.adapter.query('SELECT id FROM "users" LIMIT 10;');
            if (uRows.length > 0) {
              row[col.name] = uRows[(i - 1) % uRows.length].id;
            } else {
              row[col.name] = `use-${1000 + ((i - 1) % 5 + 1)}`;
            }
          } catch {
            row[col.name] = `use-${1000 + ((i - 1) % 5 + 1)}`;
          }
        } else if (cName.includes('product_id')) {
          try {
            const pRows = this.adapter.query('SELECT id FROM "products" LIMIT 10;');
            if (pRows.length > 0) {
              row[col.name] = pRows[(i - 1) % pRows.length].id;
            } else {
              row[col.name] = `pro-${1000 + ((i - 1) % 6 + 1)}`;
            }
          } catch {
            row[col.name] = `pro-${1000 + ((i - 1) % 6 + 1)}`;
          }
        } else if (cName.includes('created_at') || cName.includes('updated_at') || cName.includes('start_date') || cName.includes('end_date') || cName.includes('date')) {
          row[col.name] = new Date(Date.now() - (count - i) * 86400000 * 2).toISOString();
        } else if (cName.includes('description') || cName.includes('comment') || cName.includes('message')) {
          row[col.name] = `High performance high quality solar power equipment item #${i}. Excellent durability and efficiency.`;
        } else if (cName.includes('code')) {
          row[col.name] = `SOLAR${i}0`;
        } else if (cName.includes('type')) {
          row[col.name] = 'percentage';
        } else if (cName.includes('value')) {
          row[col.name] = 10 + i;
        } else {
          if (cType.includes('INT')) {
            row[col.name] = i * 10;
          } else if (cType.includes('REAL') || cType.includes('DOUBLE')) {
            row[col.name] = i * 1.5;
          } else {
            row[col.name] = `Sample ${col.name} ${i}`;
          }
        }
      }
      rowsToInsert.push(row);
    }

    // Insert rows
    let insertedCount = 0;
    for (const row of rowsToInsert) {
      const keys = Object.keys(row);
      const colsStr = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(k => row[k]);
      try {
        const stmt = this.adapter.db.prepare(`INSERT INTO "${tableName}" (${colsStr}) VALUES (${placeholders});`);
        stmt.run(...values);
        insertedCount++;
      } catch (err) {
        // Skip constraints if foreign key reference isn't seeded yet
      }
    }

    return insertedCount;
  }

  seedAllTables(countPerTable = 10) {
    const tableNames = this.adapter.getTableNames();
    const results = {};

    // Seed parent tables first (users, products, departments)
    const priority = ['users', 'departments', 'products', 'instructors', 'courses', 'store_settings', 'orders', 'cart_items', 'wishlist', 'product_reviews', 'discounts', 'flash_deals', 'contact_messages', 'enrollments'];
    const sorted = [...tableNames].sort((a, b) => {
      const idxA = priority.indexOf(a.toLowerCase());
      const idxB = priority.indexOf(b.toLowerCase());
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    for (const table of sorted) {
      results[table] = this.seedTable(table, countPerTable);
    }

    return results;
  }
}
