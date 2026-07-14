/**
 * types.ts — 电影史AI助手后端类型定义
 *
 * 所有类型均使用 TypeScript 严格模式，禁止 any
 * 对应前端 agent-client/src/types.ts 中的同名类型
 */

// ============================================================
// SSE 事件类型枚举
// 前端通过 EventSource 或 fetch ReadableStream 解析 SSE 数据流
// 每种事件类型对应前端不同的渲染逻辑
// ============================================================

/** SSE 事件类型：前端根据 type 字段决定如何渲染消息 */
export type SSEEventType = 'text' | 'tool' | 'action' | 'error' | 'done';

/** SSE 数据包基础结构 — 所有推送给前端的事件都遵循此格式 */
export interface SSEPacket {
  /** 事件类型 */
  type: SSEEventType;
  /** 事件负载（文本内容 / 工具名 / 动作指令 / 错误信息） */
  content: string;
  /** 附加元数据（工具参数、动作类型等），可选 */
  meta?: Record<string, unknown>;
}

// ============================================================
// 工具参数类型
// LangChain Tool 使用 Zod schema 校验参数，这些类型用于
// TypeScript 侧的类型安全（双重保障）
// ============================================================

/** scrollToNode 工具参数 — 控制时间轴滚动 */
export interface ScrollToNodeInput {
  /** 目标年份，必须在 1895-2024 之间 */
  year: number;
}

/** playEraSound 工具参数 — 控制年代音效播放 */
export interface PlayEraSoundInput {
  /** 目标年份，后台映射为对应的音效类型（silent/jazz/orchestra/scifi/digital/ai） */
  year: number;
}

/** queryBlog 工具参数 — 搜索博客知识库 */
export interface QueryBlogInput {
  /** 搜索关键词，支持电影名、导演名、年份、流派等 */
  keyword: string;
}

// ============================================================
// 对话与记忆类型
// ============================================================

/** 单条对话消息 */
export interface ChatMessage {
  /** 角色：用户 或 AI助手 */
  role: 'user' | 'assistant';
  /** 消息内容 */
  content: string;
  /** 消息时间戳 */
  timestamp: number;
}

/** 对话会话 — 每个浏览器标签页一个 sessionId */
export interface ChatSession {
  /** 会话唯一标识 */
  sessionId: string;
  /** 对话历史（最近 k 轮） */
  messages: ChatMessage[];
  /** 创建时间 */
  createdAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
}

// ============================================================
// API 请求/响应类型
// ============================================================

/** POST /chat 请求体 */
export interface ChatRequest {
  /** 用户输入的自然语言消息 */
  message: string;
  /** 会话 ID，用于维持多轮对话上下文 */
  sessionId: string;
}

/** POST /chat 的 SSE 流式响应 — 由多个 SSEPacket 组成的数据流 */
export type ChatResponse = ReadableStream<Uint8Array>;

// ============================================================
// 年代 → 音效映射（复用 Cinema Evolution.html 的 playEraSound 逻辑）
// ============================================================

/** 音效类型 — 对应官网 data-sound 属性 */
export type SoundType = 'silent' | 'jazz' | 'orchestra' | 'scifi' | 'digital' | 'ai';

/** 年代数据节点 — 复用官网时间轴结构 */
export interface EraNode {
  /** 年份 */
  year: number;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 年代标签 */
  era: string;
  /** 音效类型 */
  sound: SoundType;
}

/**
 * 年份 → 音效映射函数
 * 根据年份找到最近的年代节点，返回对应的音效类型
 * 例如：1927 → 'jazz'，1950（最近的节点 1939）→ 'orchestra'
 */
export function mapYearToSound(year: number, eraNodes: EraNode[]): SoundType {
  // 按年份排序
  const sorted = [...eraNodes].sort((a, b) => a.year - b.year);

  // 精确匹配
  const exact = sorted.find((n) => n.year === year);
  if (exact) return exact.sound;

  // 找最近的节点
  let closest = sorted[0];
  let minDist = Math.abs(year - closest.year);
  for (const node of sorted) {
    const dist = Math.abs(year - node.year);
    if (dist < minDist) {
      minDist = dist;
      closest = node;
    }
  }
  return closest.sound;
}
