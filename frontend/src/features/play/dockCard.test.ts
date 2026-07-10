// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { parseTemplate, runSelect, expandTemplate, extractVisuals } from "./dockCard.js";
import type { SheetGroup } from "@dicelore/shared";

const sheets: SheetGroup[] = [
  { entity: "张三", cells: [
    { attr: "HP", value: "12", visible: 1 },
    { attr: "金钱", value: "77", visible: 1 },
    { attr: "潜行", value: "+4", visible: 1 },
    { attr: "暗号", value: "夜枭", visible: 0 },
  ] },
  { entity: "哑婆", cells: [{ attr: "态度", value: "中立", visible: 1 }] },
];

it("parseTemplate：YAML front matter 解析 select/where", () => {
  const { meta, body } = parseTemplate("---\nselect: 张三\nwhere: HP < 15\n---\n## 角色\n- HP: ${HP}");
  expect(meta.select).toBe("张三");
  expect(meta.where).toEqual({ attr: "HP", op: "<", value: "15" });
  expect(body).toContain("## 角色");
});

it("parseTemplate：宽松原型态（select 张三.HP, 张三.金钱）取 entity 段", () => {
  const { meta } = parseTemplate('select 张三.HP, 张三.金钱\nwhere entity = "张三"\n\n## 角色 · 张三\n- HP: ${张三.HP}');
  expect(meta.select).toBe("张三");
});

it("runSelect：挑出匹配 entity 的记录 + cell 映射", () => {
  const recs = runSelect({ select: "张三" }, sheets);
  expect(recs).toHaveLength(1);
  expect(recs[0].cells.HP.value).toBe("12");
});

it("runSelect：DIY 边界只取 visible=1 的 cell（暗号 visible=0 被剔）", () => {
  const recs = runSelect({ select: "张三" }, sheets, true);
  expect(recs[0].cells.暗号).toBeUndefined();
  expect(recs[0].cells.HP).toBeDefined();
});

it("runSelect：where 过滤——不满足条件则记录为空(count=0)", () => {
  const recs = runSelect({ select: "张三", where: { attr: "HP", op: ">", value: "100" } }, sheets);
  expect(recs).toHaveLength(0);
});

it("expandTemplate：count=0 返回 null（不渲染 card）", () => {
  expect(expandTemplate("## x", [])).toBeNull();
});

it("expandTemplate：${attr} 插值", () => {
  const recs = runSelect({ select: "张三" }, sheets);
  const md = expandTemplate("## 角色\n- HP: ${HP}\n- 潜行: ${潜行}", recs);
  expect(md).toContain("HP: 12");
  expect(md).toContain("潜行: +4");
});

it("expandTemplate：${#each} 循环遍历多记录", () => {
  const all: SheetGroup[] = [
    { entity: "队伍", cells: [{ attr: "名", value: "A", visible: 1 }] },
    { entity: "队伍", cells: [{ attr: "名", value: "B", visible: 1 }] },
  ];
  const recs = runSelect({ select: "队伍" }, all);
  const md = expandTemplate("${#each 队伍}- ${名}${{/each}}", recs);
  expect(md).toContain("A");
  expect(md).toContain("B");
});

it("expandTemplate：条件块 ${{expr}} 真则保留、假则删", () => {
  const recs = runSelect({ select: "张三" }, sheets);
  const md = expandTemplate("${{${HP} < 15}}低血量${{/if}}", recs);
  expect(md).toContain("低血量");
  const md2 = expandTemplate("${{${HP} > 100}}高血量${{/if}}", recs);
  expect(md2).not.toContain("高血量");
});

it("extractVisuals：抽出 ![dial]/![bar] + 数值", () => {
  const recs = runSelect({ select: "张三" }, sheets);
  const { markdown, visuals } = extractVisuals("## x\n![dial](HP)\n![bar](金钱)", recs[0]);
  expect(markdown).not.toContain("![dial]");
  expect(visuals).toEqual([
    { kind: "dial", attr: "HP", value: 12 },
    { kind: "bar", attr: "金钱", value: 77 },
  ]);
});
