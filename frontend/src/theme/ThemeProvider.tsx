// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type AccentName = "gold" | "copper" | "teal" | "crimson" | "indigo";
export type FontPreset = "default" | "song"; // song=正文走思源宋体 fallback(留口)

interface ThemeCtx {
  mode: ThemeMode;            // 用户选择(可为 system)
  resolved: "dark" | "light"; // 实际生效(system 解析后)
  accent: AccentName;
  font: FontPreset;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentName) => void;
  setFont: (f: FontPreset) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const K_MODE = "dicelore.theme.mode";
const K_ACC = "dicelore.theme.accent";
const K_FONT = "dicelore.theme.font";

function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem(key); if (v && (allowed as readonly string[]).includes(v)) return v as T; } catch { /* ignore */ }
  return fallback;
}
function systemDark(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => load(K_MODE, ["dark", "light", "system"] as const, "dark"));
  const [accent, setAccentState] = useState<AccentName>(() => load(K_ACC, ["gold", "copper", "teal", "crimson", "indigo"] as const, "gold"));
  const [font, setFontState] = useState<FontPreset>(() => load(K_FONT, ["default", "song"] as const, "default"));
  const [sysDark, setSysDark] = useState<boolean>(() => systemDark());

  // 跟随系统：监听媒体查询变化。
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSysDark(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const resolved: "dark" | "light" = mode === "system" ? (sysDark ? "dark" : "light") : mode;

  useEffect(() => { document.documentElement.dataset.theme = resolved; try { localStorage.setItem(K_MODE, mode); } catch { /* */ } }, [mode, resolved]);
  useEffect(() => { document.documentElement.dataset.accent = accent; try { localStorage.setItem(K_ACC, accent); } catch { /* */ } }, [accent]);
  useEffect(() => { document.documentElement.dataset.font = font; try { localStorage.setItem(K_FONT, font); } catch { /* */ } }, [font]);

  return (
    <Ctx.Provider value={{ mode, resolved, accent, font, setMode: setModeState, setAccent: setAccentState, setFont: setFontState }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return v;
}
