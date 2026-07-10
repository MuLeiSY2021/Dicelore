// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState, Fragment, type ComponentType, type KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BookOpen, Wrench, LayoutGrid, Search, File, Pin, CheckCircle2, Dices, LayoutDashboard,
  Grid3x3, User, Minus, X, Timer, Timer as ClockIcon, Package, Eye, Sparkles, Loader2, AlertTriangle, Flag,
  BookMarked, ChevronDown, ChevronUp, ScrollText, Play, Trash2,
  Scale, ArrowRightLeft, BellRing, GripVertical, RotateCcw, History,
} from "lucide-react";
import { useSession } from "@/features/play/useSession.js";
import { Markdown } from "@/features/play/Markdown.js";
import { useT } from "@/shared/i18n/index.js";
import { browse, listSessions, deleteSession, type BrowseEntry } from "@/features/play/api.js";
import { Link } from "react-router-dom";
import type { SessionSummary } from "@dicelore/shared";

const DEMO_SESSION = "demo";
// 机械回显按 agent 不同 MCP 调用的 kind 分风格(参考视觉草图「内嵌机械回显·左金边」):
// verdict(裁决·resolve_*) / mutation(状态变更·sheet/state 写) / watcher_fired(凶兆触发)。
const MECH_ICON: Record<string, ComponentType<{ className?: string }>> = {
  verdict: Scale, mutation: ArrowRightLeft, watcher_fired: BellRing,
};
// 左活动轨不再是固定的「设定/规则/日志」物理表分类——团本业务表段已客制化。
// 改为：① 设定(可见 lore，按条目自带 category/tag 动态分组，天然兼容任意客制段) ② 工具(玩家自查工具)。
type RailKey = "world" | "tools";
const RAIL: { key: RailKey; Icon: ComponentType<{ className?: string }> }[] = [
  { key: "world", Icon: BookOpen }, { key: "tools", Icon: Wrench },
];

const CLOCK_RE = /^\s*(\d+)\s*\/\s*(\d+)\s*$/;
const INV_PREFIX = "库存:";

function ClockDial({ cur, max }: { cur: number; max: number }) {
  const frac = max > 0 ? Math.min(1, cur / max) : 0;
  const deg = Math.round(frac * 360);
  const seg = 360 / Math.max(max, 1);
  const style = { background: `repeating-conic-gradient(from -90deg, transparent 0 ${seg - 4}deg, var(--surface2) ${seg - 4}deg ${seg}deg), conic-gradient(from -90deg, var(--acc) 0 ${deg}deg, var(--dial-empty) ${deg}deg)` };
  return <div className="dial" style={style} aria-label={`${cur}/${max}`} />;
}

function dateBucket(iso?: string | number): "today" | "week" | "earlier" {
  if (iso == null) return "earlier";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 864e5) return "today";
  if (diff < 7 * 864e5) return "week";
  return "earlier";
}

export default function PlayPage() {
  const t = useT();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const sid = sessionId ?? DEMO_SESSION;
  const { snapshot, narration, pendingRoll, generating, error, errorCode, gameEnd, reveals, postMessage, start, roll, choose, rewind, retry, skip, dismissReveal } = useSession(sid);
  const [draft, setDraft] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);

  // 左活动轨 / 浏览
  const [source, setSource] = useState<RailKey>("world");
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [logEntries, setLogEntries] = useState<BrowseEntry[]>([]);
  const [pins, setPins] = useState<BrowseEntry[]>([]);
  // 会话栏(次级 bar，可隐藏)
  const [barOpen, setBarOpen] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [kicked, setKicked] = useState(false); // 本地乐观：已点「开始游戏」
  // 面板隐藏 / 最小化 / 拖拽重排(可选+可拖拽;默认风格=自然顺序,可一键复位)
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [mini, setMini] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderKey = `dicelore.stage.order.${sid}`;
  useEffect(() => {
    try { const raw = localStorage.getItem(orderKey); setOrder(raw ? JSON.parse(raw) : []); }
    catch { setOrder([]); }
  }, [orderKey]);
  const persistOrder = (next: string[]) => {
    setOrder(next);
    try { localStorage.setItem(orderKey, JSON.stringify(next)); } catch { /* 隐私模式忽略 */ }
  };
  // 把拖起的 id 落到目标 id 之前(同一序列内移动)。
  const reorder = (targetId: string, ids: string[]) => {
    if (!dragId || dragId === targetId) return;
    const base = order.length ? order.filter((id) => ids.includes(id)) : ids.slice();
    for (const id of ids) if (!base.includes(id)) base.push(id);
    const from = base.indexOf(dragId);
    if (from < 0) return;
    base.splice(from, 1);
    const to = base.indexOf(targetId);
    base.splice(to < 0 ? base.length : to, 0, dragId);
    persistOrder(base);
  };
  const resetOrder = () => persistOrder([]);

  useEffect(() => { setChosen(null); }, [snapshot?.choices?.eventId]);
  const reloadSessions = () => listSessions().then((s) => { setSessions(s); setSessionsLoaded(true); }).catch(() => setSessionsLoaded(true));
  // 切会话：重置呈现台 UI 内存态（hidden/mini/pins/检索框/chosen），防旧会话残留漂到新会话。
  // order 走 localStorage 按 sid key 自行 reload（见 orderKey effect），不在此重置。与 FE-ws-race 同源。
  useEffect(() => {
    setKicked(false);
    setHidden(new Set());
    setMini(new Set());
    setPins([]);
    setEntries([]);
    setLogEntries([]);
    setQ("");
    setChosen(null);
    reloadSessions();
  }, [sid]);

  // 设定源：q 防抖检索可见 lore。
  useEffect(() => {
    if (source !== "world") return;
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => { browse(sid, "world", q).then(setEntries).catch(() => setEntries([])); }, 180);
    return () => { if (qTimer.current) clearTimeout(qTimer.current); };
  }, [sid, source, q]);
  // 工具源：加载本局日志。
  useEffect(() => { if (source === "tools") browse(sid, "log").then(setLogEntries).catch(() => setLogEntries([])); }, [sid, source]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && draft.trim()) { postMessage(draft.trim()).catch(() => {}); setDraft(""); }
  };
  const togglePin = (e: BrowseEntry) => setPins((p) => (p.some((x) => x.ref === e.ref) ? p.filter((x) => x.ref !== e.ref) : [...p, e]));
  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  const toggleMin = (id: string) => setMini((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sheets = snapshot?.sheets ?? [];
  const mechanics = snapshot?.mechanics ?? [];
  const choices = snapshot?.choices ?? null;

  // 两层 Play：未开场(开场层) → 大金按钮；已开场(续玩层) → 输入框。
  const sessionRow = sessions.find((s) => s.sessionId === sid);
  const started = kicked || narration.length > 0 || (snapshot?.narrativeCursor ?? 0) > 0 || sessionRow?.started === true || !!gameEnd;
  // 无显式会话、一局都没有、且当前也没有任何活数据 → 引导去团本目录。
  const noSessions = !sessionId && sessionsLoaded && sessions.length === 0 && sheets.length === 0 && narration.length === 0;

  async function kickoff() {
    setKicked(true);
    try { await start(); } catch { setKicked(false); }
  }
  async function removeSession(id: string) {
    await deleteSession(id);
    try { localStorage.removeItem(`dicelore.stage.order.${id}`); } catch { /* 隐私模式忽略 */ } // 删会话清其拖拽布局，防 localStorage 泄漏
    const rest = sessions.filter((s) => s.sessionId !== id);
    setSessions(rest);
    if (id === sid) navigate(rest[0] ? `/play/${encodeURIComponent(rest[0].sessionId)}` : "/adventures");
  }

  // 设定按 tag 动态分组(兼容任意客制段)。
  const grouped = new Map<string, BrowseEntry[]>();
  for (const e of entries) { const k = e.tag ?? "未分类"; (grouped.get(k) ?? grouped.set(k, []).get(k)!).push(e); }

  // 会话按日期分组。
  const buckets: { key: "today" | "week" | "earlier"; label: string }[] = [
    { key: "today", label: t("play.date.today") }, { key: "week", label: t("play.date.week") }, { key: "earlier", label: t("play.date.earlier") },
  ];
  const curRow = sessions.find((s) => s.sessionId === sid);
  const sessTitle = (s: SessionSummary) => (s.packName && s.packName !== s.title ? `${s.packName} · ` : "") + s.title;
  const curTitle = curRow ? sessTitle(curRow) : sid;

  // 呈现台分类
  const attrPanels = sheets.map((g) => ({
    entity: g.entity,
    clocks: g.cells.filter((c) => CLOCK_RE.test(c.value)),
    inv: g.cells.filter((c) => c.attr.startsWith(INV_PREFIX)),
    attrs: g.cells.filter((c) => !CLOCK_RE.test(c.value) && !c.attr.startsWith(INV_PREFIX)),
  }));

  // 把呈现台所有面板收成一个带稳定 id 的扁平表(自然顺序),供拖拽重排排序。
  const stageCells: { id: string; el: JSX.Element }[] = [];
  // 统一接线:最小化 / 隐藏 / 拖拽重排。
  const panel = (
    id: string, title: string, Icon: ComponentType<{ className?: string }>,
    body: React.ReactNode, opts?: { wide?: boolean; gmTag?: string; onHide?: () => void },
  ): JSX.Element => (
    <Panel id={id} title={title} Icon={Icon} wide={opts?.wide} gmTag={opts?.gmTag}
      mini={mini.has(id)} onMin={() => toggleMin(id)} onHide={() => { opts?.onHide?.(); hide(id); }}
      dragging={dragId === id}
      onDragStart={() => setDragId(id)} onDragEnd={() => setDragId(null)}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); reorder(id, stageCells.map((c) => c.id)); setDragId(null); }}>
      {body}
    </Panel>
  );
  const push = (id: string, render: () => JSX.Element) => { if (!hidden.has(id)) stageCells.push({ id, el: render() }); };
  for (const { entity, attrs, clocks, inv } of attrPanels) {
    if (attrs.length > 0) push(`attr:${entity}`, () => panel(`attr:${entity}`, entity, User,
      attrs.map((c) => <div className="row" key={c.attr}><span>{c.attr}</span><b>{c.value}</b></div>)));
    clocks.forEach((c) => { const m = CLOCK_RE.exec(c.value)!; push(`clock:${entity}:${c.attr}`, () => panel(
      // 领域概念=Clock(倒计时钟)；复用 lucide Timer 图标渲染(无专用 Clock 字形时)，故本地别名 ClockIcon 标明用途。
      `clock:${entity}:${c.attr}`, t("play.panel.clock"), ClockIcon,
      <div className="clockrow"><ClockDial cur={Number(m[1])} max={Number(m[2])} /><div className="ck"><div className="nm">{c.attr}</div><div className="v">{c.value}</div></div></div>)); });
    if (inv.length > 0) push(`inv:${entity}`, () => panel(`inv:${entity}`, `${t("play.panel.inv")} · ${inv.length}`, Package,
      inv.map((c) => <div className="row" key={c.attr}><span>{c.attr.slice(INV_PREFIX.length)}</span><b>{c.value}</b></div>)));
  }
  for (const r of reveals) push(`rev:${r.seq}`, () => panel(`rev:${r.seq}`, t("play.panel.reveal"), Eye,
    <div className="revc"><b>{r.target.replace(/^world:/, "")}</b>　{r.text}</div>,
    { wide: true, gmTag: `GM·${r.seq}`, onHide: () => dismissReveal(r.seq) }));
  for (const p of pins) push(`pin:${p.ref}`, () => panel(`pin:${p.ref}`, p.name, Pin,
    <div className="revc">{p.snippet}</div>, { wide: true }));
  // 按用户 order 稳定排序(未列入 order 的保持自然顺序追加在后)。
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  const orderedCells = stageCells.map((c, i) => ({ ...c, i })).sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i);

  // 一局都没有(裸 /play) → 引导去团本目录。
  if (noSessions) return (
    <div className="playwrap">
      <div className="play-empty">
        <BookMarked className="lucide" />
        <div className="et">{t("play.session.empty.title")}</div>
        <div className="es">{t("play.session.empty.sub")}</div>
        <Link className="btn go" to="/adventures"><BookMarked className="lucide" />{t("play.session.empty.cta")}</Link>
      </div>
    </div>
  );

  return (
    <div className="playwrap">
      {/* 次级会话栏(可隐藏，仿团本制作 ctx 栏) */}
      {barOpen ? (
        <div className="playbar">
          <BookMarked className="lucide" />
          <span className="name">{curTitle}</span>
          <label className="sessel"><ScrollText className="lucide" />
            <select aria-label={t("play.bar.session")} value={sid} onChange={(e) => navigate(`/play/${e.target.value}`)}>
              {sessions.length === 0 && <option value={sid}>{t("play.bar.nosession")}</option>}
              {buckets.map((b) => {
                const items = sessions.filter((s) => dateBucket(s.lastActionAt) === b.key);
                return items.length === 0 ? null : (
                  <optgroup key={b.key} label={b.label}>
                    {items.map((s) => <option key={s.sessionId} value={s.sessionId}>{sessTitle(s)} · {t(`status.${s.status}`)}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <span className="sp" />
          {/* 读档（SNAP-1 v1）：自动恢复最近存档。已开场（已有快照）才显示——v1 是存档/读档，非手动回滚按钮。 */}
          {started && (
            <button className="collapse" data-testid="rewind" aria-label={t("play.rewind")} title={t("play.rewind.hint")}
              onClick={() => { if (confirm(t("play.rewind.confirm"))) rewind().catch(() => {}); }}><History className="lucide" /></button>
          )}
          {curRow && (
            <button className="collapse" aria-label={t("play.session.delete")} title={t("play.session.delete")}
              onClick={() => { if (confirm(`${t("play.session.delete")}：${curTitle}?`)) removeSession(sid); }}><Trash2 className="lucide" /></button>
          )}
          <button className="collapse" aria-label={t("play.bar.hide")} title={t("play.bar.hide")} onClick={() => setBarOpen(false)}><ChevronUp className="lucide" /></button>
        </div>
      ) : (
        <button className="playbar mini" aria-label={t("play.bar.show")} onClick={() => setBarOpen(true)}>
          <ChevronDown className="lucide" /><span className="name">{curTitle}</span>
        </button>
      )}

      <div className="play">
        <aside className="rail" aria-label="活动轨">
          {RAIL.map(({ key, Icon }) => (
            <button key={key} className={"ic" + (source === key ? " on" : "")} title={t(`play.rail.${key}`)} aria-label={t(`play.rail.${key}`)}
              aria-pressed={source === key} onClick={() => setSource(key)}><Icon className="lucide" /></button>
          ))}
          <span className="sp" />
          <button className="ic" title={t("play.rail.add")}><LayoutGrid className="lucide" /></button>
        </aside>

        <aside className="browse" aria-label="自查源">
          {source === "world" ? (
            <>
              <div className="bh"><BookOpen className="lucide" />{t("play.rail.world")}</div>
              <label className="bsearch"><Search className="lucide" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("play.search.world")} aria-label={t("play.search.world")}
                  style={{ background: "none", border: "none", color: "inherit", outline: "none", width: "100%", font: "inherit" }} />
              </label>
              <div className="tree">
                {entries.length === 0 ? <div className="leaf"><span className="nm">{t("play.tree.empty")}</span></div>
                  : [...grouped.entries()].map(([tag, items]) => (
                    <div key={tag}>
                      <div className="cat"><File className="lucide" />{tag}</div>
                      {items.map((e) => {
                        const pinned = pins.some((x) => x.ref === e.ref);
                        return (
                          <div className="leaf" key={e.ref} title={e.snippet}>
                            <span className="lic"><File className="lucide" /></span><span className="nm">{e.name}</span>
                            {e.canPin && <button className={"pin" + (pinned ? " on" : "")} aria-label={`pin ${e.name}`} aria-pressed={pinned}
                              onClick={() => togglePin(e)} style={{ background: "none", border: "none", cursor: "pointer" }}><Pin className="lucide" /></button>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div className="bh"><Wrench className="lucide" />{t("play.rail.tools")}</div>
              <div className="tree">
                <div className="cat"><Pin className="lucide" />{t("play.tools.pins")} · {pins.length}</div>
                {pins.length === 0 ? <div className="leaf"><span className="nm">{t("play.tools.none")}</span></div>
                  : pins.map((p) => (
                    <div className="leaf" key={p.ref}><span className="lic"><Pin className="lucide" /></span><span className="nm">{p.name}</span>
                      <button className="pin on" aria-label={`unpin ${p.name}`} onClick={() => togglePin(p)} style={{ background: "none", border: "none", cursor: "pointer" }}><X className="lucide" /></button></div>
                  ))}
                <div className="cat"><ScrollText className="lucide" />{t("play.tools.log")}</div>
                {logEntries.length === 0 ? <div className="leaf"><span className="nm">{t("play.tree.empty")}</span></div>
                  : logEntries.slice(0, 40).map((e) => (
                    <div className="leaf" key={e.ref} title={e.snippet}><span className="lic"><ScrollText className="lucide" /></span><span className="nm">{e.snippet || e.name}</span></div>
                  ))}
              </div>
            </>
          )}
        </aside>

        <section className="center" aria-label="叙事">
          <div className="narr">
            {gameEnd && <div className="end" role="status"><Flag className="lucide" /><b>{gameEnd.outcome}</b><span>{gameEnd.reason}</span></div>}
            {narration.length === 0 && mechanics.length === 0 && !gameEnd ? (
              <p className="empty">{started ? t("play.narr.empty") : t("play.narr.prestart")}</p>
            ) : (
              <>
                {narration.map((para, i) => <Markdown key={i} text={para} />)}
                {mechanics.map((m) => {
                  const Icon = MECH_ICON[m.kind] ?? CheckCircle2;
                  return (
                    <div className={`mech mech-${m.kind}`} key={m.seq}>
                      <Icon className="lucide" />{m.text}
                    </div>
                  );
                })}
              </>
            )}
            {pendingRoll?.bands && pendingRoll.bands.length > 0 && (
              <div className="ranges">
                <div className="rt"><Dices className="lucide" />{pendingRoll.label} — {pendingRoll.yourSide.exprDisplay}</div>
                {pendingRoll.bands.map((b) => <div className="rr" key={b.label}><span className="rg">{b.min}–{b.max}</span><span className="rd">{b.label}</span></div>)}
              </div>
            )}
            {pendingRoll && (!pendingRoll.bands || pendingRoll.bands.length === 0) && (
              <div className="mech"><Dices className="lucide" />{pendingRoll.label}：{pendingRoll.yourSide.exprDisplay}{pendingRoll.dc != null ? ` vs DC ${pendingRoll.dc}` : ""}</div>
            )}
            {choices && (
              <div className="ranges">
                {choices.options.map((o) => (
                  <button className={"choice" + (chosen === o.index ? " sel" : "")} key={o.index} disabled={chosen !== null}
                    onClick={() => { setChosen(o.index); choose(choices.eventId, o.index).catch(() => setChosen(null)); }}>
                    <span className="cl">{o.label}</span><span className="cc">{o.consequence}</span>
                  </button>
                ))}
              </div>
            )}
            {(generating || (kicked && narration.length === 0)) && !gameEnd && <div className="gen"><Loader2 className="lucide spin" />{t("play.generating")}</div>}
            {error && (
              errorCode === "gm_timeout" ? (
                // RT-1 短期方案：超时(可区分 code=gm_timeout)给「重试 / 跳过」入口。
                // 重试=重发上一步玩家输入；跳过=放弃本回合继续。中期事务回滚/长期快照恢复另立。
                <div className="err timeout" role="alert" data-testid="gm-timeout">
                  <div className="t"><Timer className="lucide" /><b>{t("play.timeout.title")}</b></div>
                  <div className="m">{error}</div>
                  <div className="acts">
                    <button data-testid="timeout-retry" onClick={() => retry().catch(() => {})}><RotateCcw className="lucide" />{t("play.timeout.retry")}</button>
                    <button data-testid="timeout-skip" onClick={skip}><X className="lucide" />{t("play.timeout.skip")}</button>
                  </div>
                  <span className="h">{t("play.timeout.hint")}</span>
                </div>
              ) : (
                <div className="err"><AlertTriangle className="lucide" />{error}</div>
              )
            )}
          </div>

          <div className="split" />
          <div className="input">
            {pendingRoll ? (
              <>
                <button className="roll" onClick={() => roll(pendingRoll.eventId).catch(() => {})}>
                  <Dices className="lucide" />{t("play.roll")}<span className="d">d{pendingRoll.shape === "outcome" ? "10" : "20"}</span>
                </button>
                <span className="h">{t("play.roll.hint")}</span>
              </>
            ) : !started ? (
              <>
                <button className="roll kickoff" data-testid="kickoff" onClick={kickoff} disabled={kicked}>
                  <Play className="lucide" />{kicked ? t("play.start.busy") : t("play.start")}
                </button>
                <span className="h">{t("play.start.hint")}</span>
              </>
            ) : (
              <input className="field" aria-label="输入" value={draft} placeholder={t("play.input.ph")}
                onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} disabled={!!gameEnd} />
            )}
          </div>
        </section>

        <aside className="stage" aria-label="呈现台">
          <div className="sh"><LayoutDashboard className="lucide" />{t("play.stage")}
            <span className="mode">
              {order.length > 0 && (
                <button className="reset" aria-label={t("play.stage.reset")} title={t("play.stage.reset")} onClick={resetOrder}><RotateCcw className="lucide" /></button>
              )}
              <Grid3x3 className="lucide" />{t("play.stage.grid")}
            </span>
          </div>
          <div className="grid">
            {orderedCells.length === 0 ? (
              <div className="pan wide"><div className="pc"><span className="empty">{t("play.stage.empty")}</span></div></div>
            ) : (
              orderedCells.map((c) => <Fragment key={c.id}>{c.el}</Fragment>)
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Panel({ id, title, Icon, children, wide, gmTag, mini, onMin, onHide, dragging, onDragStart, onDragEnd, onDragOver, onDrop }: {
  id: string; title: string; Icon: ComponentType<{ className?: string }>; children: React.ReactNode;
  wide?: boolean; gmTag?: string; mini: boolean; onMin: () => void; onHide: () => void;
  dragging?: boolean; onDragStart?: () => void; onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <div className={"pan" + (wide ? " wide" : "") + (mini ? " min" : "") + (dragging ? " dragging" : "")} data-panel={id}
      onDragOver={onDragOver} onDrop={onDrop}>
      <div className="ph">
        <span className="grip" draggable aria-label="拖拽排序" title="拖拽排序"
          onDragStart={onDragStart} onDragEnd={onDragEnd}><GripVertical className="lucide" /></span>
        <span className="pic"><Icon className="lucide" /></span><span className="pt">{title}</span>
        <span className="ctl">
          {gmTag && <span className="gm-tag"><Sparkles className="lucide" />{gmTag}</span>}
          <button aria-label="最小化" onClick={onMin} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}><Minus className="lucide" /></button>
          <button aria-label="隐藏" onClick={onHide} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}><X className="lucide" /></button>
        </span>
      </div>
      {!mini && <div className="pc">{children}</div>}
    </div>
  );
}
