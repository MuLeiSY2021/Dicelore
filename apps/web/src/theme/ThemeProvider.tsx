// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";
export type AccentName = "gold" | "copper" | "teal" | "crimson" | "indigo";

interface ThemeCtx {
  mode: ThemeMode;
  accent: AccentName;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentName) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [accent, setAccent] = useState<AccentName>("gold");

  useEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
  useEffect(() => { document.documentElement.dataset.accent = accent; }, [accent]);

  return <Ctx.Provider value={{ mode, accent, setMode, setAccent }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return v;
}
