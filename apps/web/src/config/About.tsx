// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useT } from "../i18n/index.js";
import { useHealth } from "../shell/useHealth.js";

// 配置 → 关于：真实版本 / 协议契约版本 / 运行壳。
export function About() {
  const t = useT();
  const { health } = useHealth();
  return (
    <>
      <div className="mhead"><h3>{t("cfg.about")}</h3></div>
      <div className="section">
        <div className="frow"><span className="flabel">{t("cfg.about.product")}</span><div className="fctrl"><span className="fval">Dicelore · 玩家客户端</span></div></div>
        <div className="frow"><span className="flabel">{t("cfg.about.version")}</span><div className="fctrl"><span className="fval">v1 · {health?.fakeGm ? "FAKE_GM" : "live"}</span></div></div>
        <div className="frow"><span className="flabel">{t("cfg.about.proto")}</span><div className="fctrl"><span className="fval">{health?.protocol ?? "dicelore.client/1"} · dicelore.notify/1</span></div></div>
        <div className="frow"><span className="flabel">{t("cfg.about.shell")}</span><div className="fctrl"><span className="fval">Web</span></div></div>
      </div>
    </>
  );
}
