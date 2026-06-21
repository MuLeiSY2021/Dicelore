import { render, screen } from "@testing-library/react";
import { ModelConnection } from "./ModelConnection.js";

it("渲染模型连接(GM 模型 / API key·OAuth)", () => {
  render(<ModelConnection />);
  expect(screen.getByText("模型连接")).toBeInTheDocument();
  expect(screen.getAllByText(/当 GM/).length).toBeGreaterThan(0);
  expect(screen.getByText(/API key/)).toBeInTheDocument();
});
