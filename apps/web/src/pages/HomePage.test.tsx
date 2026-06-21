import { render, screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage.js";
import { listSessions } from "../api/client.js";
import type { SessionSummary } from "@dicelore/shared";

vi.mock("../api/client.js", () => ({ listSessions: vi.fn() }));

function mount() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

const sessions: SessionSummary[] = [
  { sessionId: "demo", title: "黄昏旅店", status: "active" },
  { sessionId: "old", title: "旧档", status: "archived" },
];

it("挂载时拉取会话列表并渲染 session title", async () => {
  (listSessions as Mock).mockResolvedValue(sessions);
  mount();
  expect(listSessions).toHaveBeenCalled();
  expect((await screen.findAllByText("黄昏旅店")).length).toBeGreaterThan(0);
  expect(await screen.findByText("旧档")).toBeInTheDocument();
});

it("列表为空显示开新局提示", async () => {
  (listSessions as Mock).mockResolvedValue([]);
  mount();
  expect((await screen.findAllByText(/暂无会话/)).length).toBeGreaterThan(0);
});

it("拉取失败显示加载失败提示", async () => {
  (listSessions as Mock).mockRejectedValue(new Error("boom"));
  mount();
  expect(await screen.findByText(/加载失败/)).toBeInTheDocument();
});
