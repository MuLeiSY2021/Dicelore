// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import { Dices, Server, Lock, Plus, Info, Plug, Trash2, Check, X, Store, Download, PackagePlus } from "lucide-react";
import { useT } from "@/shared/i18n/index.js";
import { useHealth } from "@/shell/useHealth.js";
import {
  addMarketplace,
  listMarketplaces,
  installMcp,
  listServers,
  toggleServer,
  deleteServer,
  testServer,
  type MarketplaceEntry,
  type ManifestMcp,
  type McpServerEntry,
  type TestResult,
} from "./mcpApi.js";

// 配置 → MCP 服务器（裁决 custom-mcp-install）：
//  核心 dicelore(锁定必需·系统固定注入) + 客制 out-of-canon MCP(config.toml 后端持久化)。
//  两按钮：① 添加 marketplace(Git 源拉清单) ② 安装(marketplace 选装 或 直装 npm 包·后端 npx -y 预拉)。
//  客制 MCP：安装表单(command/args 推导 + envSchema 配置项 table) + 开关 + out-of-canon 徽 + 连接测试。

interface EnvRow { key: string; value: string; required?: boolean }
interface InstallForm {
  spec: string;
  name: string;
  command: string;
  args: string;              // 空格分隔，提交时 split
  env: EnvRow[];
  fromMarketplace?: string;  // marketplace 装时置位（提交只发 spec+env）
}

/** 直装 `<pkg>@<version>` 推导默认实例名（去 scope / 去版本），镜像后端 deriveInstanceName。 */
function deriveInstanceName(pkg: string): string {
  let base = pkg;
  const at = pkg.lastIndexOf("@");
  if (at > 0) base = pkg.slice(0, at);
  const slash = base.lastIndexOf("/");
  if (slash >= 0) base = base.slice(slash + 1);
  return base || "mcp";
}

export function McpServers() {
  const t = useT();
  const { health } = useHealth();

  const [marketplaces, setMarketplaces] = useState<MarketplaceEntry[]>([]);
  const [marketMcps, setMarketMcps] = useState<Record<string, ManifestMcp[]>>({});
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [marketSrc, setMarketSrc] = useState("");
  const [installSpec, setInstallSpec] = useState("");
  const [form, setForm] = useState<InstallForm | null>(null);
  const [busy, setBusy] = useState<"" | "market" | "install">("");
  const [err, setErr] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult | "pending">>({});

  // 初次加载：后端 config.toml 里已注册的源 + 已装 MCP。失败静默(离线不崩)。
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(listMarketplaces).then((m) => { if (alive) setMarketplaces(m); }).catch(() => { /* 离线 */ });
    Promise.resolve().then(listServers).then((s) => { if (alive) setServers(s); }).catch(() => { /* 离线 */ });
    return () => { alive = false; };
  }, []);

  async function doAddMarketplace() {
    const src = marketSrc.trim();
    if (!src || busy) return;
    setBusy("market"); setErr(null);
    try {
      const { marketplace, mcps } = await addMarketplace(src);
      setMarketplaces((ms) => [...ms.filter((m) => m.name !== marketplace.name), marketplace]);
      setMarketMcps((mm) => ({ ...mm, [marketplace.name]: mcps }));
      setMarketSrc("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "添加 marketplace 失败");
    } finally {
      setBusy("");
    }
  }

  // 打开安装表单：marketplace 装(带清单 mcp 预填 command/args/envSchema) 或直装(推导 npx -y)。
  function openForm(spec: string, mcp?: ManifestMcp, fromMarketplace?: string) {
    if (mcp) {
      setForm({
        spec,
        name: mcp.name,
        command: mcp.command,
        args: mcp.args.join(" "),
        env: mcp.envSchema.map((s) => ({ key: s.key, value: "", required: s.required })),
        fromMarketplace,
      });
    } else {
      setForm({
        spec,
        name: deriveInstanceName(spec),
        command: "npx",
        args: `-y ${spec}`,
        env: [],
      });
    }
    setErr(null);
  }

  // 点「安装」按钮：spec 尾 @<x> 若匹配已装 marketplace 的某 MCP → 预填清单；否则直装。
  function beginInstall() {
    const spec = installSpec.trim();
    if (!spec) return;
    const at = spec.lastIndexOf("@");
    const tail = at > 0 ? spec.slice(at + 1) : "";
    const mcpName = at > 0 ? spec.slice(0, at) : spec;
    if (tail && marketMcps[tail]) {
      const mcp = marketMcps[tail].find((m) => m.name === mcpName);
      if (mcp) { openForm(spec, mcp, tail); return; }
    }
    openForm(spec);
  }

  function setEnvRow(i: number, patch: Partial<EnvRow>) {
    setForm((f) => (f ? { ...f, env: f.env.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) } : f));
  }
  function addEnvRow() {
    setForm((f) => (f ? { ...f, env: [...f.env, { key: "", value: "" }] } : f));
  }
  function delEnvRow(i: number) {
    setForm((f) => (f ? { ...f, env: f.env.filter((_, idx) => idx !== i) } : f));
  }

  async function confirmInstall() {
    if (!form || busy) return;
    setBusy("install"); setErr(null);
    const env: Record<string, string> = {};
    for (const r of form.env) if (r.key.trim()) env[r.key.trim()] = r.value;
    try {
      const body = form.fromMarketplace
        ? { spec: form.spec, name: form.name.trim() || undefined, env }
        : { spec: form.spec, name: form.name.trim() || undefined, command: form.command.trim() || undefined, args: form.args.trim() ? form.args.trim().split(/\s+/) : undefined, env };
      const { server } = await installMcp(body);
      setServers((ss) => [...ss.filter((s) => s.name !== server.name), server]);
      setForm(null);
      setInstallSpec("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "安装失败");
    } finally {
      setBusy("");
    }
  }

  async function doToggle(s: McpServerEntry) {
    const next = !s.enabled;
    setServers((ss) => ss.map((x) => (x.name === s.name ? { ...x, enabled: next } : x)));
    try {
      await toggleServer(s.name, next);
    } catch {
      setServers((ss) => ss.map((x) => (x.name === s.name ? { ...x, enabled: s.enabled } : x))); // 回滚
    }
  }

  async function doDelete(name: string) {
    try {
      await deleteServer(name);
      setServers((ss) => ss.filter((s) => s.name !== name));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "删除失败");
    }
  }

  async function runTest(s: McpServerEntry) {
    setTests((m) => ({ ...m, [s.name]: "pending" }));
    try {
      const r = await testServer(s);
      setTests((m) => ({ ...m, [s.name]: r }));
    } catch (e) {
      setTests((m) => ({ ...m, [s.name]: { ok: false, message: e instanceof Error ? e.message : "失败" } }));
    }
  }

  return (
    <>
      <div className="mhead">
        <h3>{t("cfg.mcp")}</h3>
        <span className="sp" />
      </div>
      <div className="mdesc">
        GM 可调用的工具来源。<b style={{ color: "var(--text)" }}>规范态(人物卡 / 事件 / 世界 / 裁决)只走 dicelore 自己</b>；自定义 MCP 仅提供周边能力(检索 / 配图 / 氛围)，产出作叙述流回，归 out-of-canon。<b style={{ color: "var(--text)" }}>不预置任何额外 MCP(含搜索)</b>——需自行添加。
      </div>

      {/* 核心 dicelore：锁定必需，系统固定注入，不进 config.toml */}
      <div className="sec-l">{t("cfg.mcp.core")}</div>
      <div className="srv" data-testid="config-mcp-core">
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

      {/* 按钮①：添加 marketplace（输入框 + 点击执行） */}
      <div className="sec-l">Marketplace 源</div>
      <div className="mcp-form">
        <div className="ff">
          <input
            className="f mono"
            aria-label="添加 marketplace"
            placeholder="owner/repo[@ref] 或清单 URL"
            value={marketSrc}
            onChange={(e) => setMarketSrc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void doAddMarketplace(); }}
          />
          <button className="btn go" data-testid="config-mcp-market-add" onClick={() => void doAddMarketplace()} disabled={busy === "market"}>
            <Store className="lucide" />{busy === "market" ? "添加中…" : "添加 marketplace"}
          </button>
        </div>
      </div>

      {marketplaces.length === 0
        ? <div className="note"><Info className="lucide" /><span>尚未添加 marketplace 源。填 GitHub <code>owner/repo</code> 或清单 URL 拉取可安装 MCP 列表。</span></div>
        : marketplaces.map((m) => (
            <div className="srv" data-testid="config-mcp-market" key={m.name}>
              <span className="ico"><Store className="lucide" /></span>
              <div className="mid">
                <div className="nm">{m.name}</div>
                <div className="meta">
                  <span>{m.source}</span>
                  {m.repo && <span className="mono">{m.repo}{m.ref ? `@${m.ref}` : ""}</span>}
                  {m.url && <span className="mono" style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{m.url}</span>}
                </div>
                {(marketMcps[m.name] ?? []).length > 0 && (
                  <div className="meta" style={{ flexDirection: "column", gap: 4, marginTop: 6 }}>
                    {(marketMcps[m.name] ?? []).map((mcp) => (
                      <span key={mcp.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <b style={{ color: "var(--text)" }}>{mcp.name}</b>
                        {mcp.description && <span>{mcp.description}</span>}
                        <button className="btn test" data-testid="config-mcp-market-install" onClick={() => openForm(`${mcp.name}@${m.name}`, mcp, m.name)}>
                          <Download className="lucide" />安装
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

      {/* 按钮②：安装（输入框 + 点击执行） */}
      <div className="sec-l">安装</div>
      <div className="mcp-form">
        <div className="ff">
          <input
            className="f mono"
            aria-label="安装"
            placeholder="<mcp>@<marketplace> 或 <pkg>@<version>"
            value={installSpec}
            onChange={(e) => setInstallSpec(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") beginInstall(); }}
          />
          <button className="btn go" data-testid="config-mcp-install" onClick={beginInstall}>
            <PackagePlus className="lucide" />安装
          </button>
        </div>
      </div>

      {/* 安装表单：command/args 推导 + envSchema 配置项 table */}
      {form && (
        <div className="mcp-form" data-testid="config-mcp-form">
          <div className="ff">
            <label style={{ width: 96, flex: "none", color: "var(--text2)", fontSize: 12 }}>实例名</label>
            <input className="f" aria-label="实例名" placeholder="my-search" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="ff">
            <label style={{ width: 96, flex: "none", color: "var(--text2)", fontSize: 12 }}>command</label>
            <input className="f mono" aria-label="command" value={form.command} disabled={!!form.fromMarketplace} onChange={(e) => setForm({ ...form, command: e.target.value })} />
          </div>
          <div className="ff">
            <label style={{ width: 96, flex: "none", color: "var(--text2)", fontSize: 12 }}>args</label>
            <input className="f mono" aria-label="args" value={form.args} disabled={!!form.fromMarketplace} onChange={(e) => setForm({ ...form, args: e.target.value })} />
          </div>

          <div className="sec-l" style={{ margin: "6px 0 2px" }}>配置项(环境变量)</div>
          <div className="cfg-table" data-testid="config-mcp-config-table">
            {form.env.map((row, i) => (
              <div className="cfg-row" key={i}>
                <input className="f mono" aria-label={`配置项键 ${i}`} placeholder="KEY" value={row.key} readOnly={!!form.fromMarketplace && !!row.required} onChange={(e) => setEnvRow(i, { key: e.target.value })} style={{ flex: 1 }} />
                <input className="f mono" aria-label={`配置项值 ${i}`} placeholder={row.required ? "必填" : "value"} value={row.value} onChange={(e) => setEnvRow(i, { value: e.target.value })} style={{ flex: 1 }} />
                <button className="del" aria-label={`删除配置项 ${i}`} data-testid="config-mcp-cfg-del" onClick={() => delEnvRow(i)}><X className="lucide" /></button>
              </div>
            ))}
          </div>
          <div className="ff">
            <button className="btn" data-testid="config-mcp-config-add" onClick={addEnvRow}><Plus className="lucide" />加配置项</button>
            <span className="sp" style={{ flex: 1 }} />
            <button className="btn go" data-testid="config-mcp-form-confirm" onClick={() => void confirmInstall()} disabled={busy === "install"}>
              <Check className="lucide" />{busy === "install" ? "安装中…" : "确认安装"}
            </button>
            <button className="btn" onClick={() => setForm(null)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {err && <div className="note" data-testid="config-mcp-err"><X className="lucide" style={{ color: "var(--err)" }} /><span style={{ color: "var(--err)" }}>{err}</span></div>}

      {/* 已装客制 MCP */}
      <div className="sec-l">{t("cfg.mcp.custom")}</div>
      {servers.length === 0
        ? <div className="note" data-testid="config-mcp-empty"><Info className="lucide" /><span>未安装任何自定义 MCP。先添加 marketplace 或直接安装 npm 包。</span></div>
        : servers.map((s) => {
            const tr = tests[s.name];
            return (
              <div className="srv" data-testid="config-mcp-item" key={s.name}>
                <span className="ico"><Server className="lucide" /></span>
                <div className="mid">
                  <div className="nm">{s.name}<span className={"dot" + (s.enabled ? "" : " off")} /><span className="badge ooc">out-of-canon</span></div>
                  <div className="meta">
                    <span className="mono">{s.command} {s.args.join(" ")}</span>
                    {s.fromMarketplace && <span>← {s.fromMarketplace}</span>}
                    {!s.installed && <span className="w">未预拉</span>}
                    {tr && tr !== "pending" && (
                      <span className={tr.ok ? "" : "w"}>
                        {tr.ok ? <Check className="lucide" style={{ width: 12 }} /> : <X className="lucide" style={{ width: 12 }} />} {tr.message}
                        {tr.ok && typeof tr.toolCount === "number" ? ` · ${tr.toolCount} 工具` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="right">
                  <button className="btn test" data-testid="config-mcp-test-btn" onClick={() => void runTest(s)} disabled={tr === "pending"}>
                    <Plug className="lucide" />{tr === "pending" ? t("cfg.testing") : t("cfg.test")}
                  </button>
                  <button className={"sw" + (s.enabled ? " on" : "")} data-testid="config-mcp-toggle" aria-label={`${s.name} 开关`} onClick={() => void doToggle(s)} />
                  <button className="del" aria-label={`${t("cfg.mcp.del")} ${s.name}`} onClick={() => void doDelete(s.name)}><Trash2 className="lucide" /></button>
                </div>
              </div>
            );
          })}

      <div className="note"><Info className="lucide" /><span>{t("cfg.mcp.note")}</span></div>
    </>
  );
}
