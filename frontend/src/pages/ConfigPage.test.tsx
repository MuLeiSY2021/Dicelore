// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, act } from "@testing-library/react";
import { ThemeProvider } from "../theme/ThemeProvider.js";
import ConfigPage from "./ConfigPage.js";

function mount() {
  return render(<ThemeProvider><ConfigPage /></ThemeProvider>);
}

it("渲染 §6 左导航项", () => {
  mount();
  for (const item of ["通用", "服务与网络", "MCP 服务器", "模型连接", "主题外观", "数据与存储", "关于"]) {
    expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
  }
});

it("点「主题外观」显示主题外观子页(含强调色控件)", () => {
  mount();
  act(() => { screen.getByRole("button", { name: "主题外观" }).click(); });
  expect(screen.getByLabelText("强调色")).toBeInTheDocument();
});

it("点「MCP 服务器」显示 MCP 子页(含必需与 out-of-canon)", () => {
  mount();
  act(() => { screen.getByRole("button", { name: "MCP 服务器" }).click(); });
  expect(screen.getByText("dicelore")).toBeInTheDocument();
  expect(screen.getByText(/必需/)).toBeInTheDocument();
  expect(screen.getAllByText(/out-of-canon/).length).toBeGreaterThan(0);
});

it("点「数据与存储」显示数据子页(含 DICELORE_SESSIONS_DIR)", () => {
  mount();
  act(() => { screen.getByRole("button", { name: "数据与存储" }).click(); });
  expect(screen.getByText("DICELORE_SESSIONS_DIR")).toBeInTheDocument();
});

it("点「服务与网络」显示服务子页(含 DICELORE_NOTIFY_URL)", () => {
  mount();
  act(() => { screen.getByRole("button", { name: "服务与网络" }).click(); });
  expect(screen.getByText("DICELORE_NOTIFY_URL")).toBeInTheDocument();
});
