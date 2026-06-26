// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState } from "react";
import { Dices, Globe, Server, Lock, ShieldCheck, Plus, Info, Plug, Trash2, Check, X } from "lucide-react";
import { useT } from "../i18n/index.js";
import { useHealth } from "../shell/useHealth.js";
import { useSettings, type McpTransport } from "../settings/useSettings.js";
import { testMcp, type TestResult } from "../api/client.js";

// 配置 → MCP 服务器：核心 dicelore(真实工具数/锁定必需) + 自定义 out-of-canon(增删改/开关/授权/连接测试，持久化)。
export function McpServers() {
  const t = useT();
  const { health } = useHealth();
  const { settings, addMcp, updateMcp, removeMcp } = useSettings();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ name: string; transport: McpTransport; endpoint: string }>({ name: "", transport: "sse", endpoint: "" });
  const [tests, setTests] = useState<Record<string, TestResult | "pending">>({});

  async function runTest(id: string, transport: string, endpoint: string) {
    setTests((s) => ({ ...s, [id]: "pending" }));
    try {
      const r = await testMcp({ transport, endpoint });
      setTests((s) => ({ ...s, [id]: r }));
    } catch (e: unknown) {
      setTests((s) => ({ ...s, [id]: { ok: false, message: e instanceof Error ? e.message : "失败" } }));
    }
  }

  function submitAdd() {
    if (!draft.name.trim() || !draft.endpoint.trim()) return;
    addMcp({ name: draft.name.trim(), transport: draft.transport, endpoint: draft.endpoint.trim(), enabled: true, authorized: draft.transport === "stdio" });
    setDraft({ name: "", transport: "sse", endpoint: "" });
    setAdding(false);
  }

  return (
    <>
      <div className="mhead">
        <h3>{t("cfg.mcp")}</h3>
        <span className="sp" />
        <button className="add" onClick={() => setAdding((v) => !v)}><Plus className="lucide" />{t("cfg.mcp.add")}</button>
      </div>
      <div className="mdesc">
        GM 可调用的工具来源。<b style={{ color: "var(--text)" }}>规范态(人物卡 / 事件 / 世界 / 裁决)只走 dicelore 自己</b>；自定义 MCP 仅提供周边能力(检索 / 配图 / 氛围)，产出作叙述流回，归 out-of-canon。
      </div>

      <div className="sec-l">{t("cfg.mcp.core")}</div>
      <div className="srv">
        <span className="ico"><Dices className="lucide" /></span>
        <div className="mid">
          <div className="nm">{health?.mcp.name ?? "dicelore"}<span className="dot" /><span className="badge core">规范态来源</span></div>
          <div className="meta">
            <span>{health?.mcp.transport ?? "in-process"} · 运行时</span>
            <span>{t("cfg.mcp.tools", { n: health?.mcp.toolCount ?? "…" })}</span>
            <span>notify {health?.notify.configured ? `${t("bar.notify.connected")} · ${health?.notify.url ?? ""}` : t("bar.notify.unset")}</span>
          </div>
        </div>
        <div className="right"><span className="lock"><Lock className="lucide" />{t("cfg.mcp.required")}</span></div>
      </div>

      <div className="sec-l">{t("cfg.mcp.custom")}</div>

      {adding && (
        <div className="mcp-form">
          <div className="ff">
            <input className="f" aria-label={t("cfg.mcp.name.ph")} placeholder={t("cfg.mcp.name.ph")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <select className="f" aria-label={t("cfg.mcp.transport")} value={draft.transport} onChange={(e) => setDraft({ ...draft, transport: e.target.value as McpTransport })}>
              <option value="sse">远程 SSE</option>
              <option value="stdio">本地 stdio</option>
            </select>
          </div>
          <div className="ff">
            <input className="f mono" aria-label="endpoint" placeholder={draft.transport === "sse" ? t("cfg.mcp.url.ph") : t("cfg.mcp.cmd.ph")} value={draft.endpoint} onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })} />
            <button className="btn go" onClick={submitAdd}>{t("common.confirm")}</button>
            <button className="btn" onClick={() => setAdding(false)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {settings.mcpServers.length === 0 && !adding && (
        <div className="note"><Info className="lucide" /><span>{t("cfg.mcp.note")}</span></div>
      )}

      {settings.mcpServers.map((s) => {
        const tr = tests[s.id];
        const remote = s.transport === "sse";
        return (
          <div className="srv" key={s.id}>
            <span className="ico">{remote ? <Globe className="lucide" /> : <Server className="lucide" />}</span>
            <div className="mid">
              <div className="nm">{s.name}<span className={"dot" + (s.enabled ? "" : " off")} /><span className="badge ooc">out-of-canon</span></div>
              <div className="meta">
                <span>{remote ? "远程 SSE" : "本地 stdio"}</span>
                <span className="mono" style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{s.endpoint}</span>
                {remote && <span className="w">{t("cfg.mcp.warn")}</span>}
                {tr && tr !== "pending" && <span className={tr.ok ? "" : "w"}>{tr.ok ? <Check className="lucide" style={{ width: 12 }} /> : <X className="lucide" style={{ width: 12 }} />} {tr.message}</span>}
              </div>
            </div>
            <div className="right">
              <button className="btn test" onClick={() => runTest(s.id, s.transport, s.endpoint)} disabled={tr === "pending"}>
                <Plug className="lucide" />{tr === "pending" ? t("cfg.testing") : t("cfg.test")}
              </button>
              {remote && (
                s.authorized
                  ? <span className="perm"><ShieldCheck className="lucide" />{t("cfg.mcp.authorized")}</span>
                  : <button className="btn" onClick={() => updateMcp(s.id, { authorized: true })}>{t("cfg.mcp.authorize")}</button>
              )}
              <button className={"sw" + (s.enabled ? " on" : "")} aria-label={`${s.name} 开关`} onClick={() => updateMcp(s.id, { enabled: !s.enabled })} />
              <button className="del" aria-label={`${t("cfg.mcp.del")} ${s.name}`} onClick={() => removeMcp(s.id)}><Trash2 className="lucide" /></button>
            </div>
          </div>
        );
      })}
    </>
  );
}
