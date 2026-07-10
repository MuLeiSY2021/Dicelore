// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { lookup } from "node:dns/promises";
import { isIP, BlockList } from "node:net";
import { CLIENT_PROTOCOL } from "@dicelore/shared";
import { BUILTIN_TOOL_COUNT } from "@dicelore/harness";
import { getLogger } from "@dicelore/logs";

// 缝 B 自检面（组件7 配置页/顶栏运行态指示的真值来源）：
// - GET  /diagnostics/health    服务器真实运行态(端口/模型/MCP工具数/notify/存储)
// - POST /diagnostics/model-test 真发起一次最小可达性探测(FAKE 模式短路)
// - POST /diagnostics/mcp-test   自定义 MCP 可达性探测
export interface DiagDeps {
  port: number;
  fakeGm: boolean;
}

export interface HealthInfo {
  protocol: string;
  fakeGm: boolean;
  port: number;
  model: { gm: string; configured: boolean; baseUrl: string | null };
  mcp: { name: string; transport: string; toolCount: number; running: boolean };
  notify: { url: string | null; configured: boolean };
  storage: { sessionsDir: string; ftsMode: string };
}

const PROTOCOL = CLIENT_PROTOCOL;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

// ── SSRF 白名单（SEC2，见 backlog-后端）─────────────────────────────────
// model-test / mcp-test 的 baseUrl / endpoint 完全用户可控，未防护时可探测云元数据
// (169.254.169.254)、环回、内网服务。裁决：挡私网/环回/元数据 IP 段 + 限 https；
// 外部 host 走配置放行。对域名做 DNS 解析后再校验解析出的 IP，挡 DNS rebinding。

// 私网 / 环回 / 链路本地 / 元数据 / 保留段——拒绝直连这些目标。
const BLOCKED = new BlockList();
// IPv4
BLOCKED.addSubnet("0.0.0.0", 8); // "this" 网络 / 未指定
BLOCKED.addSubnet("10.0.0.0", 8); // 私网 A
BLOCKED.addSubnet("100.64.0.0", 10); // CGNAT (RFC6598)
BLOCKED.addSubnet("127.0.0.0", 8); // 环回
BLOCKED.addSubnet("169.254.0.0", 16); // 链路本地（含 169.254.169.254 云元数据）
BLOCKED.addSubnet("172.16.0.0", 12); // 私网 B（172.16-31）
BLOCKED.addSubnet("192.0.0.0", 24); // IETF 协议分配
BLOCKED.addSubnet("192.168.0.0", 16); // 私网 C
BLOCKED.addSubnet("198.18.0.0", 15); // benchmark
BLOCKED.addSubnet("255.255.255.255", 32); // 广播
// IPv6
BLOCKED.addAddress("::1", "ipv6"); // 环回
BLOCKED.addAddress("::", "ipv6"); // 未指定
BLOCKED.addSubnet("fc00::", 7, "ipv6"); // 唯一本地地址 (ULA)
BLOCKED.addSubnet("fe80::", 10, "ipv6"); // 链路本地（含 fe80::a9fe:a9fe 等）

// IPv4-mapped IPv6 (::ffff:a.b.c.d) 归一化成内嵌的 IPv4 再判定，避免绕过。
function unwrapV4Mapped(addr: string): { ip: string; family: "ipv4" | "ipv6" } {
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(addr);
  if (m && isIP(m[1]) === 4) return { ip: m[1], family: "ipv4" };
  const fam = isIP(addr);
  return { ip: addr, family: fam === 6 ? "ipv6" : "ipv4" };
}

function isBlockedIp(addr: string): boolean {
  const { ip, family } = unwrapV4Mapped(addr);
  if (isIP(ip) === 0) return true; // 无法解析当作不安全，拒绝
  return BLOCKED.check(ip, family);
}

export interface SsrfCheck {
  ok: boolean;
  reason?: string;
}

// 校验一个用户提供的 URL 是否可安全发起探测：
// 1) 必须 https；2) 字面量 IP 直接判段；3) 域名先 DNS 解析全部地址、任一落黑段即拒。
// allowHosts：显式放行的 host（小写），命中则跳过 IP 段判定（默认放行用户已配 baseURL host）。
export async function checkSsrf(rawUrl: string, allowHosts: Set<string> = new Set()): Promise<SsrfCheck> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL 非法" };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "仅允许 https" };

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // 去 IPv6 字面量方括号
  if (allowHosts.has(host)) return { ok: true };

  // 字面量 IP：直接判段，不做 DNS。
  if (isIP(host) !== 0) {
    return isBlockedIp(host) ? { ok: false, reason: "目标 IP 属私网/环回/元数据段" } : { ok: true };
  }

  // 域名：解析所有地址，任一落黑段即拒（挡 DNS rebinding / 内网域名）。
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "域名解析失败" };
  }
  if (addrs.length === 0) return { ok: false, reason: "域名无解析结果" };
  for (const a of addrs) {
    if (isBlockedIp(a.address)) return { ok: false, reason: "域名解析到私网/环回/元数据段" };
  }
  return { ok: true };
}

// 默认放行 host：用户已配的 ANTHROPIC_BASE_URL host + 官方 API host。
function defaultAllowHosts(): Set<string> {
  const hosts = new Set<string>(["api.anthropic.com"]);
  const configured = process.env.ANTHROPIC_BASE_URL;
  if (configured) {
    try {
      hosts.add(new URL(configured).hostname.toLowerCase());
    } catch {
      /* 配置非法则忽略，不放行 */
    }
  }
  return hosts;
}

// 客制 MCP stdio 连接测试(裁决 custom-mcp-install §七):真按 stdio 拉起子进程 + MCP 握手 + listTools,
// 返回可达性 + 工具数。命中 npx 缓存则秒起;超时/坏命令回可辨识失败。真实进程 env + 用户配置项 env 注入。
export interface StdioTestResult {
  ok: boolean;
  toolCount?: number;
  message: string;
}
export async function testStdioMcp(
  command: string,
  args: string[],
  env: Record<string, string> = {},
  timeoutMs = 8000,
): Promise<StdioTestResult> {
  if (!command) return { ok: false, message: "缺少 command" };
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport, getDefaultEnvironment } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command,
    args,
    env: { ...getDefaultEnvironment(), ...env }, // 保留 PATH 等默认环境,叠加用户配置项 env
    stderr: "ignore",
  });
  const client = new Client({ name: "dicelore-mcp-test", version: "0.0.0" }, { capabilities: {} });
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`连接超时(${timeoutMs}ms)`)), timeoutMs),
  );
  try {
    await Promise.race([client.connect(transport), timer]);
    const listed = (await Promise.race([client.listTools(), timer])) as { tools: unknown[] };
    const toolCount = listed.tools.length;
    return { ok: true, toolCount, message: `可连接，工具数 ${toolCount}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "stdio 连接失败" };
  } finally {
    try {
      await client.close();
    } catch {
      /* 已断开则忽略 */
    }
  }
}

export function createDiagnosticsApp(deps: DiagDeps): Hono {
  const app = new Hono();

  app.get("/diagnostics/health", (c) => {
    const baseUrl = process.env.ANTHROPIC_BASE_URL ?? null;
    const configured = !!(process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY) || deps.fakeGm;
    const notifyUrl = process.env.DICELORE_NOTIFY_URL ?? null;
    const info: HealthInfo = {
      protocol: PROTOCOL,
      fakeGm: deps.fakeGm,
      port: deps.port,
      model: { gm: process.env.DICELORE_GM_MODEL ?? (deps.fakeGm ? "fake-gm" : "glm-5.2"), configured, baseUrl },
      mcp: { name: "dicelore", transport: "in-process", toolCount: BUILTIN_TOOL_COUNT, running: true },
      notify: { url: notifyUrl, configured: !!notifyUrl },
      storage: {
        sessionsDir: process.env.DICELORE_DATA_DIR ?? process.env.DICELORE_SESSIONS_DIR ?? ".",
        ftsMode: process.env.DICELORE_FTS_MODE === "trigram" ? "trigram" : "jieba",
      },
    };
    return c.json(info);
  });

  // 模型连接测试：FAKE 模式返回模拟成功；否则对 baseUrl 做一次最小 GET(/models) 探测。
  app.post("/diagnostics/model-test", async (c) => {
    const body = (await c.req.json().catch((e: unknown) => { getLogger().warn({ err: e }, "model-test body 解析失败,用空对象兜底"); return {}; })) as { baseUrl?: string; key?: string; gm?: string };
    const start = Date.now();
    if (deps.fakeGm) {
      return c.json({ ok: true, fake: true, latencyMs: Date.now() - start, message: "FAKE_GM 模拟模式：未发起真实请求" });
    }
    const base = (body.baseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
    const key = body.key || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || "";
    const target = `${base}/v1/models`;
    const guard = await checkSsrf(target, defaultAllowHosts());
    if (!guard.ok) {
      getLogger().warn({ baseUrl: base, reason: guard.reason }, "model-test 被 SSRF 白名单拒绝");
      return c.json({ ok: false, latencyMs: Date.now() - start, message: `目标被拒：${guard.reason}` }, 400);
    }
    const { signal, cancel } = withTimeout(6000);
    try {
      const res = await fetch(target, {
        method: "GET",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", authorization: key ? `Bearer ${key}` : "" },
        signal,
      });
      cancel();
      const reachable = res.status > 0;
      const authed = res.status !== 401 && res.status !== 403;
      return c.json({
        ok: reachable && authed,
        status: res.status,
        latencyMs: Date.now() - start,
        message: !authed ? "凭据被拒(401/403)" : reachable ? "连接正常" : "不可达",
      });
    } catch (e: unknown) {
      cancel();
      getLogger().error({ err: e, baseUrl: base }, "model-test 请求失败");
      return c.json({ ok: false, latencyMs: Date.now() - start, message: e instanceof Error ? e.message : "网络错误" });
    }
  });

  // 自定义 MCP 测试：本地 stdio → 真拉起 + 握手 + listTools(客制 out-of-canon MCP);远程 SSE → HTTP 可达性。
  app.post("/diagnostics/mcp-test", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      transport?: string;
      endpoint?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    };
    if (body.transport === "stdio") {
      // 优先用结构化 command/args/env(配置页/config.toml 直传);回落 endpoint 字符串按空白拆分(旧契约)。
      let command = (body.command ?? "").trim();
      let args = Array.isArray(body.args) ? body.args : [];
      if (!command && body.endpoint) {
        const parts = body.endpoint.trim().split(/\s+/);
        command = parts[0] ?? "";
        args = parts.slice(1);
      }
      if (!command) return c.json({ ok: false, message: "缺少 command/endpoint" }, 400);
      const env = body.env && typeof body.env === "object" ? body.env : {};
      const start = Date.now();
      const r = await testStdioMcp(command, args, env);
      return c.json({ ok: r.ok, toolCount: r.toolCount, latencyMs: Date.now() - start, message: r.message }, r.ok ? 200 : 502);
    }
    const ep = (body.endpoint || "").trim();
    if (!ep) return c.json({ ok: false, message: "缺少 endpoint" }, 400);
    const { signal, cancel } = withTimeout(5000);
    const start = Date.now();
    const guard = await checkSsrf(ep);
    if (!guard.ok) {
      cancel();
      getLogger().warn({ endpoint: ep, reason: guard.reason }, "mcp-test 被 SSRF 白名单拒绝");
      return c.json({ ok: false, latencyMs: Date.now() - start, message: `端点被拒：${guard.reason}` }, 400);
    }
    try {
      const res = await fetch(ep, { method: "GET", signal });
      cancel();
      return c.json({ ok: res.status > 0 && res.status < 500, status: res.status, latencyMs: Date.now() - start, message: "端点可达" });
    } catch (e: unknown) {
      cancel();
      getLogger().error({ err: e, endpoint: ep }, "mcp-test 请求失败");
      return c.json({ ok: false, latencyMs: Date.now() - start, message: e instanceof Error ? e.message : "不可达" });
    }
  });

  return app;
}
