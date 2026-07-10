// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  createMcpApp,
  parseManifest,
  resolveMarketplaceSource,
  deriveInstanceName,
  type Manifest,
} from "./mcp.js";
import { readMcpConfig } from "../config.js";

vi.mock("@dicelore/logs", () => ({
  getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const FIXTURE_MANIFEST: Manifest = {
  name: "acme-mcp-market",
  mcps: [
    {
      name: "bocha-search",
      package: "@bocha/mcp-search@1.2.0",
      command: "npx",
      args: ["-y", "@bocha/mcp-search@1.2.0"],
      description: "博查搜索 MCP",
      envSchema: [{ key: "BOCHA_API_KEY", required: true, description: "API 密钥" }],
    },
  ],
};

describe("parseManifest / resolveMarketplaceSource / deriveInstanceName（纯函数）", () => {
  it("parseManifest 归一化清单", () => {
    const m = parseManifest({ name: "x", mcps: [{ name: "a", package: "a@1" }] });
    expect(m.name).toBe("x");
    expect(m.mcps[0]).toEqual({ name: "a", package: "a@1", command: "npx", args: ["-y", "a@1"], envSchema: [] });
  });

  it("parseManifest 缺 name → throw", () => {
    expect(() => parseManifest({ mcps: [] })).toThrow();
    expect(() => parseManifest(null)).toThrow();
  });

  it("resolveMarketplaceSource: GitHub slug → raw manifest URL", () => {
    const r = resolveMarketplaceSource("acme/mcp-market");
    expect(r.entry).toEqual({ name: "mcp-market", source: "github", repo: "acme/mcp-market" });
    expect(r.manifestUrl).toBe("https://raw.githubusercontent.com/acme/mcp-market/HEAD/.dicelore/marketplace.json");
  });

  it("resolveMarketplaceSource: slug@ref 带 ref", () => {
    const r = resolveMarketplaceSource("acme/mcp-market@v2.0");
    expect(r.entry.ref).toBe("v2.0");
    expect(r.manifestUrl).toContain("/v2.0/.dicelore/marketplace.json");
  });

  it("resolveMarketplaceSource: GitHub URL", () => {
    const r = resolveMarketplaceSource("https://github.com/acme/mcp-market");
    expect(r.entry.source).toBe("github");
    expect(r.entry.repo).toBe("acme/mcp-market");
  });

  it("resolveMarketplaceSource: 直连 marketplace.json URL", () => {
    const r = resolveMarketplaceSource("https://cdn.example.com/foo/marketplace.json");
    expect(r.entry.source).toBe("marketplace-url");
    expect(r.manifestUrl).toBe("https://cdn.example.com/foo/marketplace.json");
  });

  it("resolveMarketplaceSource: 非法源 → throw", () => {
    expect(() => resolveMarketplaceSource("")).toThrow();
    expect(() => resolveMarketplaceSource("https://example.com/not-json")).toThrow();
  });

  it("deriveInstanceName 去 scope 去版本", () => {
    expect(deriveInstanceName("@bocha/mcp-search@1.2.0")).toBe("mcp-search");
    expect(deriveInstanceName("some-pkg@0.4.0")).toBe("some-pkg");
    expect(deriveInstanceName("plain")).toBe("plain");
  });
});

describe("createMcpApp 端点（注入 fake fetchManifest / prefetch，不触网/不 spawn）", () => {
  let dir: string;
  const fetchManifest = vi.fn(async () => FIXTURE_MANIFEST);
  const prefetch = vi.fn(async () => ({ ok: true, message: "预拉成功" }));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "dl-mcpapi-"));
    fetchManifest.mockClear();
    prefetch.mockClear();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const app = () => createMcpApp({ root: dir, fetchManifest, prefetch });

  it("按钮①：POST /mcp/marketplaces 注册源 + 回可用 MCP", async () => {
    const res = await app().request("/mcp/marketplaces", json({ source: "acme/mcp-market" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; marketplace: { name: string }; mcps: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.marketplace.name).toBe("acme-mcp-market"); // 用清单里的 name
    expect(body.mcps).toHaveLength(1);
    // config.toml 落 [marketplaces.<name>]
    expect(readMcpConfig(dir).marketplaces.map((m) => m.name)).toContain("acme-mcp-market");
  });

  it("按钮①：缺 source → 400", async () => {
    const res = await app().request("/mcp/marketplaces", json({}));
    expect(res.status).toBe(400);
  });

  it("按钮①：非法源 → 400，不注册", async () => {
    const res = await app().request("/mcp/marketplaces", json({ source: "https://x/not-json" }));
    expect(res.status).toBe(400);
    expect(readMcpConfig(dir).marketplaces).toHaveLength(0);
  });

  it("GET /mcp/marketplaces 列已注册源", async () => {
    await app().request("/mcp/marketplaces", json({ source: "acme/mcp-market" }));
    const res = await app().request("/mcp/marketplaces");
    const body = (await res.json()) as { marketplaces: unknown[] };
    expect(body.marketplaces).toHaveLength(1);
  });

  it("按钮②（marketplace 装）：npx -y 预拉 → [mcpServers.<name>] 含 installed/fromMarketplace/env", async () => {
    await app().request("/mcp/marketplaces", json({ source: "acme/mcp-market" }));
    const res = await app().request("/mcp/install", json({ spec: "bocha-search@acme-mcp-market", env: { BOCHA_API_KEY: "k-123" } }));
    expect(res.status).toBe(200);
    expect(prefetch).toHaveBeenCalledWith("npx", ["-y", "@bocha/mcp-search@1.2.0"], { BOCHA_API_KEY: "k-123" });
    const s = readMcpConfig(dir).mcpServers[0];
    expect(s.name).toBe("bocha-search");
    expect(s.installed).toBe(true);
    expect(s.enabled).toBe(true);
    expect(s.outOfCanon).toBe(true);
    expect(s.fromMarketplace).toBe("acme-mcp-market");
    expect(s.env).toEqual({ BOCHA_API_KEY: "k-123" });
  });

  it("按钮②（marketplace 装）：缺 required env → 400，不预拉不落库", async () => {
    await app().request("/mcp/marketplaces", json({ source: "acme/mcp-market" }));
    const res = await app().request("/mcp/install", json({ spec: "bocha-search@acme-mcp-market", env: {} }));
    expect(res.status).toBe(400);
    expect(prefetch).not.toHaveBeenCalled();
    expect(readMcpConfig(dir).mcpServers).toHaveLength(0);
  });

  it("按钮②（直装 npm 包）：无 fromMarketplace、默认 npx -y", async () => {
    const res = await app().request("/mcp/install", json({ spec: "some-pkg@0.4.0", env: { TOKEN: "t" } }));
    expect(res.status).toBe(200);
    expect(prefetch).toHaveBeenCalledWith("npx", ["-y", "some-pkg@0.4.0"], { TOKEN: "t" });
    const s = readMcpConfig(dir).mcpServers[0];
    expect(s.name).toBe("some-pkg");
    expect(s.fromMarketplace).toBeUndefined();
    expect(s.package).toBe("some-pkg@0.4.0");
  });

  it("按钮②（直装）：用户手填 command/args（如 uvx）", async () => {
    const res = await app().request("/mcp/install", json({
      spec: "some-py-mcp@0.4.0", name: "local-py", command: "uvx", args: ["some-py-mcp@0.4.0"], env: {},
    }));
    expect(res.status).toBe(200);
    expect(prefetch).toHaveBeenCalledWith("uvx", ["some-py-mcp@0.4.0"], {});
    const s = readMcpConfig(dir).mcpServers[0];
    expect(s.name).toBe("local-py");
    expect(s.command).toBe("uvx");
  });

  it("按钮②：预拉失败 → 502，不落库", async () => {
    prefetch.mockResolvedValueOnce({ ok: false, message: "退出码 1：坏包" });
    const res = await app().request("/mcp/install", json({ spec: "bad-pkg@9.9.9", env: {} }));
    expect(res.status).toBe(502);
    expect(readMcpConfig(dir).mcpServers).toHaveLength(0);
  });

  it("GET /mcp/servers 列已装 + toggle + delete", async () => {
    await app().request("/mcp/install", json({ spec: "p@1", env: {} }));
    let res = await app().request("/mcp/servers");
    expect(((await res.json()) as { servers: unknown[] }).servers).toHaveLength(1);

    res = await app().request("/mcp/servers/p/toggle", json({ enabled: false }));
    expect(res.status).toBe(200);
    expect(readMcpConfig(dir).mcpServers[0].enabled).toBe(false);

    res = await app().request("/mcp/servers/nope/toggle", json({ enabled: true }));
    expect(res.status).toBe(404);

    res = await app().request("/mcp/servers/p", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(readMcpConfig(dir).mcpServers).toHaveLength(0);
  });
});

describe("defaultPrefetch 真 spawn（node fixture，无网络）", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "dl-prefetch-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("命令零退出 → 预拉成功", async () => {
    // 用真 defaultPrefetch（不注入）：node -e "process.exit(0)" 立即成功退出。
    const app = createMcpApp({ root: dir }); // 默认 prefetch = 真 spawn
    const res = await app.request("/mcp/install", json({
      spec: "dummy", name: "ok-mcp", command: process.execPath, args: ["-e", "process.exit(0)"], env: {},
    }));
    expect(res.status).toBe(200);
    expect(readMcpConfig(dir).mcpServers[0].installed).toBe(true);
  });

  it("命令非零退出 → 502", async () => {
    const app = createMcpApp({ root: dir });
    const res = await app.request("/mcp/install", json({
      spec: "dummy2", name: "bad-mcp", command: process.execPath, args: ["-e", "process.exit(3)"], env: {},
    }));
    expect(res.status).toBe(502);
    expect(readMcpConfig(dir).mcpServers).toHaveLength(0);
  });
});
