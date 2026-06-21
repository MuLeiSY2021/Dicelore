// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { DiceloreError, type DiceloreErrorCode } from "../errors.js";

export interface ErrShape {
  code: DiceloreErrorCode;
  message: string;
  hint?: string;
}
export interface CallToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

export function classify(e: unknown): ErrShape {
  if (e instanceof DiceloreError) {
    const out: ErrShape = { code: e.code, message: e.message };
    if (e.hint !== undefined) out.hint = e.hint;
    return out;
  }
  // 不回传原始 e.message,避免泄漏内部栈/路径。
  return { code: "INTERNAL", message: "工具内部错误", hint: "请检查入参或重试" };
}

export function successEnvelope(out: unknown, structuredContent: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(out) }],
    structuredContent,
  };
}

// ★错误路径:绝不带 structuredContent(SDK v1.x 即便 isError 也校验它 against outputSchema)。
export function errorEnvelope(e: unknown): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: classify(e) }) }],
  };
}
