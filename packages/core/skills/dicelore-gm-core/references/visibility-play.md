# 可见性 playbook

<!-- 措辞 eval-pending。 -->
- **开局**:对玩家自己人物卡 `sheet_show` 一次(默认全隐),否则玩家看不到自己。
- **暗值**:好感度暗值、隐藏 DC、GM 私有信息写入时用强制隐藏(visible=2),entity 级 show 也不揭。
- **reveal_once vs show**:一次性瞥/侦查/占卜/鉴定 → `reveal_once`(冻结副本披露、不入持久可见集);长效揭示 → `sheet_show`/`world_show`(持久,输出层每轮渲染实时值)。
- **红线**:别在 `narrate` 散文里吐出任何隐藏数值。
