import type { PresentationSnapshot } from "@dicelore/shared";
import "./PresentationStage.css";

// 呈现台 v1：只读首屏快照的简单堆叠渲染。
// 网格停靠/拖拽/最小化属视觉页 §9 fast-follow；choices 点选(POST)属写侧、阻塞 → 展示态。
export function PresentationStage({ snapshot }: { snapshot: PresentationSnapshot | null }) {
  if (
    !snapshot ||
    (snapshot.sheets.length === 0 && snapshot.mechanics.length === 0 && !snapshot.choices)
  ) {
    return <div className="stage-empty">暂无呈现数据（首屏快照加载中，或本局尚无可见状态）</div>;
  }
  return (
    <div className="stage-panels">
      {snapshot.sheets.map((g) => (
        <section className="panel" key={g.entity}>
          <h3 className="panel-title">{g.entity}</h3>
          <dl className="cells">
            {g.cells.map((c) => (
              <div className="cell" key={c.attr}>
                <dt className="cell-attr">{c.attr}</dt>
                <dd className="cell-val">{c.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {snapshot.mechanics.length > 0 && (
        <section className="panel" key="__mechanics">
          <h3 className="panel-title">机械回显</h3>
          <ul className="mechanics">
            {snapshot.mechanics.map((m) => (
              <li className="mech" key={m.seq}>{m.text}</li>
            ))}
          </ul>
        </section>
      )}

      {snapshot.choices && (
        <section className="panel" key="__choices">
          <h3 className="panel-title">待选项</h3>
          <div className="choices">
            {snapshot.choices.options.map((o) => (
              <button className="choice" key={o.index} disabled title={o.consequence}>
                <span className="choice-label">{o.label}</span>
                <span className="choice-conseq">{o.consequence}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
