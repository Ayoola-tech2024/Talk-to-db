<p align="center">
  <h1 align="center">🔍 db-lens</h1>
  <p align="center">
    <strong>Interactive Visual Database Explorer & Plain-English SQL Query Assistant</strong><br>
    <em>Empowering students, business analysts, and developers to explore, query, and visualize databases without writing raw SQL</em>
  </p>
  <p align="center">
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node: >=18.0.0"></a>
    <a href="https://www.npmjs.com/package/@damisile_ayoola/db-lens"><img src="https://img.shields.io/npm/v/@damisile_ayoola/db-lens.svg?color=cb3837" alt="npm version"></a>
  </p>
</p>

---

## The Problem

Students studying Business Information Technology, business analysts, product managers, and non-technical founders frequently need to analyze data in SQL databases. However, raw SQL syntax (`JOIN`, `GROUP BY`, `HAVING`, foreign keys) is intimidating, and traditional database management tools are cluttered and enterprise-heavy.

**db-lens solves this by letting anyone explore databases visually and query in plain English.**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🕸️ Auto ERD Diagram** | Automatically maps tables, columns, primary keys (🔑), and foreign key connection lines (🔗) |
| **💬 Plain English SQL Assistant** | Type questions in natural English (e.g., *"Top 5 students with highest GPA"*) → instant SQL + result table |
| **💡 Step-by-Step Logic Explanation** | Explains exactly how and why each generated SQL query works in simple words |
| **📊 Instant Table Quality Metrics** | Row counts, column data types, missing/null value percentages, and completeness scores |
| **📥 1-Click CSV Export** | Export any query or table preview to CSV with a single click |
| **🎓 Built-in Educational Datasets** | Pre-loaded with **University Student Portal** and **Solar E-Commerce** databases |
| **⚡ Zero Heavy Dependencies** | Powered by Node.js built-in `DatabaseSync` engine — zero native build issues |

---

## 🚀 Quick Start

### 1. Launch with Demo Datasets in Browser

```bash
npx @damisile_ayoola/db-lens --demo
```
Open `http://localhost:4300` to interactively explore the University or E-Commerce database.

---

### 2. Open Your Own SQLite Database

```bash
npx @damisile_ayoola/db-lens ./my_database.sqlite
```

---

## 💬 Example Plain-English Queries You Can Ask

| What You Type | Generated SQL Query |
|---|---|
| *"Top 5 students with highest GPA"* | `SELECT * FROM students ORDER BY students.gpa DESC LIMIT 5;` |
| *"How many courses are in Business Information Technology?"* | `SELECT COUNT(*) as total_count FROM courses;` |
| *"Show instructors with salary above 1300000"* | `SELECT * FROM instructors WHERE salary >= 1300000 LIMIT 25;` |
| *"List students with their department"* | `SELECT * FROM students JOIN departments ON students.dept_id = departments.dept_id LIMIT 25;` |
| *"Find products with zero stock"* | `SELECT * FROM products WHERE stock = 0 LIMIT 25;` |

---

## 🛠️ CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `[dbFile]` | Path to SQLite `.sqlite`, `.db`, or `.sql` file | `:memory:` |
| `--demo` | Launch directly with the University Student Records database | `false` |
| `--dataset <name>` | Default dataset: `university`, `ecommerce` | `university` |
| `-p, --port <number>` | Web Studio port | `4300` |
| `-h, --help` | Display help | — |

---

## 🧪 Running Automated Tests

```bash
npm test
```

---

## 📜 License

MIT © [Ayoola Damisile](https://github.com/Ayoola-tech2024)
