// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { existsSync } from "node:fs";
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
        sessionsDir: process.env.DICELORE_SESSIONS_DIR ?? ".",
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
    const { signal, cancel } = withTimeout(6000);
    try {
      const res = await fetch(`${base}/v1/models`, {
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

  // 自定义 MCP 测试：远程 SSE → HTTP 可达性；本地 stdio → 命令路径存在性。
  app.post("/diagnostics/mcp-test", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { transport?: string; endpoint?: string };
    const ep = (body.endpoint || "").trim();
    if (!ep) return c.json({ ok: false, message: "缺少 endpoint" }, 400);
    if (body.transport === "stdio") {
      const cmd = ep.split(/\s+/)[0];
      const exists = existsSync(cmd);
      return c.json({ ok: exists, message: exists ? "命令路径存在" : "命令路径不存在(运行时握手才能确认工具数)" });
    }
    const { signal, cancel } = withTimeout(5000);
    const start = Date.now();
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
