// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { createRateLimit, resolveRateLimitConfig } from "./rateLimit.js";

// 给一个挂了限流的最小 app:每个 session 路由都过中间件,handler 只回 ok。
function makeApp(opts?: Parameters<typeof createRateLimit>[0]) {
  const app = new Hono();
  app.use("/sessions/:id/*", createRateLimit(opts));
  app.use("/sessions/:id", createRateLimit(opts));
  app.post("/sessions/:id/messages", (c) => c.json({ ok: true }));
  app.get("/sessions/:id", (c) => c.json({ ok: true }));
  return app;
}

const RL_ENV = [
  "DICELORE_RATELIMIT_MAX",
  "DICELORE_RATELIMIT_WINDOW_MS",
  "DICELORE_RATELIMIT_DISABLED",
] as const;

describe("resolveRateLimitConfig — 默认值与 env 覆盖", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const k of RL_ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of RL_ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("无 env 时给宽松默认值", () => {
    const cfg = resolveRateLimitConfig();
    expect(cfg.max).toBe(120);
    expect(cfg.windowMs).toBe(60_000);
    expect(cfg.disabled).toBe(false);
  });

  it("env 覆盖 max / windowMs", () => {
    process.env.DICELORE_RATELIMIT_MAX = "5";
    process.env.DICELORE_RATELIMIT_WINDOW_MS = "1000";
    const cfg = resolveRateLimitConfig();
    expect(cfg.max).toBe(5);
    expect(cfg.windowMs).toBe(1000);
  });

  it("DICELORE_RATELIMIT_DISABLED=1 关闭限流", () => {
    process.env.DICELORE_RATELIMIT_DISABLED = "1";
    expect(resolveRateLimitConfig().disabled).toBe(true);
  });

  it("非法 env(负数/非数字/零)回退默认,不破窗", () => {
    process.env.DICELORE_RATELIMIT_MAX = "-3";
    process.env.DICELORE_RATELIMIT_WINDOW_MS = "abc";
    const cfg = resolveRateLimitConfig();
    expect(cfg.max).toBe(120);
    expect(cfg.windowMs).toBe(60_000);
  });

  // 显式传入的 opts 优先于 env(挂载方可强制覆盖)。
  it("显式 opts 覆盖 env", () => {
    process.env.DICELORE_RATELIMIT_MAX = "5";
    const cfg = resolveRateLimitConfig({ max: 9 });
    expect(cfg.max).toBe(9);
  });
});

describe("createRateLimit — 超阈返回 429", () => {
  it("窗内放行至 max、第 max+1 个 429", async () => {
    const app = makeApp({ max: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/sessions/s1/messages", { method: "POST" });
      expect(res.status).toBe(200);
    }
    const blocked = await app.request("/sessions/s1/messages", { method: "POST" });
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toBe("rate_limited");
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("命中后带 RateLimit-* 提示头", async () => {
    const app = makeApp({ max: 2, windowMs: 60_000 });
    await app.request("/sessions/s1/messages", { method: "POST" });
    const res = await app.request("/sessions/s1/messages", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("2");
    expect(res.headers.get("RateLimit-Remaining")).toBe("0");
  });

  it("不同 session 独立计数,互不影响", async () => {
    const app = makeApp({ max: 1, windowMs: 60_000 });
    expect((await app.request("/sessions/a/messages", { method: "POST" })).status).toBe(200);
    expect((await app.request("/sessions/a/messages", { method: "POST" })).status).toBe(429);
    // b 第一发仍应放行
    expect((await app.request("/sessions/b/messages", { method: "POST" })).status).toBe(200);
  });

  it("窗口过期后重新放行(注入 clock 推进时间)", async () => {
    let now = 1_000_000;
    const app = makeApp({ max: 1, windowMs: 1000, now: () => now });
    expect((await app.request("/sessions/s1/messages", { method: "POST" })).status).toBe(200);
    expect((await app.request("/sessions/s1/messages", { method: "POST" })).status).toBe(429);
    now += 1001; // 跨过窗口
    expect((await app.request("/sessions/s1/messages", { method: "POST" })).status).toBe(200);
  });

  it("disabled=true 时完全放行(永不 429)", async () => {
    const app = makeApp({ max: 1, windowMs: 60_000, disabled: true });
    for (let i = 0; i < 10; i++) {
      expect((await app.request("/sessions/s1/messages", { method: "POST" })).status).toBe(200);
    }
  });
});

describe("createRateLimit — 对抗性 / 边界", () => {
  // 无 :id param 的路由(理论上不会挂,但中间件须健壮):退化到 header / 全局桶,不抛。
  it("无 session 标识时用 x-session-id 头,缺失则全局桶,不崩", async () => {
    const app = new Hono();
    app.use("*", createRateLimit({ max: 1, windowMs: 60_000 }));
    app.get("/ping", (c) => c.json({ ok: true }));
    const r1 = await app.request("/ping", { headers: { "x-session-id": "h1" } });
    expect(r1.status).toBe(200);
    const r2 = await app.request("/ping", { headers: { "x-session-id": "h1" } });
    expect(r2.status).toBe(429);
    // 不同头 → 不同桶
    expect((await app.request("/ping", { headers: { "x-session-id": "h2" } })).status).toBe(200);
  });

  it("各 session 桶独立过期,不会因一个 session 跨窗影响另一个", async () => {
    let now = 0;
    const app = makeApp({ max: 1, windowMs: 1000, now: () => now });
    await app.request("/sessions/a/messages", { method: "POST" }); // a 计数=1@window0
    now = 1500;
    await app.request("/sessions/b/messages", { method: "POST" }); // b 计数=1@window1
    // a 已过期 → 放行;b 未过期 → 429
    expect((await app.request("/sessions/a/messages", { method: "POST" })).status).toBe(200);
    expect((await app.request("/sessions/b/messages", { method: "POST" })).status).toBe(429);
  });

  it("Retry-After 为正整数秒、不小于剩余窗口", async () => {
    let now = 0;
    const app = makeApp({ max: 1, windowMs: 5000, now: () => now });
    await app.request("/sessions/s1/messages", { method: "POST" });
    now = 2000; // 还剩 3s
    const res = await app.request("/sessions/s1/messages", { method: "POST" });
    expect(res.status).toBe(429);
    const retry = Number(res.headers.get("Retry-After"));
    expect(Number.isInteger(retry)).toBe(true);
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(5);
  });
});
