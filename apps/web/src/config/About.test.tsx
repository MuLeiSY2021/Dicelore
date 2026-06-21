import { render, screen } from "@testing-library/react";
import { About } from "./About.js";

it("渲染关于子页(Dicelore)", () => {
  render(<About />);
  expect(screen.getByText("关于")).toBeInTheDocument();
  expect(screen.getByText(/Dicelore/)).toBeInTheDocument();
});
