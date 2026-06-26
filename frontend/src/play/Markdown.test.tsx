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

  // ===== XSS 防回归:GM/玩家文本不可信,原始 HTML 必须被转义、不得变成真实 DOM =====
  it("<script> 不渲染为真实 script 元素(被当纯文本转义)", () => {
    const { container } = render(<Markdown text="正常剧情<script>alert(1)</script>结束" />);
    // 不能出现真实 <script> 节点
    expect(container.querySelector("script")).toBeNull();
    // 原文应作为文本保留(转义后仍是可见文本)
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("<img onerror> 不产生真实 img 节点/事件处理器", () => {
    const { container } = render(<Markdown text={'看这里<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector("img")).toBeNull();
    // onerror 不应作为属性挂到任何元素上;整段以文本形式存在
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("混入 HTML 的列表项也只输出文本,不注入元素", () => {
    const { container } = render(<Markdown text={"- 安全<b>项</b>"} />);
    // 列表结构来自 markdown,但 <b> 来自用户文本,必须被转义而非渲染
    expect(container.querySelector("ul li")).not.toBeNull();
    expect(container.querySelector("ul li b")).toBeNull();
    expect(container.querySelector("ul li")?.textContent).toBe("安全<b>项</b>");
  });
});
