// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { defineConfig } from "@playwright/test";

// e2e:跑团闭环。backend 需另起(DICELORE_FAKE_GM=1 PORT=8787);vite dev 由本配置拉起(代理 /sessions、/catalog → 8787)。
//   运行:DICELORE_FAKE_GM=1 PORT=8787 npx tsx backend/src/server.ts   # 另一个终端
//        cd frontend && npx playwright test
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "npx vite --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
