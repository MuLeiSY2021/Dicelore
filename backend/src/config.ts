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

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { parse as parseToml } from "smol-toml";
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
