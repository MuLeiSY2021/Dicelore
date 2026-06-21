import { render, screen } from "@testing-library/react";
import { General } from "./General.js";

it("渲染通用子页", () => {
  render(<General />);
  expect(screen.getByText("通用")).toBeInTheDocument();
});
