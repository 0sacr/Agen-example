/**
 * sse.ts — SSE (Server-Sent Events) 客户端工具
 *
 * ============================================================
 * 工程决策：为什么用 fetch + ReadableStream 而不是 EventSource？
 *
 * EventSource 限制：
 *   - 只支持 GET 请求 → 无法发送 JSON 消息体
 *   - 不支持自定义请求头 → 无法携带认证信息
 *   - 不支持 AbortController → 无法主动取消连接
 *
 * fetch + ReadableStream 优势：
 *   - POST 请求 → 可以发送用户消息
 *   - 支持 AbortController → 可取消请求、切换对话
 *   - 灵活的错误处理 → 可区分网络错误和服务器错误
 *   - 支持重连逻辑 → 自定义重试策略
 *
 * SSE 协议数据格式：
 *   后端发送的每一行格式为: "data: <JSON>\n\n"
 *   我们逐行解析，提取 JSON 数据并回调
 * ============================================================
 */

import type { SSEPacket } from '../types';

/** SSE 事件回调集合 */
export interface SSECallbacks {
  /** 收到文本 token（AI 逐词输出） */
  onText: (token: string) => void;
  /** Agent 开始调用工具 */
  onTool: (toolName: string, args: Record<string, unknown>) => void;
  /** 前端需要执行动作（滚动/音效） */
  onAction: (actionType: string, payload: Record<string, unknown>) => void;
  /** 对话流结束 */
  onDone: (fullResponse: string) => void;
  /** 发生错误 */
  onError: (errorMessage: string) => void;
}

/** SSE 客户端配置 */
export interface SSEClientConfig {
  /** 后端地址 */
  baseUrl: string;
  /** 最大重连次数（默认 3 次） */
  maxRetries?: number;
  /** 重连间隔（毫秒，默认 1000ms） */
  retryDelay?: number;
}

/**
 * 创建 SSE 客户端
 *
 * 使用方式：
 *   const client = createSSEClient({ baseUrl: 'http://localhost:3001' });
 *   await client.send('1927年发生了什么？', 'session-abc', { ... });
 */
export function createSSEClient(config: SSEClientConfig) {
  const { baseUrl, maxRetries = 3, retryDelay = 1000 } = config;

  /** AbortController 实例 — 用于取消正在进行的请求 */
  let abortController: AbortController | null = null;

  /**
   * 发送消息并接收 SSE 流
   *
   * @param message 用户输入的原始文本
   * @param sessionId 会话唯一标识（用于多轮对话记忆）
   * @param callbacks 事件回调
   */
  async function sendMessage(
    message: string,
    sessionId: string,
    callbacks: SSECallbacks
  ): Promise<string> {
    // 取消之前的请求（如果用户快速发送多条消息）
    abortController?.abort();
    abortController = new AbortController();

    let fullResponse = '';  // 累积完整回复文本
    let retryCount = 0;      // 当前重试次数

    /**
     * 实际执行请求的内部函数（支持重试）
     */
    async function attemptFetch(): Promise<string> {
      try {
        const response = await fetch(`${baseUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message, sessionId }),
          signal: abortController!.signal,
        });

        // 检查 HTTP 状态
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `服务器返回 ${response.status}: ${errorBody.slice(0, 200)}`
          );
        }

        // 检查响应体是否存在
        if (!response.body) {
          throw new Error('响应体为空（浏览器可能不支持 ReadableStream）');
        }

        // ============================================================
        // ★ 核心：读取 ReadableStream，逐行解析 SSE 数据
        //
        // ReadableStream 是 WHATWG Streams API 的一部分
        // getReader() 返回一个 ReadableStreamDefaultReader
        // read() 返回 { done: boolean, value: Uint8Array | undefined }
        //
        // 由于 SSE 数据可能跨 chunk 分割，
        // 我们使用 buffer 缓存不完整的行
        // ============================================================
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // 流结束 — 处理 buffer 中剩余的数据
            if (buffer.trim()) {
              processLine(buffer.trim(), callbacks, fullResponse, (t) => {
                fullResponse += t;
              });
            }
            break;
          }

          // 解码二进制数据为文本
          buffer += decoder.decode(value, { stream: true });

          // 按行分割（SSE 每行以 \n 结尾）
          const lines = buffer.split('\n');
          // 最后一行可能不完整，保留到下次循环
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              fullResponse = processSSELine(
                trimmed,
                callbacks,
                fullResponse
              );
            }
          }
        }

        return fullResponse;
      } catch (error) {
        // AbortError 是用户主动取消，不需要重试
        if (error instanceof DOMException && error.name === 'AbortError') {
          return fullResponse;
        }

        // 重试逻辑
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(
            `⚠️ SSE 连接失败，${retryCount}/${maxRetries} 次重试... (${retryDelay}ms 后)`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return attemptFetch(); // 递归重试
        }

        // 重试耗尽 — 向上抛出错误
        const errorMessage =
          error instanceof Error ? error.message : '未知网络错误';
        throw new Error(`SSE 连接失败（已重试 ${maxRetries} 次）: ${errorMessage}`);
      }
    }

    try {
      return await attemptFetch();
    } catch (error) {
      // 最终错误处理
      const errorMessage =
        error instanceof Error ? error.message : '未知错误';
      callbacks.onError(errorMessage);
      return fullResponse;
    }
  }

  /**
   * 取消正在进行的请求
   */
  function abort(): void {
    abortController?.abort();
    abortController = null;
  }

  return { sendMessage, abort };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 处理单行 SSE 数据
 *
 * SSE 格式: data: {"type":"text","content":"1927年","meta":{...}}
 *
 * @param line SSE 单行原始文本
 * @param callbacks 事件回调
 * @param currentResponse 当前累积的完整回复
 * @returns 更新后的完整回复
 */
function processSSELine(
  line: string,
  callbacks: SSECallbacks,
  currentResponse: string
): string {
  // 只处理 data: 开头的行（跳过注释行和空行）
  if (!line.startsWith('data: ')) {
    return currentResponse;
  }

  const jsonStr = line.slice(6); // 去掉 "data: " 前缀

  try {
    const packet: SSEPacket = JSON.parse(jsonStr);
    return handlePacket(packet, callbacks, currentResponse);
  } catch {
    // JSON 解析失败（可能是非 JSON 格式的旧数据），忽略
    console.warn('SSE 数据解析失败:', jsonStr.slice(0, 100));
    return currentResponse;
  }
}

/**
 * 处理解析后的 SSE 数据包
 */
function handlePacket(
  packet: SSEPacket,
  callbacks: SSECallbacks,
  currentResponse: string
): string {
  let response = currentResponse;

  switch (packet.type) {
    case 'text': {
      // ★ 文本 token — 累积到回复，触发打字机效果
      const token: string = packet.content || '';
      response += token;
      callbacks.onText(token);
      break;
    }

    case 'tool': {
      // ★ 工具调用 — Agent 决定调用某个 Tool
      const toolName: string = packet.content || 'unknown';
      const args: Record<string, unknown> =
        (packet.meta?.args as Record<string, unknown>) || {};
      callbacks.onTool(toolName, args);
      break;
    }

    case 'action': {
      // ★ 页面动作 — 工具触发的 DOM 操作（滚动/音效）
      const actionType: string =
        (packet.meta?.actionType as string) || '';
      const payload: Record<string, unknown> =
        (packet.meta as Record<string, unknown>) || {};
      callbacks.onAction(actionType, payload);
      break;
    }

    case 'error': {
      // ★ 错误事件 — 服务器推送的错误信息
      callbacks.onError(packet.content);
      break;
    }

    case 'done': {
      // ★ 流结束 — 通知前端对话完成
      callbacks.onDone(response);
      break;
    }
  }

  return response;
}

/**
 * 处理非 data: 格式的行（兜底逻辑）
 */
function processLine(
  line: string,
  callbacks: SSECallbacks,
  currentResponse: string,
  appendFull: (t: string) => void
): void {
  // 尝试解析为 JSON
  try {
    const packet: SSEPacket = JSON.parse(line);
    const newResponse = handlePacket(packet, callbacks, currentResponse);
    // 如果是 text 类型，需要更新累积
    if (packet.type === 'text') {
      appendFull(packet.content);
    }
  } catch {
    // 忽略无法解析的行
  }
}
