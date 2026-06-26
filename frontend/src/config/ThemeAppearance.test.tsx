// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, act, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../theme/ThemeProvider.js";
import { ThemeAppearance } from "./ThemeAppearance.js";

function mount() {
  return render(<ThemeProvider><ThemeAppearance /></ThemeProvider>);
}

it("切换明暗写到 <html data-theme>", () => {
  mount();
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => { screen.getByRole("button", { name: "切换明暗" }).click(); });
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("选强调色写到 <html data-accent>", () => {
  mount();
  fireEvent.change(screen.getByLabelText("强调色"), { target: { value: "crimson" } });
  expect(document.documentElement.dataset.accent).toBe("crimson");
});
