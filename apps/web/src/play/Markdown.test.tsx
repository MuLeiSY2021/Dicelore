// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "./Markdown.js";

describe("Markdown", () => {
  it("纯文本 → 单 <p>", () => {
    const { container } = render(<Markdown text="门吱呀一声开了。" />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe("门吱呀一声开了。");
  });
  it("行内 **粗** *斜* `码`", () => {
    const { container } = render(<Markdown text="他**怒喝**一声,*缓缓*抽出 `钟锤`。" />);
    expect(container.querySelector("strong")?.textContent).toBe("怒喝");
    expect(container.querySelector("em")?.textContent).toBe("缓缓");
    expect(container.querySelector("code")?.textContent).toBe("钟锤");
  });
  it("空行分段 → 多 <p>", () => {
    const { container } = render(<Markdown text={["第一段。", "第二段。"].join("\n\n")} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });
  it("- 列表 → <ul><li>", () => {
    const { container } = render(<Markdown text={["- 甲", "- 乙"].join("\n")} />);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
  });
  it("# 标题 → 提升级 heading", () => {
    const { container } = render(<Markdown text="# 黑风寨" />);
    expect(container.querySelector("h3")?.textContent).toBe("黑风寨");
  });
});
