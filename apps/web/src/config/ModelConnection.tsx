// 配置 → 模型连接（视觉页 §6）。展示态骨架（只读，真实数据接线属后续轮）。
export function ModelConnection() {
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">模型连接</h2>

      <div className="cfg-row">
        <span className="cfg-label">GM 模型</span>
        <span className="cfg-static">选择哪个模型当 GM · 经 Agent SDK · 待接线</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">凭据</span>
        <span className="cfg-static">API key / OAuth · 与「哪个模型当 GM」正交 · 待接线</span>
      </div>
    </div>
  );
}
