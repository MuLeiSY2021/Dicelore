import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import { TopBar } from "./shell/TopBar.js";
import HomePage from "./pages/HomePage.js";
import PlayPage from "./pages/PlayPage.js";

function tree(initial: string) {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<><TopBar /><Outlet /></>}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

it("bar 渲染四个页面导航 + 品牌", () => {
  render(tree("/"));
  expect(screen.getByText("Dicelore")).toBeInTheDocument();
  for (const label of ["主页", "跑团", "团本制作", "配置"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});

it("主页路由渲染主页壳", () => {
  render(tree("/"));
  expect(screen.getByText("欢迎回到案上")).toBeInTheDocument();
});

it("/play 路由渲染跑团三栏(活动轨 + 呈现台)", () => {
  render(tree("/play"));
  expect(screen.getByLabelText("活动轨")).toBeInTheDocument();
  expect(screen.getByLabelText("呈现台")).toBeInTheDocument();
});
