#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function files(root, relative = '') {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Use portable files, not symlinks: ${name}`);
      return entry.isDirectory() ? files(root, name) : [name];
    });
}

export function workflow(root, mode = 'check') {
  if (!['sync', 'check'].includes(mode)) throw new Error('Usage: node scripts/ai-workflow.mjs <sync|check>');
  const source = path.join(root, '.agents/skills');
  const destination = path.join(root, '.claude/skills');
  const names = files(source);
  const generatedNames = files(destination);
  if (!names.some((name) => name.endsWith('/SKILL.md'))) throw new Error('No shared skills found');
  const expected = new Set(names);
  const errors = [];
  for (const name of names) {
    const from = path.join(source, name);
    const to = path.join(destination, name);
    const bytes = fs.readFileSync(from);
    if (name.includes('/agents/') && name.endsWith('.toml') && /^\s*(?:model|model_reasoning_effort)\s*=/m.test(bytes.toString())) {
      errors.push(`Agent templates must use runtime model settings: ${name}`);
    }
    if (mode === 'sync') {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, bytes);
      fs.chmodSync(to, fs.statSync(from).mode & 0o777);
    } else if (!fs.existsSync(to) || !fs.readFileSync(to).equals(bytes)) {
      errors.push(`Missing or drifted generated skill: .claude/skills/${name}`);
    }
  }
  for (const name of generatedNames) {
    if (!expected.has(name)) errors.push(`Obsolete generated file: .claude/skills/${name}`);
  }
  for (const directory of ['.codex/skills', '.cursor/skills']) {
    if (fs.existsSync(path.join(root, directory))) errors.push(`Duplicate skill root: ${directory}`);
  }
  return { files: names.length, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const result = workflow(root, process.argv[2] ?? 'check');
    for (const error of result.errors) console.error(error);
    console.log(`AI workflow: ${result.files} shared skill files; ${result.errors.length} error(s).`);
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
