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

it("渲染模型连接(GM 模型 / API key·OAuth)", () => {
  render(<ModelConnection />);
  expect(screen.getByText("模型连接")).toBeInTheDocument();
  expect(screen.getAllByText(/当 GM/).length).toBeGreaterThan(0);
  expect(screen.getByText(/API key/)).toBeInTheDocument();
});
