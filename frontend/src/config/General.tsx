// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useI18n, LANGS, type Lang } from "../i18n/index.js";
import { useSettings, type StartupBehavior } from "../settings/useSettings.js";

// 配置 → 通用：语言切换(真生效+持久化) + 启动行为。
export function General() {
  const { lang, setLang, t } = useI18n();
  const { settings, setStartup } = useSettings();
  return (
    <>
      <div className="mhead"><h3>{t("cfg.general")}</h3></div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.general.lang")}</span>
          <div className="fctrl">
            <select className="f" aria-label={t("cfg.general.lang")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.general.startup")}</span>
          <div className="fctrl">
            <div className="seg" role="group" aria-label={t("cfg.general.startup")}>
              {(["home", "last"] as StartupBehavior[]).map((v) => (
                <button key={v} className={settings.startup === v ? "on" : ""} onClick={() => setStartup(v)}>
                  {t(v === "home" ? "cfg.startup.home" : "cfg.startup.last")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
