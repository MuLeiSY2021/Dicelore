// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { spawn } from "node:child_process";
import { getLogger } from "@dicelore/logs";
import { checkSsrf } from "./diagnostics.js";
import {
  readMcpConfig,
  upsertMarketplace,
  upsertMcpServer,
  setMcpServerEnabled,
  removeMcpServer,
  type MarketplaceEntry,
  type McpServerEntry,
} from "../config.js";

// 客制 MCP 安装两按钮（裁决 custom-mcp-install）的后端端点。
// - POST /mcp/marketplaces   按钮①：拉 marketplace 清单 → 注册 [marketplaces.<name>] → 回清单里可用 MCP
// - GET  /mcp/marketplaces   列已注册 marketplace 源
// - POST /mcp/install        按钮②：npx -y 预拉 → 写 [mcpServers.<name>]（含 env 子表）
// - GET  /mcp/servers        列已装客制 MCP（含 outOfCanon 徽 / enabled 开关）
// - POST /mcp/servers/:name/toggle  切 enabled
// - DELETE /mcp/servers/:name       删客制 MCP
//
// 核心 dicelore MCP 不在此面（系统固定注入）；此面只管用户装的 out-of-canon MCP。

// ── marketplace 清单格式（§三·v1 轻量自定）────────────────────────────────
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
export interface Manifest {
  name: string;
  mcps: ManifestMcp[];
}

/** 解析 + 归一化远端拉到的 marketplace.json（宽容：缺失字段给默认，非法 throw）。 */
export function parseManifest(raw: unknown): Manifest {
  if (raw === null || typeof raw !== "object") throw new Error("marketplace 清单不是对象");
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" && o.name ? o.name : "";
  if (!name) throw new Error("marketplace 清单缺 name");
  const mcpsRaw = Array.isArray(o.mcps) ? o.mcps : [];
  const mcps: ManifestMcp[] = mcpsRaw.map((m) => {
    const e = (m ?? {}) as Record<string, unknown>;
    const mn = typeof e.name === "string" ? e.name : "";
    if (!mn) throw new Error("marketplace 清单某 mcp 缺 name");
    const pkg = typeof e.package === "string" ? e.package : "";
    const command = typeof e.command === "string" && e.command ? e.command : "npx";
    const args = Array.isArray(e.args) ? e.args.map(String) : pkg ? ["-y", pkg] : [];
    const envSchema: ManifestEnvSchema[] = Array.isArray(e.envSchema)
      ? e.envSchema.map((s) => {
          const so = (s ?? {}) as Record<string, unknown>;
          return {
            key: typeof so.key === "string" ? so.key : "",
            ...(so.required === true ? { required: true } : {}),
            ...(typeof so.description === "string" ? { description: so.description } : {}),
          };
        }).filter((s) => s.key)
      : [];
    return {
      name: mn,
      package: pkg,
      command,
      args,
      ...(typeof e.description === "string" ? { description: e.description } : {}),
      envSchema,
    };
  });
  return { name, mcps };
}

// ── marketplace 源解析（GitHub slug / GitHub URL / 直连 marketplace.json URL）──
export interface ResolvedSource {
  entry: MarketplaceEntry;
  manifestUrl: string; // 拉清单的 https URL
}

const GITHUB_URL = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/;
const SLUG = /^([\w.-]+)\/([\w.-]+?)(?:@(.+))?$/;

/**
 * 把用户输入的 marketplace 源规约成 { 注册项 entry, 拉清单 manifestUrl }。
 * - GitHub slug `owner/repo[@ref]` 或 GitHub URL → raw.githubusercontent.com/<owner>/<repo>/<ref|HEAD>/.dicelore/marketplace.json
 * - 直连 https `.json` URL → 原样即清单 URL（source=marketplace-url）
 * 其余不支持 → throw（前端回 4xx）。
 */
export function resolveMarketplaceSource(input: string, nameHint?: string): ResolvedSource {
  const src = input.trim();
  if (!src) throw new Error("marketplace 源为空");

  // 直连 marketplace.json URL
  if (/^https?:\/\//i.test(src) && !GITHUB_URL.test(src)) {
    if (!/\.json(\?.*)?$/i.test(src)) throw new Error("直连 URL 需指向 marketplace.json");
    const name = nameHint || deriveNameFromUrl(src);
    return { entry: { name, source: "marketplace-url", url: src }, manifestUrl: src };
  }

  // GitHub URL 或 slug
  const um = GITHUB_URL.exec(src);
  let owner: string, repo: string, ref: string | undefined;
  if (um) {
    [, owner, repo] = um;
    ref = um[3];
  } else {
    const sm = SLUG.exec(src);
    if (!sm) throw new Error("无法识别 marketplace 源（支持 owner/repo[@ref] 或 GitHub/清单 URL）");
    [, owner, repo] = sm;
    ref = sm[3];
  }
  const repoName = `${owner}/${repo}`;
  const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref ?? "HEAD"}/.dicelore/marketplace.json`;
  const name = nameHint || repo;
  return {
    entry: { name, source: "github", repo: repoName, ...(ref ? { ref } : {}) },
    manifestUrl,
  };
}

function deriveNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : u.hostname;
  } catch {
    return "marketplace";
  }
}

/** 从 `<pkg>@<version>`（含 scope）推导默认实例名：去 scope、去版本。 */
export function deriveInstanceName(pkg: string): string {
  // 去掉版本后缀：最后一个 @（非首字符）之后的部分
  let base = pkg;
  const at = pkg.lastIndexOf("@");
  if (at > 0) base = pkg.slice(0, at);
  // 去 scope：@scope/name → name
  const slash = base.lastIndexOf("/");
  if (slash >= 0) base = base.slice(slash + 1);
  return base || "mcp";
}

// ── 默认实现（真实网络 / 真实 npx）；测试可经 deps 注入替身 ──
async function defaultFetchManifest(manifestUrl: string): Promise<Manifest> {
  const guard = await checkSsrf(manifestUrl);
  if (!guard.ok) throw new Error(`清单 URL 被拒：${guard.reason}`);
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(manifestUrl, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`拉清单失败：HTTP ${res.status}`);
    return parseManifest(await res.json());
  } finally {
    clearTimeout(id);
  }
}

/**
 * `npx -y <pkg>` 预拉：跑运行时将用的真实启动命令，触发首次下载到 npx 缓存。
 * MCP stdio server 拉起后会等 stdin 而不退出，故：graceMs 内快速非零退出=失败（坏包/命令），
 * 到 graceMs 仍在跑=已下载并成功启动=成功（kill 收尾）；graceMs 内零退出也视为成功。
 */
async function defaultPrefetch(
  command: string,
  args: string[],
  env: Record<string, string>,
  graceMs = 4000,
): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolvePromise) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "pipe"] });
    } catch (e) {
      resolvePromise({ ok: false, message: e instanceof Error ? e.message : "无法启动命令" });
      return;
    }
    let stderr = "";
    let settled = false;
    child.stderr?.on("data", (d) => {
      if (stderr.length < 4000) stderr += String(d);
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolvePromise({ ok: true, message: "预拉成功（命令已启动并进入运行态，已收尾）" });
    }, graceMs);
    child.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ ok: false, message: e instanceof Error ? e.message : "命令启动失败" });
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolvePromise({ ok: true, message: "预拉成功（命令正常退出）" });
      else resolvePromise({ ok: false, message: `预拉失败（退出码 ${code}）：${stderr.slice(0, 500).trim()}` });
    });
  });
}

export interface McpAppDeps {
  root: string; // 数据根（config.toml 落此）
  fetchManifest?: (manifestUrl: string) => Promise<Manifest>;
  prefetch?: (command: string, args: string[], env: Record<string, string>) => Promise<{ ok: boolean; message: string }>;
}

export function createMcpApp(deps: McpAppDeps): Hono {
  const app = new Hono();
  const { root } = deps;
  const fetchManifest = deps.fetchManifest ?? defaultFetchManifest;
  const prefetch = deps.prefetch ?? defaultPrefetch;

  // 按钮①：添加 marketplace。body { source, name? } → 拉清单 → 注册 → 回可用 MCP 列表。
  app.post("/mcp/marketplaces", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { source?: string; name?: string };
    const source = (body.source ?? "").trim();
    if (!source) return c.json({ ok: false, message: "缺少 source" }, 400);
    let resolved: ResolvedSource;
    try {
      resolved = resolveMarketplaceSource(source, body.name);
    } catch (e) {
      return c.json({ ok: false, message: e instanceof Error ? e.message : "源非法" }, 400);
    }
    let manifest: Manifest;
    try {
      manifest = await fetchManifest(resolved.manifestUrl);
    } catch (e) {
      getLogger().warn({ err: e, manifestUrl: resolved.manifestUrl }, "拉 marketplace 清单失败");
      return c.json({ ok: false, message: e instanceof Error ? e.message : "拉清单失败" }, 400);
    }
    // 用清单里的 name 作注册名（更权威），回落 resolved.entry.name。
    const entry: MarketplaceEntry = { ...resolved.entry, name: manifest.name || resolved.entry.name };
    upsertMarketplace(root, entry);
    return c.json({ ok: true, marketplace: entry, mcps: manifest.mcps });
  });

  // 列已注册 marketplace 源。
  app.get("/mcp/marketplaces", (c) => {
    return c.json({ marketplaces: readMcpConfig(root).marketplaces });
  });

  // 按钮②：安装。body:
  //   marketplace 装：{ spec: "<mcp>@<marketplace>", env? }
  //   直装 npm 包：  { spec: "<pkg>@<version>", name?, command?, args?, env? }
  app.post("/mcp/install", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      spec?: string;
      name?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    };
    const spec = (body.spec ?? "").trim();
    if (!spec) return c.json({ ok: false, message: "缺少 spec" }, 400);
    const userEnv = body.env && typeof body.env === "object" ? body.env : {};

    // 判定：spec 尾 @<x> 的 x 是否是已注册 marketplace 名 → marketplace 装；否则直装 npm 包。
    const registered = new Set(readMcpConfig(root).marketplaces.map((m) => m.name));
    const at = spec.lastIndexOf("@");
    const tail = at > 0 ? spec.slice(at + 1) : "";

    let entry: McpServerEntry;

    if (at > 0 && registered.has(tail)) {
      // ── marketplace 装 ──
      const mcpName = spec.slice(0, at);
      const marketName = tail;
      const mkt = readMcpConfig(root).marketplaces.find((m) => m.name === marketName);
      if (!mkt) return c.json({ ok: false, message: `marketplace ${marketName} 未注册` }, 400);
      let manifestUrl: string;
      try {
        manifestUrl = reconstructManifestUrl(mkt);
      } catch (e) {
        return c.json({ ok: false, message: e instanceof Error ? e.message : "marketplace 源无法解析" }, 400);
      }
      let manifest: Manifest;
      try {
        manifest = await fetchManifest(manifestUrl);
      } catch (e) {
        return c.json({ ok: false, message: e instanceof Error ? e.message : "拉清单失败" }, 400);
      }
      const mcp = manifest.mcps.find((m) => m.name === mcpName);
      if (!mcp) return c.json({ ok: false, message: `清单里无 MCP ${mcpName}` }, 404);
      // envSchema required 键必须有 value。
      const missing = mcp.envSchema.filter((s) => s.required && !userEnv[s.key]).map((s) => s.key);
      if (missing.length) return c.json({ ok: false, message: `缺必填配置项：${missing.join(", ")}` }, 400);
      entry = {
        name: body.name || mcp.name,
        package: mcp.package,
        command: mcp.command,
        args: mcp.args,
        fromMarketplace: marketName,
        installed: false,
        enabled: true,
        outOfCanon: true,
        env: userEnv,
      };
    } else {
      // ── 直装 npm 包 ──
      const command = body.command || "npx";
      const args = body.args && body.args.length ? body.args : ["-y", spec];
      entry = {
        name: body.name || deriveInstanceName(spec),
        package: spec,
        command,
        args,
        installed: false,
        enabled: true,
        outOfCanon: true,
        env: userEnv,
      };
    }

    // npx -y 预拉（触发首次下载到 npx 缓存 / 早暴露坏包）。
    const pre = await prefetch(entry.command, entry.args, entry.env);
    if (!pre.ok) return c.json({ ok: false, message: pre.message }, 502);

    entry.installed = true;
    upsertMcpServer(root, entry);
    return c.json({ ok: true, server: entry, message: pre.message });
  });

  // 列已装客制 MCP。
  app.get("/mcp/servers", (c) => {
    return c.json({ servers: readMcpConfig(root).mcpServers });
  });

  // 切 enabled 开关。body { enabled: boolean }。
  app.post("/mcp/servers/:name/toggle", async (c) => {
    const name = c.req.param("name");
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
    const enabled = body.enabled !== false;
    const ok = setMcpServerEnabled(root, name, enabled);
    if (!ok) return c.json({ ok: false, message: `未找到 MCP ${name}` }, 404);
    return c.json({ ok: true, name, enabled });
  });

  // 删客制 MCP。
  app.delete("/mcp/servers/:name", (c) => {
    const name = c.req.param("name");
    const ok = removeMcpServer(root, name);
    if (!ok) return c.json({ ok: false, message: `未找到 MCP ${name}` }, 404);
    return c.json({ ok: true, name });
  });

  return app;
}

/** 从已注册 marketplace 项重建拉清单 URL（install 时二次拉清单用）。 */
function reconstructManifestUrl(mkt: MarketplaceEntry): string {
  if (mkt.source === "marketplace-url" || mkt.source === "url") {
    if (!mkt.url) throw new Error("marketplace 缺 url");
    return mkt.url;
  }
  // github
  if (!mkt.repo) throw new Error("marketplace 缺 repo");
  const [owner, repo] = mkt.repo.split("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${mkt.ref ?? "HEAD"}/.dicelore/marketplace.json`;
}
