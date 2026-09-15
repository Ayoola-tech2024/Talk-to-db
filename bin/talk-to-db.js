#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { createDbLensApp } from '../src/server.js';

const program = new Command();

program
  .name('talk-to-db')
  .description('Interactive visual database explorer, auto ERD diagram generator, and plain-English natural language query assistant.')
  .version('1.0.0')
  .argument('[dbFile]', 'Path to SQLite database file (.sqlite, .db, or .sql)', null)
  .option('-p, --port <number>', 'Port for the Web Studio UI', '4300')
  .option('--demo', 'Launch directly with the University Student Records demo database', false)
  .option('--dataset <name>', 'Default dataset to load: university, ecommerce', 'university')
  .parse(process.argv);

const options = program.opts();
const args = program.args;

async function start() {
  const port = parseInt(options.port, 10) || 4300;
  let dbPath = ':memory:';
  let defaultDataset = options.dataset || 'university';
  let customSqlFile = null;
  let isPostgres = false;

  if (args[0]) {
    const rawArg = args[0];
    if (rawArg.startsWith('postgres://') || rawArg.startsWith('postgresql://')) {
      dbPath = rawArg;
      defaultDataset = null;
      isPostgres = true;
    } else {
      const resolved = path.resolve(process.cwd(), rawArg);
      if (fs.existsSync(resolved)) {
        if (resolved.endsWith('.sql')) {
          // Raw SQL file: run in memory and seed it
          dbPath = ':memory:';
          customSqlFile = resolved;
        } else {
          dbPath = resolved;
        }
        defaultDataset = null;
      } else {
        console.log(pc.yellow(`  ⚠️  File '${args[0]}' not found. Launching with demo dataset instead.`));
      }
    }
  }

  try {
    const app = await createDbLensApp({
      dbPath,
      defaultDataset,
      customSqlFile,
      port
    });

    const server = http.createServer(app);

    server.listen(port, () => {
      printBanner({ port, dbPath, defaultDataset, customSqlFile, isPostgres });
    });

    const shutdown = () => {
      console.log(pc.yellow('\n  Shutting down TalkToDB...'));
      server.close(() => {
        console.log(pc.green('  TalkToDB stopped. Have a productive day! 🚀\n'));
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error(pc.red(`\n  ❌ Failed to connect to database: ${err.message}`));
    process.exit(1);
  }
}

function printBanner({ port, dbPath, defaultDataset, customSqlFile, isPostgres }) {
  console.log(pc.cyan(`
  ████████╗ █████╗ ██╗     ██╗  ██╗████████╗ ██████╗       ██████╗ ██████╗ 
  ╚══██╔══╝██╔══██╗██║     ██║ ██╔╝╚══██╔══╝██╔═══██╗      ██╔══██╗██╔══██╗
     ██║   ███████║██║     █████╔╝    ██║   ██║   ██║█████╗██║  ██║██████╔╝
     ██║   ██╔══██║██║     ██╔═██╗    ██║   ██║   ██║╚════╝██║  ██║██╔══██╗
     ██║   ██║  ██║███████╗██║  ██╗   ██║   ╚██████╔╝      ██████╔╝██████╔╝
     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝       ╚═════╝ ╚═════╝ 
  `));
  console.log(pc.dim('  Visual Database Explorer & Plain-English SQL Query Assistant'));
  console.log(pc.dim('  ----------------------------------------------------------------'));
  console.log(`  ${pc.bold('🖥️  Interactive Web Studio:')}  ${pc.green(`http://localhost:${port}/`)}`);
  
  let sourceLabel = '';
  if (isPostgres) {
    try {
      const u = new URL(dbPath);
      sourceLabel = `PostgreSQL Live (${u.pathname.replace('/', '') || 'db'} on ${u.hostname})`;
    } catch {
      sourceLabel = 'PostgreSQL Live Remote DB';
    }
  } else if (customSqlFile) {
    sourceLabel = `Custom SQL Dump (${path.basename(customSqlFile)})`;
  } else if (dbPath === ':memory:') {
    sourceLabel = `In-Memory (${defaultDataset} demo)`;
  } else {
    sourceLabel = dbPath;
  }
  
  console.log(`  ${pc.bold('🗄️  Active Database:')}         ${pc.magenta(sourceLabel)}`);
  console.log(`  ${pc.bold('🛡️  Safety Guard:')}            ${pc.green('100% Read-Only Mode (Database + Application Locked)')}`);
  console.log(`  ${pc.bold('💡 Plain English Prompting:')} Type questions naturally — no SQL required!`);
  console.log(pc.dim('  ----------------------------------------------------------------'));
  console.log(pc.gray('  Press Ctrl+C to stop.\n'));
}

start();
