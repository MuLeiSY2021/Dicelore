import { afterEach, describe, expect, test } from "vitest";
import { buildFtsQuery, escapeLike, ftsMode, tokenizeForIndex } from "./fts.js";

afterEach(() => { delete process.env.ANKO_FTS_MODE; });

describe("ftsMode", () => {
  test("默认 jieba", () => { expect(ftsMode()).toBe("jieba"); });
  test("env 切 trigram", () => { process.env.ANKO_FTS_MODE = "trigram"; expect(ftsMode()).toBe("trigram"); });
});

describe("tokenizeForIndex", () => {
  test("jieba:分词空格连接", () => {
    expect(tokenizeForIndex("我爱北京天安门", "jieba")).toBe("我 爱 北京 天安门");
  });
  test("trigram:原文不动", () => {
    expect(tokenizeForIndex("青云门派收弟子", "trigram")).toBe("青云门派收弟子");
  });
});

describe("buildFtsQuery", () => {
  test("jieba:单词加引号", () => {
    expect(buildFtsQuery("北京", "jieba")).toEqual({ match: '"北京"', like: null });
  });
  test("jieba:多词 OR 连接", () => {
    expect(buildFtsQuery("北京 天安门", "jieba")).toEqual({ match: '"北京" OR "天安门"', like: null });
  });
  test("trigram:≥3 字走 MATCH", () => {
    expect(buildFtsQuery("门派收", "trigram")).toEqual({ match: "门派收", like: null });
  });
  test("trigram:<3 字走 LIKE 兜底", () => {
    expect(buildFtsQuery("门派", "trigram")).toEqual({ match: null, like: "%门派%" });
  });
  test("空查询:全 null", () => {
    expect(buildFtsQuery("  ", "jieba")).toEqual({ match: null, like: null });
  });
});

describe("escapeLike", () => {
  test("转义 LIKE 通配符", () => {
    expect(escapeLike("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });
});
