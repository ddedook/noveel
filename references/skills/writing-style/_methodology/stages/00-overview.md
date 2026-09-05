# RIA-TV++ 文风蒸馏总览

面向 **写作 Agent 执行**，不是给人看的书评。

## 与 cangjie 的差异

| 维度 | cangjie（方法论） | writing-style（文风） |
|---|---|---|
| 产出粒度 | 多个原子 skill | **一份** STYLE.md |
| 提取器 | framework / principle / case / counter / glossary | voice / rhythm / dialogue / imagery / taboo |
| 成功标准 | 决策问题被解决 | 新段落仿写贴合源作者声口 |

## 流水线

```
阶段 0 Adler → STYLE_OVERVIEW
     ↓
阶段 1 五路并行提取 → candidates/
     ↓
阶段 1.5 三重验证 → verified.md
     ↓
阶段 2 RIA++ 合成 → STYLE.md
     ↓
阶段 3 可选 INDEX
     ↓
阶段 4 仿写压力测试
     ↓
阶段 5 交付（references 或 DB）
```

## 不变量

1. **单交付**: 运行时只注入一份 `content`（STYLE.md）
2. **可追溯**: 关键特征须有原文引用（≤150 字）
3. **可验证**: V1 多章佐证 / V2 可指导仿写 / V3 非「写好点」空话
4. **可执行**: E 段为 1-2-3 步骤 + 完成标准
5. **有边界**: B 段写明何时不该套用此风格
