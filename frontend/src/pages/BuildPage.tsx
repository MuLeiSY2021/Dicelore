// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BookMarked, SearchCheck, PackageOpen, Download, Globe, Users, Layers, SlidersHorizontal,
  Swords, FileCog, CircleCheckBig, CircleDot, Circle, User, Pencil, ChevronUp, ChevronDown,
  Sparkles, ArrowUp, ShieldCheck, AlertTriangle, FilePlus2, RefreshCw, FolderOpen,
} from "lucide-react";
import { useT } from "../i18n/index.js";
import {
  listCatalog, getCatalogFiles, validateCatalog, commitPack, postBuildMessage,
  type TuanbenSummary, type PackFile, type ValidateIssue,
} from "../api/client.js";

type CType = "world" | "npc" | "pool" | "rule" | "front" | "manifest";
interface Entity { entity: string; kind: string; cells: { attr: string; value: string }[] }
interface Model {
  manifest: PackFile | null;
  lore: PackFile[]; rules: PackFile[]; pools: PackFile[]; fronts: PackFile[];
  entities: Entity[];
}

// 解析包文件为可读模型(state CSV → 实体；md → 设定/规则/卡池)。
function parsePack(files: PackFile[]): Model {
  const lore: PackFile[] = [], rules: PackFile[] = [], pools: PackFile[] = [], fronts: PackFile[] = [];
  let manifest: PackFile | null = null;
  const byEntity = new Map<string, Entity>();
  for (const f of files) {
    const p = f.path.toLowerCase();
    if (p.includes("manifest")) manifest = f;
    else if (p.startsWith("rule")) rules.push(f);
    else if (p.startsWith("pool")) pools.push(f);
    else if (p.startsWith("front")) fronts.push(f);
    else if (p.endsWith(".csv")) {
      const lines = f.content.split(/\r?\n/).filter((l) => l.trim());
      const header = lines.shift()?.split(",").map((s) => s.trim()) ?? [];
      const ix = (k: string) => header.indexOf(k);
      for (const line of lines) {
        const cols = line.split(",");
        const entity = cols[ix("entity")]?.trim(); if (!entity) continue;
        const kind = cols[ix("kind")]?.trim() || "player";
        const attr = cols[ix("attr")]?.trim() ?? ""; const value = cols[ix("value")]?.trim() ?? "";
        const e = byEntity.get(entity) ?? { entity, kind, cells: [] };
        if (attr) e.cells.push({ attr, value });
        byEntity.set(entity, e);
      }
    } else if (p.endsWith(".md")) lore.push(f);
  }
  return { manifest, lore, rules, pools, fronts, entities: [...byEntity.values()] };
}

interface ChatMsg { role: "u" | "a"; text: string }

// 团本制作（组件5 构建台 Web 门面）：接真 catalog（列/读包/校验/导出）+ 构建助手对话。
export default function BuildPage() {
  const t = useT();
  const [packs, setPacks] = useState<TuanbenSummary[]>([]);
  const [active, setActive] = useState<TuanbenSummary | null>(null);
  const [files, setFiles] = useState<PackFile[]>([]);
  const [ctype, setCtype] = useState<CType>("world");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [issues, setIssues] = useState<ValidateIssue[] | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listCatalog().then((p) => { setPacks(p); if (p[0]) setActive(p[0]); }).catch(() => setPacks([]));
  }, []);
  useEffect(() => {
    if (!active) { setFiles([]); return; }
    getCatalogFiles(active.id, active.head ?? "head").then(setFiles).catch(() => setFiles([]));
    setIssues(null);
  }, [active]);

  const model = parsePack(files);
  const npcs = model.entities.filter((e) => e.kind === "npc");
  const counts: Record<CType, number> = {
    world: model.lore.length, npc: npcs.length, pool: model.pools.length,
    rule: model.rules.length, front: model.fronts.length, manifest: model.manifest ? 1 : 0,
  };
  const stageDot = (done: boolean, now: boolean) => "stg" + (done ? " done" : now ? " now" : "");

  async function runValidate() { setBusy(true); try { setIssues((await validateCatalog(files)).issues); } finally { setBusy(false); } }
  async function exportPack() {
    if (!active) return;
    setBusy(true);
    try { await commitPack(active.name, `export ${new Date().toISOString()}`, files); const p = await listCatalog(); setPacks(p); }
    finally { setBusy(false); }
  }
  async function newPack() {
    const name = prompt(t("build.create"), "新团本");
    if (!name) return;
    const seed: PackFile[] = [{ path: "manifest.md", content: `# ${name}\n\n- id: ${name}` }, { path: "prologue.md", content: "（在此填写团本开场白 prompt：固定台词、导调指令、或让 GM 即兴的指导语）" }, { path: "lore/序章.md", content: "（在此填写世界设定）" }];
    const r = await commitPack(name, "init", seed);
    const list = await listCatalog(); setPacks(list);
    setActive(list.find((x) => x.id === r.tuanbenId) ?? list[0] ?? null);
  }
  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    f.text().then((content) => setFiles((prev) => [...prev, { path: `lore/${f.name}`, content }]));
    e.target.value = "";
  }
  async function send() {
    if (!draft.trim() || !active) return;
    const text = draft.trim(); setDraft("");
    setChat((c) => [...c, { role: "u", text }]);
    setBusy(true);
    try {
      const { turnId } = await postBuildMessage(`build-${active.id}`, text, active.name);
      setChat((c) => [...c, { role: "a", text: t("build.chat.received", { id: turnId.slice(0, 8), refresh: t("build.refresh") }) }]);
    } catch (err: unknown) {
      setChat((c) => [...c, { role: "a", text: t("build.chat.error", { msg: err instanceof Error ? err.message : "" }) }]);
    } finally { setBusy(false); }
  }
  const refresh = () => { if (active) getCatalogFiles(active.id, active.head ?? "head").then(setFiles).catch(() => {}); };

  const NAV: { key: CType; Icon: ComponentType<{ className?: string }>; label: string }[] = [
    { key: "world", Icon: Globe, label: t("build.world") }, { key: "npc", Icon: Users, label: t("build.npc") },
    { key: "pool", Icon: Layers, label: t("build.pool") }, { key: "rule", Icon: SlidersHorizontal, label: t("build.rule") },
    { key: "front", Icon: Swords, label: t("build.front") }, { key: "manifest", Icon: FileCog, label: t("build.manifest") },
  ];
  const errCount = issues?.filter((i) => i.level === "error").length ?? 0;
  const warnCount = issues?.filter((i) => i.level === "warn").length ?? 0;

  return (
    <div className="build">
      <div className="ctx">
        <BookMarked className="lucide" />
        <select className="f" aria-label={t("build.select")} value={active?.id ?? ""} onChange={(e) => setActive(packs.find((p) => p.id === e.target.value) ?? null)}
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 8px", fontFamily: "var(--serif)" }}>
          {packs.length === 0 && <option value="">{t("build.empty")}</option>}
          {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {active && <span className="badge">{(active.tags[0] ?? active.head?.slice(0, 7) ?? "draft")}</span>}
        <button className="act" onClick={newPack}><FilePlus2 className="lucide" />{t("build.create")}</button>
        <span className="sp" />
        <button className="act" onClick={runValidate} disabled={busy || !active}><SearchCheck className="lucide" />{t("build.validate")}</button>
        <button className="act" onClick={() => fileInput.current?.click()} disabled={!active}><PackageOpen className="lucide" />{t("build.import")}</button>
        <input ref={fileInput} type="file" accept=".md,.txt" hidden onChange={onImport} />
        <button className="act go" onClick={exportPack} disabled={busy || !active}><Download className="lucide" />{t("build.export")}</button>
      </div>

      <div className="body">
        <nav className="sidenav">
          <div className="sn-grp">{t("build.nav.content")}</div>
          {NAV.map(({ key, Icon, label }) => (
            <button key={key} className={"sn" + (ctype === key ? " on" : "")} onClick={() => setCtype(key)} style={{ width: "100%", background: "none", textAlign: "left", border: "none" }}>
              <Icon className="lucide" />{label}{key !== "manifest" && <span className="ct">{counts[key]}</span>}
            </button>
          ))}
          <div className="sn-grp">{t("build.nav.progress")}</div>
          <div className="sn"><CircleCheckBig className="lucide" />{t("build.stage.world")}<span className={stageDot(counts.world > 0, false)} /></div>
          <div className="sn"><CircleDot className="lucide" />{t("build.stage.people")}<span className={stageDot(false, counts.npc > 0)} /></div>
          <div className="sn"><Circle className="lucide" />{t("build.stage.pool")}<span className={stageDot(counts.pool > 0, false)} /></div>
          <div className="sn"><Circle className="lucide" />{t("build.stage.mech")}<span className={stageDot(counts.rule > 0, false)} /></div>
        </nav>

        <div className="main">
          <div className="mtool">
            <span className="t">{NAV.find((n) => n.key === ctype)?.label}</span><span className="sp" />
            <button className="btn" onClick={refresh}><RefreshCw className="lucide" />{t("build.refresh")}</button>
          </div>
          <div className="mbody">
            {ctype === "npc" && (npcs.length === 0
              ? <Empty t={t} />
              : npcs.map((e) => {
                const col = collapsed.has(e.entity);
                const prose = model.lore.find((l) => l.path.includes(e.entity));
                return (
                  <div className={"npc" + (col ? " collapsed" : "")} key={e.entity}>
                    <div className="nh"><span className="av"><User className="lucide" /></span><span className="nm">{e.entity}</span>
                      <span className="tag">{e.kind}</span>{e.cells.length === 0 && <span className="tag" style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>{t("build.npc.nocard")}</span>}
                      <span className="ed"><Pencil className="lucide" />
                        <button aria-label={t("build.npc.collapse")} onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(e.entity) ? n.delete(e.entity) : n.add(e.entity); return n; })} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}>
                          {col ? <ChevronDown className="lucide" /> : <ChevronUp className="lucide" />}</button></span>
                    </div>
                    <div className="nb">
                      <div className="prose"><div className="lbl">{t("build.npc.prose")}</div>{prose ? prose.content : t("build.npc.prose.empty")}</div>
                      <div className="card"><div className="lbl">sheet 卡</div>
                        {e.cells.length === 0 ? <div className="crow" style={{ border: "none" }}><span>—</span></div>
                          : e.cells.map((c) => <div className="crow" key={c.attr}><span>{c.attr}</span><b>{c.value}</b></div>)}
                      </div>
                    </div>
                  </div>
                );
              }))}
            {ctype === "world" && (model.lore.length === 0 ? <Empty t={t} /> : model.lore.map((f) => <DocCard key={f.path} f={f} />))}
            {ctype === "rule" && (model.rules.length === 0 ? <Empty t={t} /> : model.rules.map((f) => <DocCard key={f.path} f={f} />))}
            {ctype === "pool" && (model.pools.length === 0 ? <Empty t={t} /> : model.pools.map((f) => <DocCard key={f.path} f={f} />))}
            {ctype === "front" && (model.fronts.length === 0 ? <Empty t={t} /> : model.fronts.map((f) => <DocCard key={f.path} f={f} />))}
            {ctype === "manifest" && (model.manifest ? <DocCard f={model.manifest} /> : <Empty t={t} />)}
          </div>
        </div>

        <div className="aside">
          <div className="as-h"><Sparkles className="lucide" />{t("build.assistant")}</div>
          <div className="chat">
            {chat.length === 0 && <div className="msg a"><div className="who"><Sparkles className="lucide" />{t("build.assistant")}</div>{t("build.assistant.welcome")}</div>}
            {chat.map((m, i) => m.role === "u"
              ? <div className="msg u" key={i}>{m.text}</div>
              : <div className="msg a" key={i}><div className="who"><Sparkles className="lucide" />{t("build.assistant")}</div>{m.text}</div>)}
          </div>
          <div className="cin">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder={t("build.assistant.ph")} aria-label={t("build.assistant.ph")} />
            <button className="send" onClick={send} disabled={busy || !active} aria-label={t("build.send")}><ArrowUp className="lucide" /></button>
          </div>
          <div className="valid">
            <div className="vh"><ShieldCheck className="lucide" style={{ color: errCount ? "var(--err)" : "var(--ok)" }} />{t("build.report")}
              <span className={"chip " + (errCount ? "warn" : "ok")}>{t("build.report.errors", { n: errCount })}</span>
              <span className="chip warn">{t("build.report.warns", { n: warnCount })}</span></div>
            {issues === null
              ? <div className="vitem"><FolderOpen className="lucide" style={{ color: "var(--text3)" }} /><span>{t("build.validate.hint", { label: t("build.validate") })}</span></div>
              : issues.length === 0
                ? <div className="vitem"><ShieldCheck className="lucide" style={{ color: "var(--ok)" }} /><span>{t("build.validate.pass")}</span></div>
                : issues.map((it, i) => (
                  <div className="vitem" key={i}><AlertTriangle className="lucide" style={{ color: it.level === "error" ? "var(--err)" : "var(--warn)" }} />
                    <span><span className="f">{it.path}</span> {it.msg}</span></div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocCard({ f }: { f: PackFile }) {
  return (
    <div className="npc"><div className="nh"><span className="nm" style={{ fontSize: 14 }}>{f.path}</span></div>
      <div className="nb"><div className="prose" style={{ whiteSpace: "pre-wrap" }}>{f.content}</div></div></div>
  );
}
function Empty({ t }: { t: (k: string) => string }) {
  return <div className="vitem" style={{ padding: 20 }}><span>{t("build.empty")}</span></div>;
}
