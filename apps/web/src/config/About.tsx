// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 配置 → 关于（视觉页 §6）。展示态骨架（只读）。
export function About() {
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">关于</h2>

      <div className="cfg-row">
        <span className="cfg-label">产品</span>
        <span className="cfg-static">Dicelore · 玩家客户端</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">版本</span>
        <span className="cfg-static">v1 · 开发态</span>
      </div>
    </div>
  );
}
