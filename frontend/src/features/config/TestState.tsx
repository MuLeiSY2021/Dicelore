// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 连接测试三态胶囊（model / mcp 子页共用）：none(未测)/pending/ok/fail。
// 四态全渲染，用 hidden 属性切换（非活动态 display:none → playwright 不可见）；
// none 默认可见（spec 在 mcp 子页断言 config-test-none 可见）。fail 文案接 error.code。
export type TState = "none" | "pending" | "ok" | "fail";

export function TestState({ state, failMsg }: { state: TState; failMsg?: string }) {
  return (
    <>
      <span className="tstate" data-testid="config-test-none" hidden={state !== "none"}>未测</span>
      <span className="tstate pending" data-testid="config-test-pending" hidden={state !== "pending"}>测试中…</span>
      <span className="tstate ok" data-testid="config-test-ok" hidden={state !== "ok"}>可达 · 探活 OK</span>
      <span className="tstate fail" data-testid="config-test-fail" hidden={state !== "fail"}>{failMsg ?? "失败"}</span>
    </>
  );
}
