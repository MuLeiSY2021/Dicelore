// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { checkout, commit, history, tag, type PackFile } from "./catalog.js";
import type { CatalogDB } from "./db.js";

// ===== 单向投影:DB(权威) → git history(导出边界格式)。git 非存储,只是进出口拉链(§6.2)。=====
// 自实现 git loose object(blob/tree/commit)+ refs,零依赖。import 读回本格式(round-trip)。

const AUTHOR = "dicelore <noreply@dicelore>";

function gitHash(type: string, content: Buffer): string {
  return createHash("sha1").update(Buffer.concat([Buffer.from(`${type} ${content.length}\0`), content])).digest("hex");
}
function writeObject(objectsDir: string, type: string, content: Buffer): string {
  const hex = gitHash(type, content);
  const p = join(objectsDir, hex.slice(0, 2), hex.slice(2));
  if (!existsSync(p)) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, deflateSync(Buffer.concat([Buffer.from(`${type} ${content.length}\0`), content])));
  }
  return hex;
}
function readObject(objectsDir: string, hex: string): { type: string; content: Buffer } {
  const raw = inflateSync(readFileSync(join(objectsDir, hex.slice(0, 2), hex.slice(2))));
  const nul = raw.indexOf(0);
  const [type] = raw.subarray(0, nul).toString("utf8").split(" ");
  return { type, content: raw.subarray(nul + 1) };
}

interface TreeNode { files: Map<string, string>; dirs: Map<string, TreeNode> } // name → blobHex / subnode
function emptyNode(): TreeNode { return { files: new Map(), dirs: new Map() }; }

function buildTreeNodes(files: PackFile[], objectsDir: string): TreeNode {
  const root = emptyNode();
  for (const f of files) {
    const blob = writeObject(objectsDir, "blob", Buffer.from(f.content, "utf8"));
    const segs = f.path.split("/");
    let node = root;
    for (let i = 0; i < segs.length - 1; i++) {
      if (!node.dirs.has(segs[i])) node.dirs.set(segs[i], emptyNode());
      node = node.dirs.get(segs[i])!;
    }
    node.files.set(segs[segs.length - 1], blob);
  }
  return root;
}
// git tree:条目按 name(目录视作 name+"/")字节序排;mode 100644 文件 / 40000 目录。
function writeTree(node: TreeNode, objectsDir: string): string {
  const entries: { sortKey: string; buf: Buffer }[] = [];
  for (const [name, blob] of node.files) {
    entries.push({ sortKey: name, buf: Buffer.concat([Buffer.from(`100644 ${name}\0`), Buffer.from(blob, "hex")]) });
  }
  for (const [name, sub] of node.dirs) {
    const subHex = writeTree(sub, objectsDir);
    entries.push({ sortKey: name + "/", buf: Buffer.concat([Buffer.from(`40000 ${name}\0`), Buffer.from(subHex, "hex")]) });
  }
  entries.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  return writeObject(objectsDir, "tree", Buffer.concat(entries.map((e) => e.buf)));
}

function unixTs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
}

// 导出某团本线性史 → outDir 下的真 git 仓库(裸 .git 结构)。
export function exportGit(catalogDB: CatalogDB, adventureId: string, outDir: string): { head: string } {
  const gitDir = join(outDir, ".git");
  const objectsDir = join(gitDir, "objects");
  mkdirSync(objectsDir, { recursive: true });
  const commits = history(catalogDB, adventureId).reverse(); // oldest → newest
  let parentHex: string | null = null;
  const map = new Map<string, string>(); // dbCommitId → gitCommitHex
  for (const c of commits) {
    const files = checkout(catalogDB, adventureId, c.id);
    const treeHex = writeTree(buildTreeNodes(files, objectsDir), objectsDir);
    const ts = unixTs(c.createdAt);
    const lines = [`tree ${treeHex}`];
    if (parentHex) lines.push(`parent ${parentHex}`);
    lines.push(`author ${AUTHOR} ${ts} +0000`, `committer ${AUTHOR} ${ts} +0000`, "", c.message, "");
    const commitHex = writeObject(objectsDir, "commit", Buffer.from(lines.join("\n"), "utf8"));
    map.set(c.id, commitHex);
    parentHex = commitHex;
  }
  const head = parentHex ?? "";
  mkdirSync(join(gitDir, "refs", "heads"), { recursive: true });
  writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  if (head) writeFileSync(join(gitDir, "refs", "heads", "main"), head + "\n");
  // tags → refs/tags/<label>
  const tags = catalogDB.prepare("SELECT label, commit_id FROM tag WHERE adventure_id=?").all(adventureId) as { label: string; commit_id: string }[];
  if (tags.length) {
    mkdirSync(join(gitDir, "refs", "tags"), { recursive: true });
    for (const t of tags) { const h = map.get(t.commit_id); if (h) writeFileSync(join(gitDir, "refs", "tags", t.label), h + "\n"); }
  }
  return { head };
}

function parseCommit(content: Buffer): { tree: string; parent: string | null; message: string; createdAt: string | null } {
  const text = content.toString("utf8");
  const blank = text.indexOf("\n\n");
  const headers = text.slice(0, blank).split("\n");
  let tree = "", parent: string | null = null, createdAt: string | null = null;
  for (const h of headers) {
    if (h.startsWith("tree ")) tree = h.slice(5).trim();
    else if (h.startsWith("parent ")) parent = h.slice(7).trim();
    // `committer <name> <email> <unix-ts> <tz>` → 还原 ISO 时间(round-trip 时间元数据)。
    else if (h.startsWith("committer ")) {
      const m = /\s(\d+)\s[-+]\d{4}\s*$/.exec(h);
      if (m) createdAt = new Date(Number(m[1]) * 1000).toISOString();
    }
  }
  return { tree, parent, message: text.slice(blank + 2).replace(/\n$/, ""), createdAt };
}
function readTree(objectsDir: string, hex: string, prefix: string, out: PackFile[]): void {
  const { content } = readObject(objectsDir, hex);
  let i = 0;
  while (i < content.length) {
    const sp = content.indexOf(0x20, i);
    const mode = content.subarray(i, sp).toString("utf8");
    const nul = content.indexOf(0, sp);
    const name = content.subarray(sp + 1, nul).toString("utf8");
    const sha = content.subarray(nul + 1, nul + 21).toString("hex");
    i = nul + 21;
    if (mode === "40000") readTree(objectsDir, sha, `${prefix}${name}/`, out);
    else out.push({ path: `${prefix}${name}`, content: readObject(objectsDir, sha).content.toString("utf8") });
  }
}

// 从本格式 git 仓库读回 → 重建一份全新 DB 线性史(import 反序列化,§6.2)。name = 团本名(新录)。
export function importGit(gitDir: string, catalogDB: CatalogDB, name: string): { adventureId: string; commits: number } {
  const objectsDir = join(gitDir, "objects");
  const headRef = readFileSync(join(gitDir, "refs", "heads", "main"), "utf8").trim();
  // 走 parent 链 newest→root,再反转 oldest→newest 逐个 commit。
  const chain: { tree: string; message: string; createdAt: string | null }[] = [];
  let cur: string | null = headRef;
  while (cur) {
    const { content } = readObject(objectsDir, cur);
    const c = parseCommit(content);
    chain.push({ tree: c.tree, message: c.message, createdAt: c.createdAt });
    cur = c.parent;
  }
  chain.reverse();
  let adventureId = "";
  for (const c of chain) {
    const files: PackFile[] = [];
    readTree(objectsDir, c.tree, "", files);
    // round-trip:用 git commit header 还原的时间;缺失才退化到 epoch 占位。
    const r = commit(catalogDB, { name, files, message: c.message, createdAt: c.createdAt ?? "1970-01-01" });
    adventureId = r.adventureId;
  }
  // tags
  const tagsDir = join(gitDir, "refs", "tags");
  if (existsSync(tagsDir)) {
    for (const label of readdirSync(tagsDir)) {
      const gitHex = readFileSync(join(tagsDir, label), "utf8").trim();
      const { content } = readObject(objectsDir, gitHex);
      const c = parseCommit(content);
      const files: PackFile[] = []; readTree(objectsDir, c.tree, "", files);
      // 重算该版本在新 DB 的 commitId(内容寻址,checkout 用 label 即可)
      const ids = history(catalogDB, adventureId);
      const match = ids.find((row) => checkoutMatches(catalogDB, adventureId, row.id, files));
      if (match) tag(catalogDB, { adventureId, commitId: match.id, label });
    }
  }
  return { adventureId, commits: chain.length };
}
function checkoutMatches(db: CatalogDB, adventureId: string, commitId: string, files: PackFile[]): boolean {
  const got = checkout(db, adventureId, commitId);
  if (got.length !== files.length) return false;
  const a = JSON.stringify([...got].sort((x, y) => x.path.localeCompare(y.path)));
  const b = JSON.stringify([...files].sort((x, y) => x.path.localeCompare(y.path)));
  return a === b;
}
