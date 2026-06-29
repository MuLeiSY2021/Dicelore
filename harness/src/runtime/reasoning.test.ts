// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { stripReasoning } from "./reasoning.js";

describe("stripReasoning(P6 多模型)", () => {
  it("剥 <think> 闭合块,留正文", () => {
    expect(stripReasoning("<think>盘算一下</think>门开了。")).toBe("门开了。");
    expect(stripReasoning("<thinking>x</thinking>\n\n你推门进去。")).toBe("你推门进去。");
  });
  it("剥未闭合(流式截断)的前导思考", () => {
    expect(stripReasoning("<think>还在想")).toBe("");
  });
  it("无思考块原样返回", () => {
    expect(stripReasoning("门吱呀一声开了。")).toBe("门吱呀一声开了。");
  });
  it("reasoning 标签同样剥", () => {
    expect(stripReasoning("<reasoning>r</reasoning>正文")).toBe("正文");
  });
});
