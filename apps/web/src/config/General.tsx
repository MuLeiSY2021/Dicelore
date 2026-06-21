// 配置 → 通用（视觉页 §6）。展示态骨架（只读，真实数据接线属后续轮）。
export function General() {
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">通用</h2>

      <div className="cfg-row">
        <span className="cfg-label">语言</span>
        <span className="cfg-static">简体中文（默认）· 待接线</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">启动</span>
        <span className="cfg-static">打开时落到主页 · 待接线</span>
      </div>
    </div>
  );
}
