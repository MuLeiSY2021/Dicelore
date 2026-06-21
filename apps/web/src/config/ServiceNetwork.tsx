// 配置 → 服务与网络（视觉页 §6）。展示态骨架（只读，真实数据接线属后续轮）。
export function ServiceNetwork() {
  return (
    <div className="cfg-section">
      <h2 className="cfg-h2">服务与网络</h2>

      <div className="cfg-row">
        <span className="cfg-label">主页端口</span>
        <span className="cfg-static">默认 7456 · 待接线</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">域名</span>
        <span className="cfg-static">本地访问 localhost · 待接线</span>
      </div>

      <div className="cfg-row">
        <span className="cfg-label">notify</span>
        <span className="cfg-static">呈现态 webhook · 待接线</span>
        <span className="cfg-static">DICELORE_NOTIFY_URL</span>
      </div>
    </div>
  );
}
