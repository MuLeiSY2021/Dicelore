// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi } from "vitest";
import { openCatalog, openDb, initSchema, type DB } from "@dicelore/core";
import { createLoreApp } from "./lore.js";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm } from "../dice/FakeDiceGm.js";
import type { SkillRef } from "../pkg/agent.js";

const PACK = [
  { path: "manifest.md", content: "# 凡人\n\n- id: f" },
  { path: "prologue.md", content: "你睁开眼，发现自己躺在七玄门弟子的木屋中。请向韩立描述清晨的山门。" },
  { path: "lore/黄枫谷.md", content: "正道" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n韩立,player,HP,12,1\n" },
];

describe("后端 e2e: 建团本 → 列 → 开局 import → 呈现", () => {
  it("catalog commit → list → /sessions/:id/open → presentation 含导入态", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });

    // 1. 直接提交一个团本
    const commitRes = await lore.request("/catalog/commit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "凡人", message: "init", files: PACK }),
    });
    expect(commitRes.status).toBe(201);
    const { tuanbenId, commitId } = (await commitRes.json()) as { tuanbenId: string; commitId: string };

    // 2. 列团本
    const ls = (await (await lore.request("/catalog")).json()) as { tuanben: { id: string; name: string }[] };
    expect(ls.tuanben.find((t) => t.id === tuanbenId)?.name).toBe("凡人");

    // 3. 开局:per-id 持久内存库,import 落其中
    const dbs = new Map<string, DB>();
    const openSession = (id: string): DB => {
      let d = dbs.get(id);
      if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); }
      return d;
    };
    const live = createLiveApp({ catalog, openSession, agentFactory: () => new FakeDiceGm([{ type: "narration", text: "门开了" }, { type: "turn_end" }]) });
    const openRes = await live.request("/sessions/s1/open", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tuanbenId, ref: commitId }),
    });
    expect(openRes.status).toBe(201);

    // 4. 首屏快照含导入的 state cell
    const snap = (await (await live.request("/sessions/s1/presentation")).json()) as { sheets: { entity: string; cells: { attr: string; value: string }[] }[] };
    const hp = snap.sheets.find((g) => g.entity === "韩立")?.cells.find((c) => c.attr === "HP");
    expect(hp?.value).toBe("12");

    catalog.close();
  });
});

describe("createLoreApp: skills 传入", () => {
  it("skills 参数经 LoreDeps 传入构建会话(agentFactory 收到 skills)", async () => {
    const catalog = openCatalog(":memory:");
    const capturedInits: { skills: SkillRef[] }[] = [];
    const fakeSkill: SkillRef = { name: "dicelore-build-pack", srcDir: "/fake/build-pack" };
    const lore = createLoreApp({
      catalog,
      agentFactory: (init) => {
        capturedInits.push({ skills: init.skills ?? [] });
        return new FakeDiceGm([{ type: "narration", text: "ok" }, { type: "turn_end" }]);
      },
      skills: [fakeSkill],
    });

    const res = await lore.request("/lore-sessions/s-skill-test/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定", name: "测试团本" }),
    });
    expect(res.status).toBe(202);
    expect(capturedInits.length).toBeGreaterThan(0);
    expect(capturedInits[0].skills).toHaveLength(1);
    expect(capturedInits[0].skills[0].name).toBe("dicelore-build-pack");
    catalog.close();
  });

  it("skills 省略时构建 agent 收到空数组(向后兼容)", async () => {
    const catalog = openCatalog(":memory:");
    const capturedSkills: SkillRef[][] = [];
    const lore = createLoreApp({
      catalog,
      agentFactory: (init) => {
        capturedSkills.push(init.skills ?? []);
        return new FakeDiceGm([{ type: "narration", text: "ok" }, { type: "turn_end" }]);
      },
      // skills 省略
    });

    const res = await lore.request("/lore-sessions/s-no-skill/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定", name: "无技能团本" }),
    });
    expect(res.status).toBe(202);
    expect(capturedSkills[0]).toEqual([]);
    catalog.close();
  });
});
