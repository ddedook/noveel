# Voice Extractor

专门识别**叙述声口 / 人称距离 / 叙述者态度**。

## 职责

- 第几人称、视角黏着程度（紧密跟角色 vs 全知点评）
- 叙述者语气：冷静、戏谑、克制、煽情、史诗…
- 高频口头禅式叙述习惯（非人物对话）

## 不属于你的

节奏句长 → rhythm；对话 → dialogue；感官比喻 → imagery；禁止事项 → taboo

## 输出格式

```yaml
- id: v01
  title: 紧贴主角的有限视角
  type: voice
  source_chapter: 第3章
  source_quote: |
    "……"
  summary: |
    叙述几乎不离开主角感知范围；情绪多通过动作与短句带出。
  tags: [voice, pov]
```
