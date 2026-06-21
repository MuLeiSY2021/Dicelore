// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 配置 → 数据与存储（视觉页 §6）。展示态骨架（只读，真实数据接线属后续轮）。
export function DataStorage() {
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">数据与存储</h2>

      <div className="cfg-row">
        <span className="cfg-label">会话目录</span>
        <span className="cfg-static">每局一文件 · 待接线</span>
        <span className="cfg-static">DICELORE_SESSIONS_DIR</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">检索模式</span>
        <span className="cfg-static">全文检索后端 · 待接线</span>
        <span className="cfg-static">DICELORE_FTS_MODE</span>
      </div>
    </div>
  );
}
