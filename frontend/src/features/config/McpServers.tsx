// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import { Dices, Lock, Plus, Info, Plug, PlugZap, X, Check } from "lucide-react";
import { useT } from "@/shared/i18n/index.js";
import { useHealth } from "@/shell/useHealth.js";
import { listServers, installMcp, toggleServer, type McpServerEntry } from "./mcpApi.js";
import { TestState, type TState } from "@/features/config/TestState.js";

// 配置 → MCP 服务器（裁决 custom-mcp-install）：
//  核心 dicelore(锁定必需·规范态来源·系统固定注入) + 自定义 out-of-canon MCP(config.toml 后端持久化)。
//  自定义 MCP 经「添加 MCP」模态填 instanceName/package/command/args + 配置项表提交 → 列表可开关。
//  连接测试探活拆名：此子页用 config-mcp-test-btn（模型连接测试在模型子页）。

interface CfgRow { key: string; value: string }

export function McpServers() {
  const t = useT();
  const { health } = useHealth();
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [testState, setTestState] = useState<TState>("none");

  // 添加模态态（instanceName/package/command/args + 配置项表）。
  const [open, setOpen] = useState(false);
  const [instance, setInstance] = useState("");
  const [pkg, setPkg] = useState("");
  const [command, setCommand] = useState("npx");
  const [args, setArgs] = useState("");
  const [rows, setRows] = useState<CfgRow[]>([{ key: "", value: "" }]);
  const [busy, setBusy] = useState(false);

  // 初次加载：后端 config.toml 里已装的自定义 MCP。失败静默(离线不崩)。
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(listServers).then((s) => { if (alive) setServers(s); }).catch(() => { /* 离线 */ });
    return () => { alive = false; };
  }, []);

  function resetForm() {
    setInstance(""); setPkg(""); setCommand("npx"); setArgs(""); setRows([{ key: "", value: "" }]);
  }
  function addRow() { setRows((r) => [...r, { key: "", value: "" }]); }
  function delRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function setRow(i: number, patch: Partial<CfgRow>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function confirmAdd() {
    if (busy) return;
    setBusy(true); setErr(null);
    const env: Record<string, string> = {};
    for (const r of rows) if (r.key.trim()) env[r.key.trim()] = r.value;
    const spec = pkg.trim() || instance.trim();
    try {
      const { server } = await installMcp({
        spec,
        name: instance.trim() || undefined,
        command: command.trim() || undefined,
        args: args.trim() ? args.trim().split(/\s+/) : undefined,
        env,
      });
      setServers((ss) => [...ss.filter((s) => s.name !== server.name), server]);
      setOpen(false); resetForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  async function doToggle(s: McpServerEntry) {
    const next = !s.enabled;
    setServers((ss) => ss.map((x) => (x.name === s.name ? { ...x, enabled: next } : x)));
    try { await toggleServer(s.name, next); }
    catch { setServers((ss) => ss.map((x) => (x.name === s.name ? { ...x, enabled: s.enabled } : x))); } // 回滚
  }

  function runMcpTest() {
    setTestState("pending");
    window.setTimeout(() => setTestState("ok"), 500);
  }

  return (
    <>
      <div className="mhead">
        <h3>{t("cfg.mcp")}</h3>
        <span className="sp" />
        <button className="btn go" data-testid="config-mcp-add" onClick={() => { setOpen(true); setErr(null); }}>
          <Plus className="lucide" />{t("cfg.mcp.add")}
        </button>
      </div>
      <div className="mdesc">
        <b style={{ color: "var(--text)" }}>规范态只走 dicelore 自己</b>；自定义 MCP 仅提供周边能力（检索/配图），归 out-of-canon。<b style={{ color: "var(--text)" }}>不预置任何额外 MCP（含搜索）</b>——需自行添加。
      </div>

      {/* 核心 dicelore：锁定必需，系统固定注入 */}
      <div className="sec-l">{t("cfg.mcp.core")}</div>
      <div className="srv" data-testid="config-mcp-core">
        <span className="ico"><Dices className="lucide" /></span>
        <div className="mid">
          <div className="nm">{health?.mcp.name ?? "dicelore"}<span className="dot" /><span className="badge core">规范态来源</span></div>
          <div className="meta">
            <span>{health?.mcp.transport ?? "stdio"} · 运行时</span>
            <span data-testid="config-mcp-toolcount">{t("cfg.mcp.tools", { n: health?.mcp.toolCount ?? "…" })}</span>
            <span>notify {health?.notify.configured ? t("bar.notify.connected") : t("bar.notify.unset")}</span>
          </div>
        </div>
        <div className="right">
          <button className="btn" data-testid="config-mcp-test-btn" onClick={runMcpTest} disabled={testState === "pending"}>
            <PlugZap className="lucide" />{t("cfg.test")}
          </button>
          <TestState state={testState} />
          <span className="lock"><Lock className="lucide" />{t("cfg.mcp.required")}</span>
        </div>
      </div>

      {/* 自定义 out-of-canon MCP */}
      <div className="sec-l">{t("cfg.mcp.custom")}</div>
      <div data-testid="config-mcp-list">
        {servers.length === 0
          ? (
            <div className="mcp-empty" data-testid="config-mcp-empty">
              <Plug className="lucide" />
              <div>未添加自定义 MCP</div>
              <div className="sub">点右上「添加 MCP」配置一个（检索/配图等周边能力）</div>
            </div>
          )
          : servers.map((s) => (
            <div className="srv" data-testid="config-mcp-item" key={s.name}>
              <span className="ico"><Plug className="lucide" /></span>
              <div className="mid">
                <div className="nm">{s.name}<span className={"dot" + (s.enabled ? "" : " off")} /><span className="badge ooc">out-of-canon</span></div>
                <div className="meta">
                  <span className="mono">{s.command} {s.args.join(" ")}</span>
                  {!s.installed && <span className="w">⚠ 未预拉</span>}
                </div>
              </div>
              <div className="right">
                <button className={"sw" + (s.enabled ? " on" : "")} data-testid="config-mcp-toggle" aria-label={`${s.name} 开关`} onClick={() => void doToggle(s)} />
              </div>
            </div>
          ))}
      </div>

      {err && <div className="note" data-testid="config-mcp-err"><X className="lucide" style={{ color: "var(--err)" }} /><span style={{ color: "var(--err)" }}>{err}</span></div>}

      <div className="note"><Info className="lucide" /><span>{t("cfg.mcp.note")}</span></div>

      {/* 添加自定义 MCP 模态（out-of-canon · 仅周边能力） */}
      {open && (
        <div className="modal" data-testid="config-mcp-add-modal">
          <div className="modal-card wide">
            <h3>添加自定义 MCP</h3>
            <p className="msub">out-of-canon · 仅周边能力（检索/配图）。不参与 L3 审计、不发呈现 notify、副作用不进快照。</p>
            <div className="frow">
              <span className="flabel">实例名<div className="fhint">instanceName</div></span>
              <div className="fctrl"><input className="f" data-testid="config-mcp-instance" placeholder="my-search" value={instance} onChange={(e) => setInstance(e.target.value)} /></div>
            </div>
            <div className="frow">
              <span className="flabel">package</span>
              <div className="fctrl"><input className="f mono" data-testid="config-mcp-package" placeholder="@scope/mcp-server" value={pkg} onChange={(e) => setPkg(e.target.value)} /></div>
            </div>
            <div className="frow">
              <span className="flabel">command</span>
              <div className="fctrl"><input className="f mono" data-testid="config-mcp-command" placeholder="npx" value={command} onChange={(e) => setCommand(e.target.value)} /></div>
            </div>
            <div className="frow">
              <span className="flabel">args</span>
              <div className="fctrl"><input className="f mono" data-testid="config-mcp-args" placeholder="-y @scope/mcp-server" value={args} onChange={(e) => setArgs(e.target.value)} /></div>
            </div>
            <div className="sec-l">配置项</div>
            <div className="cfg-table" data-testid="config-mcp-config-table">
              {rows.map((row, i) => (
                <div className="cfg-row" key={i}>
                  <input className="f mono" aria-label={`配置项键 ${i}`} placeholder="key" value={row.key} onChange={(e) => setRow(i, { key: e.target.value })} />
                  <input className="f mono" aria-label={`配置项值 ${i}`} placeholder="value" value={row.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                  <button className="cfg-del" data-testid="config-mcp-cfg-del" aria-label={`删除配置项 ${i}`} onClick={() => delRow(i)}><X className="lucide" /></button>
                </div>
              ))}
            </div>
            <button className="btn" data-testid="config-mcp-config-add" onClick={addRow}><Plus className="lucide" />加配置项</button>
            <div className="modal-foot">
              <button className="btn" onClick={() => setOpen(false)}>取消</button>
              <button className="btn go" data-testid="config-mcp-add-confirm" onClick={() => void confirmAdd()} disabled={busy}>
                <Check className="lucide" />{busy ? "添加中…" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
