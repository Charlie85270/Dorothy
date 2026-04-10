#!/usr/bin/env bun
/**
 * factor-echelon skill pipeline build stub.
 *
 * This is a placeholder that will be replaced by Plan 01 (Foundation)
 * with the real skill parser, schema validator, and per-target builders.
 *
 * For now it echoes the requested target and exits 0 so CI stays green.
 */

const args = process.argv.slice(2);
const targetFlag = args.find(a => a.startsWith('--target='));
const target = targetFlag ? targetFlag.split('=')[1] : 'all';

const validTargets = ['claude-code', 'openclaw', 'echelon', 'all'];

if (!validTargets.includes(target)) {
  console.error(`Unknown target: ${target}. Valid targets: ${validTargets.join(', ')}`);
  process.exit(1);
}

console.log(`[build stub] target=${target} — no-op until Plan 01 populates build/`);
process.exit(0);
