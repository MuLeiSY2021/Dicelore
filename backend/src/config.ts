// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 数据根解析 + config.toml [env] 注入。
// - resolveDataDir：--data-dir flag > DICELORE_DATA_DIR env > OS 默认，返回绝对路径。
// - applyConfigEnv：读 <root>/config.toml 的 [env] 表，仅补写未设的 KEY，跳过 master key。

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { getLogger } from "@dicelore/logs";

// 绝不从 config.toml [env] 注入的敏感键：master key 只能来自真实进程 env，不落配置文件。
const FORBIDDEN_ENV_KEYS = new Set(["DICELORE_KEY_MASTER"]);

/** OS 约定的默认数据根（未指定 --data-dir / DICELORE_DATA_DIR 时的落点）。 */
export function defaultDataDir(): string {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library/Application Support/Dicelore");
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData/Roaming"), "Dicelore");
    default:
      return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local/share"), "dicelore");
  }
}

/**
 * 解析数据根，优先级：--data-dir <path> > env.DICELORE_DATA_DIR > defaultDataDir()。
 * 返回绝对路径（path.resolve）。
 */
export function resolveDataDir(
  argv: string[],
  env: Record<string, string | undefined>,
): string {
  const flagIdx = argv.indexOf("--data-dir");
  const flagVal =
    flagIdx >= 0 && flagIdx + 1 < argv.length ? argv[flagIdx + 1] : undefined;
  const picked = flagVal ?? env.DICELORE_DATA_DIR ?? defaultDataDir();
  return resolve(picked);
}

/**
 * 读 <root>/config.toml 的顶层 [env] 表，对每个 KEY=value：仅当 process.env[KEY]===undefined
 * 时写入 process.env[KEY]=String(value)。跳过 DICELORE_KEY_MASTER（若出现则 warn）。
 * 非 [env] 小节一律不碰。文件不存在=no-op；解析失败 fail loud（error + throw）。
 */
export function applyConfigEnv(root: string): void {
  const path = join(root, "config.toml");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    // 文件不存在（或不可读）→ no-op，不报错。
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    // 其他 IO 错误也视作可降级的 no-op（配置为可选特性），但记录以便排查。
    getLogger().warn({ err: e, path }, "config.toml 读取失败,跳过 env 注入");
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseToml(raw) as Record<string, unknown>;
  } catch (e) {
    getLogger().error({ err: e, path }, "config.toml 解析失败");
    throw e;
  }

  const envTable = parsed.env;
  if (envTable === null || typeof envTable !== "object" || Array.isArray(envTable)) {
    return;
  }

  for (const [key, value] of Object.entries(envTable as Record<string, unknown>)) {
    if (FORBIDDEN_ENV_KEYS.has(key)) {
      getLogger().warn({ key, path }, "config.toml [env] 含禁用敏感键,跳过注入");
      continue;
    }
    if (process.env[key] === undefined) {
      process.env[key] = String(value);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 客制 MCP 安装（裁决 custom-mcp-install）：config.toml 的 [marketplaces.*] /
// [mcpServers.*] 节读写。与既有 [env] 节共存于同一 <dataDir>/config.toml（单源单文件）。
//
// 核心 dicelore MCP（in-process·必需·锁定）不进此文件——系统固定注入；此文件只管
// 用户装的客制 out-of-canon MCP + marketplace 源。
//
// 写策略（v1·可逆）：parse 整份 toml → 改对应节 → stringify 回写。副作用：注释会丢失
// （smol-toml 无保留注释的 stringify）。config.toml 的注释样例另存 config.example.toml
// （从不被读），故本策略对功能无损；如需保注释可后续换保序 toml 编辑器。
// ─────────────────────────────────────────────────────────────────────────

/** marketplace 源（按钮①注册）。source 决定 repo/url 语义。 */
export interface MarketplaceEntry {
  name: string;
  source: "github" | "url" | "marketplace-url";
  repo?: string; // source=github 时的 owner/repo
  url?: string; // source=url/marketplace-url 时的清单/仓库 URL
  ref?: string; // 可选：git ref / 分支 / tag
}

/** 客制 MCP（按钮②安装后落此）。运行时按 stdio 拉起，工具标 outOfCanon。 */
export interface McpServerEntry {
  name: string; // 实例名（[mcpServers.<name>]）
  package: string; // 登记溯源（<pkg>@<version>）
  command: string; // npx / uvx / node / 绝对路径
  args: string[];
  fromMarketplace?: string; // 溯源（直装时缺）
  installed: boolean; // npx -y 预拉已执行
  enabled: boolean; // 开关
  outOfCanon: boolean; // 徽：非核心 dicelore MCP（恒 true）
  env: Record<string, string>; // 配置项 table（收敛至 [mcpServers.<name>.env]）
}

export interface McpConfig {
  marketplaces: MarketplaceEntry[];
  mcpServers: McpServerEntry[];
}

function configPath(root: string): string {
  return join(root, "config.toml");
}

/** 读整份 config.toml（不存在→空对象；解析失败 fail loud）。供读写共用。 */
function readConfigToml(root: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = readFileSync(configPath(root), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
  try {
    return parseToml(raw) as Record<string, unknown>;
  } catch (e) {
    getLogger().error({ err: e, path: configPath(root) }, "config.toml 解析失败");
    throw e;
  }
}

/** 写整份 config.toml（父目录不存在先建）。 */
function writeConfigToml(root: string, parsed: Record<string, unknown>): void {
  const path = configPath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyToml(parsed));
}

function asTable(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function parseMarketplace(name: string, raw: Record<string, unknown>): MarketplaceEntry {
  const src = raw.source;
  const source: MarketplaceEntry["source"] = src === "url" || src === "marketplace-url" ? src : "github";
  return {
    name,
    source,
    ...(typeof raw.repo === "string" ? { repo: raw.repo } : {}),
    ...(typeof raw.url === "string" ? { url: raw.url } : {}),
    ...(typeof raw.ref === "string" ? { ref: raw.ref } : {}),
  };
}

function parseMcpServer(name: string, raw: Record<string, unknown>): McpServerEntry {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(asTable(raw.env))) env[k] = String(v);
  return {
    name,
    package: typeof raw.package === "string" ? raw.package : "",
    command: typeof raw.command === "string" ? raw.command : "npx",
    args: asStringArray(raw.args),
    ...(typeof raw.fromMarketplace === "string" ? { fromMarketplace: raw.fromMarketplace } : {}),
    installed: raw.installed === true,
    enabled: raw.enabled === true,
    outOfCanon: raw.outOfCanon !== false, // 缺省视为 true（客制 MCP 恒 out-of-canon）
    env,
  };
}

/** 读 config.toml 的 [marketplaces.*] + [mcpServers.*]（不存在→空列表）。 */
export function readMcpConfig(root: string): McpConfig {
  const parsed = readConfigToml(root);
  const marketplaces = Object.entries(asTable(parsed.marketplaces)).map(([name, raw]) =>
    parseMarketplace(name, asTable(raw)),
  );
  const mcpServers = Object.entries(asTable(parsed.mcpServers)).map(([name, raw]) =>
    parseMcpServer(name, asTable(raw)),
  );
  return { marketplaces, mcpServers };
}

/** upsert 一个 marketplace 源到 [marketplaces.<name>]（同名覆盖）。 */
export function upsertMarketplace(root: string, entry: MarketplaceEntry): void {
  const parsed = readConfigToml(root);
  const table = asTable(parsed.marketplaces);
  const body: Record<string, unknown> = { source: entry.source };
  if (entry.repo !== undefined) body.repo = entry.repo;
  if (entry.url !== undefined) body.url = entry.url;
  if (entry.ref !== undefined) body.ref = entry.ref;
  table[entry.name] = body;
  parsed.marketplaces = table;
  writeConfigToml(root, parsed);
}

/** upsert 一个客制 MCP 到 [mcpServers.<name>]（含 env 子表；同名覆盖）。 */
export function upsertMcpServer(root: string, entry: McpServerEntry): void {
  const parsed = readConfigToml(root);
  const table = asTable(parsed.mcpServers);
  const body: Record<string, unknown> = {
    package: entry.package,
    command: entry.command,
    args: entry.args,
    installed: entry.installed,
    enabled: entry.enabled,
    outOfCanon: entry.outOfCanon,
  };
  if (entry.fromMarketplace !== undefined) body.fromMarketplace = entry.fromMarketplace;
  // env 子表放最后：smol-toml 把子表写在标量之后，避免 [mcpServers.<name>.env] 提前打断标量。
  body.env = { ...entry.env };
  table[entry.name] = body;
  parsed.mcpServers = table;
  writeConfigToml(root, parsed);
}

/** 切换某客制 MCP 的 enabled 开关；不存在返回 false。 */
export function setMcpServerEnabled(root: string, name: string, enabled: boolean): boolean {
  const parsed = readConfigToml(root);
  const table = asTable(parsed.mcpServers);
  const entry = table[name];
  if (entry === undefined || typeof entry !== "object") return false;
  (entry as Record<string, unknown>).enabled = enabled;
  parsed.mcpServers = table;
  writeConfigToml(root, parsed);
  return true;
}

/** 删除某客制 MCP；不存在返回 false。 */
export function removeMcpServer(root: string, name: string): boolean {
  const parsed = readConfigToml(root);
  const table = asTable(parsed.mcpServers);
  if (!(name in table)) return false;
  delete table[name];
  parsed.mcpServers = table;
  writeConfigToml(root, parsed);
  return true;
}

/** 运行时用的 stdio MCP 配置（对齐 Agent SDK McpStdioServerConfig 子集）。 */
export interface StdioMcpServerConfig {
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * 解析 config.toml 里 enabled=true && installed=true 的客制 MCP，映射为运行时
 * stdio 配置表（key=实例名）。供组合根注入 GM/loregm 运行时（gmAssembly 合并进 query）。
 */
export function resolveCustomMcpServers(root: string): Record<string, StdioMcpServerConfig> {
  const out: Record<string, StdioMcpServerConfig> = {};
  for (const s of readMcpConfig(root).mcpServers) {
    if (!s.enabled || !s.installed) continue;
    out[s.name] = {
      type: "stdio",
      command: s.command,
      args: s.args,
      ...(Object.keys(s.env).length > 0 ? { env: s.env } : {}),
    };
  }
  return out;
}
