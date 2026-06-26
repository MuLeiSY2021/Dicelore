// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render } from "@testing-library/react";
import { ICONS } from "./icons.js";

it("每个语义名都映射到可渲染的 SVG 图标", () => {
  for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
    const Icon = ICONS[name];
    const { container, unmount } = render(<Icon />);
    expect(container.querySelector("svg")).not.toBeNull();
    unmount();
  }
});
