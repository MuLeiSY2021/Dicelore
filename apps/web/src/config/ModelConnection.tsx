// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState } from "react";
import { Check, X, Plug, Eye, EyeOff, Info } from "lucide-react";
import { useT } from "../i18n/index.js";
import { useSettings, GM_MODELS, AGENTS } from "../settings/useSettings.js";
import { useHealth } from "../shell/useHealth.js";
import { testModel, type TestResult } from "../api/client.js";

// 配置 → 模型连接：GM 模型/agent 下拉(真实清单) + baseURL/key(掩码持久化) + 连接测试(真测通断)。
export function ModelConnection() {
  const t = useT();
  const { settings, setModel } = useSettings();
  const { health } = useHealth();
  const m = settings.model;
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    setTesting(true); setResult(null);
    try {
      setResult(await testModel({ baseUrl: m.baseUrl, key: m.key, gm: m.gm }));
    } catch (e: unknown) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "请求失败" });
    } finally { setTesting(false); }
  }

  return (
    <>
      <div className="mhead"><h3>{t("cfg.model")}</h3></div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.model.gm")}</span>
          <div className="fctrl">
            <select className="f" aria-label={t("cfg.model.gm")} value={m.gm} onChange={(e) => setModel({ gm: e.target.value })}>
              {GM_MODELS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.model.agent")}</span>
          <div className="fctrl">
            <select className="f" aria-label={t("cfg.model.agent")} value={m.agent} onChange={(e) => setModel({ agent: e.target.value })}>
              {AGENTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <span className="fhint">{t("cfg.model.agent.hint")}</span>
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.model.base")}</span>
          <div className="fctrl">
            <input className="f mono" aria-label={t("cfg.model.base")} placeholder={health?.model.baseUrl ?? "https://api.anthropic.com"}
              value={m.baseUrl} onChange={(e) => setModel({ baseUrl: e.target.value })} />
          </div>
        </div>
        <div className="frow">
          <span className="flabel">{t("cfg.model.key")}</span>
          <div className="fctrl">
            <input className="f mono" aria-label={t("cfg.model.key")} type={showKey ? "text" : "password"}
              placeholder={t("cfg.model.key.ph")} value={m.key} onChange={(e) => setModel({ key: e.target.value })} />
            <button className="btn" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? t("cfg.model.hide") : t("cfg.model.show")}>
              {showKey ? <EyeOff className="lucide" /> : <Eye className="lucide" />}{showKey ? t("cfg.model.hide") : t("cfg.model.show")}
            </button>
          </div>
        </div>
        <div className="frow">
          <span className="flabel" />
          <div className="fctrl">
            <button className="btn go" onClick={runTest} disabled={testing}>
              <Plug className="lucide" />{testing ? t("cfg.testing") : t("cfg.test")}
            </button>
            {result && (
              <span className={"tres " + (result.ok ? "ok" : "err")} role="status">
                {result.ok ? <Check className="lucide" /> : <X className="lucide" />}
                {(result.ok ? t("cfg.test.ok") : t("cfg.test.fail"))} · {result.message}
                {result.latencyMs != null ? ` (${result.latencyMs}ms)` : ""}
              </span>
            )}
          </div>
        </div>
        {health?.fakeGm && (
          <div className="note"><Info className="lucide" /><span>{t("cfg.model.fakehint")}</span></div>
        )}
      </div>
    </>
  );
}
