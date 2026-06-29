// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { SessionBackend } from "@dicelore/interface";
import type { ToolDef } from "./tooldef.js";
import { makeResolverTools } from "./handlers/resolver.js";
import { makeSheetTools } from "./handlers/sheet.js";
import { makeEventTools } from "./handlers/event.js";
import { makeWorldTools } from "./handlers/world.js";
import { makeIoTools } from "./handlers/io.js";

/** 内置框架工具全集（handler 经注入的 SessionBackend 调 ported ops；storage-port ADR §4）。 */
export function makeTools(backend: SessionBackend): ToolDef[] {
  return [
    ...makeResolverTools(backend),
    ...makeSheetTools(backend),
    ...makeEventTools(backend),
    ...makeWorldTools(backend),
    ...makeIoTools(backend),
  ];
}

// 内置工具的元数据（名字/数量）不依赖具体 backend——工厂仅在 handler 闭包里引用 backend，
// 构造期不调其方法。故传 null backend 仅为读元数据(诊断面工具计数 / 注册表自检)，绝不 invoke。
const METADATA_TOOLS = makeTools(null as unknown as SessionBackend);
/** 内置工具名清单（静态元数据，backend 无关）。 */
export const BUILTIN_TOOL_NAMES: readonly string[] = METADATA_TOOLS.map((t) => t.name);
/** 内置工具数（组件7 配置页展示真实工具数）。 */
export const BUILTIN_TOOL_COUNT = METADATA_TOOLS.length;
