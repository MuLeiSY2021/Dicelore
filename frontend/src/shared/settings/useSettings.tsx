// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 客户端配置持久化(localStorage)：模型连接 / 服务覆盖 / 启动行为。
// 与服务器真值(GET /diagnostics)互补——这里存「用户可改的偏好与覆盖」，服务器真值只读展示。
//
// 客制 MCP(marketplace 源 + 安装的 out-of-canon MCP)不再走 localStorage——
// 已迁到后端 config.toml 持久化(裁决 custom-mcp-install)，前端经 /mcp/* 端点读写(见 features/config/mcpApi)。

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type StartupBehavior = "home" | "last";

export interface ModelSettings {
  gm: string;        // GM 模型 id，如 claude-opus-4-8
  agent: string;     // Agent 底座(驱动 GM 的 agent 运行时)：harness(默认) / claude-agent(Claude Agent SDK)
  baseUrl: string;   // ANTHROPIC_BASE_URL 覆盖(空=走服务器 env)
  key: string;       // API key 覆盖(空=走服务器 env)
}
export interface Settings {
  model: ModelSettings;
  notifyUrl: string; // 服务与网络 notify 覆盖(空=走服务器 env)
  startup: StartupBehavior;
}

// 可选的真实模型清单(GM 模型下拉)。id 与 claude-api 对齐。
export const GM_MODELS: { id: string; label: string }[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (最强)" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (均衡)" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (快)" },
  { id: "claude-fable-5", label: "Claude Fable 5" },
];
// Agent 底座(驱动 GM 的运行时)。harness=自带 harness 驱动(默认)；claude-agent=Claude Agent SDK。
export const AGENTS: { id: string; label: string }[] = [
  { id: "harness", label: "Harness (默认)" },
  { id: "claude-agent", label: "Claude Agent SDK" },
];

const DEFAULTS: Settings = {
  model: { gm: "claude-opus-4-8", agent: "harness", baseUrl: "", key: "" },
  notifyUrl: "",
  startup: "home",
};

const STORAGE_KEY = "dicelore.settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        model: { ...DEFAULTS.model, ...parsed.model },
        notifyUrl: parsed.notifyUrl ?? "",
        startup: parsed.startup === "last" ? "last" : "home",
      };
    }
  } catch { /* ignore */ }
  return DEFAULTS;
}

interface SettingsCtx {
  settings: Settings;
  setModel: (patch: Partial<ModelSettings>) => void;
  setNotifyUrl: (v: string) => void;
  setStartup: (v: StartupBehavior) => void;
}
const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const persist = useCallback((next: Settings) => {
    setSettings(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const setModel = useCallback((patch: Partial<ModelSettings>) => persist({ ...settings, model: { ...settings.model, ...patch } }), [settings, persist]);
  const setNotifyUrl = useCallback((v: string) => persist({ ...settings, notifyUrl: v }), [settings, persist]);
  const setStartup = useCallback((v: StartupBehavior) => persist({ ...settings, startup: v }), [settings, persist]);

  return (
    <Ctx.Provider value={{ settings, setModel, setNotifyUrl, setStartup }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx);
  if (v) return v;
  // 无 provider 回退(隔离组件测试)：只读默认值，setter noop。
  const noop = () => { /* noop */ };
  return { settings: DEFAULTS, setModel: noop, setNotifyUrl: noop, setStartup: noop };
}
