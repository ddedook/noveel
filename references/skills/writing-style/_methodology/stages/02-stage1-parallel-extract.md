# 阶段 1 — 五路并行提取

并行（或串行降级）运行 `extractors/` 下五个提取器，各自独立读原文 + STYLE_OVERVIEW，输出到 `candidates/<type>.md`。

| 提取器 | 文件 | 关注点 |
|---|---|---|
| voice | voice-extractor.md | 声口、人称距离、叙述者态度 |
| rhythm | rhythm-extractor.md | 句长、段落呼吸、节奏加速/减速 |
| dialogue | dialogue-extractor.md | 对话密度、标签、潜台词 |
| imagery | imagery-extractor.md | 感官、比喻、环境写意 |
| taboo | taboo-extractor.md | 作者不做的事、反例腔调 |

## 分块策略

单块建议 8k–15k 字；块间保留 200 字重叠。每块提取后合并去重（同 title 合并 source_quote）。

## 输出

每条候选 YAML 列表项：`id, title, type, source_chapter, source_quote, summary, tags`。不做筛选（筛选在 1.5）。
