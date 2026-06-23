// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";
import { frontList, type Front } from "../store/front.js";
import { plotlineList, type Plotline } from "../store/plotline.js";
import { foreshadowList, type Foreshadow } from "../store/foreshadow.js";
import { watcherList, type WatcherRow } from "../store/watcher.js";

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
