// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import { useT } from "../i18n/index.js";
import { useHealth } from "../shell/useHealth.js";
import { listSessions } from "../api/client.js";

// 配置 → 数据与存储：展示后端真实会话目录 / FTS 模式 + 会话数统计。
export function DataStorage() {
  const t = useT();
  const { health, offline } = useHealth();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    listSessions().then((s) => { if (alive) setCount(s.length); }).catch(() => { if (alive) setCount(null); });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <div className="mhead"><h3>{t("cfg.data")}</h3></div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.data.dir")}</span>
          <div className="fctrl"><span className="fval">{offline ? "—" : health?.storage.sessionsDir ?? "…"}</span><span className="fhint">DICELORE_SESSIONS_DIR</span></div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.data.fts")}</span>
          <div className="fctrl"><span className="fval">{offline ? "—" : health?.storage.ftsMode ?? "…"}</span><span className="fhint">DICELORE_FTS_MODE</span></div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.data.count")}</span>
          <div className="fctrl"><span className="fval">{count ?? "—"}</span></div>
        </div>
      </div>
    </>
  );
}
