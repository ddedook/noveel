# 阶段 3–5 — 链接、压力测试、交付

## 阶段 3（可选）

若 verified 单元很多，可写简短 `INDEX.md` 列出 STYLE 内各段对应的特征标签。非必须。

## 阶段 4 — 仿写压力测试

准备 2–3 条 test prompt（如「用此风格写一段路遇冲突」「改写一段 AI 味旁白」），盲测检查：

- 句式节奏是否接近
- 是否出现 B 段禁止的腔调
- 是否空有形容词堆砌而无源作特征

失败则回炉阶段 2 补强 E/B 或补充 R 例证。

## 阶段 5 — 交付

- **内置**: 写入 `references/skills/writing-style/<slug>/STYLE.md` + 可选 `meta.json`（name, author, sourceTitle, summary）
- **应用内用户**: 更新 `writing_styles`：`content`、`summary`、`status=ready`
