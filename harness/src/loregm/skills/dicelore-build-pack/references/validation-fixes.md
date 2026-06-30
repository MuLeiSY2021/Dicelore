# validate 常见 error/warn → 修法

> `validate({})` 返回 `{ ok: boolean, issues: Issue[] }`。每条 issue 带 `level`（error/warn）、`code`、`message`。本页按 code 速查修法。

---

## Errors（必须修，否则 commit 产物不可用）

### `MANIFEST_MISSING_ID`
manifest 没设 `id`。

```
set_manifest({ id: "fanren-xiuxian" })
```
`id` 只能包含小写字母、数字、连字符（`-`），不可有空格或中文。

---

### `MANIFEST_MISSING_NAME`
manifest 没设 `name`。

```
set_manifest({ name: "凡人修仙传" })
```

---

### `SHEETS_MISSING_REQUIRED_COLS`
sheets 数据缺少必选列（`entity`/`attr`/`value`）。

通常是 `set_state` 传入的 cells 对象缺字段：

```
# 错：缺 attr
set_state({ cells: [{ entity:"韩立", value:"五灵根" }] })

# 对：三列齐全
set_state({ cells: [{ entity:"韩立", attr:"资质", value:"五灵根" }] })
```

---

### `FRONT_MISSING_CLOCK_ATTR`
`add_front` 未传 `clock_attr`，或 `clock_attr` 为空字符串。

`clock_attr` 是钟写入 sheet 的 attr 名，必须给（如 `世界.入侵进度`）。

---

### `FRONT_CLOCK_RANGE_INVALID`
`clock_min >= clock_max`，钟区间无效。

```
# 错：min == max
add_front({ clock_min: 8, clock_max: 8, … })

# 对：min < max
add_front({ clock_min: 0, clock_max: 8, … })
```

---

### `FRONT_OMENS_EMPTY`
`omens` 数组为空——无凶兆阶梯的 Front 没有意义。

至少提供一条 omen，threshold 在 `[clock_min, clock_max]` 范围内：

```
omens: [{ threshold: 8, payload: "终局威胁触发" }]
```

---

### `FRONT_OMEN_OUT_OF_RANGE`
某条 omen 的 `threshold` 超出 `[clock_min, clock_max]`。

调整 threshold 或调整 clock_min/clock_max 使其覆盖该值。

---

### `POOLS_EMPTY_ROWS`
`add_pool` 传入了空 rows 数组（`rows: []`）。

确保至少一行数据。如果是先占位后填，改为先准备好数据再调工具。

---

## Warnings（建议修，不修也能 commit）

### `MANIFEST_NO_FLOWS`
manifest 未声明 `flows`（用了哪些流程 skill）。

如果团本确实不需要特定流程 skill，可以忽略。否则：

```
# set_manifest 目前只接受 name/id（产出 manifest.md，无 flows 字段）；
# flows 需要直接写 write_lore 补一篇特殊文档声明，
# 或在 commit 前确认 draft 已包含 flows 声明。
# 如不确定，可忽略此 warn。
```

---

### `MANIFEST_NO_ENTRY`
manifest 未设 `entry`（开局引子锚点）。

若有 `lore/设定.md` 并且文档中有 `## 引子` 一节，可在 manifest 里声明：
```
entry: lore/设定.md#引子
```
若团本不需要特定引子，此 warn 可忽略（运行时 AI 会自行开局）。

---

### `WORLD_DOC_NO_CONTENT`
某篇 `write_lore` 写入的内容过短（通常 < 10 字符）。

这通常是占位符还没填：
```
# 错：空内容
write_lore({ name:"lore/设定", content:"" })

# 修：补充真实内容后覆写（同名再调一次 write_lore 会覆盖）
write_lore({ name:"lore/设定", content:"凡人修仙界，修仙者以灵根修行…" })
```

---

### `FRONT_OMEN_THRESHOLD_DUPLICATE`
同一 Front 有两条 omen 的 threshold 相同。

watcher 会重复触发，通常是笔误。调整其中一条的 threshold：
```
# 错：两条都是 threshold:6
omens: [
  { threshold:6, payload:"事件A" },
  { threshold:6, payload:"事件B" },
]

# 修：分开
omens: [
  { threshold:5, payload:"事件A" },
  { threshold:6, payload:"事件B" },
]
```

---

### `SHEETS_DUPLICATE_ENTITY_ATTR`
同一 `entity+attr` 组合在 sheets 中出现多次。

`set_state` 是追加语义，多次调用会追加行而非覆盖。重复行在 import 时取最后一条，但会产生歧义。

修法：确认是否误重复写了相同 attr，如果是，用 `read({ section:"sheets" })` 查看当前 draft，不重复写即可（已写入的行无法从 draft 删除，只能在 commit 后注意）。

---

## 通用排查步骤

1. `validate({})` → 拿到 issues 列表
2. 对每条 issue 查本页 code
3. 按修法补调相应工具
4. 再次 `validate({})` 确认 issues 消除
5. 全绿后 `read({})` 审阅一遍再 `commit`
