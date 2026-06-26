// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import { getHealth, type HealthInfo } from "../api/client.js";

// 运行态自检(顶栏指示 / 配置页真值)。失败静默(离线/未起后端时不崩 UI)。
export function useHealth(): { health: HealthInfo | null; offline: boolean } {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    // Promise.resolve 包一层：getHealth 可能因环境无 fetch 而同步抛错，统一走 .catch。
    Promise.resolve().then(getHealth)
      .then((h) => { if (alive) setHealth(h); })
      .catch(() => { if (alive) setOffline(true); });
    return () => { alive = false; };
  }, []);
  return { health, offline };
}
