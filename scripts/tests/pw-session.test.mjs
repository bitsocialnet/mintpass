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
  listing="$(for file in "$PW_TEST_DIR"/session-*; do
    [ -f "$file" ] || continue
    printf -- '- %s:\\n  - status: open\\n' "\${file##*/session-}"
  done)"
  if [ "\${PW_TEST_PAUSE_LIST:-}" = 1 ]; then
    touch "$PW_TEST_DIR/paused"
    while [ ! -f "$PW_TEST_DIR/resume" ]; do sleep 0.02; done
  fi
  printf '%s\\n' "$listing"
  exit 0
fi
session="\${1#-s=}"
case "$2" in
  open)
    if [ "\${PW_TEST_PAUSE_OPEN:-}" = 1 ]; then
      touch "$PW_TEST_DIR/paused"
      while [ ! -f "$PW_TEST_DIR/resume" ]; do sleep 0.02; done
    fi
    touch "$PW_TEST_DIR/session-$session"
    [ "\${PW_TEST_FAIL_OPEN:-}" != 1 ] ;;
  close)
    [ "\${PW_TEST_FAIL_CLOSE:-}" != 1 ] || exit 1
    rm -f "$PW_TEST_DIR/session-$session" ;;
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
  await writeFile(
    path.join(bin, "rm"),
    `#!/bin/bash
if [ "\${PW_TEST_PAUSE_RELEASE:-}" = 1 ] && [ "$2" = "$PLAYWRIGHT_RESOURCE_LOCK_DIR/owner" ]; then
  touch "$PW_TEST_DIR/paused"
  while [ ! -f "$PW_TEST_DIR/resume" ]; do sleep 0.02; done
fi
/bin/rm "$@"
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

async function pausedOperation(t, f, args, flag) {
  const child = spawn("bash", [wrapper, ...args], {
    env: { ...f.env, [flag]: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  t.after(async () => {
    await writeFile(path.join(f.dir, "resume"), "").catch(() => {});
    child.kill();
  });
  await waitForFile(path.join(f.dir, "paused"));
  return async () => {
    await writeFile(path.join(f.dir, "resume"), "");
    assert.equal(await exited, 0, output);
  };
}

test("two stale-lock reclaimers cannot both launch browsers", async (t) => {
  const f = await fixture(t);
  assert.equal(f.run("open", "old").status, 0);
  await rm(path.join(f.dir, "session-old"));
  const resume = await pausedOperation(t, f, ["open", "first"], "PW_TEST_PAUSE_LIST");
  const second = f.run("open", "second");
  await resume();
  assert.equal(second.status, 75, second.stdout + second.stderr);
  assert.equal((await readFile(path.join(f.lock, "owner"), "utf8")).trim(), "first");
  assert.equal(f.run("close", "first").status, 0);
});

test("release cannot delete a replacement reservation", async (t) => {
  const f = await fixture(t);
  assert.equal(f.run("open", "first").status, 0);
  await rm(path.join(f.dir, "session-first"));
  const resume = await pausedOperation(t, f, ["release", "first"], "PW_TEST_PAUSE_RELEASE");
  const second = f.run("open", "second");
  await resume();
  assert.equal(second.status, 75, second.stdout + second.stderr);
  assert.equal(f.run("open", "second").status, 0);
  assert.equal(f.run("close", "second").status, 0);
});

test("a failed open closes any partially launched browser before freeing its slot", async (t) => {
  const f = await fixture(t);
  f.env.PW_TEST_FAIL_OPEN = "1";
  assert.equal(f.run("open", "first").status, 1);
  await assert.rejects(readFile(path.join(f.dir, "session-first")), { code: "ENOENT" });
  delete f.env.PW_TEST_FAIL_OPEN;
  assert.equal(f.run("open", "second").status, 0);
  assert.equal(f.run("close", "second").status, 0);
});

for (const failOpen of [false, true]) {
  test(`a failed close keeps the browser slot (failed open: ${failOpen})`, async (t) => {
    const f = await fixture(t);
    f.env.PW_TEST_FAIL_CLOSE = "1";
    if (failOpen) f.env.PW_TEST_FAIL_OPEN = "1";
    assert.equal(f.run("open", "first").status, failOpen ? 1 : 0);
    assert.equal(f.run("close", "first").status, 1);
    delete f.env.PW_TEST_FAIL_OPEN;
    assert.equal(f.run("open", "second").status, 75);
    assert.equal((await readFile(path.join(f.lock, "owner"), "utf8")).trim(), "first");
    delete f.env.PW_TEST_FAIL_CLOSE;
    assert.equal(f.run("close", "first").status, 0);
  });
}

test("close and release cannot free a reservation while its launcher is still running", async (t) => {
  const f = await fixture(t);
  const resume = await pausedOperation(t, f, ["open", "first"], "PW_TEST_PAUSE_OPEN");
  assert.equal(f.run("close", "first").status, 1);
  assert.equal(f.run("release", "first").status, 1);
  await resume();
  assert.equal(f.run("release", "first").status, 1);
  assert.equal(f.run("close", "first").status, 0);
});

test("an abandoned operation guard fails closed instead of risking another reservation", async (t) => {
  const f = await fixture(t);
  await mkdir(`${f.lock}.guard`);
  assert.equal(f.run("open", "first").status, 75);
  await assert.rejects(readFile(path.join(f.dir, "session-first")), { code: "ENOENT" });
});

test("an unavailable CLI cannot free a live browser reservation", async (t) => {
  const f = await fixture(t);
  assert.equal(f.run("open", "first").status, 0);
  const cli = f.env.PLAYWRIGHT_CLI_BIN;
  f.env.PLAYWRIGHT_CLI_BIN = path.join(f.dir, "missing-cli");
  assert.notEqual(f.run("close", "first").status, 0);
  assert.equal(f.run("release", "first").status, 1);
  assert.equal(f.run("open", "second").status, 75);
  assert.equal((await readFile(path.join(f.lock, "owner"), "utf8")).trim(), "first");
  f.env.PLAYWRIGHT_CLI_BIN = cli;
  assert.equal(f.run("close", "first").status, 0);
});
