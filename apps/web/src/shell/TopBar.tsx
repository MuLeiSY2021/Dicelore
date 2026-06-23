// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, Dices, Hammer, Settings, Languages, Moon, Sun, Check, BookMarked } from "lucide-react";
import { useTheme } from "../theme/ThemeProvider.js";
import { useI18n, LANGS } from "../i18n/index.js";
import { useHealth } from "./useHealth.js";
import { Logo } from "./Logo.js";

export function TopBar() {
  const { resolved, setMode } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { health, offline } = useHealth();
  const [langOpen, setLangOpen] = useState(false);

  const NAV = [
    { to: "/", label: t("nav.home"), Icon: Home, end: true },
    { to: "/packs", label: t("nav.catalog"), Icon: BookMarked, end: false },
    { to: "/play", label: t("nav.play"), Icon: Dices, end: false },
    { to: "/build", label: t("nav.build"), Icon: Hammer, end: false },
    { to: "/config", label: t("nav.config"), Icon: Settings, end: false },
  ];

  return (
    <header className="bar">
      <NavLink to="/" aria-label="Dicelore" style={{ textDecoration: "none" }}>
        <Logo variant="lockup" size={26} />
      </NavLink>
      <nav className="nav">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon className="lucide" /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="tools">
        {/* 运行态指示：模型 / MCP / notify(真值来自 /diagnostics/health) */}
        {!offline && health && (
          <div className="status" aria-label="运行态">
            <span className="st"><span className={"dot" + (health.model.configured ? " ok" : " warn")} />{t("bar.model")} <b>{health.model.gm}</b></span>
            <span className="st"><span className={"dot" + (health.mcp.running ? " ok" : "")} />{t("bar.mcp")} <b>{health.mcp.toolCount}</b></span>
            <span className="st"><span className={"dot" + (health.notify.configured ? " ok" : " warn")} />{t("bar.notify")} {health.notify.configured ? t("bar.notify.connected") : t("bar.notify.unset")}</span>
          </div>
        )}

        <div className="langmenu">
          <button className="tool" aria-label={t("bar.lang")} title={t("bar.lang")} onClick={() => setLangOpen((v) => !v)}>
            <Languages className="lucide" />
          </button>
          {langOpen && (
            <div className="pop" role="menu">
              {LANGS.map((l) => (
                <button key={l.value} className={l.value === lang ? "on" : ""} role="menuitemradio" aria-checked={l.value === lang}
                  onClick={() => { setLang(l.value); setLangOpen(false); }}>
                  {l.value === lang ? <Check className="lucide" style={{ width: 13 }} /> : <span style={{ width: 13 }} />}{l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="tool" aria-label={t("bar.theme")} title={t("bar.theme")} onClick={() => setMode(resolved === "dark" ? "light" : "dark")}>
          {resolved === "dark" ? <Moon className="lucide" /> : <Sun className="lucide" />}
        </button>
      </div>
    </header>
  );
}
