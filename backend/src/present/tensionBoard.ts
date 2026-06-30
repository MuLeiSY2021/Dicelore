// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";
import { frontList, type Front } from "../store/narrative/front.js";
import { plotlineList, type Plotline } from "../store/narrative/plotline.js";
import { foreshadowList, type Foreshadow } from "../store/narrative/foreshadow.js";
import { watcherList, type WatcherRow } from "../store/narrative/watcher.js";

// ⚠ 接线待办（见 backlog-core A5 / A′「未结张力看板」）：本聚合已实现但尚未接进 buildMcp，
// GM 调不到「以概念为单位」的张力看板读。当前无运行时消费者（仅自测引用）——保留作第二批
// 路线图「视图层投影/暴露 tensionBoard 工具」的待接线资产，勿误删。

export interface TensionBoard {
  fronts: Front[];
  plotlines: Plotline[];
  foreshadows: Foreshadow[];
  watchers: WatcherRow[];
}

export function tensionBoard(db: DB): TensionBoard {
  return {
    fronts: frontList(db).filter((f) => f.status === "active"),
    plotlines: plotlineList(db).filter((p) => p.status === "open" || p.status === "active"),
    foreshadows: foreshadowList(db).filter((f) => f.status === "planted"),
    watchers: watcherList(db).filter((w) => w.armed === 1),
  };
}
