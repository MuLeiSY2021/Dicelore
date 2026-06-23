// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 开发期代理到 orchestrator；ws:true 透传 /sessions/:id/ws 的 WebSocket 升级。
  server: {
    proxy: {
      "/sessions": { target: "http://localhost:8787", ws: true, changeOrigin: true },
      "/catalog": { target: "http://localhost:8787", changeOrigin: true },
      "/lore-sessions": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
