import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider.js";

function Probe() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="accent">{accent}</span>
      <button onClick={() => setMode("light")}>light</button>
      <button onClick={() => setAccent("teal")}>teal</button>
    </div>
  );
}

it("默认 dark/gold，并写到 <html> data 属性", () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByTestId("mode").textContent).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.accent).toBe("gold");
});

it("切换 mode/accent 同步到 <html>", () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  act(() => { screen.getByText("light").click(); });
  act(() => { screen.getByText("teal").click(); });
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.dataset.accent).toBe("teal");
});
