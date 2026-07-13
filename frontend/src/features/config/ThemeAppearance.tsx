// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useTheme, type AccentName, type ThemeMode, type FontPreset } from "@/shared/theme/ThemeProvider.js";
import { useT } from "@/shared/i18n/index.js";

const ACCENTS: { value: AccentName; hex: string }[] = [
  { value: "gold", hex: "#d4a83e" }, { value: "copper", hex: "#c47a3e" },
  { value: "teal", hex: "#3aa896" }, { value: "crimson", hex: "#b4453a" }, { value: "indigo", hex: "#6f74e8" },
];

// 配置 → 主题外观：主题 / 明暗(含跟随系统) / 强调色 / 字体——皆主题 token，即时生效 + 持久化。
export function ThemeAppearance() {
  const { mode, setMode, accent, setAccent, font, setFont } = useTheme();
  const t = useT();
  const MODES: { v: ThemeMode; label: string }[] = [
    { v: "dark", label: t("cfg.theme.dark") },
    { v: "light", label: t("cfg.theme.light") },
    { v: "system", label: t("cfg.theme.system") },
  ];
  const FONTS: { v: FontPreset; label: string }[] = [
    { v: "default", label: "默认" },
    { v: "song", label: "思源宋体" },
  ];
  return (
    <>
      <div className="mhead"><h3>{t("cfg.theme")}</h3></div>
      <div className="mdesc">主题 / 明暗 / 强调色 / 字体，均本地持久化，改完即时应用。</div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.theme.theme")}</span>
          <div className="fctrl">
            <select className="f" data-testid="config-theme-preset" aria-label={t("cfg.theme.theme")} defaultValue="inkgold">
              <option value="inkgold">{t("cfg.theme.inkgold")}</option>
            </select>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.theme.mode")}</span>
          <div className="fctrl">
            <div className="seg" data-testid="config-theme-mode" role="group" aria-label={t("cfg.theme.mode")}>
              {MODES.map(({ v, label }) => (
                <button key={v} className={mode === v ? "on" : ""} aria-pressed={mode === v} onClick={() => setMode(v)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.theme.accent")}</span>
          <div className="fctrl">
            <span className="swatches" data-testid="config-theme-accent" role="group" aria-label={t("cfg.theme.accent")}>
              {ACCENTS.map(({ value, hex }) => (
                <button key={value} className={"swatch" + (accent === value ? " on" : "")} style={{ background: hex }}
                  aria-label={t(`accent.${value}`)} aria-pressed={accent === value} onClick={() => setAccent(value)} />
              ))}
            </span>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.theme.font")}</span>
          <div className="fctrl">
            <div className="seg" data-testid="config-theme-font" role="group" aria-label={t("cfg.theme.font")}>
              {FONTS.map(({ v, label }) => (
                <button key={v} className={font === v ? "on" : ""} onClick={() => setFont(v)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
