// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, act } from "@testing-library/react";
import { ThemeProvider } from "@/shared/theme/ThemeProvider.js";
import { ThemeAppearance } from "./ThemeAppearance.js";

function mount() {
  return render(<ThemeProvider><ThemeAppearance /></ThemeProvider>);
}

it("点「亮」写到 <html data-theme>（明暗 seg 即时应用）", () => {
  mount();
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => { screen.getByRole("button", { name: "亮" }).click(); });
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("点强调色色板写到 <html data-accent>", () => {
  mount();
  act(() => { screen.getByRole("button", { name: "绛" }).click(); });
  expect(document.documentElement.dataset.accent).toBe("crimson");
});
