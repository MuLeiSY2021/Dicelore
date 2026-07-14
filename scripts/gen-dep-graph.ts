// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 架构依赖图生成器：扫描各 workspace 包的 src/**/*.{ts,tsx}，正则抓 import/export 边，
// 重算依赖图数据（dir 层目录聚合 + file 层文件级 + palette 调色板），把结果作为
// `var DATA={...};` 内联回写进 wiki/开发指南/03-架构/dep-graph.html（单一来源，无外部 json）。
//
// 生成策略（重要，幂等可重复跑）：现有 dep-graph.html 已含全部 vis-network 渲染/交互/CSS。
// 本脚本【不重写交互逻辑】——它读现有 html，用正则把 `var DATA={...};` 整行替换成
// `var DATA=<新算出的 JSON>;` 再写回。模板（CDN/CSS/渲染 JS/HTML 骨架）永远跟现有 html
// 同步；数据只内联在 html 里，不再有 .data.json 副本。
//
// 口径：
//  - 扫 *.ts 与 *.tsx，排除 *.test.ts / *.test.tsx。含 .tsx 是为让 React 前端（组件全是
//    .tsx）的内部依赖与跨包边在图里显形——否则 frontend 这一整根近乎孤岛。相对 import 解析
//    候选含 .tsx（.js→.ts/.tsx、补 /index.tsx）。`@/` 路径别名按所属包 src 根解析
//    （vite/tsconfig 约定，目前仅 frontend）。
//  - 包列表从根 package.json 的 workspaces 动态解析（glob 展开 packages/* + 读各包
//    package.json 的 name），加包自动纳入、零硬编码包名。
//  - 相对 import：moduleResolution=Bundler 写 .js 后缀但实文件是 .ts → .js→.ts；无后缀/
//    指向目录 → 补 /index.ts。跨包裸名 @dicelore/<pkg> → 该包 barrel(main, 都是
//    ./src/index.ts)。第三方 / node: 内置跳过；解析不到的边丢弃，绝不造假节点。
//  - dir 层边由 file 层边聚合得出（value=条数）；同一聚合节点内的自环 dir 边过滤掉
//    （与旧 DATA 一致——旧 DATA 无 from===to 的 dir 边）；包内跨子目录边保留。
//
// 跑法：npx tsx scripts/gen-dep-graph.ts （零新 npm 依赖，纯 node:fs/path + 正则）

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, dirname, relative, resolve, basename } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const HTML = join(REPO_ROOT, "wiki/开发指南/03-架构/dep-graph.html");

// 8 色调色板（覆盖全部包短名，明显区分）
const PALETTE: Record<string, string> = {
  frontend: "#2ecc71",
  backend: "#3498db",
  harness: "#e67e22",
  interface: "#e74c3c",
  dice: "#9b59b6",
  errors: "#c0392b",
  logs: "#16a085",
  shared: "#f1c40f",
};

// ---- 包发现：从根 workspaces 动态解析 ----
interface Pkg {
  short: string; // 短名（group key），如 backend / shared
  name: string; // @dicelore/<x>
  dir: string; // 绝对路径
  srcDir: string; // 绝对 src 路径
  barrel: string | null; // main 对应的仓库根相对 .ts 路径（跨包桶）
}

function expandWorkspaces(patterns: string[]): string[] {
  const dirs: string[] = [];
  for (const p of patterns) {
    if (p.endsWith("/*")) {
      const base = join(REPO_ROOT, p.slice(0, -2));
      if (!existsSync(base)) continue;
      for (const e of readdirSync(base)) {
        const full = join(base, e);
        if (statSync(full).isDirectory()) dirs.push(full);
      }
    } else {
      const full = join(REPO_ROOT, p);
      if (existsSync(full)) dirs.push(full);
    }
  }
  return dirs;
}

function discoverPkgs(): Pkg[] {
  const root = JSON.parse(
    readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
  );
  const out: Pkg[] = [];
  for (const dir of expandWorkspaces(root.workspaces ?? [])) {
    const pjPath = join(dir, "package.json");
    if (!existsSync(pjPath)) continue;
    const pj = JSON.parse(readFileSync(pjPath, "utf8"));
    const name: string = pj.name;
    if (!name) continue;
    const short = name.replace(/^@dicelore\//, "");
    const srcDir = join(dir, "src");
    if (!existsSync(srcDir)) continue; // 无 src（如纯内容包）跳过
    let barrel: string | null = null;
    // main 缺省回退 ./src/index.ts（与本仓约定一致）
    const mainRel = typeof pj.main === "string" ? pj.main : "./src/index.ts";
    const abs = resolve(dir, mainRel);
    if (existsSync(abs)) barrel = relRepo(abs);
    out.push({ short, name, dir, srcDir, barrel });
  }
  return out;
}

function relRepo(abs: string): string {
  return relative(REPO_ROOT, abs).split("\\").join("/");
}

// ---- 扫源文件 ----
function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (
      (e.endsWith(".ts") || e.endsWith(".tsx")) &&
      !e.endsWith(".test.ts") &&
      !e.endsWith(".test.tsx")
    )
      out.push(full);
  }
  return out;
}

// ---- 解析 import/export 说明符 ----
// 抓 `from "X"` （import ... from / export ... from）以及 `import "X"`。
const FROM_RE = /(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g;
const BARE_IMPORT_RE = /\bimport\s*['"]([^'"]+)['"]/g;

function specifiers(code: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = FROM_RE.exec(code))) set.add(m[1]);
  while ((m = BARE_IMPORT_RE.exec(code))) set.add(m[1]);
  return [...set];
}

// 把相对/裸包说明符解析成目标 .ts 的仓库根相对路径；解析不到返回 null
function resolveSpec(
  spec: string,
  fromFileAbs: string,
  pkgs: Pkg[],
): string | null {
  if (spec.startsWith(".")) {
    // 相对路径：moduleResolution=Bundler 写 .js 后缀但实文件是 .ts
    const target = resolve(dirname(fromFileAbs), spec);
    return resolveTsTarget(target);
  }
  if (spec.startsWith("@/")) {
    // `@` 路径别名 → 所属包的 src 根（vite/tsconfig 约定，目前仅 frontend 用）
    const owner = pkgs.find((p) => fromFileAbs.startsWith(p.srcDir));
    if (!owner) return null;
    return resolveTsTarget(join(owner.srcDir, spec.slice(2)));
  }
  // 裸包名：@dicelore/<pkg> 或 @dicelore/<pkg>/<deep>
  const pkg = pkgs.find(
    (p) => spec === p.name || spec.startsWith(p.name + "/"),
  );
  if (pkg) {
    if (spec === pkg.name) return pkg.barrel; // 跨包桶 = barrel(main)
    // 深路径：尽力解析进该包 src
    const deep = spec.slice(pkg.name.length + 1);
    return resolveTsTarget(join(pkg.dir, deep));
  }
  // 第三方 / node: 内置 → 跳过
  return null;
}

function resolveTsTarget(absNoExt: string): string | null {
  // 把 .js → .ts/.tsx；无后缀/指向目录补 /index.ts(x)。.ts 优先于 .tsx。
  const candidates: string[] = [];
  if (absNoExt.endsWith(".js")) {
    const stem = absNoExt.slice(0, -3);
    candidates.push(stem + ".ts", stem + ".tsx");
  }
  if (absNoExt.endsWith(".ts") || absNoExt.endsWith(".tsx")) candidates.push(absNoExt);
  candidates.push(absNoExt + ".ts", absNoExt + ".tsx");
  candidates.push(join(absNoExt, "index.ts"), join(absNoExt, "index.tsx"));
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return relRepo(c);
  }
  return null;
}

// ---- 子目录 / cluster 归属 ----
function subdirOf(fileRepoPath: string, pkg: Pkg): string {
  const relSrc = relative(pkg.srcDir, join(REPO_ROOT, fileRepoPath))
    .split("\\")
    .join("/");
  const slash = relSrc.indexOf("/");
  return slash === -1 ? "(root)" : relSrc.slice(0, slash);
}

function relSrcPath(fileRepoPath: string, pkg: Pkg): string {
  return relative(pkg.srcDir, join(REPO_ROOT, fileRepoPath))
    .split("\\")
    .join("/");
}

// ============ 主流程 ============
const pkgs = discoverPkgs();

// 文件 → 其所属包
const fileToPkg = new Map<string, Pkg>();
const allFiles: { repo: string; pkg: Pkg }[] = [];
for (const pkg of pkgs) {
  for (const abs of walkTs(pkg.srcDir)) {
    const repo = relRepo(abs);
    fileToPkg.set(repo, pkg);
    allFiles.push({ repo, pkg });
  }
}

// 收集 file 层边（去重）
const fileEdges = new Set<string>(); // "from\tto"
for (const { repo } of allFiles) {
  const code = readFileSync(join(REPO_ROOT, repo), "utf8");
  for (const spec of specifiers(code)) {
    const target = resolveSpec(spec, join(REPO_ROOT, repo), pkgs);
    if (!target) continue;
    if (target === repo) continue; // 自指
    if (!fileToPkg.has(target)) continue; // 目标不在被扫文件集（如 .tsx 桶）→ 丢弃
    fileEdges.add(repo + "\t" + target);
  }
}

// 入度（被依赖条数）
const indeg = new Map<string, number>();
for (const f of allFiles) indeg.set(f.repo, 0);
for (const e of fileEdges) {
  const to = e.split("\t")[1];
  indeg.set(to, (indeg.get(to) ?? 0) + 1);
}

// file 层 nodes（按 id 排序，输出稳定）
const fileNodes = allFiles
  .slice()
  .sort((a, b) => a.repo.localeCompare(b.repo))
  .map(({ repo, pkg }) => {
    const subdir = subdirOf(repo, pkg);
    const rel = relSrcPath(repo, pkg);
    const deg = indeg.get(repo) ?? 0;
    return {
      id: repo,
      label: basename(repo).replace(/\.tsx?$/, ""),
      title: `${rel}  [${pkg.short}/${subdir}]  被依赖 ${deg}`,
      pkg: pkg.short,
      cluster: `${pkg.short}/${subdir}`,
      deg,
    };
  });

// file 层 edges
const fileEdgeArr = [...fileEdges]
  .sort()
  .map((e) => {
    const [from, to] = e.split("\t");
    return { from, to, color: { color: "#dadada" } };
  });

// ---- dir 层聚合 ----
function dirNodeId(repo: string): string {
  const pkg = fileToPkg.get(repo)!;
  return `${pkg.name}::${subdirOf(repo, pkg)}`;
}

// dir node 统计：每个 dir 的文件数
const dirFileCount = new Map<string, number>();
const dirGroup = new Map<string, string>();
const dirSubdir = new Map<string, string>();
for (const { repo, pkg } of allFiles) {
  const id = dirNodeId(repo);
  dirFileCount.set(id, (dirFileCount.get(id) ?? 0) + 1);
  dirGroup.set(id, pkg.short);
  dirSubdir.set(id, subdirOf(repo, pkg));
}

const dirNodes = [...dirFileCount.keys()]
  .sort()
  .map((id) => {
    const subdir = dirSubdir.get(id)!;
    const short = dirGroup.get(id)!;
    const n = dirFileCount.get(id)!;
    const label =
      subdir === "(root)" ? `${short}·根\n${n}f` : `${subdir}\n${n}f`;
    return { id, label, group: short, value: n };
  });

// dir edges：聚合 file 边到 (fromDir,toDir)，计数；过滤同节点自环（与旧 DATA 一致）
const dirEdgeCount = new Map<string, number>();
for (const e of fileEdges) {
  const [from, to] = e.split("\t");
  const fd = dirNodeId(from);
  const td = dirNodeId(to);
  if (fd === td) continue; // 同一聚合 dir 节点内不连自环
  const key = fd + "\t" + td;
  dirEdgeCount.set(key, (dirEdgeCount.get(key) ?? 0) + 1);
}
const dirEdges = [...dirEdgeCount.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([key, value]) => {
    const [from, to] = key.split("\t");
    return { from, to, value, title: `${value}×`, color: { color: "#cfcfcf" } };
  });

const data = {
  dir: { nodes: dirNodes, edges: dirEdges },
  file: { nodes: fileNodes, edges: fileEdgeArr },
  palette: PALETTE,
};

// ---- 正则替换现有 html 里的 var DATA 整行，写回（幂等） ----
const html = readFileSync(HTML, "utf8");
const dataLineRe = /var DATA=\{[\s\S]*?\};/;
if (!dataLineRe.test(html)) {
  throw new Error(
    "在 dep-graph.html 里没找到 `var DATA={...};`，模板可能已变，请检查。",
  );
}
const newHtml = html.replace(dataLineRe, `var DATA=${JSON.stringify(data)};`);
writeFileSync(HTML, newHtml, "utf8");

console.log(
  `rewrote ${relRepo(HTML)}: ` +
    `dir ${dirNodes.length} nodes / ${dirEdges.length} edges, ` +
    `file ${fileNodes.length} nodes / ${fileEdgeArr.length} edges, ` +
    `palette ${Object.keys(PALETTE).length} groups`,
);
console.log("packages:", pkgs.map((p) => p.short).join(", "));
