// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog } from "../catalog/db.js";
import { importPack } from "../catalog/import.js";
import { openDb, initSchema } from "../store/db.js";
import { frontList } from "../store/front.js";
import { plotlineList } from "../store/plotline.js";
import { foreshadowList } from "../store/foreshadow.js";
import { anchorsByOwner } from "../store/anchor.js";
import { Draft, commitDraft } from "./draft.js";

describe("叙事域 Draft → commit → import 全链(front/plotline/foreshadow/anchor)", () => {
  it("作者声明叙事域 → 物化进运行库", () => {
    const draft = new Draft();
    draft.setManifest({ name: "魔道入侵", id: "md" });
    draft.setPrologue("游戏开始。");
    // front 正典 md 格式：FrontSpec（clock_attr/clock_min/clock_max/omens）→ fronts/f1.md
    draft.addFront({
      id: "f1",
      name: "魔道入侵",
      stakes: "黄枫谷能否守住护山大阵",
      clock_attr: "世界.入侵进度",
      clock_min: 0,
      clock_max: 8,
      clock_mode: "once",
      omens: [{ threshold: 4, payload: "边境沦陷" }],
    });
    // plotline/foreshadow/anchor 保持 CSV 格式（同 main）
    draft.addPlotline([{ id: "p1", title: "韩立的崛起", summary: "凡人到金丹", status: "open" }]);
    draft.addForeshadow([{ id: "fs1", content: "墨大夫袖中的暗格", status: "planted" }]);
    draft.addAnchor([{ owner_table: "plotline", owner_id: "p1", target_table: "front", target_id: "f1", role: "威胁" }]);

    const cat = openCatalog(":memory:");
    const r = commitDraft(cat, { name: "魔道入侵", message: "init", draft, createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);

    expect(res.fronts).toBe(1);
    expect(res.plotlines).toBe(1);
    expect(res.foreshadows).toBe(1);
    expect(res.anchors).toBe(1);
    // front 从 fronts/f1.md 物化：id 为文件名，name 来自 H1
    expect(frontList(run).find((f) => f.id === "f1")?.name).toBe("魔道入侵");
    expect(plotlineList(run).find((p) => p.id === "p1")?.title).toBe("韩立的崛起");
    expect(foreshadowList(run).find((f) => f.id === "fs1")?.content).toBe("墨大夫袖中的暗格");
    expect(anchorsByOwner(run, "plotline", "p1")[0]?.target_id).toBe("f1");
    cat.close(); run.close();
  });
});
