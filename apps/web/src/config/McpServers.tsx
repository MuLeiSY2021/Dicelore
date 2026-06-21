// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState } from "react";
import { Dices, Globe, Image, Lock, ShieldCheck, Plus, Info } from "lucide-react";

// 配置 → MCP 服务器（展示态 · config.html）：dicelore 规范态来源 + 自定义 out-of-canon + 权限闸 + notify 状态。
export function McpServers() {
  const [web, setWeb] = useState(true);
  const [img, setImg] = useState(false);
  return (
    <>
      <div className="mhead">
        <h3>MCP 服务器</h3>
        <span className="sp" />
        <button className="add"><Plus className="lucide" />添加 MCP</button>
      </div>
      <div className="mdesc">
        GM 可调用的工具来源。<b style={{ color: "var(--text)" }}>规范态(人物卡 / 事件 / 世界 / 裁决)只走 dicelore 自己</b>；自定义 MCP 仅提供周边能力(检索 / 配图 / 氛围)，产出作叙述流回，归 out-of-canon。
      </div>

      <div className="sec-l">核心 · 规范态来源</div>
      <div className="srv">
        <span className="ico"><Dices className="lucide" /></span>
        <div className="mid">
          <div className="nm">dicelore<span className="dot" /><span className="badge core">规范态来源</span></div>
          <div className="meta"><span>stdio · 运行时</span><span>20 工具</span><span>notify webhook 已连 · 127.0.0.1/internal/notify</span></div>
        </div>
        <div className="right"><span className="lock"><Lock className="lucide" />必需</span></div>
      </div>

      <div className="sec-l">自定义 · out-of-canon</div>
      <div className="srv">
        <span className="ico"><Globe className="lucide" /></span>
        <div className="mid">
          <div className="nm">联网检索<span className="dot" /><span className="badge ooc">out-of-canon</span></div>
          <div className="meta"><span>远程 SSE</span><span>3 工具</span><span className="w">⚠ 联网 · 数据外流</span></div>
        </div>
        <div className="right">
          <span className="perm"><ShieldCheck className="lucide" />已授权</span>
          <button className={"sw" + (web ? " on" : "")} aria-label="联网检索开关" onClick={() => setWeb((v) => !v)} />
        </div>
      </div>
      <div className="srv">
        <span className="ico"><Image className="lucide" /></span>
        <div className="mid">
          <div className="nm">配图生成<span className={"dot" + (img ? "" : " off")} /><span className="badge ooc">out-of-canon</span></div>
          <div className="meta"><span>本地 stdio</span><span>1 工具</span><span>{img ? "已启用" : "未启用"}</span></div>
        </div>
        <div className="right">
          <button className={"sw" + (img ? " on" : "")} aria-label="配图生成开关" onClick={() => setImg((v) => !v)} />
        </div>
      </div>

      <div className="note">
        <Info className="lucide" />
        <span>out-of-canon 工具调用仍落 event 留痕，但<b style={{ color: "var(--text)" }}>不参与 L3 审计比对、不发呈现 notify</b>；外部副作用不进快照、rewind 撤不回。远程 server 首次调用需显式授权。</span>
      </div>
    </>
  );
}
