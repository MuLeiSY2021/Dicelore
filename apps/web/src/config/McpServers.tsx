// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 配置 → MCP 服务器（视觉页 §6）。展示态骨架（只读，真实数据接线属后续轮）。
export function McpServers() {
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">MCP 服务器</h2>

      <div className="cfg-row">
        <span className="cfg-label">核心</span>
        <span className="cfg-static">规范态来源</span>
      </div>
      <div className="cfg-row">
        <span className="cfg-label">dicelore</span>
        <span className="cfg-static">stdio · 运行时 · 工具数 — · notify 就绪 · 标「必需」锁定</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">自定义</span>
        <span className="cfg-static">用户登记 MCP · out-of-canon · 远程／本地</span>
      </div>
      <div className="cfg-row">
        <span className="cfg-label">条目</span>
        <span className="cfg-static">
          每条带开关 + 权限闸 + out-of-canon 徽 + 联网警示：远程 MCP 可能将上下文发往第三方
        </span>
      </div>
      <div className="cfg-row">
        <span className="cfg-label">操作</span>
        <span className="cfg-static">添加 MCP · 待接线</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-static">
          说明：out-of-canon 不参与 L3 审计、不发呈现 notify、副作用不进快照。
        </span>
      </div>
    </div>
  );
}
