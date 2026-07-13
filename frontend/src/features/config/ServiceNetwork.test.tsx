// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { ServiceNetwork } from "./ServiceNetwork.js";

it("渲染服务与网络(端口 / 域名 / DICELORE_NOTIFY_URL)", () => {
  render(<ServiceNetwork />);
  expect(screen.getByText("服务与网络")).toBeInTheDocument();
  expect(screen.getByText("DICELORE_NOTIFY_URL")).toBeInTheDocument();
  expect(screen.getAllByText(/端口/).length).toBeGreaterThan(0);
  expect(screen.getByTestId("config-net-port")).toBeInTheDocument();
});
