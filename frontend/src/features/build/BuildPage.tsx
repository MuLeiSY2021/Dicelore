// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  BookMarked, SearchCheck, PackageOpen, GitCommit, Download, Globe, Users, Layers,
  SlidersHorizontal, Table, Swords, GitBranch, Sparkles, Anchor, GitGraph, Scroll,
  FileCog, Paperclip, CircleCheckBig, CircleDot, Circle, User, Pencil, Trash2,
  ArrowUp, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Hammer, Plus,
  UploadCloud, FileText, X, Coins, Wrench, FolderOpen,
} from "lucide-react";
import { commitPack, type ValidateIssue } from "@/features/catalog/api.js";
import {
  createLoreSession, postBuildMessage, validateDraft, listLoreSessions, deleteLoreSession,
  uploadMaterial, type LoreSessionSummary, type BuildTurnUsage,
} from "@/features/build/api.js";
import { useLoreSession, type ToolCall } from "@/features/build/useLoreSession.js";
import { deriveViews, guidelineStages, type ViewKey, type DraftViews } from "@/features/build/draftViews.js";
import { useBuildT, type BuildTFunc } from "@/features/build/strings.js";
import { estimateCostUsd, formatUsd, formatTokens } from "@/features/cost/pricing.js";
import { useHealth } from "@/shell/useHealth.js";
import "@/features/build/build.css";

type Icon = ComponentType<{ className?: string }>;
interface ChatEntry { role: "u" | "a"; text: string; turnId?: string; usage?: BuildTurnUsage; model?: string }
interface MatItem { name: string; pct: number; bytes?: number; abort?: () => void }

// sidenav 内容域定义（裁决 §三 C13 七组中带 data-view 的内容域）。
const CONTENT_NAV: { key: ViewKey; Icon: Icon; labelKey: string }[] = [
  { key: "lore", Icon: Globe, labelKey: "bd.nav.lore" },
  { key: "npc", Icon: Users, labelKey: "bd.nav.npc" },
  { key: "pool", Icon: Layers, labelKey: "bd.nav.pool" },
  { key: "rule", Icon: SlidersHorizontal, labelKey: "bd.nav.rule" },
  { key: "state", Icon: Table, labelKey: "bd.nav.state" },
];
const SCAFFOLD_NAV: { key: ViewKey; Icon: Icon; labelKey: string }[] = [
  { key: "front", Icon: Swords, labelKey: "bd.nav.front" },
  { key: "plotline", Icon: GitBranch, labelKey: "bd.nav.plotline" },
  { key: "foreshadow", Icon: Sparkles, labelKey: "bd.nav.foreshadow" },
  { key: "anchor", Icon: Anchor, labelKey: "bd.nav.anchor" },
  { key: "relation", Icon: GitGraph, labelKey: "bd.nav.relation" },
];
const CLOSURE_NAV: { key: ViewKey; Icon: Icon; labelKey: string }[] = [
  { key: "prologue", Icon: Scroll, labelKey: "bd.nav.prologue" },
  { key: "manifest", Icon: FileCog, labelKey: "bd.nav.manifest" },
];
const ALL_NAV = [...CONTENT_NAV, ...SCAFFOLD_NAV, ...CLOSURE_NAV, { key: "materials" as ViewKey, labelKey: "bd.nav.materials" }];

// 校验报告条目 → 跳转目标 data-view（缺口 #6：点定位）。按 Draft 分域 path 前缀映射。
function jumpTargetFor(path: string): ViewKey {
  const p = path.toLowerCase();
  if (p.startsWith("manifest")) return "manifest";
  if (p.startsWith("prologue")) return "prologue";
  if (p.startsWith("world") || p.startsWith("lore")) return "lore";
  if (p.startsWith("npc")) return "npc";
  if (p.startsWith("pool")) return "pool";
  if (p.startsWith("rule")) return "rule";
  if (p.startsWith("state") || p.startsWith("sheet")) return "state";
  if (p.startsWith("front")) return "front";
  if (p.startsWith("plotline")) return "plotline";
  if (p.startsWith("foreshadow")) return "foreshadow";
  if (p.startsWith("relation")) return "relation";
  if (p.startsWith("anchor")) return "anchor";
  return "manifest";
}

// 团本制作（组件5 构建台 Web 门面）：loregm 会话为中心（活跃 Draft 即写即读），三栏 +
// sidenav 七组 + data-view 切换 + 13 缺口（裁决 frontend-ia-rebuild §三）。
export default function BuildPage() {
  const t = useBuildT();
  const { health } = useHealth();
  const model = health?.model.gm ?? "";

  const [sessions, setSessions] = useState<LoreSessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewKey>("lore");
  const [exported, setExported] = useState<{ name: string } | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [issues, setIssues] = useState<ValidateIssue[] | null>(null);
  const [turnErr, setTurnErr] = useState<{ code: string; message: string } | null>(null);
  const [materials, setMaterials] = useState<MatItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [bayPop, setBayPop] = useState<"session" | "usage" | null>(null);
  const [editing, setEditing] = useState<{ view: ViewKey; name: string } | null>(null);
  const [editText, setEditText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const lore = useLoreSession(activeId);
  const views = deriveViews(lore.draft?.snapshot);
  const stages = guidelineStages(views, materials.length);
  const packName = lore.draft?.snapshot.manifest.name
    ?? sessions.find((s) => s.sessionId === activeId)?.packName ?? "";

  useEffect(() => {
    listLoreSessions().then((s) => {
      setSessions(s);
      // 选**最近活动**的会话（lastActionAt 最大）——刚建/刚编辑的续上，而非列表首个陈旧会话。
      const active = s.filter((x) => x.status === "active");
      const pool = active.length > 0 ? active : s;
      const newest = pool.reduce<LoreSessionSummary | undefined>(
        (best, x) => (!best || (x.lastActionAt ?? 0) > (best.lastActionAt ?? 0) ? x : best), undefined);
      if (newest) setActiveId(newest.sessionId);
      setLoaded(true);
    }).catch(() => { setSessions([]); setLoaded(true); });
  }, []);

  useEffect(() => {
    setChat([]); setIssues(null); setTurnErr(null); setMaterials([]); setExported(null);
    setView("lore"); setEditing(null);
  }, [activeId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView?.({ block: "end" }); }, [chat, lore.generating, lore.liveTools]);

  const displayErr = lore.error ?? turnErr;

  // 唯一写路径是构建助手（缝 A：assistant → build 工具 → WS draft_delta → 刷新）。
  // 自由输入与 inline 编辑/新建/删除都经此下发。
  function post(text: string) {
    if (!activeId || !text.trim()) return;
    setTurnErr(null);
    setChat((c) => [...c, { role: "u", text: text.trim() }]);
    setSending(true);
    postBuildMessage(activeId, text.trim())
      .then((r) => {
        if (r.error) setTurnErr(r.error);
        setChat((c) => [...c, {
          role: "a", turnId: r.turnId, usage: r.usage, model,
          text: r.error ? t("bd.err.prefix") + r.error.message : summarizeTurn(),
        }]);
        lore.refresh(); // 即写即读兜底：回合完成后主动重拉 Draft（不单靠 WS draft_delta，proxy 抖动也不丢）
      })
      .catch((e) => setTurnErr({ code: "send_failed", message: e instanceof Error ? e.message : String(e) }))
      .finally(() => setSending(false));
  }
  function send() { const text = input.trim(); if (!text) return; setInput(""); post(text); }

  const beginEdit = (v: ViewKey, name: string, cur: string) => { setEditing({ view: v, name }); setEditText(cur); };
  const saveEdit = (domain: string) => { if (editing && editText.trim()) post(`请把「${domain}·${editing.name}」改为：\n${editText.trim()}`); setEditing(null); };
  const delEntry = (domain: string, name: string) => { if (window.confirm(t("bd.confirm.del"))) post(`请删除「${domain}·${name}」这条条目。`); };
  const newEntry = () => { const text = window.prompt(t("bd.edit.ph")); if (text && text.trim()) post(`请在「${t(`bd.nav.${view}`)}」新增一条：\n${text.trim()}`); };

  async function runValidate() {
    if (!activeId) return;
    try { setIssues(await validateDraft(activeId)); }
    catch (e) { setTurnErr({ code: "validate_failed", message: e instanceof Error ? e.message : String(e) }); }
  }

  async function doCommit() {
    if (!activeId || !packName) return;
    const list = issues ?? [];
    if (list.some((i) => i.level === "error")) { setTurnErr({ code: "has_error", message: "存在 error，请先修复再提交。" }); return; }
    if (list.some((i) => i.level === "warn") && !confirm(t("bd.confirm.commit"))) return;
    try {
      await commitPack(packName, `commit ${new Date().toISOString()}`, lore.draft?.files ?? []);
      await deleteLoreSession(activeId).catch(() => {});
      setSessions((s) => s.map((x) => (x.sessionId === activeId ? { ...x, status: "archived" } : x)));
      setExported({ name: packName });
    } catch (e) { setTurnErr({ code: "commit_failed", message: e instanceof Error ? e.message : String(e) }); }
  }

  function doExport() {
    const files = lore.draft?.files ?? [];
    const blob = new Blob([JSON.stringify({ name: packName, files }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${packName || "pack"}.dicelore.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onPickFiles(list: FileList | null) {
    if (!list || !activeId) return;
    for (const file of Array.from(list)) {
      const { promise, abort } = uploadMaterial(activeId, file, (pct) =>
        setMaterials((m) => m.map((x) => (x.name === file.name ? { ...x, pct } : x))));
      setMaterials((m) => [...m.filter((x) => x.name !== file.name), { name: file.name, pct: 0, abort }]);
      promise
        .then((res) => setMaterials((m) => m.map((x) => (x.name === file.name ? { ...x, pct: 100, bytes: res.bytes, abort: undefined } : x))))
        .catch(() => setMaterials((m) => m.filter((x) => x.name !== file.name)));
    }
  }

  async function createSession(name: string, meta: { flows?: string; clock?: string; entry?: string }) {
    setModalOpen(false);
    try {
      const id = await createLoreSession(name || undefined);
      const s = await listLoreSessions().catch(() => sessions);
      setSessions(s);
      setActiveId(id);
      const bits = [meta.flows && `flows=${meta.flows}`, meta.clock && `clock=${meta.clock}`, meta.entry && `entry=${meta.entry}`].filter(Boolean);
      if (bits.length) setTimeout(() => { void postBuildMessage(id, `设置 manifest：${bits.join("，")}`).catch(() => {}); }, 0);
    } catch (e) { setTurnErr({ code: "create_failed", message: e instanceof Error ? e.message : String(e) }); }
  }

  const screen: "none" | "exported" | "active" = exported ? "exported" : (loaded && !activeId ? "none" : "active");
  const errCount = (issues ?? []).filter((i) => i.level === "error").length;
  const warnCount = (issues ?? []).filter((i) => i.level === "warn").length;
  const allGreen = issues !== null && issues.length === 0;
  const editorTitle = ALL_NAV.find((n) => n.key === view)?.labelKey;

  return (
    <div className="build appshell">
      <div className="ctx" data-testid="build-ctxbar">
        <BookMarked className="lucide" />
        <span className="name">{packName || t("bd.none.title")}</span>
        {activeId && <span className="badge">{t("bd.badge.draft")}</span>}
        <span className="sp" />
        <button className="act" data-testid="build-validate-btn" onClick={runValidate} disabled={!activeId}><SearchCheck className="lucide" />{t("bd.validate")}</button>
        <button className="act" data-testid="build-import-btn" onClick={() => { setView("materials"); fileInput.current?.click(); }} disabled={!activeId}><PackageOpen className="lucide" />{t("bd.import")}</button>
        <button className="act" data-testid="build-commit-btn" title={t("bd.commit.title")} onClick={doCommit} disabled={!activeId}><GitCommit className="lucide" />{t("bd.commit")}</button>
        <button className="act go" data-testid="build-export-btn" title={t("bd.export.title")} onClick={doExport} disabled={!activeId}><Download className="lucide" />{t("bd.export")}</button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {screen === "none" && (
        <div className="nosession" data-testid="build-noSession-hint">
          <Hammer className="lucide big" />
          <div className="ns-t">{t("bd.none.title")}</div>
          <div className="ns-sub">{t("bd.none.sub")}</div>
          <div className="ns-btns"><button className="act go" data-testid="build-session-new-main" onClick={() => setModalOpen(true)}><Plus className="lucide" />{t("bd.none.new")}</button></div>
          {sessions[0] && <div className="ns-recent" data-testid="build-none-recent" role="button" tabIndex={0} onClick={() => setActiveId(sessions[0].sessionId)}>{t("bd.none.recent", { name: sessions[0].packName, when: relTime(sessions[0].lastActionAt) })}</div>}
        </div>
      )}

      {screen === "exported" && (
        <div className="exported" data-testid="build-exported">
          <CheckCircle2 className="lucide big ok" />
          <div className="ex-t">{t("bd.exported.title")}</div>
          <div className="ex-sub">{t("bd.exported.sub", { name: exported?.name ?? "" })}</div>
          <div className="ns-btns">
            <button className="act" data-testid="build-exported-continue" onClick={() => setExported(null)}>{t("bd.exported.continue")}</button>
            <button className="act go" data-testid="build-exported-tocatalog" onClick={() => { window.location.hash = "#/adventures"; }}>{t("bd.exported.tocatalog")}</button>
          </div>
        </div>
      )}

      {screen === "active" && (
        <div className="bbody">
          <nav className="sidenav">
            <NavGroup label={t("bd.grp.content")} items={CONTENT_NAV} view={view} setView={setView} counts={views.counts} t={t} />
            <NavGroup label={t("bd.grp.scaffold")} items={SCAFFOLD_NAV} view={view} setView={setView} counts={views.counts} t={t} />
            <NavGroup label={t("bd.grp.closure")} items={CLOSURE_NAV} view={view} setView={setView} counts={views.counts} t={t} />
            <div className="sn-grp">{t("bd.grp.materials")}</div>
            <button className={"sn" + (view === "materials" ? " on" : "")} data-testid="build-nav-materials" onClick={() => setView("materials")}>
              <Paperclip className="lucide" />{t("bd.nav.materials")}{materials.length > 0 && <span className="ct">{materials.length}</span>}
            </button>
            <div className="sn-grp">{t("bd.grp.progress")}</div>
            <GuidelineRow testid="build-guideline-source" stage={stages.source} label={t("bd.stg.source")} goto="materials" setView={setView} />
            <GuidelineRow testid="build-guideline-world" stage={stages.world} label={t("bd.stg.world")} goto="lore" setView={setView} />
            <GuidelineRow testid="build-guideline-npc" stage={stages.npc} label={t("bd.stg.npc")} goto="npc" setView={setView} />
            <GuidelineRow testid="build-guideline-rule" stage={stages.rule} label={t("bd.stg.rule")} goto="rule" setView={setView} />
            <GuidelineRow testid="build-guideline-manifest" stage={stages.manifest} label={t("bd.stg.manifest")} goto="manifest" setView={setView} />
          </nav>

          <div className="main">
            <div className="mtool">
              <span className="t" data-testid="build-editor-title">{editorTitle ? t(editorTitle) : t("bd.editor.title")}</span>
              <span className="sp" />
              {view !== "materials" && <button className="btn" data-testid="build-card-new" onClick={newEntry}><Plus className="lucide" />{t("bd.card.new")}</button>}
            </div>
            <div className="mbody" data-testid="build-editor">
              <DataView view={view} views={views} materials={materials} t={t}
                editing={editing} editText={editText} setEditText={setEditText}
                beginEdit={beginEdit} saveEdit={saveEdit} cancelEdit={() => setEditing(null)} delEntry={delEntry}
                onDropClick={() => fileInput.current?.click()} onDropFiles={onPickFiles} />
            </div>
          </div>

          <aside className="aside">
            <div className="as-h"><Sparkles className="lucide" />{t("bd.assistant")}</div>
            <div className="chat" data-testid="build-assistant">
              {chat.length === 0 && !lore.generating && (
                <div className="msg a"><div className="who"><Sparkles className="lucide" />{t("bd.assistant")}</div>{t("bd.assistant.welcome")}</div>
              )}
              {chat.map((m, i) => m.role === "u"
                ? <div className="msg u" key={i}>{m.text}</div>
                : <div className="msg a" key={i}>
                    <div className="who"><Sparkles className="lucide" />{t("bd.assistant")}</div>{m.text}
                    {m.turnId && lore.toolsByTurn[m.turnId]?.length ? (
                      <div className="did" data-testid="build-assistant-toolcalls">↳ {lore.toolsByTurn[m.turnId].map((x) => x.tool).join(" · ")}</div>
                    ) : null}
                    {m.usage && <TurnUsage usage={m.usage} model={m.model ?? model} t={t} />}
                  </div>)}
              {lore.generating && (
                <div className="msg gen" data-testid="build-generating">
                  <span className="spin" />
                  <div className="gen-body">
                    <div>{t("bd.gen.title")}</div>
                    <div className="gen-tools" data-testid="build-generating-tools">
                      {lore.liveTools.map((x, i) => <div className="gen-tool" key={i}>↳ {x.tool}</div>)}
                    </div>
                    <button className="act gen-cancel" data-testid="build-generating-cancel" onClick={() => lore.clearError()}>
                      <X className="lucide" />中止本轮
                    </button>
                  </div>
                </div>
              )}
              {displayErr && (
                <div className="msg err" data-testid="build-assistant-error" role="button" tabIndex={0} onClick={runValidate}>
                  <AlertCircle className="lucide" /><span>{t("bd.err.prefix")}{displayErr.message} {t("bd.err.locate")}</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="cin">
              <input className="box" value={input} placeholder={t("bd.assistant.ph")} aria-label={t("bd.assistant.ph")}
                onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} disabled={!activeId} />
              <button className="send" data-testid="build-send" onClick={send} disabled={!activeId || sending} aria-label={t("bd.send")}><ArrowUp className="lucide" /></button>
            </div>
            <div className="valid" data-testid="build-validate-report">
              <div className="vh">
                <ShieldCheck className="lucide" style={{ color: errCount ? "var(--err)" : "var(--ok)" }} />{t("bd.report")}
                <span className={"chip " + (errCount ? "warn" : "ok")}>{t("bd.report.err", { n: errCount })}</span>
                <span className={"chip " + (warnCount ? "warn" : "ok")}>{t("bd.report.warn", { n: warnCount })}</span>
              </div>
              {issues === null && (
                <div className="vitem"><FolderOpen className="lucide" style={{ color: "var(--text3)" }} /><span>{t("bd.report.hint", { label: t("bd.validate") })}</span></div>
              )}
              {issues !== null && issues.map((it, i) => (
                <div className="vitem" data-testid="build-validate-item" data-jump={jumpTargetFor(it.path)} key={i}
                  role="button" tabIndex={0} title={it.path} onClick={() => setView(jumpTargetFor(it.path))}>
                  <AlertTriangle className="lucide" style={{ color: it.level === "error" ? "var(--err)" : "var(--warn)" }} />
                  <span><span className="f">{it.path}</span> {it.msg}</span>
                </div>
              ))}
              {allGreen && (
                <div className="vok" data-testid="build-validate-ok"><CheckCircle2 className="lucide" />{t("bd.report.ok")}</div>
              )}
            </div>
          </aside>
        </div>
      )}

      <BayExtras t={t} bayPop={bayPop} setBayPop={setBayPop} sessions={sessions} activeId={activeId}
        setActiveId={setActiveId} onNew={() => setModalOpen(true)} model={model} chat={chat} />
      {modalOpen && <NewSessionModal t={t} onClose={() => setModalOpen(false)} onConfirm={createSession} />}
    </div>
  );
}

// ── 子组件 ─────────────────────────────────────────────────────────────────

function NavGroup({ label, items, view, setView, counts, t }: {
  label: string; items: { key: ViewKey; Icon: Icon; labelKey: string }[];
  view: ViewKey; setView: (v: ViewKey) => void; counts: DraftViews["counts"]; t: BuildTFunc;
}) {
  return (
    <>
      <div className="sn-grp">{label}</div>
      {items.map(({ key, Icon, labelKey }) => (
        <button key={key} className={"sn" + (view === key ? " on" : "")} data-nav={key} data-navgroup="c" data-testid={`build-nav-${key}`} onClick={() => setView(key)}>
          <Icon className="lucide" />{t(labelKey)}
          {key !== "prologue" && key !== "manifest" && <span className="ct">{counts[key as keyof DraftViews["counts"]] ?? 0}</span>}
        </button>
      ))}
    </>
  );
}

function GuidelineRow({ testid, label, stage, goto, setView }: {
  testid: string; label: string; stage: "done" | "now" | ""; goto: ViewKey; setView: (v: ViewKey) => void;
}) {
  const Ic = stage === "done" ? CircleCheckBig : stage === "now" ? CircleDot : Circle;
  return (
    <button className="sn" data-goto={goto} data-testid={testid} onClick={() => setView(goto)}>
      <Ic className="lucide" />{label}<span className={"stg" + (stage ? " " + stage : "")} />
    </button>
  );
}

function TurnUsage({ usage, model, t }: { usage: BuildTurnUsage; model: string; t: BuildTFunc }) {
  const cost = estimateCostUsd(model, usage);
  return (
    <div className="turn-usage" data-testid="build-turn-usage"
      title={`${t("bd.usage.turn")} · model ${model || "—"} · in ${usage.inputTokens} / out ${usage.outputTokens} / cacheRead ${usage.cacheReadTokens} / cacheWrite ${usage.cacheCreationTokens}`}>
      ⟨<span className="tu-model">{model || "—"}</span> · <span className="up">↑{formatTokens(usage.inputTokens)}</span>{" "}
      <span className="down">↓{formatTokens(usage.outputTokens)}</span> tok · ≈{formatUsd(cost)}⟩
    </div>
  );
}

// data-view 渲染器：按当前 view 渲染对应域内容。inline 编辑/删除经 dispatch(post) 下发助手。
function DataView(props: {
  view: ViewKey; views: DraftViews; materials: MatItem[]; t: BuildTFunc;
  editing: { view: ViewKey; name: string } | null; editText: string; setEditText: (s: string) => void;
  beginEdit: (v: ViewKey, name: string, cur: string) => void; saveEdit: (domain: string) => void;
  cancelEdit: () => void; delEntry: (domain: string, name: string) => void;
  onDropClick: () => void; onDropFiles: (f: FileList | null) => void;
}) {
  const { view, views, materials, t, editing, editText, setEditText, beginEdit, saveEdit, cancelEdit, delEntry } = props;
  const isEditing = (name: string) => editing?.view === view && editing?.name === name;
  const domain = t(`bd.nav.${view}`);

  const Acts = (name: string, cur: string) => (
    <span className="card-acts">
      <span className="card-act" data-testid="build-card-edit" title={t("bd.card.edit")} role="button" tabIndex={0} onClick={() => beginEdit(view, name, cur)}><Pencil className="lucide" /></span>
      <span className="card-act" data-testid="build-card-del" title={t("bd.card.del")} role="button" tabIndex={0} onClick={() => delEntry(domain, name)}><Trash2 className="lucide" /></span>
    </span>
  );
  const EditForm = (
    <div className="inline-form">
      <textarea rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} aria-label={t("bd.card.edit")} />
      <div className="if-row">
        <button className="act" onClick={cancelEdit}>{t("bd.edit.cancel")}</button>
        <button className="act go" onClick={() => saveEdit(domain)}>{t("bd.edit.save")}</button>
      </div>
    </div>
  );
  const empty = <div className="editor-empty" data-testid="build-editor-empty">{t("bd.editor.empty")}</div>;

  if (view === "lore" || view === "rule") {
    const items = view === "lore" ? views.lore : views.rules;
    if (items.length === 0) return empty;
    return <>{items.map((d) => (
      <div className="card" data-view={view} key={d.name}>
        <div className="ph2">{d.name}{Acts(d.name, d.content)}</div>
        <div className="mono">{d.content}</div>
        {isEditing(d.name) && EditForm}
      </div>
    ))}</>;
  }
  if (view === "npc" || view === "state") {
    const items = view === "npc" ? views.npcs : views.states;
    if (items.length === 0) return empty;
    return <>{items.map((e) => (
      <div className="card npc" data-view={view} key={e.entity}>
        <div className="nh">
          <span className="av"><User className="lucide" /></span>
          <span className="nm">{e.entity}</span>
          <span className="tag">{e.kind}</span>
          {view === "npc" && <span className="tag" style={e.cells.length === 0 ? { color: "var(--warn)", borderColor: "var(--warn)" } : undefined}>{e.cells.length === 0 ? t("bd.npc.nocard") : t("bd.npc.hascard")}</span>}
          <span className="sp" />{Acts(e.entity, e.cells.map((c) => `${c.attr}=${c.value}`).join("\n"))}
        </div>
        <div className="nb">
          <div className="sheet"><div className="lbl">{t("bd.sheet")}</div>
            {e.cells.length === 0 ? <div className="crow" style={{ border: "none" }}><span>—</span></div>
              : e.cells.map((c, i) => <div className="crow" key={i} style={i === e.cells.length - 1 ? { border: "none" } : undefined}><span>{c.attr}</span><b>{c.value}</b></div>)}
          </div>
        </div>
        {isEditing(e.entity) && EditForm}
      </div>
    ))}</>;
  }
  if (view === "pool") {
    if (views.pools.length === 0) return empty;
    return <>{views.pools.map((p) => (
      <div className="card" data-view="pool" key={p.name}>
        <div className="ph2">{p.name}{Acts(p.name, JSON.stringify(p.rows, null, 2))}</div>
        {p.rows.map((r, i) => { const keys = Object.keys(r); return (
          <div className="crow" key={i} style={i === p.rows.length - 1 ? { border: "none" } : undefined}>
            <span>{String(r[keys[0]] ?? "")}</span><b>{keys.slice(1).map((k) => `${k} ${r[k]}`).join(" · ")}</b>
          </div>
        ); })}
        {isEditing(p.name) && EditForm}
      </div>
    ))}</>;
  }
  if (view === "front") {
    if (views.fronts.length === 0) return empty;
    return <>{views.fronts.map((f) => (
      <div className="card" data-view="front" key={f.id}>
        <div className="ph2">{f.title ?? f.id}{f.clockMax ? `（Clock 0/${f.clockMax}）` : ""}{Acts(f.id, f.title ?? f.id)}</div>
        <div className="front-steps">{(f.steps ?? []).map((s, i) => <div className="s" key={i}><span className="g">阶 {s.at}</span>{s.text}</div>)}</div>
        {isEditing(f.id) && EditForm}
      </div>
    ))}</>;
  }
  if (view === "plotline" || view === "foreshadow" || view === "anchor") {
    const rows = view === "plotline" ? views.plotlines : view === "foreshadow" ? views.foreshadows : views.anchors;
    if (rows.length === 0) return empty;
    return <div className="card" data-view={view}><div className="ph2">{domain}</div>
      {rows.map((r, i) => { const keys = Object.keys(r); return (
        <div className="crow" key={i} style={i === rows.length - 1 ? { border: "none" } : undefined}>
          <span>{String(r[keys[0]] ?? "")}</span><b>{keys.slice(1).map((k) => `${r[k]}`).join(" · ")}</b>
        </div>
      ); })}
    </div>;
  }
  if (view === "relation") {
    if (views.relations.length === 0) return empty;
    return <div className="card" data-view="relation"><div className="ph2">{t("bd.nav.relation")}</div>
      <div className="mono">{views.relations.map((r) => `${r.from} —${r.role}→ ${r.to}`).join("\n")}</div>
    </div>;
  }
  if (view === "prologue") {
    return <div className="card" data-view="prologue"><div className="ph2">prologue.md{views.prologue ? Acts("prologue", views.prologue) : null}</div>
      <div className="mono">{views.prologue || t("bd.editor.empty")}</div>
      {isEditing("prologue") && EditForm}</div>;
  }
  if (view === "manifest") {
    return <div className="card" data-view="manifest"><div className="ph2">manifest.toml</div>
      <div className="mono">{`name = "${views.manifest.name ?? ""}"\nid = "${views.manifest.id ?? ""}"`}</div></div>;
  }
  // materials
  return (
    <div className="card" data-view="materials">
      <div className="ph2">{t("bd.nav.materials")}</div>
      <div className="mat-drop" data-testid="build-materials-drop" role="button" tabIndex={0}
        onClick={props.onDropClick} onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); props.onDropFiles(e.dataTransfer.files); }}>
        <UploadCloud className="lucide" />{t("bd.mat.drop")}
      </div>
      <div className="mat-list" data-testid="build-materials-list">
        {materials.length === 0 && <div className="editor-empty">{t("bd.mat.empty")}</div>}
        {materials.map((m, i) => (
          <div className="mat-row" key={i}>
            <FileText className="lucide" /><span className="mn">{m.name}</span><span className="msp" />
            <span className="mat-prog"><span className="mat-fill" style={{ width: `${m.pct}%` }} /></span>
            <span className="dim">{m.pct >= 100 ? `${m.bytes ? (m.bytes / 1e6).toFixed(1) + "MB·" : ""}${t("bd.mat.done")}` : t("bd.mat.uploading", { pct: m.pct })}</span>
            <span className="card-act" role="button" tabIndex={0} onClick={() => m.abort?.()}>{m.pct >= 100 ? <Trash2 className="lucide" /> : <X className="lucide" />}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 助手回合摘要：loregm REST-only 不回传散文，用通用回执（工具流在 chat 尾行另显）。
function summarizeTurn(): string { return "已处理本轮指令，产物已即写即读刷新到左侧内容。"; }

function relTime(ms?: number): string {
  if (!ms) return "—";
  const d = Date.now() - ms;
  if (d < 60_000) return "刚才";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  return `${Math.floor(d / 86_400_000)} 天前`;
}

// 全局 bay 注入（Shell 的 <Bay/> 不带 children，故本页专属 bay 按钮 + popover 经 portal 挂进 .bay / body）。
function BayExtras({ t, bayPop, setBayPop, sessions, activeId, setActiveId, onNew, model, chat }: {
  t: BuildTFunc; bayPop: "session" | "usage" | null; setBayPop: (p: "session" | "usage" | null) => void;
  sessions: LoreSessionSummary[]; activeId: string | null; setActiveId: (id: string) => void; onNew: () => void;
  model: string; chat: ChatEntry[];
}) {
  const [bayEl, setBayEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setBayEl(document.querySelector<HTMLElement>(".bay")); }, []);

  const usageTurns = chat.filter((m) => m.usage);
  const sessionCost = usageTurns.reduce((sum, m) => sum + estimateCostUsd(m.model ?? model, m.usage!), 0);
  const sessionTok = usageTurns.reduce((sum, m) => sum + m.usage!.inputTokens + m.usage!.outputTokens + m.usage!.cacheReadTokens + m.usage!.cacheCreationTokens, 0);

  const buttons = (
    <>
      <span className="bay-sep" />
      <span className="bay-btn" data-testid="build-bay-btn-session" role="button" tabIndex={0} onClick={() => setBayPop(bayPop === "session" ? null : "session")}><Layers className="lucide" />{t("bd.bay.session")}</span>
      <span className="bay-btn" data-testid="build-bay-btn-usage" role="button" tabIndex={0} onClick={() => setBayPop(bayPop === "usage" ? null : "usage")}><Coins className="lucide" />{t("bd.bay.usage")}</span>
    </>
  );

  return (
    <>
      {bayEl && createPortal(buttons, bayEl)}
      {bayPop === "session" && createPortal(
        <div className="popover" data-testid="build-bay-popover-session" onClick={(e) => { if (e.target === e.currentTarget) setBayPop(null); }}>
          <div className="pop-card">
            <div className="pop-head"><Layers className="lucide" />{t("bd.bay.session.title")}<span className="sp" /><span className="x" role="button" tabIndex={0} onClick={() => setBayPop(null)}><X className="lucide" /></span></div>
            <div className="pop-body">
              {sessions.map((s) => (
                <div className={"sess-row" + (s.sessionId === activeId ? " on" : "")} data-testid="build-session-item" key={s.sessionId} role="button" tabIndex={0} onClick={() => { setActiveId(s.sessionId); setBayPop(null); }}>
                  <div className="st"><BookMarked className="lucide" />{s.packName}
                    <span className={"sess-status " + s.status} data-testid="build-session-status">{t(s.status === "active" ? "bd.sess.active" : "bd.sess.archived")}</span></div>
                  <div className="sm" data-testid="build-session-date">{relTime(s.lastActionAt)}</div>
                  {s.lastaction && <div className="sr" data-testid="build-session-lastaction">{s.lastaction}</div>}
                </div>
              ))}
              <div className="nav-row" data-testid="build-session-new" style={{ justifyContent: "center", color: "var(--text2)" }} role="button" tabIndex={0} onClick={() => { setBayPop(null); onNew(); }}><Plus className="lucide" />{t("bd.sess.new")}</div>
            </div>
          </div>
        </div>, document.body)}
      {bayPop === "usage" && createPortal(
        <div className="popover" data-testid="build-bay-popover-usage" onClick={(e) => { if (e.target === e.currentTarget) setBayPop(null); }}>
          <div className="pop-card">
            <div className="pop-head"><Coins className="lucide" />{t("bd.bay.usage.title")}<span className="sp" /><span className="x" role="button" tabIndex={0} onClick={() => setBayPop(null)}><X className="lucide" /></span></div>
            <div className="pop-body usage-detail">
              <div className="ud-sec"><div className="ud-h">{t("bd.usage.session")} · {model || "—"}</div>
                <div className="ud-row"><span>{t("bd.usage.total")}</span><span className="ud-v"><b>{formatTokens(sessionTok)}</b></span></div>
                <div className="ud-row"><span>{t("bd.usage.price")}</span><span className="ud-v">≈{formatUsd(sessionCost)}</span></div>
                <div className="ud-row"><span>上下文占用</span><span className="ud-v">
                  <span className="ud-dial" data-testid="build-context-dial" title="loregm 无 /usage · v1 无上下文源">
                    <svg viewBox="0 0 36 36" className="dial-svg"><circle className="dial-bg" cx="18" cy="18" r="15.9" /><circle className="dial-fg" cx="18" cy="18" r="15.9" style={{ strokeDasharray: "0 100" }} /></svg>
                    <span className="dial-pct">—</span>
                  </span>
                </span></div>
              </div>
              {usageTurns.length === 0 ? <div className="editor-empty">{t("bd.usage.empty")}</div> : (
                <div className="ud-sec"><div className="ud-h">{t("bd.usage.perturn")}</div>
                  {usageTurns.slice().reverse().map((m, i) => (
                    <div className="ud-row" key={i}><span className="dim"><Wrench className="lucide" /> {m.turnId?.slice(0, 6) ?? "—"}</span>
                      <span className="ud-v">↑{formatTokens(m.usage!.inputTokens)} ↓{formatTokens(m.usage!.outputTokens)} · {m.model || "—"}</span></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}

function NewSessionModal({ t, onClose, onConfirm }: {
  t: BuildTFunc; onClose: () => void; onConfirm: (name: string, meta: { flows?: string; clock?: string; entry?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [flows, setFlows] = useState("");
  const [clock, setClock] = useState("");
  const [entry, setEntry] = useState("");
  return createPortal(
    <div className="modal" data-testid="build-new-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card wide">
        <h3>{t("bd.new.title")}</h3>
        <p className="msub">{t("bd.new.sub")}</p>
        <div className="field"><div className="fl">{t("bd.new.name")}</div><div className="fc"><input className="inp" data-testid="build-new-name" value={name} placeholder={t("bd.new.name.ph")} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} /></div></div>
        <div className="field"><div className="fl">{t("bd.new.flows")}</div><div className="fc"><input className="inp" data-testid="build-new-flows" value={flows} placeholder={t("bd.new.flows.ph")} onChange={(e) => setFlows(e.target.value)} style={{ flex: 1 }} /></div></div>
        <div className="field"><div className="fl">{t("bd.new.clock")}</div><div className="fc"><input className="inp" data-testid="build-new-clock" value={clock} placeholder={t("bd.new.clock.ph")} onChange={(e) => setClock(e.target.value)} style={{ flex: 1 }} /></div></div>
        <div className="field" style={{ border: "none" }}><div className="fl">{t("bd.new.entry")}</div><div className="fc"><input className="inp" data-testid="build-new-entry" value={entry} placeholder={t("bd.new.entry.ph")} onChange={(e) => setEntry(e.target.value)} style={{ flex: 1 }} /></div></div>
        <div className="modal-foot">
          <button className="act" data-testid="build-new-cancel" onClick={onClose}>{t("bd.new.cancel")}</button>
          <button className="act go" data-testid="build-new-confirm" onClick={() => onConfirm(name, { flows, clock, entry })}><CheckCircle2 className="lucide" />{t("bd.new.confirm")}</button>
        </div>
      </div>
    </div>, document.body);
}
