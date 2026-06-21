// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { NavLink } from "react-router-dom";
import { Home, Dices, Hammer, Settings, Languages, Moon, Sun, Palette } from "lucide-react";
import { useTheme, type AccentName } from "../theme/ThemeProvider.js";

const NAV = [
  { to: "/", label: "主页", Icon: Home, end: true },
  { to: "/play", label: "跑团", Icon: Dices, end: false },
  { to: "/build", label: "团本制作", Icon: Hammer, end: false },
  { to: "/config", label: "配置", Icon: Settings, end: false },
];

const ACCENTS: { name: AccentName; hex: string }[] = [
  { name: "gold", hex: "#d4a83e" },
  { name: "copper", hex: "#c47a3e" },
  { name: "teal", hex: "#3aa896" },
  { name: "crimson", hex: "#b4453a" },
  { name: "indigo", hex: "#6f74e8" },
];

export function TopBar() {
  const { mode, setMode, accent, setAccent } = useTheme();
  return (
    <header className="bar">
      <span className="brand">Dicelore<span style={{ color: "#d8553f" }}>.</span></span>
      <nav className="nav">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon className="lucide" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="tools">
        <button className="tool" aria-label="语言" title="语言"><Languages className="lucide" /></button>
        <button className="tool" aria-label="明暗" title="明暗" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
          {mode === "dark" ? <Moon className="lucide" /> : <Sun className="lucide" />}
        </button>
        <span className="palette" title="强调色">
          <Palette className="lucide" />
          {ACCENTS.map(({ name, hex }) => (
            <button
              key={name}
              className={"sw" + (accent === name ? " on" : "")}
              style={{ background: hex }}
              aria-label={`强调色 ${name}`}
              onClick={() => setAccent(name)}
            />
          ))}
        </span>
      </div>
    </header>
  );
}
