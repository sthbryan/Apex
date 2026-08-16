#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noPush = args.includes("--no-push");
const allowDirty = args.includes("--allow-dirty");
const yes = args.includes("--yes") || args.includes("-y");
const bumpArg = args.find((a) => !a.startsWith("--")) ?? null;

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function paint(color, text) {
  return `${color}${text}${c.reset}`;
}

function fail(msg) {
  console.error(`\n  ${paint(c.red, "✗")} ${msg}\n`);
  process.exit(1);
}

function banner(current) {
  console.log(`\n   ${paint(c.cyan + c.bold, "apex")} ${paint(c.dim, "release")}\n`);
  console.log(`   ${paint(c.dim, "current")}  ${paint(c.bold + c.white, `v${current}`)}`);
  if (dryRun) console.log(`   ${paint(c.yellow, "mode")}     dry-run (no writes)`);
  console.log();
}

function parseSemver(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) fail(`invalid semver: ${v}`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const s = parseSemver(current);
  if (bump === "major") return formatSemver({ major: s.major + 1, minor: 0, patch: 0 });
  if (bump === "minor") return formatSemver({ major: s.major, minor: s.minor + 1, patch: 0 });
  if (bump === "patch") return formatSemver({ major: s.major, minor: s.minor, patch: s.patch + 1 });
  fail(`unknown bump "${bump}" (use patch|minor|major|x.y.z)`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function readWorkspaceVersion(path) {
  const src = readFileSync(path, "utf-8");
  let inSection = false;
  for (const line of src.split("\n")) {
    if (line.startsWith("[")) {
      inSection = line.trim() === "[workspace.package]";
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^version\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  fail(`no [workspace.package] version in ${path}`);
}

function bumpWorkspaceVersion(path, version) {
  const src = readFileSync(path, "utf-8");
  let inSection = false;
  let done = false;
  const out = src
    .split("\n")
    .map((line) => {
      if (line.startsWith("[")) {
        inSection = line.trim() === "[workspace.package]";
        return line;
      }
      if (inSection && !done && /^version\s*=\s*".*"/.test(line)) {
        done = true;
        return `version = "${version}"`;
      }
      return line;
    })
    .join("\n");
  if (!done) fail(`could not rewrite version in ${path}`);
  writeFileSync(path, out);
}

let stdinBuf = "";
const decoder = new TextDecoder();
let stdinReader = null;

function closeStdin() {
  if (!stdinReader) return;
  stdinReader.cancel().catch(() => {});
  stdinReader = null;
}

async function promptLine(question) {
  stdinReader ??= Bun.stdin.stream().getReader();
  process.stdout.write(question);
  while (true) {
    const nl = stdinBuf.indexOf("\n");
    if (nl !== -1) {
      const line = stdinBuf.slice(0, nl).replace(/\r$/, "");
      stdinBuf = stdinBuf.slice(nl + 1);
      return line.trim();
    }
    const { value, done } = await stdinReader.read();
    if (done) {
      const line = stdinBuf.replace(/\r$/, "");
      stdinBuf = "";
      return line.trim();
    }
    stdinBuf += decoder.decode(value, { stream: true });
  }
}

async function chooseBump(current) {
  const patch = nextVersion(current, "patch");
  const minor = nextVersion(current, "minor");
  const major = nextVersion(current, "major");

  console.log(`   ${paint(c.dim, "pick a bump")}\n`);
  console.log(
    `   ${paint(c.cyan, "1")}  ${paint(c.bold, "patch")}   ${paint(c.dim, `${current} →`)} ${paint(c.green, patch)}  ${paint(c.dim, "bugfixes")}`,
  );
  console.log(
    `   ${paint(c.cyan, "2")}  ${paint(c.bold, "minor")}   ${paint(c.dim, `${current} →`)} ${paint(c.green, minor)}  ${paint(c.dim, "features")}`,
  );
  console.log(
    `   ${paint(c.cyan, "3")}  ${paint(c.bold, "major")}   ${paint(c.dim, `${current} →`)} ${paint(c.green, major)}  ${paint(c.dim, "breaking")}`,
  );
  console.log(
    `   ${paint(c.cyan, "4")}  ${paint(c.bold, "custom")}  ${paint(c.dim, "type x.y.z")}`,
  );
  console.log(`   ${paint(c.cyan, "q")}  ${paint(c.dim, "quit")}\n`);

  const answer = (
    await promptLine(`   ${paint(c.bold, "?")}  choice ${paint(c.dim, "[1/2/3/4/q]")}: `)
  ).toLowerCase();

  if (answer === "q" || answer === "quit" || answer === "") {
    console.log(`\n   ${paint(c.dim, "aborted")}\n`);
    process.exit(0);
  }
  if (answer === "1" || answer === "patch" || answer === "p") return "patch";
  if (answer === "2" || answer === "minor" || answer === "m") return "minor";
  if (answer === "3" || answer === "major") return "major";
  if (answer === "4" || answer === "custom" || answer === "c") {
    const custom = await promptLine(
      `   ${paint(c.bold, "?")}  version ${paint(c.dim, "(x.y.z)")}: `,
    );
    if (!/^\d+\.\d+\.\d+$/.test(custom)) fail(`invalid version: ${custom}`);
    return custom;
  }
  if (/^\d+\.\d+\.\d+$/.test(answer)) return answer;
  if (["patch", "minor", "major"].includes(answer)) return answer;
  fail(`invalid choice: ${answer}`);
}

async function confirm(next, tag) {
  if (yes) return true;
  console.log();
  console.log(`   ${paint(c.dim, "plan")}`);
  console.log(`   ${paint(c.dim, "────")}`);
  console.log(`   version  ${paint(c.bold + c.green, next)}`);
  console.log(`   tag      ${paint(c.bold + c.cyan, tag)}`);
  console.log(`   files    Cargo.toml · Cargo.lock · tauri.conf.json`);
  console.log(
    `   git      commit + annotated tag${noPush ? paint(c.yellow, " (no push)") : " + push"}`,
  );
  if (dryRun) console.log(`   ${paint(c.yellow, "dry-run — nothing will be written")}`);
  console.log();

  const answer = (
    await promptLine(`   ${paint(c.bold, "?")}  proceed? ${paint(c.dim, "[y/N]")}: `)
  ).toLowerCase();
  return answer === "y" || answer === "yes";
}

function printDone(tag, pushed) {
  console.log(`
   ${paint(c.green + c.bold, "✓")}  released ${paint(c.bold, tag)}
   ${paint(c.dim, pushed ? "branch + tag pushed" : "local only — push when ready")}
`);
}

const cargoPath = resolve(root, "Cargo.toml");
const tauriPath = resolve(root, "apps/desktop/src-tauri/tauri.conf.json");

const current = readWorkspaceVersion(cargoPath);

banner(current);

const bump = bumpArg ?? (await chooseBump(current));
const next = nextVersion(current, bump);
const tag = `v${next}`;

if (bumpArg) {
  console.log(
    `   ${paint(c.dim, "bump")}     ${paint(c.bold, bumpArg)}  ${paint(c.dim, `${current} →`)} ${paint(c.green, next)}\n`,
  );
}

const ok = await confirm(next, tag);
closeStdin();
if (!ok) {
  console.log(`\n   ${paint(c.dim, "aborted")}\n`);
  process.exit(0);
}

if (dryRun) {
  console.log(`
   ${paint(c.yellow, "○")}  dry-run complete — would release ${paint(c.bold, tag)}
`);
  process.exit(0);
}

const status = await $`git -C ${root} status --porcelain`.text();
if (status.trim() && !allowDirty) {
  fail("working tree is dirty; commit/stash first or pass --allow-dirty");
}

const existing = await $`git -C ${root} tag -l ${tag}`.text();
if (existing.trim()) fail(`tag ${tag} already exists`);

const tauri = readJson(tauriPath);
if (tauri.identifier !== "dev.apex.desktop") {
  fail(
    `identifier is "${tauri.identifier}" but releases expect "dev.apex.desktop". ` +
      `Changing the bundle identifier breaks upgrades for users on previous versions.`,
  );
}

console.log(`\n   ${paint(c.dim, "…")} writing version files`);
bumpWorkspaceVersion(cargoPath, next);

tauri.version = next;
writeJson(tauriPath, tauri);

console.log(`   ${paint(c.dim, "…")} syncing Cargo.lock`);
let lock = await $`cargo update --manifest-path ${cargoPath} --workspace --offline`
  .quiet()
  .nothrow();
if (lock.exitCode !== 0) {
  lock = await $`cargo update --manifest-path ${cargoPath} --workspace`.quiet().nothrow();
}
if (lock.exitCode !== 0) {
  fail(`cargo could not refresh Cargo.lock:\n${lock.stderr.toString().trim()}`);
}

console.log(`   ${paint(c.dim, "…")} git commit`);
await $`git -C ${root} add Cargo.toml Cargo.lock apps/desktop/src-tauri/tauri.conf.json`;
await $`git -C ${root} commit -m ${`chore(release): ${tag}`}`;

console.log(`   ${paint(c.dim, "…")} tagging ${tag}`);
await $`git -C ${root} tag -a ${tag} -m ${tag}`;

if (!noPush) {
  console.log(`   ${paint(c.dim, "…")} pushing`);
  await $`git -C ${root} push`;
  await $`git -C ${root} push origin ${tag}`;
  printDone(tag, true);
} else {
  printDone(tag, false);
}
