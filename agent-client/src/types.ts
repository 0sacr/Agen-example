/**
 * types.ts — 前端类型定义
 *
 * 与后端 agent-server/src/types.ts 保持同步
 * 所有类型均启用严格模式，禁止 any
 */

// ============================================================
// SSE 事件类型 — 对应后端推送给前端的 data: JSON 行
// ============================================================

/** SSE 数据包 — 后端每次推送的 JSON 结构 */
export interface SSEPacket {
  /** 事件类型：text | tool | action | error | done */
  type: 'text' | 'tool' | 'action' | 'error' | 'done';
  /** 内容：文本 token / 工具名 / 动作描述 / 错误信息 */
  content: string;
  /** 元数据（可选）：工具参数、动作类型等 */
  meta?: Record<string, unknown>;
}

// ============================================================
// 消息类型 — 前端消息列表中的每条消息
// ============================================================

/** 消息角色 */
export type MessageRole = 'user' | 'assistant';

/** 消息类型（决定渲染方式） */
export type MessageType = 'text' | 'tool' | 'action' | 'error';

/** 聊天消息 — 前端消息列表的基本单元 */
export interface ChatMessage {
  /** 消息唯一 ID（用于 Vue 的 :key） */
  id: string;
  /** 角色：用户 / AI助手 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 消息类型 */
  msgType: MessageType;
  /** 时间戳 */
  timestamp: number;
  /** 元数据（工具调用时包含 { toolName, args }） */
  meta?: Record<string, unknown>;
}

// ============================================================
// API 请求/响应类型
// ============================================================

/** POST /chat 请求体 */
export interface ChatRequest {
  message: string;
  sessionId: string;
}

/** POST /chat SSE 响应 */
export type ChatSSEResponse = ReadableStream<Uint8Array>;

// ============================================================
// 组件 Props/Emits 类型
// ============================================================

/** ChatBox 组件属性 */
export interface ChatBoxProps {
  /** 初始欢迎消息 */
  welcomeMessage?: string;
  /** 是否在右上角显示关闭按钮 */
  showCloseButton?: boolean;
  /** 自定义 CSS 类名 */
  class?: string;
}

/** ChatBox 组件事件 */
export interface ChatBoxEmits {
  /** 关闭对话框 */
  (e: 'close'): void;
  /** 工具调用事件（可用于外部监听） */
  (e: 'tool-called', toolName: string, args: Record<string, unknown>): void;
}
