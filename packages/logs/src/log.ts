// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import pino, { multistream } from "pino";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

// 分级文件 logger:pino multistream + dedupe,按级别严格分文件(error 只进 error.log)。
// streams 须降序排列(error→debug):dedupe 把每条日志只发到第一个 >= 其 level 的 stream,
// 故 error 日志止于 error.log,warn 止于 warn.log,以此类推,不重复。
const LEVEL_FILES: { level: pino.Level; file: string }[] = [
  { level: "error", file: "error.log" },
  { level: "warn", file: "warn.log" },
  { level: "info", file: "info.log" },
  { level: "debug", file: "debug.log" },
];

// 同目录复用 logger 实例(避免每回合新建 write stream 致 fd 泄漏——DiceGm 每回合 new)。
// session 删除后 cache 残留可接受(eval 短期);长期可由 deleteSession 清理。
const _fileLoggerCache = new Map<string, pino.Logger>();
export function createFileLogger(dir: string): pino.Logger {
  const cached = _fileLoggerCache.get(dir);
  if (cached) return cached;
  mkdirSync(dir, { recursive: true });
  const streams = LEVEL_FILES.map(({ level, file }) => ({
    level,
    stream: createWriteStream(join(dir, file), { flags: "a" }),
  }));
  const l = pino({ level: "debug" }, multistream(streams, { dedupe: true }));
  _fileLoggerCache.set(dir, l);
  return l;
}

// 全局系统级 logger。未 init 前退化为 pino 默认(stdout,info 级)——供 backend cli/server 与
// harness mcp/hooks 在 server 启动前兜底;server.ts 启动时 initGlobalLogger($ROOT) 切到分级文件输出。
let _global: pino.Logger = pino({ level: "info" });
export function getLogger(): pino.Logger {
  return _global;
}
export function initGlobalLogger(root: string): pino.Logger {
  _global = createFileLogger(root);
  return _global;
}

// 硬规矩:所有 catch 必记日志,禁止静默 ignore——
//   · 预期降级(目录不存在返回 []、JSON.parse 兜底、resolve 失败走 cwd)→ getLogger().warn
//   · 真错误(DB 读不动、IO 失败、写日志/对话记录失败)→ getLogger().error
