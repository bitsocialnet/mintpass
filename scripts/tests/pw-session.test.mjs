import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const wrapper = fileURLToPath(new URL("../pw-session.sh", import.meta.url));

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "mintpass-pw-lock-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bin = path.join(dir, "bin");
  await mkdir(bin);
  const cli = path.join(bin, "playwright-cli");
  await writeFile(
    cli,
    `#!/bin/bash
set -eu
if [ "$1" = list ]; then
  for file in "$PW_TEST_DIR"/session-*; do
    [ -f "$file" ] || continue
    printf -- '- %s:\\n  - status: open\\n' "\${file##*/session-}"
  done
  exit 0
fi
session="\${1#-s=}"
case "$2" in
  open)
    if [ "\${PW_TEST_PAUSE_OPEN:-}" = 1 ]; then
      touch "$PW_TEST_DIR/paused"
      while [ ! -f "$PW_TEST_DIR/resume" ]; do sleep 0.02; done
    fi
    touch "$PW_TEST_DIR/session-$session" ;;
  close) rm -f "$PW_TEST_DIR/session-$session" ;;
esac
`,
    { mode: 0o755 },
  );
  await writeFile(
    path.join(bin, "mkdir"),
    `#!/bin/bash
/bin/mkdir "$@" || exit $?
if [ "$*" = "$PLAYWRIGHT_RESOURCE_LOCK_DIR" ] && [ "\${PW_TEST_PAUSE_METADATA:-}" = 1 ]; then
  touch "$PW_TEST_DIR/paused"
  while [ ! -f "$PW_TEST_DIR/resume" ]; do sleep 0.02; done
fi
`,
    { mode: 0o755 },
  );
  const lock = path.join(dir, "lock");
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    PLAYWRIGHT_CLI_BIN: cli,
    PLAYWRIGHT_RESOURCE_LOCK_DIR: lock,
    PW_TEST_DIR: dir,
  };
  const run = (...args) => spawnSync("bash", [wrapper, ...args], { env, encoding: "utf8" });
  return { dir, lock, env, run };
}

async function waitForFile(file) {
  for (let attempt = 0; attempt < 250; attempt++) {
    try {
      await readFile(file);
      return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${file}`);
}

for (const pause of ["PW_TEST_PAUSE_METADATA", "PW_TEST_PAUSE_OPEN"]) {
  test(`another opener cannot steal the slot during ${pause}`, async (t) => {
    const f = await fixture(t);
    const first = spawn("bash", [wrapper, "open", "first"], {
      env: { ...f.env, [pause]: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    first.stdout.on("data", (data) => {
      output += data;
    });
    first.stderr.on("data", (data) => {
      output += data;
    });
    const exited = new Promise((resolve) => first.once("exit", resolve));
    await waitForFile(path.join(f.dir, "paused"));
    const second = f.run("open", "second");
    await writeFile(path.join(f.dir, "resume"), "");
    const exitCode = await exited;
    assert.equal(second.status, 75, second.stdout + second.stderr);
    assert.equal(exitCode, 0, output);
    assert.equal((await readFile(path.join(f.lock, "owner"), "utf8")).trim(), "first");
    assert.equal(f.run("close", "first").status, 0);
  });
}

test("a live browser keeps the slot and a closed browser can be reclaimed", async (t) => {
  const f = await fixture(t);
  assert.equal(f.run("open", "first").status, 0);
  assert.equal(f.run("open", "second").status, 75);
  await rm(path.join(f.dir, "session-first"));
  assert.equal(f.run("open", "second").status, 0);
  assert.equal((await readFile(path.join(f.lock, "owner"), "utf8")).trim(), "second");
  assert.equal(f.run("close", "first").status, 0);
  assert.equal((await readFile(path.join(f.lock, "owner"), "utf8")).trim(), "second");
  assert.equal(f.run("close", "second").status, 0);
});

test("another workspace cannot close or release a same-named session", async (t) => {
  const f = await fixture(t);
  assert.equal(f.run("open", "first").status, 0);
  const otherWorkspace = path.join(f.dir, "other-workspace");
  await mkdir(otherWorkspace);
  const otherRun = (...args) =>
    spawnSync("bash", [wrapper, ...args], {
      env: f.env,
      cwd: otherWorkspace,
      encoding: "utf8",
    });
  assert.equal(otherRun("open", "first").status, 75);
  assert.equal(otherRun("close", "first").status, 1);
  assert.equal(otherRun("release", "first").status, 1);
  await readFile(path.join(f.dir, "session-first"));
  assert.equal((await readFile(path.join(f.lock, "owner"), "utf8")).trim(), "first");
  assert.equal(f.run("close", "first").status, 0);
});

test("an abandoned ownerless lock is reclaimable after the initialization grace period", async (t) => {
  const f = await fixture(t);
  await mkdir(f.lock);
  assert.equal(f.run("open", "first").status, 75);
  const old = new Date(Date.now() - 120_000);
  await utimes(f.lock, old, old);
  assert.equal(f.run("open", "first").status, 0);
  assert.equal(f.run("close", "first").status, 0);
});
