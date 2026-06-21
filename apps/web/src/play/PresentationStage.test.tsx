// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { PresentationStage } from "./PresentationStage.js";
import type { PresentationSnapshot } from "@dicelore/shared";

const snap: PresentationSnapshot = {
  protocol: "dicelore.client/1",
  sessionId: "demo",
  seq: 12,
  sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }, { attr: "金钱", value: "77", visible: 1 }] }],
  mechanics: [{ seq: 11, kind: "mutation", text: "金钱 +3d100=74 → 77" }],
  choices: { eventId: 12, options: [{ index: 0, label: "推门进去", consequence: "惊动守卫" }] },
  narrativeCursor: 10,
};

it("渲染人物属性面板(entity + cell)", () => {
  render(<PresentationStage snapshot={snap} />);
  expect(screen.getByText("张三")).toBeInTheDocument();
  expect(screen.getByText("HP")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
});

it("渲染机械回显文本", () => {
  render(<PresentationStage snapshot={snap} />);
  expect(screen.getByText("金钱 +3d100=74 → 77")).toBeInTheDocument();
});

it("渲染待选项为展示态按钮(含后果)", () => {
  render(<PresentationStage snapshot={snap} />);
  const btn = screen.getByRole("button", { name: /推门进去/ });
  expect(btn).toBeDisabled(); // 写侧(POST /choices)阻塞，先展示态
  expect(screen.getByText("惊动守卫")).toBeInTheDocument();
});

it("snapshot 为 null 时给空提示", () => {
  render(<PresentationStage snapshot={null} />);
  expect(screen.getByText(/暂无/)).toBeInTheDocument();
});

it("snapshot 非 null 但内容全空时也给空提示(避免空白困惑)", () => {
  const empty: PresentationSnapshot = {
    protocol: "dicelore.client/1", sessionId: "demo", seq: 0,
    sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
  };
  render(<PresentationStage snapshot={empty} />);
  expect(screen.getByText(/暂无/)).toBeInTheDocument();
});
