// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { DataStorage } from "./DataStorage.js";

it("渲染数据与存储(DICELORE_SESSIONS_DIR / DICELORE_FTS_MODE)", () => {
  render(<DataStorage />);
  expect(screen.getByText("DICELORE_SESSIONS_DIR")).toBeInTheDocument();
  expect(screen.getByText("DICELORE_FTS_MODE")).toBeInTheDocument();
});
