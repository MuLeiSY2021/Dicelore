// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { slug } from "./CatalogPage.js";

describe("slug（团本名 → URL/会话 id 安全段）", () => {
  it("保留中文，去首尾空格", () => {
    expect(slug(" 黑风寨 ")).toBe("黑风寨");
  });

  it("空格 / 分隔符(/ \\ · :)折成单连字符", () => {
    expect(slug("黑风寨 / 续章")).toBe("黑风寨-续章");
    expect(slug("A·B:C\\D")).toBe("A-B-C-D");
  });

  it("连续分隔符不产生重复连字符", () => {
    expect(slug("a    b")).toBe("a-b");
  });

  it("截断到 24 字符", () => {
    expect(slug("x".repeat(40))).toHaveLength(24);
  });

  it("空/纯分隔符兜底为 team", () => {
    expect(slug("")).toBe("team");
    expect(slug("   ")).toBe("team");
  });
});
