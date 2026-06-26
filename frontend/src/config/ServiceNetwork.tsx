// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState } from "react";
import { Check } from "lucide-react";
import { useT } from "../i18n/index.js";
import { useSettings } from "../settings/useSettings.js";
import { useHealth } from "../shell/useHealth.js";

// 配置 → 服务与网络：展示后端真实端口/notify 状态(diagnostics) + notify URL 覆盖(持久化)。
export function ServiceNetwork() {
  const t = useT();
  const { health, offline } = useHealth();
  const { settings, setNotifyUrl } = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? settings.notifyUrl ?? "";
  const notifyConfigured = health?.notify.configured ?? !!settings.notifyUrl;

  return (
    <>
      <div className="mhead"><h3>{t("cfg.service")}</h3></div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.service.port")}</span>
          <div className="fctrl"><span className="fval">{offline ? "—" : health?.port ?? "…"}</span></div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.service.host")}</span>
          <div className="fctrl"><span className="fval">127.0.0.1 (loopback)</span></div>
        </div>
        <div className="frow top">
          <span className="flabel">{t("cfg.service.notify")}</span>
          <div className="fctrl">
            <input className="f mono" aria-label="DICELORE_NOTIFY_URL"
              placeholder={health?.notify.url ?? "http://127.0.0.1:8787/internal/notify"}
              value={value} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn go" onClick={() => { setNotifyUrl(value); setDraft(null); }}>{t("cfg.save")}</button>
            <span className={"tres " + (notifyConfigured ? "ok" : "err")}>
              {notifyConfigured && <Check className="lucide" />}{t("cfg.service.notify.status")}: {notifyConfigured ? t("bar.notify.connected") : t("bar.notify.unset")}
            </span>
            <span className="fhint">DICELORE_NOTIFY_URL</span>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.service.proto")}</span>
          <div className="fctrl"><span className="fval">{health?.protocol ?? "dicelore.client/1"}</span></div>
        </div>
      </div>
    </>
  );
}
