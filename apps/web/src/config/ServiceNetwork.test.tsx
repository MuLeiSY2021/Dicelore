import { render, screen } from "@testing-library/react";
import { ServiceNetwork } from "./ServiceNetwork.js";

it("渲染服务与网络(端口 / 域名 / DICELORE_NOTIFY_URL)", () => {
  render(<ServiceNetwork />);
  expect(screen.getByText("服务与网络")).toBeInTheDocument();
  expect(screen.getByText("DICELORE_NOTIFY_URL")).toBeInTheDocument();
  expect(screen.getByText(/端口/)).toBeInTheDocument();
});
