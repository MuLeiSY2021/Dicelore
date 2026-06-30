// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/shared/theme/ThemeProvider.js";
import { I18nProvider } from "@/shared/i18n/index.js";
import { TopBar } from "@/shell/TopBar.js";

vi.mock("@/shared/api/http.js", () => ({
  getHealth: vi.fn().mockResolvedValue(null),
}));

function tree() {
  return (
    <I18nProvider><ThemeProvider>
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    </ThemeProvider></I18nProvider>
  );
}

// 回归钉：/play 导航项永远可点（不再因挂载时零会话乐观禁用、建档后不解禁）。
// shell 不再读 features/play 的会话数据，空态由 PlayPage 自己处理。
it("/play 导航项始终可点（不带 disabled / aria-disabled）", () => {
  render(tree());
  const playLink = screen.getByRole("link", { name: "跑团" });
  expect(playLink).not.toHaveClass("disabled");
  expect(playLink).not.toHaveAttribute("aria-disabled");
});
