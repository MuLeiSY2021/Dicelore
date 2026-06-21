import { render, screen } from "@testing-library/react";
import { McpServers } from "./McpServers.js";

it("渲染核心 dicelore(标必需)与自定义 out-of-canon 说明", () => {
  render(<McpServers />);
  expect(screen.getByText("dicelore")).toBeInTheDocument();
  expect(screen.getByText(/必需/)).toBeInTheDocument();
  expect(screen.getAllByText(/out-of-canon/).length).toBeGreaterThan(0);
  // 联网警示 + 那条 out-of-canon 说明
  expect(screen.getByText(/不参与 L3 审计/)).toBeInTheDocument();
});
