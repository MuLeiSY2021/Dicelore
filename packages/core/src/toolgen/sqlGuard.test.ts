// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test } from "vitest";
import { assertReadOnlySelect, extractParams, firstKeyword } from "./sqlGuard.js";

describe("sqlGuard", () => {
  test("放行单条 SELECT", () => {
    expect(() => assertReadOnlySelect("SELECT a FROM v WHERE x=:p")).not.toThrow();
  });

  test("放行带尾分号的单条 SELECT", () => {
    expect(() => assertReadOnlySelect("SELECT a FROM v;")).not.toThrow();
  });

  test("挡写/危险/多语句", () => {
    for (const s of [
      "UPDATE t SET a=1",
      "DELETE FROM t",
      "DROP TABLE t",
      "PRAGMA x",
      "ATTACH DATABASE y",
      "SELECT 1; DROP TABLE t",
    ]) {
      expect(() => assertReadOnlySelect(s), `should throw for: ${s}`).toThrow();
    }
  });

  test("挡 INSERT/ALTER/CREATE/REPLACE/DETACH/VACUUM", () => {
    for (const s of [
      "INSERT INTO t VALUES(1)",
      "ALTER TABLE t ADD COLUMN x",
      "CREATE TABLE t(x INT)",
      "REPLACE INTO t VALUES(1)",
      "DETACH DATABASE x",
      "VACUUM",
    ]) {
      expect(() => assertReadOnlySelect(s), `should throw for: ${s}`).toThrow();
    }
  });

  test("挡含写关键字的 SELECT (subquery shell)", () => {
    // SELECT that contains INSERT in a subquery-like context
    expect(() =>
      assertReadOnlySelect("SELECT (INSERT INTO t VALUES(1)) FROM x")
    ).toThrow();
  });

  test("extractParams 去重保序", () => {
    expect(extractParams("SELECT :a, :b WHERE c=:a")).toEqual(["a", "b"]);
  });

  test("extractParams 无参数返回空数组", () => {
    expect(extractParams("SELECT * FROM t")).toEqual([]);
  });

  test("firstKeyword 大写首词", () => {
    expect(firstKeyword("  update t set ...")).toBe("UPDATE");
  });

  test("firstKeyword SELECT", () => {
    expect(firstKeyword("SELECT a FROM b")).toBe("SELECT");
  });

  test("firstKeyword 空字符串返回空", () => {
    expect(firstKeyword("   ")).toBe("");
  });
});
