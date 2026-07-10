// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { User } from "lucide-react";
import { DockCard, type DockCardDef } from "./DockCard.js";
import type { SheetGroup } from "@dicelore/shared";

const sheets: SheetGroup[] = [
  { entity: "张三", cells: [
    { attr: "HP", value: "12", visible: 1 },
    { attr: "潜行", value: "+4", visible: 1 },
    { attr: "暗号", value: "夜枭", visible: 0 },
  ] },
];
const preset = (over: Partial<DockCardDef> = {}): DockCardDef => ({
  id: "status", title: "角色 · 张三", Icon: User, diy: false,
  source: "select 张三\n\n## 角色 · 张三\n- HP: ${HP}\n- 潜行: ${潜行}", ...over,
});

it("渲染模板：插值后 markdown 显数据", () => {
  render(<DockCard card={preset()} sheets={sheets} onArchive={vi.fn()} />);
  expect(screen.getByTestId("play-card-body")).toHaveTextContent("HP: 12");
  expect(screen.getByTestId("play-card-body")).toHaveTextContent("潜行: +4");
});

it("count=0（select 选不出）→ 不渲染 card", () => {
  const { container } = render(<DockCard card={preset({ source: "select 不存在\n## x\n- ${HP}" })} sheets={sheets} onArchive={vi.fn()} />);
  expect(container.querySelector(".dcard")).toBeNull();
});

it("编辑按钮 toggle editing → 显模板源码 dc-meta", () => {
  render(<DockCard card={preset()} sheets={sheets} onArchive={vi.fn()} />);
  expect(screen.queryByTestId("play-card-meta")).toBeNull();
  fireEvent.click(screen.getByTestId("play-card-edit"));
  expect(screen.getByTestId("play-card-meta")).toBeInTheDocument();
});

it("归档按钮回调 onArchive(id)", () => {
  const onArchive = vi.fn();
  render(<DockCard card={preset()} sheets={sheets} onArchive={onArchive} />);
  fireEvent.click(screen.getByTestId("play-card-archive"));
  expect(onArchive).toHaveBeenCalledWith("status");
});

it("DIY 卡只取 visible=1：暗号(visible=0)插值为空", () => {
  render(<DockCard card={preset({ diy: true, id: "custom", source: "select 张三\n## 我的\n- 暗号: ${暗号}\n- HP: ${HP}" })} sheets={sheets} onArchive={vi.fn()} />);
  const body = screen.getByTestId("play-card-body");
  expect(body).toHaveTextContent("HP: 12");
  expect(body).not.toHaveTextContent("夜枭");
});

it("dial 可视化：![dial](HP) 渲染 dial 组件", () => {
  render(<DockCard card={preset({ source: "select 张三\n## x\n![dial](HP)" })} sheets={sheets} onArchive={vi.fn()} />);
  expect(screen.getByTestId("play-card-dial")).toBeInTheDocument();
});
