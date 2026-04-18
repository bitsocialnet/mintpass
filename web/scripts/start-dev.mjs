#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { get } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const binDir = path.join(webRoot, "node_modules", ".bin");
const executableSuffix = isWindows ? ".cmd" : "";
const portlessBin = path.join(binDir, `portless${executableSuffix}`);
const appName = "mintpass";
const canonicalBranches = new Set(["main", "master"]);
const usePortless = process.env.PORTLESS !== "0" && !isWindows && existsSync(portlessBin);

function sanitizeLabel(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getCurrentBranch() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: webRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function getPublicUrl() {
  if (!usePortless) {
    return null;
  }

  const branch = getCurrentBranch();

  if (!branch || canonicalBranches.has(branch)) {
    return `http://${appName}.localhost:1355`;
  }

  const lastSegment = branch.split("/").pop() ?? branch;
  const label = sanitizeLabel(lastSegment);

  return `http://${label}.${appName}.localhost:1355`;
}

const publicUrl = getPublicUrl();
const command = usePortless ? portlessBin : "next";
const args = usePortless
  ? ["run", "--name", appName, "next", "dev", "--turbopack"]
  : ["dev", "--turbopack"];

const child = spawn(command, args, {
  cwd: webRoot,
  stdio: "inherit",
  env: process.env,
});

if (publicUrl && process.env.BROWSER !== "none") {
  waitForHttpReady(publicUrl, 30_000)
    .then(() => {
      console.log(`Opening ${publicUrl} in browser...`);
      openInBrowser(publicUrl);
    })
    .catch((error) => {
      console.warn(`Could not auto-open ${publicUrl}: ${error.message}`);
    });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

async function waitForHttpReady(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const request = get(url, (response) => {
        response.resume();
        const statusCode = response.statusCode ?? 500;
        resolve(statusCode >= 200 && statusCode < 400);
      });

      request.on("error", () => resolve(false));
      request.setTimeout(2_000, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (ready) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function openInBrowser(url) {
  const opener =
    process.platform === "darwin" ? { cmd: "open", args: [url] }
    : process.platform === "win32" ? { cmd: "cmd", args: ["/c", "start", '""', url] }
    : { cmd: "xdg-open", args: [url] };

  spawn(opener.cmd, opener.args, { stdio: "ignore", detached: true }).unref();
}
