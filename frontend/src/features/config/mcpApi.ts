// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 客制 MCP 两按钮(裁决 custom-mcp-install)的前端 API 客户端。
// 消费后端 W2 已合的 /mcp/* 端点(见 backend/src/api/mcp.ts) + 结构化 /diagnostics/mcp-test。
// 配置持久化在后端 config.toml；前端只读写、不缓存到 localStorage。

// ── 后端契约镜像(backend/src/config.ts + api/mcp.ts) ──
export interface MarketplaceEntry {
  name: string;
  source: "github" | "url" | "marketplace-url";
  repo?: string;
  url?: string;
  ref?: string;
}
export interface ManifestEnvSchema {
  key: string;
  required?: boolean;
  description?: string;
}
export interface ManifestMcp {
  name: string;
  package: string;
  command: string;
  args: string[];
  description?: string;
  envSchema: ManifestEnvSchema[];
}
export interface McpServerEntry {
  name: string;
  package: string;
  command: string;
  args: string[];
  fromMarketplace?: string;
  installed: boolean;
  enabled: boolean;
  outOfCanon: boolean;
  env: Record<string, string>;
}
export interface TestResult {
  ok: boolean;
  status?: number;
  toolCount?: number;
  latencyMs?: number;
  message: string;
}

// 后端写操作用 { ok:false, message } + 4xx/5xx 回错；把 message 提到 Error 供前端展示。
async function jsonOrThrow<T>(res: Response, what: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `${what}失败：${res.status}`);
  }
  return data as T;
}

// 按钮①：添加 marketplace → 拉清单 + 注册源 + 回可用 MCP 列表。
export async function addMarketplace(source: string, name?: string): Promise<{ marketplace: MarketplaceEntry; mcps: ManifestMcp[] }> {
  const res = await fetch("/mcp/marketplaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(name ? { source, name } : { source }),
  });
  return jsonOrThrow<{ marketplace: MarketplaceEntry; mcps: ManifestMcp[] }>(res, "添加 marketplace");
}

// 列已注册 marketplace 源。
export async function listMarketplaces(): Promise<MarketplaceEntry[]> {
  const res = await fetch("/mcp/marketplaces");
  if (!res.ok) throw new Error(`读取 marketplace 失败：${res.status}`);
  return ((await res.json()) as { marketplaces: MarketplaceEntry[] }).marketplaces;
}

export interface InstallInput {
  spec: string;                    // <mcp>@<marketplace> 或 <pkg>@<version>
  name?: string;                   // 实例名(直装/覆盖)
  command?: string;                // 直装时 command(默认 npx)
  args?: string[];                 // 直装时 args(默认 -y <spec>)
  env?: Record<string, string>;    // 配置项 table
}
// 按钮②：安装 → npx -y 预拉 + 写 config.toml。
export async function installMcp(input: InstallInput): Promise<{ server: McpServerEntry; message: string }> {
  const res = await fetch("/mcp/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<{ server: McpServerEntry; message: string }>(res, "安装 MCP");
}

// 列已装客制 MCP。
export async function listServers(): Promise<McpServerEntry[]> {
  const res = await fetch("/mcp/servers");
  if (!res.ok) throw new Error(`读取 MCP 失败：${res.status}`);
  return ((await res.json()) as { servers: McpServerEntry[] }).servers;
}

// 切 enabled 开关。
export async function toggleServer(name: string, enabled: boolean): Promise<void> {
  const res = await fetch(`/mcp/servers/${encodeURIComponent(name)}/toggle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  await jsonOrThrow(res, "切换 MCP");
}

// 删客制 MCP。
export async function deleteServer(name: string): Promise<void> {
  const res = await fetch(`/mcp/servers/${encodeURIComponent(name)}`, { method: "DELETE" });
  await jsonOrThrow(res, "删除 MCP");
}

// 连接测试：客制 MCP 为 stdio，按结构化 command/args/env 真拉起 + listTools。
export async function testServer(server: Pick<McpServerEntry, "command" | "args" | "env">): Promise<TestResult> {
  const res = await fetch("/diagnostics/mcp-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transport: "stdio", command: server.command, args: server.args, env: server.env }),
  });
  // 后端 2xx=可达、502=不可达但仍回 TestResult 体;非 2xx/502 才当传输错。
  if (!res.ok && res.status !== 502) throw new Error(`连接测试失败：${res.status}`);
  return (await res.json()) as TestResult;
}
