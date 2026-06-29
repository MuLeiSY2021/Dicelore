// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// P6 多模型兼容:推理类模型(DeepSeek-R1 / GLM think / Hermes)会在正文里夹「思考」段,
// 不能当叙事推给玩家。剥掉 <think>/<thinking>/<reasoning> 块 + 未闭合的前导思考。
const BLOCK_RE = /<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi;
const OPEN_RE = /<(think|thinking|reasoning)>[\s\S]*$/i; // 未闭合(流式截断)→ 丢到末尾

export function stripReasoning(text: string): string {
  return text.replace(BLOCK_RE, "").replace(OPEN_RE, "").trim();
}
