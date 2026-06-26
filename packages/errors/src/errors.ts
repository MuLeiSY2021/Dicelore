// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

export type DiceloreErrorCode =
  | "EXPR_EVAL"        // expr 解析/求值失败
  | "NOT_NUMERIC"      // 该掷/算术却给非数值
  | "RANGE_INVALID"    // 档位重叠 / 不全覆盖 / min>max / 落空
  | "ENTITY_NOT_FOUND" // 引用/目标实体不存在
  | "DIE_INVALID"      // 单骰串非法(resolve_outcome)
  | "NOT_FOUND"        // 通用目标缺失(pool/doc 等)
  | "BAD_INPUT"        // 入参 schema 校验失败(字段级,便于 agent 自纠)
  | "INTERNAL";        // 未分类(兜底,不泄漏原始栈)

export class DiceloreError extends Error {
  code: DiceloreErrorCode;
  hint?: string;
  constructor(code: DiceloreErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "DiceloreError";
    this.code = code;
    this.hint = hint;
  }
}
