// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useTheme, type AccentName } from "../theme/ThemeProvider.js";

const ACCENTS: { value: AccentName; label: string }[] = [
  { value: "gold", label: "金（默认）" },
  { value: "copper", label: "铜" },
  { value: "teal", label: "青" },
  { value: "crimson", label: "绛" },
  { value: "indigo", label: "靛" },
];

// 配置 → 主题外观（视觉页 §6）。明暗 + 强调色为主题 token，立即生效。
export function ThemeAppearance() {
  const { mode, setMode, accent, setAccent } = useTheme();
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">主题外观</h2>

      <div className="cfg-row">
        <span className="cfg-label">主题</span>
        <span className="cfg-static">墨金（默认）</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">明暗</span>
        <button className="cfg-btn" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
          切换明暗
        </button>
        <span className="cfg-static">当前：{mode === "dark" ? "暗" : "亮"}</span>
      </div>

      <div className="cfg-row">
        <label className="cfg-label" htmlFor="cfg-accent">强调色</label>
        <select
          id="cfg-accent"
          aria-label="强调色"
          value={accent}
          onChange={(e) => setAccent(e.target.value as AccentName)}
        >
          {ACCENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">字体</span>
        <span className="cfg-static">Playfair / Inter / JetBrains Mono（固定三档）</span>
      </div>
    </div>
  );
}
