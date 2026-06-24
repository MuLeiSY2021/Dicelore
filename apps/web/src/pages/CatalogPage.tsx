// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookMarked, Play, Pencil, Hammer, Sparkles } from "lucide-react";
import { listCatalog, openPlaySession, commitPack, type TuanbenSummary } from "../api/client.js";
import { useT } from "../i18n/index.js";

// 团本名 → URL/文件名安全 slug(保留中文，去空格/分隔符)。会话 id 前缀团本名。
function slug(name: string): string {
  return name.trim().replace(/[\s/\\·:]+/g, "-").replace(/-+/g, "-").slice(0, 24) || "team";
}

const SAMPLE_PACK = [
  { path: "manifest.md", content: "# 示例·黑风寨\n\n- id: sample" },
  { path: "lore/黑风寨.md", content: "黑风寨盘踞鹰愁涧,当家钟三爷使子母钟锤。" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n旅人,player,HP,12,1\n旅人,player,身上银两,30,1\n" },
];

// 团本目录页(新「团本」)：列 catalog → 选一个「开始游戏」→ 建 session + import → 进 Play(开场层)。
export default function CatalogPage() {
  const t = useT();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<TuanbenSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => listCatalog().then(setPacks).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { reload(); }, []);

  async function start(p: TuanbenSummary) {
    setBusy(p.id); setError(null);
    try {
      const ref = p.head ?? "head";
      // 每次点击 = 新开一局：sid 前缀团本 slug + 唯一后缀(同团本可并存多局，由 Play 会话栏切换/删除)。
      const sid = `${slug(p.name)}-${Math.random().toString(36).slice(2, 8)}`;
      await openPlaySession(sid, p.id, ref);
      navigate(`/play/${encodeURIComponent(sid)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e)); setBusy(null);
    }
  }
  async function buildSample() {
    setBusy("sample"); setError(null);
    try { await commitPack("示例·黑风寨", "sample", SAMPLE_PACK); await reload(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const list = packs ?? [];
  return (
    <main className="catalog">
      <div className="chead">
        <h2><BookMarked className="lucide" />{t("catalog.title")}</h2>
        <p className="csub">{t("catalog.sub")}</p>
      </div>
      {error && <div className="herror">{error}</div>}

      {packs !== null && list.length === 0 ? (
        <div className="cempty">
          <BookMarked className="lucide" />
          <div className="et">{t("catalog.empty.title")}</div>
          <div className="es">{t("catalog.empty.sub")}</div>
          <div className="ea">
            <Link className="btn go" to="/build"><Hammer className="lucide" />{t("catalog.empty.build")}</Link>
            <button className="btn" onClick={buildSample} disabled={busy === "sample"}><Sparkles className="lucide" />{busy === "sample" ? t("catalog.starting") : t("catalog.empty.sample")}</button>
          </div>
        </div>
      ) : (
        <div className="cgrid">
          {list.map((p) => (
            <div className="ccard" key={p.id}>
              <div className="cc-ico"><BookMarked className="lucide" /></div>
              <div className="cc-name">{p.name}</div>
              <div className="cc-meta">{p.tags.length > 0 ? p.tags.join(" · ") : t("catalog.versions", { n: p.head ? 1 : 0 })}</div>
              <div className="cc-act">
                <button className="btn go" data-testid={`start-${p.id}`} onClick={() => start(p)} disabled={busy === p.id}>
                  <Play className="lucide" />{busy === p.id ? t("catalog.starting") : t("catalog.start")}
                </button>
                <Link className="btn" to="/build"><Pencil className="lucide" />{t("catalog.edit")}</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
