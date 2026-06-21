// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

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
