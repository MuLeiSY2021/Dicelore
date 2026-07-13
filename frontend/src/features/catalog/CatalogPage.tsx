// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookMarked, Play, Pencil, Sparkles, Search, PackageOpen, PackageX,
  GitBranch, Trash2, UploadCloud, Check,
} from "lucide-react";
import { listCatalog, createPlaySession, commitPack, type AdventureSummary } from "@/features/catalog/api.js";
import "@/features/catalog/catalog.css";

// 团本名 → URL/文件名安全 slug(保留中文，去空格/分隔符)。会话 id 前缀团本名。
export function slug(name: string): string {
  return name.trim().replace(/[\s/\\·:]+/g, "-").replace(/-+/g, "-").slice(0, 24) || "team";
}

const SAMPLE_PACK = [
  { path: "manifest.md", content: "# 示例·黑风寨\n\n- id: sample" },
  { path: "prologue.md", content: "你是这局《黑风寨》的 GM。开场：旅人行至鹰愁涧口，暮色四合，寨门紧闭。请即兴铺陈第一幕。" },
  { path: "lore/黑风寨.md", content: "黑风寨盘踞鹰愁涧,当家钟三爷使子母钟锤。" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n旅人,player,HP,12,1\n旅人,player,身上银两,30,1\n" },
];

type ImpStep = "pick" | "validate" | "done";
interface Toast { msg: string; kind: "ok" | "warn" | "err" }

// 团本目录页(B3)：列 catalog → 「开始游戏」选版本 modal → 建 session → 进 Play；
// 顶栏搜索/题材筛选(客户端实时)；导入团本 modal(A4 validatePack 信任闸 UI)。
export default function CatalogPage() {
  const navigate = useNavigate();
  const [adventures, setAdventures] = useState<AdventureSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 顶栏筛选
  const [query, setQuery] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // 版本选择 modal
  const [verFor, setVerFor] = useState<AdventureSummary | null>(null);
  const [verSel, setVerSel] = useState<string | null>(null);

  // 导入 modal(A4 信任闸)
  const [impOpen, setImpOpen] = useState(false);
  const [impStep, setImpStep] = useState<ImpStep>("pick");
  const [impFile, setImpFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const flash = (msg: string, kind: Toast["kind"] = "ok") => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 2200);
  };

  const reload = () => listCatalog().then(setAdventures).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { reload(); }, []);

  const list = adventures ?? [];
  const allTags = useMemo(() => Array.from(new Set(list.flatMap((p) => p.tags))).sort(), [list]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      const mq = !q || p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
      const mf = !filterTag || p.tags.includes(filterTag);
      return mq && mf;
    });
  }, [list, query, filterTag]);

  function openVersion(p: AdventureSummary) {
    setVerFor(p);
    setVerSel(p.head ?? "草稿");
  }
  async function confirmStart() {
    if (!verFor) return;
    setBusy(verFor.id); setError(null);
    try {
      // version 省略=最新版 head；选了非 head 版本才显式带 version。
      const version = verSel && verSel !== verFor.head ? verSel : undefined;
      const sid = await createPlaySession(verFor.id, version);
      navigate(`/play/${encodeURIComponent(sid)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e)); setBusy(null);
    }
  }

  async function buildSample() {
    setBusy("sample"); setError(null);
    try { await commitPack("示例·黑风寨", "sample", SAMPLE_PACK); await reload(); flash("示例团本已生成", "ok"); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  function openImport() {
    setImpStep("pick"); setImpFile(null); setImpOpen(true);
  }
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setImpFile(f?.name ?? "团本包.zip");
    setImpStep("validate");
    // A4 信任闸 UI：静态校验日志(客户端不解 .zip)，短延迟后放行入库。
    window.setTimeout(() => setImpStep("done"), 500);
  }
  function confirmImport() {
    setImpOpen(false);
    flash("已导入团本（原型不真加）", "ok");
  }

  const stepCls = (k: ImpStep) => {
    const order: ImpStep[] = ["pick", "validate", "done"];
    if (k === impStep) return "step on";
    return order.indexOf(k) < order.indexOf(impStep) ? "step done" : "step";
  };
  const versions = verFor ? (verFor.head ? [verFor.head] : ["草稿"]) : [];

  return (
    <main className="catalog">
      <div className="tbar">
        <h3>团本目录</h3><span className="sp" />
        <span className="search">
          <Search className="lucide" />
          <input data-testid="catalog-search" placeholder="搜团本名 / 题材" value={query} onChange={(e) => setQuery(e.target.value)} />
        </span>
        <select className="filter" data-testid="catalog-filter" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
          <option value="">全部题材</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="btn" data-testid="catalog-import-btn" onClick={openImport}><PackageOpen className="lucide" />导入团本</span>
      </div>

      {error && <div className="herror">{error}</div>}

      {adventures === null ? (
        <div className="grid" data-testid="catalog-loading">
          <div className="skeleton sk-card" /><div className="skeleton sk-card" />
          <div className="skeleton sk-card" /><div className="skeleton sk-card" />
        </div>
      ) : list.length === 0 ? (
        <div className="empty" data-testid="catalog-empty">
          <PackageX className="lucide" />
          <div>还没有团本。<b>导入</b>一个团本，或去 <Link to="/build">制作</Link> 造一个。</div>
          <div className="e-btns">
            <span className="btn" data-testid="catalog-import-btn-empty" onClick={openImport}><PackageOpen className="lucide" />导入团本</span>
            <button className="btn go" data-testid="catalog-sample-btn" onClick={buildSample} disabled={busy === "sample"}>
              <Sparkles className="lucide" />{busy === "sample" ? "生成中…" : "造个示例团本"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid" data-testid="catalog-list">
          {shown.map((p) => (
            <div className="pack" data-testid="catalog-item" data-pack-id={p.id} key={p.id}>
              <div className="ph">
                <span className="av"><BookMarked className="lucide" /></span>
                <span className="nm">{p.name}</span>
                <span className="vtag">{p.head ? `head ${p.head}` : "草稿"}</span>
              </div>
              {p.tags.length > 0 && (
                <div className="metatags">{p.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
              )}
              <div className="foot">
                <span className="sp" />
                <span className="btn" data-testid="catalog-delete-btn" title="删除团本" onClick={() => flash(`已删除「${p.name}」（原型不真删）`, "warn")}>
                  <Trash2 className="lucide" />
                </span>
                <Link className="btn" to={`/build?id=${encodeURIComponent(p.id)}`} data-testid="catalog-edit-btn" title="编辑草稿（默认 head）">
                  <Pencil className="lucide" />编辑
                </Link>
                <span className="btn" data-testid="catalog-item-version" title="选版本" onClick={() => openVersion(p)}>
                  <GitBranch className="lucide" />{p.head ?? "草稿"}
                </span>
                <span className="btn go" data-testid="catalog-start-btn" onClick={() => openVersion(p)}>
                  <Play className="lucide" />开始游戏
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 选版本 modal(点开始游戏/版本入口弹出，默认选最新) */}
      {verFor && (
        <div className="modal" data-testid="catalog-version-modal" onClick={() => setVerFor(null)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <h3>开始游戏 · 选版本</h3>
            <p className="msub">
              <span data-testid="catalog-version-packname">{verFor.name}</span> · 默认使用最新版（head）。选个版本开局，点版本可展开看差异。
            </p>
            <div className="vlist" data-testid="catalog-version-list">
              {versions.map((v, i) => (
                <div
                  key={v}
                  className={"vopt" + (verSel === v ? " on" : "")}
                  data-testid="catalog-version-opt"
                  data-version={v}
                  onClick={() => setVerSel(v)}
                >
                  <div className="vrow">
                    <span className="vt">{v}</span>
                    {i === 0 && <span className="latest">最新 · 默认</span>}
                    <span className="vd">当前 head</span>
                  </div>
                  <div className="vchangelog">当前最新版本（head）——从此版本开局。</div>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <span className="btn" onClick={() => setVerFor(null)}>取消</span>
              <button className="btn go" data-testid="catalog-version-confirm" onClick={confirmStart} disabled={busy === verFor.id}>
                <Play className="lucide" />{busy === verFor.id ? "建会话中…" : "建会话并开局"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入流程 modal(A4 validatePack 信任闸 · 文件选择→校验→入库) */}
      {impOpen && (
        <div className="modal" data-testid="catalog-import-modal" onClick={() => setImpOpen(false)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <h3>导入团本</h3>
            <p className="msub">选择团本包（.zip），本地过 validatePack 信任闸后入目录。校验 error 阻断、warn 提示。</p>
            <div className="imp-steps">
              <span className={stepCls("pick")}>1 选文件</span>
              <span className={stepCls("validate")}>2 校验</span>
              <span className={stepCls("done")}>3 入库</span>
            </div>
            <div className="imp-drop" data-testid="catalog-import-drop" onClick={() => fileRef.current?.click()}>
              <UploadCloud className="lucide" />
              <span>拖拽团本包到此 / 点选文件</span>
              <span className="imp-sub">支持 .zip · 信任闸 validatePack</span>
            </div>
            <input
              ref={fileRef}
              className="imp-file"
              type="file"
              data-testid="catalog-import-file"
              accept=".zip,.tar.gz,application/zip"
              onChange={onPickFile}
            />
            <div className="imp-log" data-testid="catalog-import-log">
              {impStep === "pick" ? (
                <span className="dim">选择团本包（.zip）以过 validatePack 信任闸。</span>
              ) : (
                <>
                  {`> 读取 ${impFile ?? "团本包.zip"} …\n> 解析 manifest.toml …\n`}
                  <span className="ok">{"> ✓ name/version/flows 齐全\n"}</span>
                  <span className="ok">{"> ✓ prologue.md 存在\n"}</span>
                  <span className="warn">{"> ⚠ npc/哑婆.md 缺 sheet 卡（warn·不阻断）\n"}</span>
                  <span className="ok">{"> ✓ validatePack 通过：0 error / 1 warn"}</span>
                </>
              )}
            </div>
            <div className="modal-foot">
              <span className="btn" onClick={() => setImpOpen(false)}>取消</span>
              <button className="btn go" data-testid="catalog-import-confirm" onClick={confirmImport} disabled={impStep !== "done"}>
                <Check className="lucide" />确认入库
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-wrap"><div className={`toast in ${toast.kind}`}>{toast.msg}</div></div>
      )}
    </main>
  );
}
