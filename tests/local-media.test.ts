import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Photos awaiting their owner's permission live in media-local/ and must never be
 * committed (every push deploys). These tests fail loudly if that guard is weakened.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
const LOCAL_PATHS = ['media-local/', 'public/media-local/', 'src/data/media-local.json'];

describe('local-only photos', () => {
  it('are git-ignored', () => {
    const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
    for (const p of LOCAL_PATHS) expect(ignore).toContain(p);
  });

  it('are not tracked by git', () => {
    const tracked = execFileSync('git', ['ls-files', '--', ...LOCAL_PATHS], { cwd: ROOT, encoding: 'utf8' });
    expect(tracked.trim()).toBe('');
  });

  it('are only read in local development', () => {
    const story = readFileSync(path.join(ROOT, 'src/lib/story.ts'), 'utf8');
    expect(story).toMatch(/const localManifest[^=]*= import\.meta\.env\.DEV/);
  });
});
