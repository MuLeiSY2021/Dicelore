// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/shared/i18n/index.js";
import { Bay } from "@/shell/Bay.js";

vi.mock("@/shared/api/http.js", () => ({
  getHealth: vi.fn().mockResolvedValue({
    protocol: "dicelore.client/1", fakeGm: true, port: 8787,
    model: { gm: "Opus 4.8", configured: true, baseUrl: null },
    mcp: { name: "dicelore", transport: "in-process", toolCount: 20, running: true },
    notify: { url: null, configured: false }, storage: { sessionsDir: ".", ftsMode: "jieba" },
  }),
}));

function tree(initial: string) {
  return (
    <I18nProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Bay />
      </MemoryRouter>
    </I18nProvider>
  );
}

afterEach(() => { document.body.className = ""; });

it("全局底部 app-bay 渲染，含五块 nav-tab（图标+短名）", () => {
  render(tree("/"));
  expect(screen.getByTestId("app-bay")).toBeInTheDocument();
  expect(screen.getByTestId("app-bay-nav-tabs")).toBeInTheDocument();
  for (const tab of ["home", "catalog", "play", "build", "config"]) {
    expect(screen.getByTestId(`nav-tab-${tab}`)).toBeInTheDocument();
  }
});

it("nav-tab 是可导航链接（指向对应路由）", () => {
  render(tree("/"));
  expect(screen.getByTestId("nav-tab-home")).toHaveAttribute("href", "/");
  expect(screen.getByTestId("nav-tab-catalog")).toHaveAttribute("href", "/adventures");
  expect(screen.getByTestId("nav-tab-play")).toHaveAttribute("href", "/play");
  expect(screen.getByTestId("nav-tab-build")).toHaveAttribute("href", "/build");
  expect(screen.getByTestId("nav-tab-config")).toHaveAttribute("href", "/config");
});

it("当前页 nav-tab 标记 on", () => {
  render(tree("/build"));
  expect(screen.getByTestId("nav-tab-build")).toHaveClass("on");
  expect(screen.getByTestId("nav-tab-home")).not.toHaveClass("on");
});

it("非跑团页默认展开（body 无 bay-nav-collapsed）", () => {
  render(tree("/"));
  expect(document.body).not.toHaveClass("bay-nav-collapsed");
});

it("跑团页默认收起（body.bay-nav-collapsed）", () => {
  render(tree("/play"));
  expect(document.body).toHaveClass("bay-nav-collapsed");
});

it("跑团子路由(/play/:id)也默认收起", () => {
  render(tree("/play/demo"));
  expect(document.body).toHaveClass("bay-nav-collapsed");
});

it("点收起 → body 加 bay-nav-collapsed；点 ≡导航 → 移除", () => {
  render(tree("/"));
  fireEvent.click(screen.getByTestId("app-bay-nav-collapse"));
  expect(document.body).toHaveClass("bay-nav-collapsed");
  fireEvent.click(screen.getByTestId("app-bay-nav"));
  expect(document.body).not.toHaveClass("bay-nav-collapsed");
});

it("≡导航打开 nav popover，含 nav-row + 展开 + nav-status 运行态", async () => {
  render(tree("/play"));
  // 跑团页默认收起，≡导航按钮可见
  fireEvent.click(screen.getByTestId("app-bay-nav"));
  expect(screen.getByTestId("app-bay-popover-nav")).toBeVisible();
  for (const row of ["home", "catalog", "play", "build", "config"]) {
    expect(screen.getByTestId(`nav-row-${row}`)).toBeInTheDocument();
  }
  expect(screen.getByTestId("app-bay-nav-expand")).toBeInTheDocument();
  // nav-status 运行态（模型/MCP/notify）
  const status = await screen.findByTestId("shell-runstatus");
  expect(status).toBeInTheDocument();
  expect(status).toHaveTextContent("Opus 4.8");
});

it("popover 内『展开常驻导航』→ 移除 collapsed 并关闭 popover", () => {
  render(tree("/play"));
  fireEvent.click(screen.getByTestId("app-bay-nav"));
  fireEvent.click(screen.getByTestId("app-bay-nav-expand"));
  expect(document.body).not.toHaveClass("bay-nav-collapsed");
  expect(screen.getByTestId("app-bay-popover-nav")).not.toBeVisible();
});
