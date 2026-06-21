// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import PlayPage from "./PlayPage.js";
import { getPresentation } from "../api/client.js";
import type { PresentationSnapshot } from "@dicelore/shared";

vi.mock("../api/client.js", () => ({ getPresentation: vi.fn() }));

const snap: PresentationSnapshot = {
  protocol: "dicelore.client/1", sessionId: "demo", seq: 5,
  sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] }],
  mechanics: [], choices: null, narrativeCursor: 0,
};

it("挂载时拉取 demo 会话快照并渲染到呈现台", async () => {
  (getPresentation as Mock).mockResolvedValue(snap);
  render(<PlayPage />);
  expect(getPresentation).toHaveBeenCalledWith("demo");
  expect(await screen.findByText("张三")).toBeInTheDocument();
});

it("拉取失败显示错误提示", async () => {
  (getPresentation as Mock).mockRejectedValue(new Error("boom"));
  render(<PlayPage />);
  expect(await screen.findByText(/加载失败/)).toBeInTheDocument();
});
