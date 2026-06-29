// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// ToolDef / ToolAnnotations 已下沉 @dicelore/interface（harness↔backend 跨层共享契约，
// 见 docs/重构/ADR-storage-port.md §5.1 教训②）；此处再导出，保持既有 `../mcp/tooldef.js` import 路径不变。
export type { ToolDef, ToolAnnotations } from "@dicelore/interface";
