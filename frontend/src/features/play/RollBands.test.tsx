// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { RollBands, type RollBand } from "./RollBands.js";

const bands: RollBand[] = [
  { label: "失手", min: 1, max: 3, plan: "绳没断惊动守卫(HP-3)", narration: "绳没断，钟楼晃出声响" },
  { label: "成功", min: 4, max: 6, plan: "割断绳暗值+1", narration: "割断绳，钟声哑了" },
];

it("严格档骰前：只显 label+区间，plan/narration 都隐", () => {
  render(<RollBands bands={bands} tier="strict" result={null} />);
  expect(screen.getByTestId("play-roll-bands")).toBeInTheDocument();
  expect(screen.queryByText(/割断绳，钟声哑了/)).toBeNull();
  expect(screen.queryByText(/暗值\+1/)).toBeNull();
  expect(screen.getByText("1–3")).toBeInTheDocument();
});

it("严格档骰后：命中档显 narration、plan 仍隐、未命中档不显", () => {
  render(<RollBands bands={bands} tier="strict" result={{ eventId: 1, rolls: [5], total: 5, outcome: "命中 4–6" }} />);
  expect(screen.getByText(/割断绳，钟声哑了/)).toBeInTheDocument();
  expect(screen.queryByText(/暗值\+1/)).toBeNull();
  expect(screen.queryByText(/绳没断/)).toBeNull(); // 未命中档不显
  expect(screen.getByTestId("play-dice-result")).toHaveTextContent("5");
});

it("宽松档骰前显 narration；骰后命中档 narration+plan", () => {
  const { rerender } = render(<RollBands bands={bands} tier="loose" result={null} />);
  expect(screen.getByText(/割断绳，钟声哑了/)).toBeInTheDocument();
  expect(screen.queryByText(/暗值\+1/)).toBeNull();
  rerender(<RollBands bands={bands} tier="loose" result={{ eventId: 1, rolls: [5], total: 5, outcome: "命中" }} />);
  expect(screen.getByText(/割断绳，钟声哑了.*暗值\+1/)).toBeInTheDocument();
});

it("关闭档：plan+narration 全显（含未命中档）", () => {
  render(<RollBands bands={bands} tier="off" result={{ eventId: 1, rolls: [5], total: 5, outcome: "命中" }} />);
  expect(screen.getByText(/绳没断惊动守卫/)).toBeInTheDocument(); // 未命中档也显
  expect(screen.getByText(/割断绳暗值\+1/)).toBeInTheDocument();
});
