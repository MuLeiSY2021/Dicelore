// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/core 公共面（additive；引擎纯逻辑反向零 import 本文件）。
export { openDb, initSchema, type DB } from "./store/db.js";
export {
  buildPresentationModel,
  type PresentationModel,
  type EchoEntry,
  type VisibleCell,
  type ChoiceView,
} from "./present/model.js";

// 玩家闸控明骰原语（供 orchestrator / 组件7 注入 gate、触发 commit）。
export {
  stagePendingRoll,
  getPendingRoll,
  type PendingRollRow,
  type RollSpec,
  type RollShape,
} from "./store/pendingRoll.js";
export { commitPendingRoll, type RollResult } from "./resolve/commitRoll.js";
export { setRollGate, getRollGate, type RollGate } from "./mcp/rollGate.js";

