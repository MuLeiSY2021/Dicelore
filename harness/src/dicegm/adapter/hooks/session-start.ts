// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/hooks/session-start.ts
// 薄入口(组合根):读 stdin(CC hook JSON,字段以实现期官方文档为准)→ openSession + openSessionBackend → 注 additionalContext。
import { openSession, openSessionBackend } from "@dicelore/backend";
import { buildSessionContext } from "../sessionContext.js";

const { db } = openSession(); // env DICELORE_SESSION
const additionalContext = buildSessionContext(openSessionBackend(db));
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
}));
