// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { NavLink } from "react-router-dom";
import { ICONS, type IconName } from "../icons.js";
import { useTheme } from "../theme/ThemeProvider.js";
import "./TopBar.css";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "主页", icon: "home" },
  { to: "/play", label: "跑团", icon: "dices" },
  { to: "/build", label: "团本制作", icon: "hammer" },
  { to: "/config", label: "配置", icon: "settings" },
];

export function TopBar() {
  const { mode, setMode, accent, setAccent } = useTheme();
  const ModeIcon = ICONS[mode === "dark" ? "moon" : "sun"];
  const Languages = ICONS.languages;
  const Palette = ICONS.palette;
  const accents = ["gold", "copper", "teal", "crimson", "indigo"] as const;

  return (
    <header className="topbar">
      <span className="brand">Dicelore</span>
      <nav className="nav">
        {NAV.map(({ to, label, icon }) => {
          const Icon = ICONS[icon];
          return (
            <NavLink key={to} to={to} end={to === "/"} className="navitem">
              <Icon size={16} /> <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="tools">
        <button aria-label="语言"><Languages size={16} /></button>
        <button aria-label="明暗" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
          <ModeIcon size={16} />
        </button>
        <button aria-label="强调色"><Palette size={16} /></button>
        <select aria-label="强调色选择" value={accent} onChange={(e) => setAccent(e.target.value as typeof accent)}>
          {accents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    </header>
  );
}
