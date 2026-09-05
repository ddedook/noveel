---
name: writing-style-distill
description: >
  Distill a novel (or long prose sample) into one executable author writing-style Skill (STYLE.md).
  Use when the user asks to "蒸馏写作风格" / "拆文风" / "把这本书做成写作风格" / "distill writing style from novel".
  NOT for methodology/framework distillation (that is cangjie-skill) and NOT for per-section novel craft skills (overview/role/chapter…).
---

# writing-style-distill — 把小说蒸馏成一份可执行的作者文风 Skill

## 使命

从一部小说（或足够长的散文样本）中抽出**可被写作 Agent 执行的文风约束**：声口、句式节奏、对话、意象、视角与禁忌，合成**一份** `STYLE.md`，供 Noveel 写作 Agent 在章节写作/改稿时注入。

**边界**:
- ✅ 做: 文风特征、可仿写步骤、反例禁忌、原文佐证
- ❌ 不做: 剧情摘要、人物档案、世界观设定、方法论框架拆解（cangjie）、书内区块写作技能（novel_skills）

## 核心方法论: RIA-TV++（文风版）

```
阶段 0: Adler 整书理解     → STYLE_OVERVIEW.md
阶段 1: 5 路并行提取       → candidates/{voice,rhythm,dialogue,imagery,taboo}.md
阶段 1.5: 三重验证筛选     → verified.md + rejected/
阶段 2: RIA++ 合成         → STYLE.md（唯一交付物）
阶段 3: 链接（可选）       → INDEX.md
阶段 4: 仿写压力测试       → test-prompts.json + 回炉
阶段 5: 交付               → 内置路径写 references/skills/writing-style/<slug>/
                           或应用内写 writing_styles 表
```

详见 `stages/00-overview.md`。

## 输入要求

1. **源文本**: TXT / MD / 纯文本路径。禁止凭记忆蒸馏。
2. **元信息**: 书名 + 作者（可空，可由阶段 0 推测后确认）。
3. **slug**: 英文短横线标识，用于目录名与内置 seed（如 `jin-yong-classic`）。

## 输出结构

### 离线/内置路径

```
references/skills/writing-style/<slug>/
├── STYLE.md          # 唯一注入 Agent 的正文
└── meta.json         # 可选: name, author, sourceTitle, summary
```

### 审计工作区（蒸馏过程，可不入库）

```
<work>/<slug>/
├── PIPELINE_STATE.md
├── STYLE_OVERVIEW.md
├── verified.md
├── candidates/
├── rejected/
├── STYLE.md
└── test-prompts.json
```

## 执行流程

严格按 `stages/01` … `stages/05` 顺序。每阶段更新 `PIPELINE_STATE.md`。

阶段 0 / 1.5 后应轻确认（应用内可「跳过自动继续」）。阶段 2 合成**一份** STYLE.md，不要拆成多个独立 skill 目录。

## 与 Noveel 集成

- 内置: seed 读 `<slug>/STYLE.md` → `writing_styles`（`origin=builtin`）
- 用户上传: 主进程同一流水线 → `writing_styles`（`origin=user`）
- 小说可选绑定 `novels.writing_style_id`；未绑定则不注入
