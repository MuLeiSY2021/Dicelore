// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// HTTP 基建 + 诊断/自检：所有 feature api 共享的 fetch 错误翻译与 health/test 调用。

// 玩家动作请求(messages/roll/choices)失败时把 HTTP 状态译成可读中文错误。
// 409 是会话级互斥/状态冲突(turn_in_progress / no_pending_roll / no_pending_choice)——
// 给玩家可执行提示，不再让调用点静默吞（接 useSession 的 error 通道）。
export async function actionError(res: Response, what: string): Promise<Error> {
  let code = "";
  try { code = ((await res.json()) as { code?: string }).code ?? ""; } catch { /* 无 json 体 */ }
  if (res.status === 409) {
    switch (code) {
      case "turn_in_progress": return new Error("上一回合还在进行中，请等当前回合结束再操作。");
      case "no_pending_roll": return new Error("当前没有待掷的骰子（可能已掷过或回合已推进）。");
      case "no_pending_choice": return new Error("当前没有待选择的选项（可能已选过或回合已推进）。");
      case "no_snapshot": return new Error("本局还没有存档（跑完第一个回合后才会自动存档）。");
      default: return new Error(`${what}冲突：${code || res.status}`);
    }
  }
  return new Error(`${what}失败：${res.status}`);
}

// 通用写操作错误翻译(catalog/build 等非玩家动作)：把带 code 的 4xx 译成可读文案，
// 其余回显状态码。与 actionError(play 域 409 专用、码表硬编码)区分：此处不绑具体业务码，
// 但仍优先回显后端给的 code，避免调用点只拿到裸 status。
export async function apiError(res: Response, what: string): Promise<Error> {
  let code = "";
  try { code = ((await res.json()) as { code?: string }).code ?? ""; } catch { /* 无 json 体 */ }
  if (res.status >= 400 && res.status < 500 && code) return new Error(`${what}失败：${code}`);
  return new Error(`${what}失败：${res.status}`);
}

// ===== 诊断/自检(缝B 真值；配置页 + 顶栏运行态) =====
export interface HealthInfo {
  protocol: string; fakeGm: boolean; port: number;
  model: { gm: string; configured: boolean; baseUrl: string | null };
  mcp: { name: string; transport: string; toolCount: number; running: boolean };
  notify: { url: string | null; configured: boolean };
  storage: { sessionsDir: string; ftsMode: string };
}
export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch("/diagnostics/health");
  if (!res.ok) throw new Error(`health 请求失败：${res.status}`);
  return (await res.json()) as HealthInfo;
}
export interface TestResult { ok: boolean; status?: number; latencyMs?: number; message: string; fake?: boolean }
export async function testModel(input: { baseUrl: string; key: string; gm: string }): Promise<TestResult> {
  const res = await fetch("/diagnostics/model-test", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  // HTTP 4xx/5xx 时响应体不是 TestResult,不能当成功解析(否则把错误体伪装成结果)。
  if (!res.ok) throw new Error(`model-test 请求失败：${res.status}`);
  return (await res.json()) as TestResult;
}
export async function testMcp(input: { transport: string; endpoint: string }): Promise<TestResult> {
  const res = await fetch("/diagnostics/mcp-test", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  // 同上：非 2xx 抛带状态码的错误,不解析错误体。
  if (!res.ok) throw new Error(`mcp-test 请求失败：${res.status}`);
  return (await res.json()) as TestResult;
}
