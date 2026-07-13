// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useT } from "@/shared/i18n/index.js";
import { useHealth } from "@/shell/useHealth.js";

// 配置 → 服务与网络：主页端口 / 域名绑定 / 缝A notify webhook。
// 三者皆后端真值（来自 health · 只读），不可在此改。
export function ServiceNetwork() {
  const t = useT();
  const { health, offline } = useHealth();
  const port = offline ? "—" : String(health?.port ?? "…");
  const notify = health?.notify.url ?? "（未配 · v1 走进程内回调）";

  return (
    <>
      <div className="mhead"><h3>{t("cfg.service")}</h3></div>
      <div className="mdesc">
        主页服务端口 / 域名 / 缝A 跨进程 notify webhook。<b style={{ color: "var(--text)" }}>真值来自 health·只读</b>，不可在此改。
      </div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.service.port")}<div className="fhint">来自 health</div></span>
          <div className="fctrl"><input className="f mono ro" data-testid="config-net-port" value={port} readOnly /></div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.service.host")}<div className="fhint">来自 health</div></span>
          <div className="fctrl"><input className="f mono ro" data-testid="config-net-host" value="127.0.0.1" readOnly /></div>
        </div>
        <div className="frow">
          <span className="flabel">notify webhook<div className="fhint">DICELORE_NOTIFY_URL</div></span>
          <div className="fctrl"><input className="f mono ro" style={{ flex: 1 }} data-testid="config-net-notify" value={notify} readOnly /></div>
        </div>
      </div>
    </>
  );
}
