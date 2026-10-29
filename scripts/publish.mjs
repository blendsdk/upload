#!/usr/bin/env node
/**
 * Publish all public upload packages with npm rather than pnpm.
 *
 * The repository uses pnpm for installation, but pnpm's publish transport
 * does not use the same npm authentication/trusted-publishing path in every
 * environment. The lockstep publisher accepts an explicit package manager, so
 * this wrapper keeps the release workflow on npm's OIDC path.
 */
import { Lockstep } from '@blendsdk/lockstep';

const args = process.argv.slice(2);
const tag = args.find((arg) => !arg.startsWith('--'));
if (!tag) {
  console.error(
    'Usage: node scripts/publish.mjs <dist-tag> [--exact] [--dry] [--preflight] [--provenance]',
  );
  process.exit(1);
}

const lockstep = new Lockstep({
  root: process.cwd(),
  packagesDirs: ['packages'],
  packageManager: 'npm',
});

await lockstep.publish({
  tag,
  access: 'public',
  tagMode: args.includes('--exact') ? 'exact' : 'branch',
  dry: args.includes('--dry'),
  preflight: args.includes('--preflight'),
  provenance: args.includes('--provenance'),
});
