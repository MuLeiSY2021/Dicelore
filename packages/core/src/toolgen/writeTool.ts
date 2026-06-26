// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";
import { DiceloreError } from "@dicelore/errors";
import { applyMutations } from "../store/mutate.js";
import type { StateKind } from "../store/state.js";
import { frontSetStatus, frontUpsert } from "../store/front.js";
import { plotlineSetStatus, plotlineUpsert } from "../store/plotline.js";
import { foreshadowSetStatus, foreshadowUpsert } from "../store/foreshadow.js";
import { matchWrite, type WritePlan } from "./writeMatch.js";

export interface WriteToolDecl {
  name: string;
  desc?: string;
  /** 参数声明: { paramName: "string" | "int" | "number" } */
  params?: Record<string, string>;
  sql: string;
  /**
   * 可选 state kind 标注（A1）。仅对 mutate 模式生效——编译时透传给 applyMutations，
   * 使 `npc_update` 等类型化写工具落 kind=npc 行（kind 由工具名携带，spec §4.1 方案 B）。
   * 非 mutate 模式（setStatus/insert）忽略此字段。
   */
  kind?: StateKind;
}

export interface WriteTool {
  name: string;
  desc: string;
  handler: (db: DB, args: Record<string, unknown>) => unknown;
}

/**
 * 将写 SQL 声明编译为写工具。
 * - 编译时 matchWrite(sql) 若匹配失败立即抛 BAD_INPUT
 * - handler 据 WritePlan.kind 调对应正典原语（永不裸跑写 SQL）
 */
export function compileWriteTool(decl: WriteToolDecl): WriteTool {
  // 编译时即解析（快速失败）
  const plan = matchWrite(decl.sql);

  const handler = (db: DB, args: Record<string, unknown>): unknown => {
    return executePlan(db, plan, args, decl.name, decl.kind);
  };

  return {
    name: decl.name,
    desc: decl.desc ?? "",
    handler,
  };
}

// ── Plan 执行 ─────────────────────────────────────────────────────────────────

function executePlan(
  db: DB,
  plan: WritePlan,
  args: Record<string, unknown>,
  toolName: string,
  kind: StateKind | undefined,
): unknown {
  switch (plan.kind) {
    case "mutate":
      return executeMutate(db, plan, args, toolName, kind);
    case "setStatus":
      return executeSetStatus(db, plan, args, toolName);
    case "insert":
      return executeInsert(db, plan, args, toolName);
  }
}

function getArg(args: Record<string, unknown>, key: string, toolName: string): unknown {
  if (!(key in args)) {
    throw new DiceloreError("BAD_INPUT", `writeTool "${toolName}": 缺少必要参数 "${key}"`);
  }
  return args[key];
}

function executeMutate(
  db: DB,
  plan: import("./writeMatch.js").MutatePlan,
  args: Record<string, unknown>,
  toolName: string,
  kind: StateKind | undefined,
): unknown {
  const entity = String(getArg(args, plan.entityParam, toolName));
  const mutations = plan.muts.map((m) => ({
    attr: m.attr,
    op: m.op,
    expr: resolveExpr(m.expr, args, toolName),
  }));
  return applyMutations(db, entity, mutations, kind ? { kind } : undefined);
}

function executeSetStatus(
  db: DB,
  plan: import("./writeMatch.js").SetStatusPlan,
  args: Record<string, unknown>,
  toolName: string,
): void {
  const id = String(getArg(args, plan.idParam, toolName));
  const status = String(getArg(args, plan.statusParam, toolName));
  switch (plan.table) {
    case "front":
      frontSetStatus(db, id, status);
      break;
    case "plotline":
      plotlineSetStatus(db, id, status);
      break;
    case "foreshadow":
      foreshadowSetStatus(db, id, status);
      break;
    default:
      throw new DiceloreError("BAD_INPUT", `writeTool: 未知叙事表 "${plan.table}"`);
  }
}

function executeInsert(
  db: DB,
  plan: import("./writeMatch.js").InsertPlan,
  args: Record<string, unknown>,
  toolName: string,
): void {
  // 从 cols/valParams+args 构建对象，调对应的 *Upsert
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < plan.cols.length; i++) {
    const col = plan.cols[i];
    const paramName = plan.valParams[i];
    obj[col] = getArg(args, paramName, toolName);
  }

  switch (plan.table) {
    case "front":
      frontUpsert(db, obj as Parameters<typeof frontUpsert>[1]);
      break;
    case "plotline":
      plotlineUpsert(db, obj as Parameters<typeof plotlineUpsert>[1]);
      break;
    case "foreshadow":
      foreshadowUpsert(db, obj as Parameters<typeof foreshadowUpsert>[1]);
      break;
    default:
      throw new DiceloreError("BAD_INPUT", `writeTool: 未知叙事表 "${plan.table}"`);
  }
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 将 expr 中的 :param 占位替换为 args 中的实际值（字符串化）。
 * 例: ":price" + {price:30} → "30"
 */
function resolveExpr(
  expr: string,
  args: Record<string, unknown>,
  toolName: string,
): string {
  return expr.replace(/:(\w+)/g, (_match, name) => {
    if (!(name in args)) {
      throw new DiceloreError("BAD_INPUT", `writeTool "${toolName}": expr 引用了未提供的参数 ":${name}"`);
    }
    return String(args[name]);
  });
}
