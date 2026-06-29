// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { defineConfig } from "vitest/config";

// orchestrator 5b 后降级为纯 eval 包(src 已迁入 backend/harness);只剩 eval/* 集成测试。
// eval 直接 import @dicelore/{backend,harness,interface}(经 workspace 符号链接解析),不再经 @dicelore/core barrel。
export default defineConfig({
  test: { include: ["eval/**/*.test.ts"], exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**"] },
});
