# Noveel

面向 AI 辅助小说创作的 Electron 桌面应用。

Noveel 将小说结构（人物、世界观、大纲、章节等）保存在本地 PGlite 数据库中，并在进程内运行 DeepSeek Harness（DSH）智能体，无需独立后端即可对话、调用工具读写小说数据并持续迭代。

## 功能

- 小说工作区：基本信息、概述、世界观、人物、生物、物品、等级体系、时间线、大纲、章节、模板、技能
- 按会话的 AI 对话：流式输出、思考过程、工具调用、上下文注入
- 通过 DSH 设置接入模型提供方（可选 Cursor 订阅登录）
- 本地优先：Electron `userData` 下的注册库 + 按小说分库
- 可折叠侧栏与 AI 对话面板（`Cmd/Ctrl+\`、`Cmd/Ctrl+Shift+\`）

## 技术栈

- Electron + electron-vite + React 19 + TypeScript
- HeroUI v3 + Tailwind CSS 4
- PGlite
- DeepSeek Harness（vendored 运行时，进程内 Host）
- assistant-ui 原生对话界面

## 环境要求

- Node.js 22+（推荐）
- [pnpm](https://pnpm.io/) 9+
- macOS / Windows / Linux（Electron）

## 快速开始

```bash
git clone git@github.com:ddedook/noveel.git
cd noveel

# 将 vendored DSH 运行时解压到 vendor/node_modules
pnpm sync:vendor

pnpm install
pnpm dev
```

`pnpm sync:vendor` 使用仓库内已提交的 `vendor/dsh-runtime` tarball，并解压到 `vendor/node_modules`。

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发模式（electron-vite watch） |
| `pnpm build` | 生产构建 |
| `pnpm typecheck` | TypeScript 检查（web + node） |
| `pnpm test:projection` | 对话投影单元测试 |
| `pnpm check:vendor` | 校验 vendor 完整性 |

## 架构

```
┌─────────────┬──────────────────────────┬─────────────────┐
│ 左侧栏      │ 中间小说页面             │ 右侧 AI 对话    │
│ 小说 / 会话 │（HeroUI 工作区）         │（assistant-ui） │
└─────────────┴──────────────────────────┴─────────────────┘
         ▲ IPC / preload ▲                    ▲
         │               │                    │
    主进程：PGlite · DSH Host · noveel 工具
```

- **数据**
  - 注册库：`{userData}/registry/pglite`
  - 单本小说：`{userData}/novels/{novelId}/pglite`
- **DSH**：在主进程启动；对话事件投影到原生 UI
- **工具**：noveel 领域工具供智能体查询/变更小说实体

## 快捷键

- `Cmd/Ctrl + \` — 切换侧栏
- `Cmd/Ctrl + Shift + \` — 切换 AI 对话面板

## 目录结构

```
app/                 渲染进程（React UI）
lib/main/            Electron 主进程（DSH、IPC、PGlite）
lib/preload/         Preload 桥接
packages/            workspace 包（plugin-host、cursor-subscription 等）
vendor/dsh-runtime/  Vendored DeepSeek Harness 包
scripts/             vendor 同步与校验脚本
```

## 许可证

[MIT](./LICENSE) © 2026 ddedook
