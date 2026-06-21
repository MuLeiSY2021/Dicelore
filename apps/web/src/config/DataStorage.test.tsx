import { render, screen } from "@testing-library/react";
import { DataStorage } from "./DataStorage.js";

it("渲染数据与存储(DICELORE_SESSIONS_DIR / DICELORE_FTS_MODE)", () => {
  render(<DataStorage />);
  expect(screen.getByText("DICELORE_SESSIONS_DIR")).toBeInTheDocument();
  expect(screen.getByText("DICELORE_FTS_MODE")).toBeInTheDocument();
});
