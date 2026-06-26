// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { McpServers } from "./McpServers.js";

it("渲染核心 dicelore(标必需)与自定义 out-of-canon 说明", () => {
  render(<McpServers />);
  expect(screen.getByText("dicelore")).toBeInTheDocument();
  expect(screen.getByText(/必需/)).toBeInTheDocument();
  expect(screen.getAllByText(/out-of-canon/).length).toBeGreaterThan(0);
  // 联网警示 + 那条 out-of-canon 说明
  expect(screen.getByText(/不参与 L3 审计/)).toBeInTheDocument();
});
