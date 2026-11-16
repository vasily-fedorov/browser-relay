#!/usr/bin/env node
/*
 * Copy the freshly built extension zip to the path the infra project consumes:
 * releases/chrome-extension/latest/chrome-mcp-server-lastest.zip
 *
 * The filename keeps its historical typo ("lastest") because
 * ../infra/scripts/package-extensions reads exactly that path.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'app', 'chrome-extension', '.output');
const target = join(root, 'releases', 'chrome-extension', 'latest', 'chrome-mcp-server-lastest.zip');

if (!existsSync(outputDir)) {
  console.error(`Build output not found: ${outputDir}. Run the extension build first.`);
  process.exit(1);
}

const candidates = readdirSync(outputDir)
  .filter((name) => name.endsWith('.zip'))
  .map((name) => ({ name, path: join(outputDir, name), mtime: statSync(join(outputDir, name)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (candidates.length === 0) {
  console.error(`No zip found in ${outputDir}. Run "wxt zip" first.`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(candidates[0].path, target);

const sizeMb = (statSync(target).size / 1024 / 1024).toFixed(2);
console.log(`Release: ${target} (${sizeMb} MB from ${candidates[0].name})`);
