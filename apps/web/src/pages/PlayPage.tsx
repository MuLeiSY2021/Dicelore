// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState, type KeyboardEvent } from "react";
import {
  BookOpen, Scale, ScrollText, MessagesSquare, LayoutGrid, Search, FileText, File,
  Pin, CornerDownRight, CheckCircle2, Dices, LayoutDashboard, Grid3x3, Plus, User, Minus, X,
} from "lucide-react";
import { useSession } from "../live/useSession.js";

// v1：会话选择(主页继续上次)未实现，跑团页先固定 demo 会话。
const DEMO_SESSION = "demo";

const RAIL = [
  { Icon: BookOpen, title: "设定", on: true },
  { Icon: Scale, title: "规则", on: false },
  { Icon: ScrollText, title: "日志", on: false },
  { Icon: MessagesSquare, title: "会话", on: false },
];

export default function PlayPage() {
  const { snapshot, narration, pendingRoll, postMessage, roll } = useSession(DEMO_SESSION);
  const [draft, setDraft] = useState("");
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && draft.trim()) { postMessage(draft.trim()).catch(() => {}); setDraft(""); }
  };

  const sheets = snapshot?.sheets ?? [];
  const mechanics = snapshot?.mechanics ?? [];
  const choices = snapshot?.choices ?? null;

  return (
    <div className="play">
      <aside className="rail" aria-label="活动轨">
        {RAIL.map(({ Icon, title, on }) => (
          <button key={title} className={"ic" + (on ? " on" : "")} title={title}><Icon className="lucide" /></button>
        ))}
        <span className="sp" />
        <button className="ic" title="拖出生成面板"><LayoutGrid className="lucide" /></button>
      </aside>

      <aside className="browse" aria-label="自查源">
        <div className="bh"><BookOpen className="lucide" />设定</div>
        <div className="bsearch"><Search className="lucide" />搜设定 / 卡池</div>
        <div className="tree">
          <div className="cat"><FileText className="lucide" />设定文档</div>
          <div className="leaf"><span className="lic"><File className="lucide" /></span><span className="nm">（待接入世界浏览）</span><span className="pin"><Pin className="lucide" /></span></div>
        </div>
      </aside>

      <section className="center" aria-label="叙事">
        <div className="narr">
          {narration.length === 0 && mechanics.length === 0 ? (
            <p className="empty">等待 GM 开场……</p>
          ) : (
            <>
              {narration.map((para, i) => <p key={i}>{para}</p>)}
              {mechanics.map((m) => (
                <div className="mech" key={m.seq}><CheckCircle2 className="lucide" />{m.text}</div>
              ))}
            </>
          )}

          {pendingRoll?.bands && pendingRoll.bands.length > 0 && (
            <div className="ranges">
              <div className="rt"><Dices className="lucide" />掷一颗骰，结果如下</div>
              {pendingRoll.bands.map((b) => (
                <div className="rr" key={b.label}><span className="rg">{b.min}–{b.max}</span><span className="rd">{b.label}</span></div>
              ))}
            </div>
          )}
          {pendingRoll && (!pendingRoll.bands || pendingRoll.bands.length === 0) && (
            <div className="mech"><Dices className="lucide" />{pendingRoll.label}：{pendingRoll.yourSide.exprDisplay}{pendingRoll.dc != null ? ` vs DC ${pendingRoll.dc}` : ""}</div>
          )}

          {choices && (
            <div className="ranges">
              {choices.options.map((o) => (
                <button className="choice" key={o.index}><span className="cl">{o.label}</span><span className="cc">{o.consequence}</span></button>
              ))}
            </div>
          )}
        </div>

        <div className="split" />
        <div className="input">
          {pendingRoll ? (
            <>
              <button className="roll" onClick={() => roll(pendingRoll.eventId).catch(() => {})}>
                <Dices className="lucide" />丢骰子<span className="d">d{pendingRoll.shape === "outcome" ? "100" : "20"}</span>
              </button>
              <span className="h">这一掷决定上面的结果</span>
            </>
          ) : (
            <input className="field" aria-label="输入" value={draft} placeholder="你做什么？（回车发送）"
              onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
          )}
        </div>
      </section>

      <aside className="stage" aria-label="呈现台">
        <div className="sh"><LayoutDashboard className="lucide" />呈现台<span className="mode"><Grid3x3 className="lucide" />网格</span><span className="add"><Plus className="lucide" /></span></div>
        <div className="grid">
          {sheets.length === 0 ? (
            <div className="pan wide"><div className="pc"><span className="empty">暂无呈现数据（首屏快照加载中，或本局尚无可见状态）</span></div></div>
          ) : (
            sheets.map((g) => (
              <div className="pan wide" key={g.entity}>
                <div className="ph"><span className="pic"><User className="lucide" /></span>{g.entity}<span className="ctl"><Minus className="lucide" /><X className="lucide" /></span></div>
                <div className="pc">
                  {g.cells.map((c) => (
                    <div className="row" key={c.attr}><span>{c.attr}</span><b>{c.value}</b></div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
