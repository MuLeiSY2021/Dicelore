// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState } from "react";
import { useI18n } from "@/shared/i18n/index.js";
import { useSettings } from "@/shared/settings/useSettings.js";

// 配置 → 通用：界面语言(真生效+持久化) / 自动继续最近会话 / bay 行为 / 紧凑模式。
// 语言、启动行为走已有 provider；bay-mode 与紧凑模式本地持久化(localStorage)，
// bay-mode 变更 dispatch dicelore:baymode 事件让 Bay 即时响应(BayProvider 监听 event + storage)。
type BayMode = "focus" | "always" | "hidden";
const BAY_MODES: { v: BayMode; label: string }[] = [
  { v: "focus", label: "聚焦出现" },
  { v: "always", label: "常驻" },
  { v: "hidden", label: "隐藏" },
];

function readBayMode(): BayMode {
  try {
    const v = localStorage.getItem("bay-mode");
    if (v === "always" || v === "hidden" || v === "focus") return v;
  } catch { /* noop */ }
  return "focus";
}

export function General() {
  const { lang, setLang, t } = useI18n();
  const { settings, setStartup } = useSettings();
  const autocontinue = settings.startup === "last";
  const [bayMode, setBayMode] = useState<BayMode>(readBayMode);
  const [compact, setCompact] = useState<boolean>(() => {
    try { return localStorage.getItem("cfg-compact") === "1"; } catch { return false; }
  });

  function chooseBay(m: BayMode) {
    setBayMode(m);
    try { localStorage.setItem("bay-mode", m); } catch { /* noop */ }
    try { window.dispatchEvent(new Event("dicelore:baymode")); } catch { /* noop */ }
  }
  function toggleCompact() {
    const next = !compact;
    setCompact(next);
    try { localStorage.setItem("cfg-compact", next ? "1" : "0"); } catch { /* noop */ }
  }

  return (
    <>
      <div className="mhead"><h3>{t("cfg.general")}</h3></div>
      <div className="mdesc">语言与通用偏好，均本地持久化（localStorage），改完即时保存。</div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.general.lang")}</span>
          <div className="fctrl">
            <div className="seg" data-testid="config-lang" role="group" aria-label={t("cfg.general.lang")}>
              <button className={lang === "zh" ? "on" : ""} onClick={() => setLang("zh")}>中文</button>
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
            </div>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">自动继续最近会话<div className="fhint">启动即回到上次</div></span>
          <div className="fctrl">
            <button
              className={"sw" + (autocontinue ? " on" : "")}
              data-testid="config-autocontinue"
              aria-label="自动继续最近会话"
              aria-pressed={autocontinue}
              onClick={() => setStartup(autocontinue ? "home" : "last")}
            />
          </div>
        </div>
        <div className="frow">
          <span className="flabel">bay 行为<div className="fhint">底部入口条 · 仿 mac 聚焦</div></span>
          <div className="fctrl">
            <div className="seg" data-testid="config-bay-mode" role="group" aria-label="bay 行为">
              {BAY_MODES.map(({ v, label }) => (
                <button key={v} className={bayMode === v ? "on" : ""} onClick={() => chooseBay(v)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">紧凑模式</span>
          <div className="fctrl">
            <button
              className={"sw" + (compact ? " on" : "")}
              data-testid="config-compact"
              aria-label="紧凑模式"
              aria-pressed={compact}
              onClick={toggleCompact}
            />
          </div>
        </div>
      </div>
    </>
  );
}
