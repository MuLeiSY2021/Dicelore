// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState } from "react";
import { PlugZap, Eye, EyeOff, Shield, Info } from "lucide-react";
import { useT } from "@/shared/i18n/index.js";
import { useSettings, GM_MODELS, AGENTS } from "@/shared/settings/useSettings.js";
import { useHealth } from "@/shell/useHealth.js";
import { testModel } from "@/shared/api/http.js";
import { TestState, type TState } from "@/features/config/TestState.js";

// 配置 → 模型连接：哪个模型当 GM(经 Agent SDK) + Agent 底座 + baseURL/key(掩码·仅存本地) + 连接测试探活。
export function ModelConnection() {
  const t = useT();
  const { settings, setModel } = useSettings();
  const { health } = useHealth();
  const m = settings.model;
  const [showKey, setShowKey] = useState(false);
  const [state, setState] = useState<TState>("none");
  const [failMsg, setFailMsg] = useState<string | undefined>(undefined);

  async function runTest() {
    setState("pending"); setFailMsg(undefined);
    try {
      const r = await testModel({ baseUrl: m.baseUrl, key: m.key, gm: m.gm });
      if (r.ok) { setState("ok"); }
      else { setFailMsg(`失败 · ${r.status ?? ""} · ${r.message}`); setState("fail"); }
    } catch (e: unknown) {
      setFailMsg(e instanceof Error ? e.message : "请求失败");
      setState("fail");
    }
  }

  return (
    <>
      <div className="mhead"><h3>{t("cfg.model")}</h3></div>
      <div className="mdesc">哪个模型当 GM（经 Agent SDK）+ Agent 底座 + key。连接测试探活。</div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.model.gm")}</span>
          <div className="fctrl">
            <select className="f" data-testid="config-model-select" aria-label={t("cfg.model.gm")} value={m.gm} onChange={(e) => setModel({ gm: e.target.value })}>
              {GM_MODELS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.model.agent")}<div className="fhint">驱动 GM 的运行时</div></span>
          <div className="fctrl">
            <div className="seg" data-testid="config-agent-base" role="group" aria-label={t("cfg.model.agent")}>
              {AGENTS.map((x) => (
                <button key={x.id} className={m.agent === x.id ? "on" : ""} onClick={() => setModel({ agent: x.id })}>{x.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.model.key")}<div className="fhint">仅存本地</div></span>
          <div className="fctrl">
            <input className="f mono" style={{ flex: 1 }} data-testid="config-key-input" aria-label={t("cfg.model.key")}
              type={showKey ? "text" : "password"} placeholder={t("cfg.model.key.ph")}
              value={m.key} onChange={(e) => setModel({ key: e.target.value })} />
            <button className="btn" data-testid="config-key-toggle" aria-label={showKey ? t("cfg.model.hide") : t("cfg.model.show")} onClick={() => setShowKey((v) => !v)}>
              {showKey ? <EyeOff className="lucide" /> : <Eye className="lucide" />}
            </button>
            <span className="lock"><Shield className="lucide" />仅存本地·不上传</span>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.model.base")}</span>
          <div className="fctrl">
            <input className="f mono" style={{ flex: 1 }} data-testid="config-baseurl" aria-label={t("cfg.model.base")}
              placeholder={health?.model.baseUrl ?? "https://api.anthropic.com"}
              value={m.baseUrl} onChange={(e) => setModel({ baseUrl: e.target.value })} />
          </div>
        </div>
        <div className="frow">
          <span className="flabel">连接测试</span>
          <div className="fctrl">
            <button className="btn" data-testid="config-model-test-btn" onClick={() => void runTest()} disabled={state === "pending"}>
              <PlugZap className="lucide" />{t("cfg.test")}
            </button>
            <TestState state={state} failMsg={failMsg} />
          </div>
        </div>
        {health?.fakeGm && (
          <div className="note"><Info className="lucide" /><span>{t("cfg.model.fakehint")}</span></div>
        )}
      </div>
    </>
  );
}
