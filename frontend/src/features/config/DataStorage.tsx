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

// 配置 → 数据与存储：展示后端真值（来自 health · 只读）。数据目录 = 每局一文件。
export function DataStorage() {
  const t = useT();
  const { health, offline } = useHealth();
  const sessionsDir = offline ? "—" : health?.storage.sessionsDir ?? "…";
  const dataDir = sessionsDir.replace(/\/sessions\/?$/, "") || sessionsDir;
  const fts = offline ? "—" : health?.storage.ftsMode ?? "…";
  return (
    <>
      <div className="mhead"><h3>{t("cfg.data")}</h3></div>
      <div className="mdesc">展示后端真值（来自 health · 只读）。数据目录 = <b style={{ color: "var(--text)" }}>每局一文件</b>。</div>
      <div className="section" data-testid="config-data-readonly">
        <div className="frow">
          <span className="flabel">DICELORE_DATA_DIR</span>
          <div className="fctrl"><input className="f mono ro" style={{ flex: 1 }} value={dataDir} readOnly /></div>
        </div>
        <div className="frow">
          <span className="flabel">sessionsDir</span>
          <div className="fctrl"><input className="f mono ro" style={{ flex: 1 }} value={sessionsDir} readOnly /></div>
        </div>
        <div className="frow">
          <span className="flabel">DICELORE_FTS_MODE</span>
          <div className="fctrl"><input className="f mono ro" value={fts} readOnly /></div>
        </div>
      </div>
    </>
  );
}
