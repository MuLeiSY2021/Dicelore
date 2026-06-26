// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type AccentName, type ThemeMode, type FontPreset } from "../theme/ThemeProvider.js";
import { useT } from "../i18n/index.js";

const ACCENTS: { value: AccentName; hex: string }[] = [
  { value: "gold", hex: "#d4a83e" }, { value: "copper", hex: "#c47a3e" },
  { value: "teal", hex: "#3aa896" }, { value: "crimson", hex: "#b4453a" }, { value: "indigo", hex: "#6f74e8" },
];

// 配置 → 主题外观：主题 / 明暗(含跟随系统) / 强调色 / 字体——皆主题 token，即时生效 + 持久化。
export function ThemeAppearance() {
  const { mode, setMode, accent, setAccent, font, setFont } = useTheme();
  const t = useT();
  const MODES: { v: ThemeMode; Icon: typeof Moon; label: string }[] = [
    { v: "dark", Icon: Moon, label: t("cfg.theme.dark") },
    { v: "light", Icon: Sun, label: t("cfg.theme.light") },
    { v: "system", Icon: Monitor, label: t("cfg.theme.system") },
  ];
  return (
    <>
      <div className="mhead"><h3>{t("cfg.theme")}</h3></div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.theme.theme")}</span>
          <div className="fctrl"><span className="fval">{t("cfg.theme.inkgold")}</span></div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.theme.mode")}</span>
          <div className="fctrl">
            <div className="seg" role="group" aria-label={t("cfg.theme.mode")}>
              {MODES.map(({ v, Icon, label }) => (
                <button key={v} className={mode === v ? "on" : ""} aria-pressed={mode === v} onClick={() => setMode(v)}>
                  <Icon className="lucide" /> {label}
                </button>
              ))}
            </div>
            {/* 兼容旧用例：保留一个直接切换明暗的按钮 */}
            <button className="btn" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>切换明暗</button>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.theme.accent")}</span>
          <div className="fctrl">
            <span className="swatches" role="group" aria-label="accent-swatches">
              {ACCENTS.map(({ value, hex }) => (
                <button key={value} className={"swatch" + (accent === value ? " on" : "")} style={{ background: hex }}
                  aria-label={t(`accent.${value}`)} aria-pressed={accent === value} onClick={() => setAccent(value)} />
              ))}
            </span>
            {/* 兼容旧用例 + 可访问：select 控件(aria-label 强调色，唯一) */}
            <select className="f" aria-label={t("cfg.theme.accent")} value={accent} onChange={(e) => setAccent(e.target.value as AccentName)} style={{ minWidth: 120 }}>
              {ACCENTS.map(({ value }) => <option key={value} value={value}>{t(`accent.${value}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.theme.font")}</span>
          <div className="fctrl">
            <div className="seg" role="group" aria-label={t("cfg.theme.font")}>
              {(["default", "song"] as FontPreset[]).map((f) => (
                <button key={f} className={font === f ? "on" : ""} onClick={() => setFont(f)}>
                  {f === "default" ? "Inter / Playfair" : "思源宋体"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
