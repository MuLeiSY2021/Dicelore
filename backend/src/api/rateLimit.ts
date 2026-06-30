// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";

// per-session 基础速率限流中间件(SEC2 ⑤ 的「滥用兜底」第一道)。
// 固定窗口计数:每个 session 一个桶,窗内计数 ≤ max 放行,超阈返回 429。
// 默认值刻意宽松(正常单人玩一局远不会撞),env 可在部署时收紧;挂载归 server.ts(主 agent)。
// 缝 B(后端↔web 可远程多租户)的请求入口防滥用,与 token 配额采集([CO-后端-采集])正交、各管一层。

/** 单次解析后的有效配置。 */
export interface RateLimitConfig {
  /** 窗口内允许的最大请求数。 */
  max: number;
  /** 窗口长度(毫秒)。 */
  windowMs: number;
  /** 关闭限流:中间件变为透传。 */
  disabled: boolean;
}

/** 挂载方可传的可选项;缺省的字段走 env → 内置默认的回退链。 */
export interface RateLimitOptions extends Partial<RateLimitConfig> {
  /** 注入时钟(测试用);缺省 Date.now。 */
  now?: () => number;
}

// 宽松默认:60s 窗内 120 次。单人一局正常节奏每回合数请求,远不会撞;
// 收紧靠 env(部署期),不写死进代码,避免日后改默认要动源码。
const DEFAULT_MAX = 120;
const DEFAULT_WINDOW_MS = 60_000;

/** 解析正整数 env;非法(非数字 / ≤0)→ fallback,绝不破窗(更宽松地放行而非误伤)。 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

/**
 * 解析有效配置:显式 opts 优先 → 否则读 env → 否则内置默认。
 * env:DICELORE_RATELIMIT_MAX / DICELORE_RATELIMIT_WINDOW_MS / DICELORE_RATELIMIT_DISABLED(=1 关闭)。
 */
export function resolveRateLimitConfig(opts: RateLimitOptions = {}): RateLimitConfig {
  const max = opts.max ?? parsePositiveInt(process.env.DICELORE_RATELIMIT_MAX, DEFAULT_MAX);
  const windowMs =
    opts.windowMs ?? parsePositiveInt(process.env.DICELORE_RATELIMIT_WINDOW_MS, DEFAULT_WINDOW_MS);
  const disabled = opts.disabled ?? process.env.DICELORE_RATELIMIT_DISABLED === "1";
  return { max, windowMs, disabled };
}

interface Bucket {
  /** 当前窗口起点(ms)。 */
  windowStart: number;
  /** 当前窗口内已计数。 */
  count: number;
}

/**
 * 从请求里取限流主体标识:
 * 1) 路由 param :id(/sessions/:id/...、/lore-sessions/:id/... 都用 :id);
 * 2) 退化 x-session-id 头;
 * 3) 再退化全局桶(常量 key),保证无标识也不抛、仍有兜底速率。
 * 取不到精确 session 时退化到更粗的桶,而非放弃限流。
 */
function subjectKey(c: Parameters<MiddlewareHandler>[0]): string {
  const param = c.req.param("id");
  if (param) return `s:${param}`;
  const header = c.req.header("x-session-id");
  if (header) return `s:${header}`;
  return "global";
}

/**
 * 造一个可挂载的 Hono 中间件。每个 subject 一个固定窗口计数桶(进程内 Map)。
 * 命中上限 → 429 + Retry-After(秒)+ RateLimit-* 提示头;未命中放行并回写剩余额度头。
 * 桶懒清理:同一 key 跨窗自然覆盖(windowStart 前移);长期不访问的死 key 由周期清扫回收。
 */
export function createRateLimit(opts: RateLimitOptions = {}): MiddlewareHandler {
  const cfg = resolveRateLimitConfig(opts);
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, Bucket>();
  // 死 key 回收:每隔一个窗口,扫掉已过期的桶,避免长跑进程 Map 无界增长。
  let lastSweep = now();

  function sweep(t: number): void {
    if (t - lastSweep < cfg.windowMs) return;
    lastSweep = t;
    for (const [k, b] of buckets) {
      if (t - b.windowStart >= cfg.windowMs) buckets.delete(k);
    }
  }

  return createMiddleware(async (c, next) => {
    if (cfg.disabled) return next();

    const t = now();
    sweep(t);
    const key = subjectKey(c);

    let b = buckets.get(key);
    if (!b || t - b.windowStart >= cfg.windowMs) {
      b = { windowStart: t, count: 0 };
      buckets.set(key, b);
    }
    b.count += 1;

    const remaining = Math.max(0, cfg.max - b.count);
    const resetMs = b.windowStart + cfg.windowMs - t;
    // draft RateLimit 头(reset 用「距窗口结束的秒数」,业界惯例)。
    c.header("RateLimit-Limit", String(cfg.max));
    c.header("RateLimit-Remaining", String(remaining));
    c.header("RateLimit-Reset", String(Math.max(0, Math.ceil(resetMs / 1000))));

    if (b.count > cfg.max) {
      const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));
      c.header("Retry-After", String(retryAfterSec));
      return c.json(
        {
          error: "rate_limited",
          message: `请求过于频繁,请 ${retryAfterSec}s 后重试`,
          retryAfterMs: Math.max(0, resetMs),
        },
        429,
      );
    }

    return next();
  });
}
