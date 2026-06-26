// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { ModelConnection } from "./ModelConnection.js";

it("渲染模型连接(GM 模型可选 + API key + 连接测试)", () => {
  render(<ModelConnection />);
  expect(screen.getByText("模型连接")).toBeInTheDocument();
  expect(screen.getByLabelText("GM 模型")).toBeInTheDocument(); // 真实模型下拉
  expect(screen.getByLabelText("API key")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /连接测试/ })).toBeInTheDocument();
});
