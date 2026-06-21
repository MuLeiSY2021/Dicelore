import type { ToolDef } from "./tooldef.js";
import { resolverTools } from "./handlers/resolver.js";
import { sheetTools } from "./handlers/sheet.js";
import { eventTools } from "./handlers/event.js";
import { worldTools } from "./handlers/world.js";
import { ioTools } from "./handlers/io.js";

export const TOOLS: ToolDef[] = [
  ...resolverTools,
  ...sheetTools,
  ...eventTools,
  ...worldTools,
  ...ioTools,
];
