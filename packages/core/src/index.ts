// @dicelore/core 公共面（additive；引擎纯逻辑反向零 import 本文件）。
export { openDb, initSchema, type DB } from "./store/db.js";
export {
  buildPresentationModel,
  type PresentationModel,
  type EchoEntry,
  type VisibleCell,
  type ChoiceView,
} from "./present/model.js";
