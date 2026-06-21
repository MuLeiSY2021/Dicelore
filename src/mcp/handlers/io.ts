// src/mcp/handlers/io.ts
import type { DB } from "../../store/db.js";
import { sheetShow, worldShow, revealOnce } from "../../store/visibility.js";
import { worldDocGet } from "../../store/world.js";
import { eventAppend } from "../../store/event.js";
import { metaSet } from "../../session/resolve.js";
import { DiceloreError } from "../../errors.js";
import type { ToolDef } from "../tooldef.js";
import {
  sheetShowIn, sheetShowOut,
  worldShowIn, worldShowOut,
  revealOnceIn, revealOnceOut,
  narrateIn, narrateOut,
  gameEndIn, gameEndOut,
} from "../schemas/io.js";

function sheetShowHandler(db: DB, input: { entity: string; attrs?: string[]; recursive?: boolean }) {
  if (input.attrs && input.attrs.length > 0) {
    for (const attr of input.attrs) sheetShow(db, input.entity, attr);
    return { shown: input.attrs, ok: true as const };
  }
  // recursive=true or no attrs → write __show_all
  if (!input.recursive) {
    throw new DiceloreError("INTERNAL", "sheet_show: 需给 attrs 或 recursive=true");
  }
  sheetShow(db, input.entity); // entity 级:写 __show_all
  return { shown: ["__show_all"], ok: true as const };
}

function worldShowHandler(db: DB, input: { doc?: string; pool_rowid?: number }) {
  if ((input.doc === undefined) === (input.pool_rowid === undefined)) {
    throw new DiceloreError("INTERNAL", "world_show: doc 与 pool_rowid 二选一");
  }
  if (input.doc !== undefined) {
    const d = worldDocGet(db, input.doc);
    if (!d) throw new DiceloreError("NOT_FOUND", `world_show: doc 不存在 "${input.doc}"`);
    worldShow(db, "world_doc", d.rowid);
  } else {
    worldShow(db, "world_pool", input.pool_rowid!);
  }
  return { ok: true as const };
}

function revealOnceHandler(db: DB, input: { sheet?: { entity: string; attr: string }; world?: { rowid: number } }) {
  if ((input.sheet === undefined) === (input.world === undefined)) {
    throw new DiceloreError("INTERNAL", "reveal_once: sheet 与 world 二选一");
  }
  const event_id = input.sheet
    ? revealOnce(db, { kind: "sheet", entity: input.sheet.entity, attr: input.sheet.attr })
    : revealOnce(db, { kind: "world_doc", rowid: input.world!.rowid });
  return { event_id };
}

function narrateHandler(db: DB, input: { text: string; tags?: string[] }) {
  const event_id = eventAppend(db, {
    kind: "narrate",
    content: input.text,
    tags: input.tags?.length ? input.tags.join(" ") : undefined,
  });
  return { event_id };
}

function gameEndHandler(db: DB, input: { reason: string; outcome?: string }) {
  const event_id = eventAppend(db, {
    kind: "note",
    visible: 0,
    data_json: { reason: input.reason, outcome: input.outcome },
  });
  metaSet(db, "ended", JSON.stringify({ reason: input.reason, outcome: input.outcome, seq: event_id }));
  return { ended: true as const, event_id };
}

export const ioTools: ToolDef[] = [
  {
    name: "sheet_show",
    title: "持久揭示卡格",
    description:
      "翻 visible=1 让玩家看到指定 cell(强制隐=2 不受影响)。Args: entity、attrs?(给定=attr 级)、recursive?(省略 attrs + true=写 __show_all 整卡长效)。" +
      "Returns: {shown, ok:true}。use: 公开角色已知属性。don't: 一次性披露(用 reveal_once)。错误: 入参非法→INTERNAL。",
    inputSchema: sheetShowIn,
    outputSchema: sheetShowOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: sheetShowHandler,
  },
  {
    name: "world_show",
    title: "持久揭示世界条目",
    description:
      "翻世界条目 visible=1。Args: doc(按名)或 pool_rowid(按行 rowid),二选一。Returns: {ok:true}。" +
      "use: 公开已揭示的设定/地点。don't: 揭示卡格(用 sheet_show)。错误: doc 不存在→NOT_FOUND;入参非法→INTERNAL。",
    inputSchema: worldShowIn,
    outputSchema: worldShowOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: worldShowHandler,
  },
  {
    name: "reveal_once",
    title: "一次性快照披露",
    description:
      "append 一条 kind=reveal 可见 event(冻结此刻副本),不碰目标底层 visible。Args: sheet?{entity,attr} 或 world?{rowid},二选一。" +
      "Returns: {event_id}。use: 给玩家瞄一眼暗值/世界条目。don't: 持久公开(用 sheet_show/world_show)。错误: 目标不存在→ENTITY_NOT_FOUND。",
    inputSchema: revealOnceIn,
    outputSchema: revealOnceOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: revealOnceHandler,
  },
  {
    name: "narrate",
    title: "叙事散文通道",
    description:
      "落一条 kind=narrate(默认 visible=1)的剧情散文,轮内可多次、非终结步骤。Args: text、tags?。Returns: {event_id}。" +
      "use: 推进剧情描写。don't: 在 text 里吐数值菜单(机械结果归输出层)。错误: 入参非法→INTERNAL。",
    inputSchema: narrateIn,
    outputSchema: narrateOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: narrateHandler,
  },
  {
    name: "game_end",
    title: "终局信号",
    description:
      "标记本局终结(you_death = 同工具 + reason 的语义特例)。Args: reason、outcome?。Returns: {ended:true, event_id}。" +
      "use: 剧情自然终结/团灭。don't: 普通失败(那继续游戏)。错误: 入参非法→INTERNAL。",
    inputSchema: gameEndIn,
    outputSchema: gameEndOut,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    handler: gameEndHandler,
  },
];
