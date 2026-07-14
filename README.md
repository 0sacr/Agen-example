# 🎞️ 光影AI助手 — 电影史智能对话 Agent

> **全链路电影史内容生态的最后一块拼图** — AI 与沉浸式官网的深度联动

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-green)](https://vuejs.org/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-orange)](https://js.langchain.com/)
[![DeepSeek](https://img.shields.io/badge/LLM-DeepSeek%20V4-purple)](https://platform.deepseek.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## 📖 项目简介

**光影AI助手**是一个基于 LangChain.js + DeepSeek V4 的智能对话 Agent，嵌入电影史沉浸式官网，支持：

- 🗣️ **自然语言交互** — 用户用口语提问，Agent 自动理解意图并调用对应工具
- 🎯 **时间轴联动** — AI 可以跳转到指定年份节点（复用官网 35mm 时间轴动画）
- 🎵 **音效联动** — AI 可以触发对应年代音效（复用官网 Web Audio API 音效系统）
- 📚 **知识库检索** — AI 可以搜索博客文章，避免"幻觉"（复用光影笔记博客数据）
- ⌨️ **打字机效果** — SSE 流式输出 AI 回复，逐 token 渲染

本项目的独特价值在于：**不是"又一个聊天机器人演示"，而是 AI 与前端动效的深度融合**——AI 不只是"会说话"，而是能实际操控页面、触发动画、播放音效。

---

## 🏗️ 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                     用户浏览器                              │
│  ┌─────────────────────┐    ┌──────────────────────────┐  │
│  │   Cinema Evolution  │    │   AI 光影助手对话框       │  │
│  │   官网 (独立页)      │◄───│   ChatBox.vue            │  │
│  │                     │    │                          │  │
│  │  · data-era 节点    │    │  · SSE 流读取            │  │
│  │  · playEraSound()   │    │  · 打字机渲染            │  │
│  │  · Web Audio 引擎   │    │  · 动作桥接层            │  │
│  └─────────────────────┘    └──────────┬───────────────┘  │
│                                        │                   │
└────────────────────────────────────────┼───────────────────┘
                                         │ SSE (POST /chat)
┌────────────────────────────────────────┼───────────────────┐
│                         Agent Server (Express :3001)        │
│  ┌─────────────────────────────────────┴──────────────┐    │
│  │              LangChain Agent                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ scrollTo │  │ playEra  │  │   queryBlog      │  │    │
│  │  │  Node    │  │  Sound   │  │   (本地搜索)      │  │    │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │    │
│  │       │              │                 │             │    │
│  │       └──────────────┼─────────────────┘             │    │
│  │                      ▼                               │    │
│  │         ChatOpenAI (DeepSeek V4)                     │    │
│  │         + BufferMemory (k=5)                         │    │
│  │         + SSE Stream Writer                          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  数据层: eraData.json  +  articles/*.md                      │
└──────────────────────────────────────────────────────────────┘
```

### 数据流（以 "1927年发生了什么？然后跳过去播爵士乐" 为例）

```
用户输入
  → POST /chat { message: "1927年发生了什么？然后跳过去播爵士乐" }
  → LangChain Agent 分析意图
    → Tool 1: queryBlog("1927") → 读取 articles/1927-爵士歌手.md → 返回搜索结果
    → LLM 组织自然语言回复 → SSE data:text: 逐 token 推送
    → Tool 2: scrollToNode(1927) → SSE data:action: scroll → 前端 scrollIntoView
    → Tool 3: playEraSound(1927) → SSE data:action: sound → 前端 playEraSound("jazz")
  → SSE data:done → 前端恢复就绪状态
```

---

## 🚀 一步步运行指南

### 前置条件

- **Node.js** ≥ 18.x（推荐 20.x LTS）
- **npm** ≥ 9.x
- **DeepSeek API Key**（免费注册获取：[platform.deepseek.com](https://platform.deepseek.com/api_keys)）
  - 新用户通常赠送 100 万 token 免费额度

### 1. 克隆 & 安装

```bash
# 进入项目目录
cd movie-history-ecosystem

# 安装后端依赖
cd agent-server
npm install

# 安装前端依赖
cd ../agent-client
npm install

# 回到项目根目录
cd ..
```

### 2. 配置 API Key

```bash
# 后端配置
cd agent-server
cp .env.example .env
# 编辑 .env 文件，将 DEEPSEEK_API_KEY 替换为你的真实 Key
# Windows: notepad .env
# macOS:   open .env

# 前端无需配置（开发时通过 Vite proxy 转发）
```

`.env` 文件内容：
```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
LLM_MODEL=deepseek-chat
LLM_TEMPERATURE=0.7
MEMORY_K=5
```

### 3. 启动服务

打开两个终端窗口：

```bash
# 终端 1 — 启动后端 Agent 服务（端口 3001）
cd agent-server
npm run dev
```

看到以下输出表示成功：
```
╔══════════════════════════════════════════════════╗
║  🎞️  电影史AI光影助手 — Agent 服务              ║
╠══════════════════════════════════════════════════╣
║  端口: http://localhost:3001                    ║
║  模型: deepseek-chat                            ║
║  API:  ✅ 已配置                                ║
╚══════════════════════════════════════════════════╝
```

```bash
# 终端 2 — 启动前端开发服务器（端口 5173）
cd agent-client
npm run dev
```

### 4. 打开浏览器

访问 **http://localhost:5173**，你应该看到：

- 胶片质感的暗色背景
- Canvas 颗粒动画
- 居中的对话框，顶部标题 "🎞️ 光影AI助手"
- 快捷问题按钮

### 5. 测试对话

点击快捷问题 **"1927年发生了什么？然后跳过去播爵士乐"**，观察：

1. 用户消息出现在右侧（深棕色气泡）
2. 加载指示器（三点动画）
3. 📚 工具调用提示："正在搜索电影史知识库..."
4. AI 回复逐字出现在左侧（胶片黄气泡，打字机效果）
5. 🎬 工具调用提示："正在跳转到 1927 年节点..."
6. 🎵 工具调用提示："正在播放 1927 年代音效..."
7. 听到爵士乐音效（如果 Web Audio API 可用）
8. 加载状态结束，可继续输入

---

## 📚 LangChain 概念对照表

> 适合不熟悉 LangChain 的前端开发者快速理解核心概念

| LangChain 概念 | 对应代码位置 | 一句话解释 | 类比（前端开发者视角） |
|---------------|-------------|-----------|---------------------|
| **Chat Model** | `agent.ts` → `createModel()` | 封装大模型 API 调用 | 类似于 `fetch()` 封装了 HTTP 请求 |
| **Prompt Template** | `agent.ts` → `createPrompt()` | 定义角色、行为规则和输入格式 | 类似于定义了一个带参数的字符串模板 |
| **System Prompt** | `agent.ts` → `systemPrompt` 变量 | 告诉 AI "你是谁，能做什么，不能做什么" | 类似于给新同事的入职指南 |
| **Tool** | `tools.ts` → `scrollToNode` 等 | 封装一个"AI 可调用的函数" | 类似于 API 路由 handler |
| **Tool Schema (Zod)** | `tools.ts` → `z.object({ year: z.number() })` | 定义工具的参数格式 | 类似于 TypeScript 接口 + 运行时校验 |
| **Agent** | `agent.ts` → `createOpenAIFunctionsAgent()` | 把 LLM + 工具 + Prompt 组合为"能自主决策的智能体" | 类似于一个聪明的 middleware |
| **Agent Executor** | `agent.ts` → `AgentExecutor.fromAgentAndTools()` | 管理 Agent 的"思考→行动→观察"循环 | 类似于 Event Loop |
| **ReAct 循环** | `agent.ts` → `streamEvents` 迭代 | Reasoning（推理）+ Acting（行动）交替进行 | 类似于 Redux 的 action→reducer→store 循环 |
| **Memory (BufferMemory)** | `agent.ts` → `ChatMemory` 类 | 保存最近 N 轮对话，理解代词和上下文 | 类似于 sessionStorage |
| **Streaming (SSE)** | `index.ts` → `sendEvent()` | 逐 token 推送 AI 回复 | 类似于 WebSocket 的单向版 |
| **Function Calling** | `tools.ts` → tool description + schema | LLM 自动选择工具并提取参数的能力 | 类似于智能路由 + 参数解析器 |

### 核心概念详解

#### 1. Tool（工具）— 如何让 AI "动手"

```typescript
// tools.ts — 这就是一个 Tool 的完整定义
const scrollToNode = tool(
  async ({ year }) => {          // ← func: 工具实际执行的函数
    sendEvent('action', ...);    //    通过 SSE 通知前端
    return '时间轴已滚动';        //    返回值会给 LLM 作为"观察结果"
  },
  {
    name: 'scrollToNode',        // ← name: 工具名称（LLM 据此选择）
    description: '滚动时间轴...',  // ← description: 何时使用（LLM 据此决策）
    schema: z.object({           // ← schema: 参数格式（LLM 据此提取参数）
      year: z.number().min(1895).max(2024)
    }),
  }
);
```

**关键理解**：Tool 的 `description` 是最重要的部分——LLM 完全依赖它来决定"何时调用该工具"。写得越清楚，Agent 越准确。

#### 2. Agent 的思考循环（ReAct 模式）

```
用户: "1927年发生了什么？然后跳过去播爵士乐"
  ↓
LLM 思考: "用户想知道1927年的信息，我应该先查知识库"
  ↓
Agent 动作: 调用 queryBlog({ keyword: "1927" })
  ↓
观察结果: "1927年...《爵士歌手》...有声片元年..."
  ↓
LLM 思考: "好的，现在我已经有了信息，用户还要求跳转和播音效"
  ↓
Agent 动作: 调用 scrollToNode({ year: 1927 })
  ↓
观察结果: "已触发滚动"
  ↓
Agent 动作: 调用 playEraSound({ year: 1927 })
  ↓
观察结果: "已播放爵士乐"
  ↓
LLM 组织最终回复: "1927年是电影史上重要的一年..."
  ↓
输出给用户
```

#### 3. Memory（记忆）— 为什么 AI 能理解"那"

```
用户: "1927年发生了什么？"
AI:   "1927年是有声电影元年..."
用户: "那播个音效"       ← "那" 指什么？没有记忆的 AI 无法理解
AI:   "正在播放爵士乐..."  ← 因为 Memory 保存了上一轮的上下文
```

---

## 🎬 对话 Demo 示例

### Demo 1：基础知识查询

```
用户: 1927年发生了什么？
AI:   1927年是电影史上具有里程碑意义的一年——华纳兄弟发行了
      《爵士歌手》(The Jazz Singer)，这是世界上第一部包含同步
      对白和歌曲的有声长片，标志着默片时代的终结。需要我带你
      跳转到时间轴上的1927节点看看吗？
```

### Demo 2：工具联动（★ 核心 Demo）

```
用户: 介绍一下《星球大战》，然后跳过去
AI:   （调用 queryBlog("星球大战") → 返回文章内容）
      乔治·卢卡斯的《星球大战》在1977年上映，不仅重新定义了
      科幻电影，更创立了工业光魔(ILM)特效帝国...
      （调用 scrollToNode(1977) → 时间轴滚动）
      （调用 playEraSound(1977) → 播放科幻电子乐）
```

### Demo 3：多轮对话记忆

```
用户: 1895年有什么大事？
AI:   1895年，卢米埃尔兄弟在巴黎首次公开放映电影...
用户: 那它的音效是什么样的？
AI:   （理解"它"指1895年的默片时代 → 播放默片钢琴音效）
```

---

## 🔮 扩展方向（面试加分项）

### 1. RAG（检索增强生成）— 向量化博客知识库

**当前方案**：`queryBlog` 使用简单的关键词匹配搜索 Markdown 文件。适合文章数量少（<50篇）的场景。

**升级方案**：使用 LangChain 的 VectorStore + Embeddings 实现语义搜索：

```typescript
// 伪代码示例 — 向量化检索
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// 1. 将 Markdown 文件切割为语义块
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

// 2. 使用 Embedding 模型将文本转为向量
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  configuration: { baseURL: "https://api.deepseek.com/v1" },
});

// 3. 存入向量数据库
const vectorStore = await MemoryVectorStore.fromDocuments(
  await splitter.createDocuments(articles),
  embeddings
);

// 4. 语义搜索（不再需要精确匹配关键词）
const results = await vectorStore.similaritySearch("爵士时代的音乐特点", 3);
// → 可以找到"1927-爵士歌手.md"中关于爵士乐的描述
// → 即使原文没有出现"音乐特点"这个词也能匹配
```

**面试价值**：展示对 RAG 架构的理解，是 AI 工程化面试的常见考点。

### 2. 多模态工具 — 搜索电影预告片

```typescript
const searchVideo = tool(
  async ({ movieName }) => {
    // 调用 YouTube Data API 或 B站 API 搜索预告片
    // 前端通过 SSE action 事件嵌入 iframe 播放器
    const videoUrl = await searchTrailerOnBilibili(movieName);
    sendEvent('action', '正在获取预告片...', {
      actionType: 'playVideo',
      videoUrl,
    });
    return `已找到《${movieName}》的预告片，正在播放。`;
  },
  {
    name: 'searchVideo',
    description: '搜索电影预告片或经典片段',
    schema: z.object({ movieName: z.string().describe('电影名称') }),
  }
);
```

### 3. 对话持久化 — 用户下次打开继续聊

使用 Redis 或 SQLite 存储会话历史（当前在内存中，重启服务器即丢失）：

```typescript
import { RedisChatMessageHistory } from "langchain/stores/message/redis";

const history = new RedisChatMessageHistory({
  sessionId,
  config: { url: "redis://localhost:6379" },
});
```

### 4. 多 Agent 协作 — 电影推荐 + 知识问答

创建两个 Agent 分工协作：
- **FilmCurator Agent**：负责回答电影史知识和推荐
- **Navigator Agent**：负责操控官网页面（滚动、音效、视频）

通过 Supervisor Agent 协调两个子 Agent 的分工。

---

## 🛠️ 技术栈一览

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端框架 | Vue 3 + Composition API + `<script setup>` | 对话框 UI |
| 前端构建 | Vite 6 | 开发/打包 |
| 前端语言 | TypeScript 5.7（严格模式） | 类型安全 |
| 后端框架 | Express 4 | HTTP 服务 + SSE |
| 后端语言 | TypeScript 5.7 + tsx | 无需编译直接运行 |
| AI 框架 | LangChain.js 0.3 | Agent 编排 |
| AI 模型 | DeepSeek V4（兼容 OpenAI API） | 对话生成 + 工具调用 |
| 通信协议 | SSE（Server-Sent Events） | 流式输出 |
| 参数校验 | Zod | Tool 参数校验 |
| 数据格式 | JSON + Markdown | 时间轴数据 + 知识库 |

---

## 📁 目录结构

```
movie-history-ecosystem/
├── README.md                  # ← 你正在阅读的文件
├── RESUME_HIGHLIGHTS.md       # 简历亮点提炼（可直接复制到简历）
│
├── agent-server/              # 后端 Agent 服务 (Express + LangChain)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example           # 环境变量模板
│   ├── articles/              # 博客知识库（Markdown）
│   │   ├── 1927-爵士歌手.md
│   │   ├── 1939-乱世佳人.md
│   │   ├── 1954-后窗.md
│   │   ├── 1977-星球大战.md
│   │   └── 1994-肖申克的救赎.md
│   └── src/
│       ├── index.ts           # Express 入口，SSE 接口
│       ├── agent.ts           # LangChain Agent 配置（核心）
│       ├── tools.ts           # Tool 定义（3个工具）
│       ├── types.ts           # TS 类型定义 + 年份→音效映射
│       └── eraData.json       # 时间轴数据（22个节点）
│
└── agent-client/              # 前端对话框应用 (Vue3 + Vite)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts         # Vite 配置（含 API 代理）
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.ts            # Vue 应用入口
        ├── App.vue            # 根组件（胶片背景 + 颗粒动画）
        ├── types.ts           # 前端类型定义
        ├── env.d.ts           # Vite 环境变量类型
        ├── utils/
        │   └── sse.ts         # SSE 客户端（fetch + ReadableStream）
        └── components/
            └── ChatBox.vue    # ★ 核心对话框组件（600+ 行）
```

---

## 🧪 运行自检清单

在提交代码或展示前，确保以下检查项全部通过：

- [ ] `cd agent-server && npm install` 无错误
- [ ] `cd agent-client && npm install` 无错误
- [ ] `.env` 文件已配置正确的 `DEEPSEEK_API_KEY`
- [ ] `npm run dev`（agent-server）启动成功，端口 3001
- [ ] `npm run dev`（agent-client）启动成功，端口 5173
- [ ] 浏览器打开 http://localhost:5173 能看到对话框
- [ ] 输入消息后能收到流式 AI 回复
- [ ] 工具调用提示正常显示
- [ ] 音效能正常播放（需要有 Web Audio API 支持）
- [ ] 对话记忆功能正常（问"1927年"，再问"那它的音效呢"）
- [ ] 断网重连后 SSE 能自动恢复（最多 3 次）

---

## ⚖️ 成本分析

### 单次对话成本

| 组成部分 | Token 估算 | 单价（元/百万token） | 成本 |
|---------|-----------|---------------------|------|
| System Prompt | ~200 | 1.0（输入） | ~0.0002 |
| 对话历史 (k=5) | ~500 | 1.0（输入） | ~0.0005 |
| 用户输入 | ~50 | 1.0（输入） | ~0.00005 |
| AI 输出 | ~200 | 2.0（输出） | ~0.0004 |
| 工具调用开销 | ~300 | 1.0（输入） | ~0.0003 |
| **合计** | **~1250** | - | **≈0.0015 元** |

> 结论：单次对话约 **0.0015 元**，1000 次对话约 1.5 元，远低于 0.3 元/次的预算上限。

### 开发成本估算

| 项目 | 耗时 | 说明 |
|------|------|------|
| 项目架构设计 | 2h | 前后端分离 + SSE 协议设计 |
| 后端 Agent 实现 | 4h | LangChain Tool 定义 + Agent 配置 + SSE |
| 前端对话框实现 | 4h | Vue3 组件 + SSE 客户端 + 胶片风格 CSS |
| 博客内容编写 | 2h | 5篇电影史 Markdown 文章 |
| 文档编写 | 2h | README + 简历提炼 + 注释 |
| 调试 & 测试 | 2h | API 联调 + 边界情况处理 |
| **总计** | **16h** | 约 2 个工作日 |

---

## 📄 License

MIT License — 可自由用于学习和商业项目。

---

<p align="center">
  <sub>Built with ❤️ for movie lovers | Powered by LangChain + DeepSeek</sub>
</p>
