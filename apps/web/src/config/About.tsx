// 配置 → 关于（视觉页 §6）。展示态骨架（只读）。
export function About() {
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">关于</h2>

      <div className="cfg-row">
        <span className="cfg-label">产品</span>
        <span className="cfg-static">Dicelore · 玩家客户端</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">版本</span>
        <span className="cfg-static">v1 · 开发态</span>
      </div>
    </div>
  );
}
