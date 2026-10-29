#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');
const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packagesDir, entry.name))
  .filter((dir) => existsSync(path.join(dir, 'package.json')));

const failures = [];

for (const dir of packages) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  if (!manifest.private && !manifest.repository) {
    failures.push(`${manifest.name}: missing repository field (required for provenance)`);
  }
  if (!existsSync(path.join(dir, 'dist'))) {
    failures.push(`${manifest.name}: dist/ is missing; run the build first`);
    continue;
  }

  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: dir,
    encoding: 'utf8',
  });
  const parsed = JSON.parse(output);
  const files = parsed[0]?.files?.map((file) => file.path) ?? [];
  const forbidden = files.filter(
    (file) =>
      file.startsWith('src/') ||
      file.startsWith('test/') ||
      file.startsWith('coverage/') ||
      file.startsWith('.turbo/') ||
      file.includes('.test.') ||
      file.includes('.spec.'),
  );
  if (forbidden.length > 0) {
    failures.push(`${manifest.name}: tarball contains source/test files: ${forbidden.join(', ')}`);
  }
  if (!files.includes('dist/index.js')) {
    failures.push(`${manifest.name}: tarball is missing dist/index.js`);
  }
  console.log(`${manifest.name}: ${files.length} files`);
}

if (failures.length > 0) {
  console.error('\nPack check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nAll package tarballs passed the pack check.');
