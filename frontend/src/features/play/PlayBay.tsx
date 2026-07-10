// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 跑团页专属 bay 按钮 + popover（裁决 frontend-ia-rebuild §一）。
// 按钮 portal 进全局 app-bay（shell/Bay.tsx 的 [data-testid="app-bay"]），popover portal 进 body；
// 无 shell（隔离组件测试）时降级为就地渲染，testid 仍在。勿改 shell 导航本体。

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Layers, User, GitBranch, BookOpen, LayoutGrid, Settings, Archive, Coins, X, ChevronRight,
  RotateCcw, Wrench, Table, Palette, Swords,
} from "lucide-react";
import type { PresentationSnapshot, SessionSummary, SpoilerTier } from "@dicelore/shared";
import type { UsageReport } from "@/features/play/api.js";
import type { DockCardDef } from "@/features/play/DockCard.js";
import { fmtTokens } from "@/features/cost/pricing.js";

const CLOCK_RE = /^\s*(\d+)\s*\/\s*(\d+)\s*$/;

function usePortal(selector: string): Element | null {
  const [el, setEl] = useState<Element | null>(null);
  useEffect(() => { setEl(document.querySelector(selector)); }, [selector]);
  return el;
}

// 数据浏览可展开条目。
function DataEntry({ title, tag, children, open: initOpen = false }: { title: string; tag?: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initOpen);
  return (
    <div className={"d-entry" + (open ? " open" : "")} data-testid="play-data-entry">
      <div className="de-h" role="button" tabIndex={0} onClick={() => setOpen((v) => !v)}>
        <ChevronRight className="lucide" />{title}{tag && <span className="de-tag">{tag}</span>}
      </div>
      <div className="de-body">{children}</div>
    </div>
  );
}

function Popover({ id, testid, title, Icon, open, onClose, children }: {
  id: string; testid: string; title: string; Icon: React.ComponentType<{ className?: string }>;
  open: boolean; onClose: () => void; children: ReactNode;
}) {
  return (
    <div className="popover" id={`bay-${id}`} data-testid={testid} hidden={!open}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pop-card">
        <div className="pop-head"><Icon className="lucide" />{title}<span className="sp" />
          <span className="x" role="button" tabIndex={0} data-bay-close onClick={onClose}><X className="lucide" /></span>
        </div>
        <div className="pop-body">{children}</div>
      </div>
    </div>
  );
}

export interface PlayBayProps {
  snapshot: PresentationSnapshot | null;
  sessions: SessionSummary[];
  sid: string;
  onSelectSession: (id: string) => void;
  spoilerTier: SpoilerTier;
  onSpoilerTier: (t: SpoilerTier) => void;
  showActions: boolean;
  onToggleActions: () => void;
  compactCards: boolean;
  onToggleCompact: () => void;
  archivedCards: DockCardDef[];
  onRestore: (id: string) => void;
  usage: UsageReport | null;
}

const BTNS: { key: string; testid: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "session", testid: "play-bay-btn-session", label: "Session", Icon: Layers },
  { key: "chara", testid: "play-bay-btn-chara", label: "人物卡", Icon: User },
  { key: "plotline", testid: "play-bay-btn-plotline", label: "剧情线", Icon: GitBranch },
  { key: "world", testid: "play-bay-btn-world", label: "世界书", Icon: BookOpen },
  { key: "forms", testid: "play-bay-btn-forms", label: "其他", Icon: LayoutGrid },
  { key: "config", testid: "play-bay-btn-config", label: "配置", Icon: Settings },
  { key: "archive", testid: "play-bay-btn-archive", label: "归档", Icon: Archive },
  { key: "usage", testid: "play-bay-btn-usage", label: "用量", Icon: Coins },
];

export function PlayBay(props: PlayBayProps) {
  const { snapshot, sessions, sid, onSelectSession, spoilerTier, onSpoilerTier, showActions, onToggleActions, compactCards, onToggleCompact, archivedCards, onRestore, usage } = props;
  const [open, setOpen] = useState<string | null>(null);
  const bayEl = usePortal('[data-testid="app-bay"]');
  const close = () => setOpen(null);

  const sheets = snapshot?.sheets ?? [];
  const plotlines = snapshot?.plotlines ?? [];
  const foreshadows = snapshot?.foreshadows ?? [];
  const lore = snapshot?.lore ?? [];
  const showHidden = spoilerTier === "off";

  const buttons = (
    <>
      <span className="bay-sep" />
      {BTNS.map((b) => (
        <span key={b.key} className={"bay-btn" + (open === b.key ? " on" : "")} role="button" tabIndex={0}
          data-bay={b.key} data-testid={b.testid} onClick={() => setOpen((o) => (o === b.key ? null : b.key))}>
          <b.Icon className="lucide" />{b.label}
        </span>
      ))}
    </>
  );

  const popovers = (
    <>
      <Popover id="session" testid="play-bay-popover-session" title="Session 切换" Icon={Layers} open={open === "session"} onClose={close}>
        {sessions.length === 0 && <div className="sess-row"><div className="st"><Swords className="lucide" />（无会话）</div></div>}
        {sessions.map((s) => (
          <div key={s.sessionId} className={"sess-row" + (s.sessionId === sid ? " on" : "")} role="button" tabIndex={0}
            data-testid="play-session-item" onClick={() => { onSelectSession(s.sessionId); close(); }}>
            <div className="st"><Swords className="lucide" />{s.packName && s.packName !== s.title ? `${s.packName} · ` : ""}{s.title}</div>
            <div className="sm" data-testid="play-session-date">{s.lastActionAt ? new Date(s.lastActionAt).toLocaleString() : ""}{s.status === "archived" ? " · 已归档" : ""}</div>
            {s.lastReply && <div className="sr" data-testid="play-session-lastreply">{s.lastReply}</div>}
          </div>
        ))}
      </Popover>

      <Popover id="chara" testid="play-bay-popover-chara" title="人物卡 · 数据浏览" Icon={User} open={open === "chara"} onClose={close}>
        {sheets.map((g, i) => (
          <DataEntry key={g.entity} title={g.entity} open={i === 0}>
            {g.cells.filter((c) => showHidden || c.visible === 1).map((c) => (
              <div className="de-cell" key={c.attr}><span>{c.attr}</span><b>{c.value}</b></div>
            ))}
          </DataEntry>
        ))}
        <div className="de-note">数据来自 sheet 域（entity→cell）。{showHidden ? "关闭档：含暗值。" : "强制隐藏值（暗值）不显示。"}</div>
      </Popover>

      <Popover id="plotline" testid="play-bay-popover-plotline" title="剧情线 · 数据浏览" Icon={GitBranch} open={open === "plotline"} onClose={close}>
        {plotlines.map((p, i) => (
          <DataEntry key={p.id} title={p.title} tag={p.status} open={i === 0}>
            {p.summary && <div className="de-cell"><span>摘要</span><b>{p.summary}</b></div>}
            {foreshadows.map((f) => <div className="de-cell" key={f.id}><span>伏笔</span><b>{f.content} · {f.status}</b></div>)}
          </DataEntry>
        ))}
        <div className="de-note">plotline/foreshadow 属 narrative 域（a-prime §7 投影）。</div>
      </Popover>

      <Popover id="world" testid="play-bay-popover-world" title="世界书 · 数据浏览" Icon={BookOpen} open={open === "world"} onClose={close}>
        {lore.map((l, i) => (
          <DataEntry key={l.name} title={l.name} tag={l.category ?? undefined} open={i === 0}>
            <div style={{ fontSize: "11.5px", color: "var(--text2)", lineHeight: 1.6 }}>{l.content}</div>
          </DataEntry>
        ))}
        <div className="de-note">world 域 lore/pool。</div>
      </Popover>

      <Popover id="forms" testid="play-bay-popover-forms" title="其他表单 · 数据浏览" Icon={LayoutGrid} open={open === "forms"} onClose={close}>
        {sheets.flatMap((g) => g.cells.filter((c) => CLOCK_RE.test(c.value)).map((c) => (
          <DataEntry key={`${g.entity}.${c.attr}`} title={c.attr} tag="Clock" open>
            <div className="de-cell"><span>进度</span><b>{c.value}</b></div>
          </DataEntry>
        )))}
        <div className="de-note">Front/Clock/Anchor 属 narrative 域。新建 DIY 卡：dock 卡上点「编辑」自定义模板。</div>
      </Popover>

      <Popover id="config" testid="play-bay-popover-config" title="跑团配置" Icon={Settings} open={open === "config"} onClose={close}>
        <div className="cfg-row" data-testid="play-spoiler-seg">防剧透<span className="sp" />
          <span className="seg" style={{ display: "flex", border: "1px solid var(--line2)", borderRadius: 7, overflow: "hidden" }}>
            {([["strict", "严格"], ["loose", "宽松"], ["off", "关闭"]] as [SpoilerTier, string][]).map(([t, label]) => (
              <span key={t} role="button" tabIndex={0} data-testid={`play-spoiler-${t}`}
                className={spoilerTier === t ? "on" : ""}
                style={{ padding: "5px 11px", fontSize: "11.5px", background: spoilerTier === t ? "var(--surface2)" : undefined, color: spoilerTier === t ? "var(--text)" : "var(--text2)", cursor: "pointer" }}
                onClick={() => onSpoilerTier(t)}>{label}</span>
            ))}
          </span>
        </div>
        <div className="cfg-note">强制隐藏值（团本作者标的暗值）随防剧透档呈现；spoiler 档是前端渲染层，与 visible 数据层正交。</div>
        <div className="cfg-row" data-testid="play-observe-toggle" role="button" tabIndex={0} onClick={onToggleActions}>透视 GM 动作<span className="sp" /><span className={"sw2" + (showActions ? " on" : "")} /></div>
        <div className="cfg-row" role="button" tabIndex={0} onClick={onToggleCompact}>紧凑卡片<span className="sp" /><span className={"sw2" + (compactCards ? " on" : "")} /></div>
        <div className="cfg-row" style={{ border: "none" }}>主题 / 字体<span className="sp" /><a className="btn" href="/config"><Palette className="lucide" />外观设置</a></div>
      </Popover>

      <Popover id="archive" testid="play-bay-popover-archive" title="归档 · 可找回" Icon={Archive} open={open === "archive"} onClose={close}>
        {archivedCards.length === 0
          ? <div className="arch-empty" data-testid="play-archive-empty">还没有归档的卡。点卡上的归档按钮，卡会移到这里，随时恢复。</div>
          : archivedCards.map((c) => (
            <div className="arch-item" key={c.id}><span className="an">{c.title}</span>
              <span className="ar" role="button" tabIndex={0} data-testid="play-archive-restore" onClick={() => onRestore(c.id)}><RotateCcw className="lucide" />恢复</span>
            </div>
          ))}
      </Popover>

      <Popover id="usage" testid="play-bay-popover-usage" title="用量详情" Icon={Coins} open={open === "usage"} onClose={close}>
        <div className="usage-detail">
          <div className="ud-sec"><div className="ud-h">当前会话 · {usage?.model || "—"}</div>
            <div className="ud-row"><span>累计 token</span><span className="ud-v" data-testid="play-usage-session"><b>{fmtTokens(usage?.sessionTotal ?? 0)}</b></span></div>
            <div className="ud-row"><span>上下文占用</span><span className="ud-v">
              <span className="ud-dial" data-testid="play-context-dial" title={`${usage?.contextTokens ?? 0}/${usage?.contextWindow ?? 0}`}>
                <svg viewBox="0 0 36 36" className="dial-svg"><circle className="dial-bg" cx="18" cy="18" r="15.9" /><circle className="dial-fg" cx="18" cy="18" r="15.9" style={{ strokeDasharray: `${Math.round((usage?.contextPct ?? 0) * 100)} 100` }} /></svg>
                <span className="dial-pct">{Math.round((usage?.contextPct ?? 0) * 100)}%</span>
              </span>
              <span className="dim">({fmtTokens(usage?.contextTokens ?? 0)}/{fmtTokens(usage?.contextWindow ?? 0)})</span>
            </span></div>
          </div>
          {usage?.mcpBreakdown && usage.mcpBreakdown.length > 0 && (
            <div className="ud-sec" data-testid="play-usage-mcp"><div className="ud-h">按 MCP 工具消耗 · 估算</div>
              {usage.mcpBreakdown.map((m) => <div className="ud-row" key={m.tool}><span><Wrench className="lucide" /> {m.tool}</span><span className="ud-v">{m.calls} 次 · {fmtTokens(m.tokens)}</span></div>)}
            </div>
          )}
          {usage?.memoryBreakdown && usage.memoryBreakdown.length > 0 && (
            <div className="ud-sec" data-testid="play-usage-memory"><div className="ud-h">记忆占用</div>
              {usage.memoryBreakdown.map((m) => <div className="ud-row" key={m.segment}><span><Table className="lucide" /> {m.segment}</span><span className="ud-v">{fmtTokens(m.tokens)}</span></div>)}
            </div>
          )}
          {usage && usage.perTurn.length > 0 && (
            <div className="ud-sec"><div className="ud-h">各轮 · per-turn</div>
              {usage.perTurn.slice().reverse().slice(0, 8).map((tt, i) => (
                <div className="ud-row" key={tt.turnId}><span className="dim">轮 {usage.perTurn.length - i}</span><span className="ud-v">↑{fmtTokens(tt.inputTokens)} ↓{fmtTokens(tt.outputTokens)}</span></div>
              ))}
            </div>
          )}
        </div>
      </Popover>
    </>
  );

  return (
    <>
      {bayEl ? createPortal(buttons, bayEl) : buttons}
      {typeof document !== "undefined" ? createPortal(popovers, document.body) : popovers}
    </>
  );
}
