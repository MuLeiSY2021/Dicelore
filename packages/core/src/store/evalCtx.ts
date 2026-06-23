// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";
import type { EvalCtx, RefGetter } from "../expr/evaluate.js";
import type { Rng } from "../dice/index.js";
import { stateGet } from "./state.js";
import { makeExistsMatch } from "./existsMatch.js";

export function makeEvalCtx(db: DB, opts?: { rng?: Rng }): EvalCtx {
  const getRef: RefGetter = (e, a) => {
    const key = e.startsWith("state:") ? e.slice(6) : e;
    return stateGet(db, key, a)?.value;
  };
  return { rng: opts?.rng, getRef, existsMatch: makeExistsMatch(db) };
}
