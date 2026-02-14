#!/usr/bin/env node

import { init, update, status } from '../lib/installer.mjs';
import { setup as benchSetup, update as benchUpdate, metrics as benchMetrics, compare as benchCompare, run as benchRun } from '../lib/benchmark.mjs';

const HELP = `
poor-dev - AI-powered development workflow slash commands

Usage:
  poor-dev init   [dir]    Install commands & agents into a project
  poor-dev update [dir]    Update to the latest version
  poor-dev status [dir]    Show installation status

  poor-dev benchmark setup       Set up benchmark directories
  poor-dev benchmark update      Update benchmark skill files
  poor-dev benchmark metrics <dir>  Collect metrics for a directory
  poor-dev benchmark compare     Generate COMPARISON.md
  poor-dev benchmark run <combo> [version]  Run a benchmark end-to-end

Options:
  dir    Target directory (defaults to current directory)

Examples:
  npx github:BaconGame4423/PoorDevSkills init
  npx github:BaconGame4423/PoorDevSkills update
  npx github:BaconGame4423/PoorDevSkills status
  npx github:BaconGame4423/PoorDevSkills benchmark setup
`.trim();

const [subcommand, targetArg] = process.argv.slice(2);
const targetDir = targetArg || process.cwd();

switch (subcommand) {
  case 'init':
    await init(targetDir);
    break;
  case 'update':
    await update(targetDir);
    break;
  case 'status':
    await status(targetDir);
    break;
  case 'benchmark': {
    const action = process.argv[3];
    switch (action) {
      case 'setup':   benchSetup(); break;
      case 'update':  benchUpdate(); break;
      case 'metrics': benchMetrics(process.argv[4]); break;
      case 'compare': benchCompare(); break;
      case 'run':     benchRun(process.argv[4], process.argv[5]); break;
      default:
        console.error(`Unknown benchmark action: ${action || '(none)'}`);
        console.log('Available: setup, update, metrics <dir>, compare, run <combo> [version]');
        process.exit(1);
    }
    break;
  }
  default:
    console.log(HELP);
    process.exit(subcommand ? 1 : 0);
}
