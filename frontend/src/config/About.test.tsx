// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { About } from "./About.js";

it("渲染关于子页(Dicelore)", () => {
  render(<About />);
  expect(screen.getByText("关于")).toBeInTheDocument();
  expect(screen.getByText(/Dicelore/)).toBeInTheDocument();
});
