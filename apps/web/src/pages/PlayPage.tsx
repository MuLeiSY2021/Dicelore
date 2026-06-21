// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import type { PresentationSnapshot } from "@dicelore/shared";
import { getPresentation } from "../api/client.js";
import { PresentationStage } from "../play/PresentationStage.js";
import "./PlayPage.css";

// v1：会话选择(主页继续上次)尚未实现，跑团页先固定取 demo 会话的只读快照。
const DEMO_SESSION = "demo";

export default function PlayPage() {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPresentation(DEMO_SESSION)
      .then((s) => { if (alive) setSnapshot(s); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="play">
      <aside className="rail" aria-label="活动轨">设定 / 规则 / 日志 / 会话</aside>
      <section className="center">叙事 + 打字（中央贯穿区占位 · 流式待组件2 合并）</section>
      <aside className="stage" aria-label="呈现台">
        {error
          ? <div className="stage-error">呈现台加载失败：{error}</div>
          : <PresentationStage snapshot={snapshot} />}
      </aside>
    </div>
  );
}
