import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
import { workflow } from '../ai-workflow.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mintpass-workflow-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const skill = path.join(root, '.agents/skills/example');
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: example\ndescription: Example skill\n---\nInstructions\n');
  return root;
}

test('sync is idempotent and preserves binary assets and executable modes', (t) => {
  const root = fixture(t);
  const skill = path.join(root, '.agents/skills/example');
  const bytes = Buffer.from([0, 255, 10, 128]);
  fs.writeFileSync(path.join(skill, 'asset.bin'), bytes);
  fs.writeFileSync(path.join(skill, 'helper.sh'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  assert.deepEqual(workflow(root, 'sync').errors, []);
  assert.deepEqual(workflow(root, 'sync').errors, []);
  assert.deepEqual(workflow(root).errors, []);
  const generated = path.join(root, '.claude/skills/example');
  assert.deepEqual(fs.readFileSync(path.join(generated, 'asset.bin')), bytes);
  assert.equal(fs.statSync(path.join(generated, 'helper.sh')).mode & 0o777, 0o755);
});

test('check detects missing, drifted, obsolete and duplicate files without deleting them', (t) => {
  const root = fixture(t);
  assert.match(workflow(root).errors.join('\n'), /Missing or drifted/);
  workflow(root, 'sync');
  const generated = path.join(root, '.claude/skills/example');
  fs.writeFileSync(path.join(generated, 'SKILL.md'), 'changed');
  fs.writeFileSync(path.join(generated, 'old.txt'), 'keep');
  fs.mkdirSync(path.join(root, '.cursor/skills'), { recursive: true });
  const errors = workflow(root).errors.join('\n');
  assert.match(errors, /Missing or drifted/);
  assert.match(errors, /Obsolete generated/);
  assert.match(errors, /Duplicate skill root/);
  workflow(root, 'sync');
  assert.equal(fs.readFileSync(path.join(generated, 'old.txt'), 'utf8'), 'keep');
});

test('agent templates leave model decisions to the runtime', (t) => {
  const root = fixture(t);
  const agents = path.join(root, '.agents/skills/example/agents');
  fs.mkdirSync(agents);
  fs.writeFileSync(path.join(agents, 'reviewer.toml'), 'model_reasoning_effort = "high"\n');
  assert.match(workflow(root).errors.join('\n'), /runtime model settings/);
  fs.writeFileSync(path.join(agents, 'reviewer.toml'), 'name = "reviewer"\n');
  assert.deepEqual(workflow(root, 'sync').errors, []);
});

// These fake executables record the optional vendor helper's real subprocess argv;
// no authenticated CLI, model provider, or project source is invoked.
for (const provider of ['codex', 'claude']) {
  test(`Impeccable ${provider} copy runner inherits model and permissions unless explicitly configured`, async (t) => {
    const { runCopyEditBatchAgent } = await import('../../.agents/skills/impeccable/scripts/live-copy-edit-agent.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'impeccable-runner-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    const capture = path.join(root, 'argv.json');
    fs.writeFileSync(
      path.join(bin, provider),
      `#!${process.execPath}\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nfs.writeFileSync(process.env.ARGV_OUTPUT, JSON.stringify(args));\nconst result = JSON.stringify({status:'done', appliedEntryIds:[], failed:[], files:[], notes:[]});\nconst output = args.indexOf('--output-last-message');\nif (output >= 0) fs.writeFileSync(args[output + 1], result);\nelse process.stdout.write(result);\nprocess.stdin.resume();\n`,
      { mode: 0o755 },
    );
    const env = { PATH: bin, ARGV_OUTPUT: capture };
    const run = async (overrides = {}) => {
      await runCopyEditBatchAgent({ entries: [] }, { provider, cwd: root, outDir: path.join(root, 'out'), env: { ...env, ...overrides }, timeoutMs: 5000 });
      return JSON.parse(fs.readFileSync(capture, 'utf8'));
    };
    const inherited = await run();
    assert.ok(!inherited.includes('--model'));
    assert.ok(!inherited.some((arg) => arg.startsWith('model_reasoning_effort=')));
    assert.ok(!inherited.includes('--dangerously-bypass-approvals-and-sandbox'));
    assert.ok(!inherited.includes('--permission-mode'));
    const selected = await run({ IMPECCABLE_LIVE_COPY_AGENT_MODEL: 'chosen-at-runtime', IMPECCABLE_LIVE_COPY_AGENT_EFFORT: 'high' });
    assert.equal(selected[selected.indexOf('--model') + 1], 'chosen-at-runtime');
    if (provider === 'codex') assert.ok(selected.includes('model_reasoning_effort="high"'));
  });
}

test('Impeccable context CLI keeps project facts while respecting session scope', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'impeccable-context-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"context-fixture","version":"1.0.0"}');
  fs.writeFileSync(path.join(root, 'PRODUCT.md'), '# Product\n\n## What it is\nA fixture catalog for testing the context helper.\n');
  fs.writeFileSync(path.join(root, 'DESIGN.md'), '# Design\n\nKeep the fixture catalog compact.\n');
  const script = path.join(repository, '.agents/skills/impeccable/scripts/context.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, IMPECCABLE_NO_UPDATE_CHECK: '1', IMPECCABLE_CONTEXT_DIR: root },
    timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fixture catalog/);
  assert.match(result.stdout, /TASK_SCOPE:/);
  assert.match(result.stdout, /DELEGATION:/);
  assert.doesNotMatch(result.stdout, /AUTONOMY_DIRECTIVE_CHECK|SUBAGENT_AUTHORIZATION|probe once|is that request for the skill/);
});

// Exercise the managed-repository branch without changing the working checkout.
test('Impeccable pinning keeps generated skills under the sync command', (t) => {
  const root = fixture(t);
  const shared = '.agents/skills/impeccable';
  fs.cpSync(path.join(repository, shared), path.join(root, shared), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.writeFileSync(path.join(root, 'scripts/ai-workflow.mjs'), '// sync entry point');
  workflow(root, 'sync');
  const generated = path.join(root, '.claude/skills/audit/SKILL.md');
  fs.mkdirSync(path.dirname(generated));
  fs.writeFileSync(generated, 'Unrelated skill');
  for (const action of ['pin', 'unpin']) {
    const result = spawnSync(process.execPath, [path.join(root, shared, 'scripts/pin.mjs'), action, 'audit'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, '.agents/skills/audit')), action === 'pin');
    assert.equal(fs.readFileSync(generated, 'utf8'), 'Unrelated skill');
    assert.equal(fs.existsSync(path.join(root, '.cursor/skills')), false);
  }
});
