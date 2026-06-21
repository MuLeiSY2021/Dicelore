import "./PlayPage.css";

export default function PlayPage() {
  return (
    <div className="play">
      <aside className="rail" aria-label="活动轨">设定 / 规则 / 日志 / 会话</aside>
      <section className="center">叙事 + 打字（中央贯穿区占位）</section>
      <aside className="stage" aria-label="呈现台">呈现台（网格停靠占位 · 待 MCP 合并通真实数据）</aside>
    </div>
  );
}
