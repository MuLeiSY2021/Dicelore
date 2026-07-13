// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { McpServers } from "./McpServers.js";

// 后端 /mcp/* 的 fetch 路由替身。
type Route = { status?: number; body: unknown };
function routeFetch(routes: Record<string, Route | (() => Route)>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url.split("?")[0]}`;
    const r = routes[key] ?? routes[`${method} ${url}`];
    if (!r) throw new Error(`no route: ${key}`);
    const resolved = typeof r === "function" ? r() : r;
    const status = resolved.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => resolved.body } as Response;
  });
}

const emptyLists = { "GET /mcp/servers": { body: { servers: [] } } };

beforeEach(() => { vi.stubGlobal("fetch", routeFetch(emptyLists)); });
afterEach(() => { vi.restoreAllMocks(); });

it("渲染核心 dicelore(标必需) + out-of-canon 说明 + 空态 + 添加按钮", async () => {
  render(<McpServers />);
  expect(screen.getByText("dicelore")).toBeInTheDocument();
  expect(screen.getByText(/必需/)).toBeInTheDocument();
  expect(screen.getAllByText(/out-of-canon/).length).toBeGreaterThan(0);
  expect(screen.getByText(/不参与 L3 审计/)).toBeInTheDocument();
  expect(screen.getByTestId("config-mcp-add")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("config-mcp-empty")).toBeInTheDocument());
});

describe("添加自定义 MCP 模态", () => {
  it("点添加 → 打开模态(instance/package/command/args + 配置项) → 确认 → POST /mcp/install → 列出 out-of-canon MCP", async () => {
    const f = routeFetch({
      ...emptyLists,
      "POST /mcp/install": {
        body: { ok: true, message: "预拉成功", server: { name: "my-search", package: "@scope/mcp@0.4.0", command: "npx", args: ["-y", "@scope/mcp@0.4.0"], installed: true, enabled: true, outOfCanon: true, env: { TOKEN: "t" } } },
      },
    });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);

    fireEvent.click(screen.getByTestId("config-mcp-add"));
    const modal = await screen.findByTestId("config-mcp-add-modal");
    fireEvent.change(within(modal).getByTestId("config-mcp-instance"), { target: { value: "my-search" } });
    fireEvent.change(within(modal).getByTestId("config-mcp-package"), { target: { value: "@scope/mcp@0.4.0" } });

    // 加一个配置项
    fireEvent.click(screen.getByTestId("config-mcp-config-add"));
    const keys = within(modal).getAllByLabelText(/配置项键/);
    fireEvent.change(keys[0], { target: { value: "TOKEN" } });
    const vals = within(modal).getAllByLabelText(/配置项值/);
    fireEvent.change(vals[0], { target: { value: "t" } });

    fireEvent.click(screen.getByTestId("config-mcp-add-confirm"));

    await waitFor(() => expect(screen.getByTestId("config-mcp-item")).toBeInTheDocument());
    expect(screen.getByText("my-search")).toBeInTheDocument();
    const call = f.mock.calls.find((c) => String(c[0]) === "/mcp/install");
    const sent = JSON.parse((call![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(sent.spec).toBe("@scope/mcp@0.4.0");
    expect(sent.name).toBe("my-search");
    expect(sent.env).toEqual({ TOKEN: "t" });
  });

  it("配置项删行", async () => {
    render(<McpServers />);
    fireEvent.click(screen.getByTestId("config-mcp-add"));
    await screen.findByTestId("config-mcp-add-modal");
    // 初始 1 行 + 加 1 行 = 2 行
    fireEvent.click(screen.getByTestId("config-mcp-config-add"));
    expect(screen.getAllByTestId("config-mcp-cfg-del").length).toBe(2);
    fireEvent.click(screen.getAllByTestId("config-mcp-cfg-del")[0]);
    expect(screen.getAllByTestId("config-mcp-cfg-del").length).toBe(1);
  });
});

describe("已装 MCP：开关", () => {
  const preinstalled = {
    "GET /mcp/servers": { body: { servers: [{ name: "my-mcp", package: "p@1", command: "npx", args: ["-y", "p@1"], installed: true, enabled: true, outOfCanon: true, env: {} }] } },
  };

  it("加载已装 MCP + out-of-canon 徽 + 开关调 toggle 端点", async () => {
    const f = routeFetch({ ...preinstalled, "POST /mcp/servers/my-mcp/toggle": { body: { ok: true, name: "my-mcp", enabled: false } } });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);
    await waitFor(() => expect(screen.getByText("my-mcp")).toBeInTheDocument());
    expect(screen.getAllByText("out-of-canon").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("config-mcp-toggle"));
    await waitFor(() => {
      const call = f.mock.calls.find((c) => String(c[0]) === "/mcp/servers/my-mcp/toggle");
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ enabled: false });
    });
  });
});
