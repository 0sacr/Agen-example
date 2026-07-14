/**
 * index.ts — Express 服务器入口
 *
 * ============================================================
 * 架构说明：
 * - 端口 3001，提供 POST /chat（SSE 流式对话）和 GET /health（健康检查）
 * - POST /chat 接收用户消息 → 调用 LangChain Agent → SSE 流式返回
 * - 前端通过 fetch + ReadableStream 消费 SSE 数据流
 * - 使用 CORS 允许前端跨域访问
 *
 * 工程决策：
 * - 为什么用 SSE 而不是 WebSocket？
 *   SSE 基于 HTTP，更轻量，天然支持断线重连，
 *   且本场景是单向数据流（服务端→客户端），不需要双向通信
 *
 * - 为什么用 fetch + ReadableStream 而不是 EventSource？
 *   EventSource 不支持 POST 请求和自定义请求头，
 *   fetch + ReadableStream 更灵活，且支持 AbortController 取消请求
 * ============================================================
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { runAgentStream, clearSessionMemory } from './agent.js';

// ============================================================
// 0. 环境变量初始化 — 必须在所有逻辑之前加载
// ============================================================
config();

// ============================================================
// 1. Express 应用初始化
// ============================================================
const app = express();
const PORT = parseInt(process.env['PORT'] || '3001', 10);

// CORS 配置：允许前端（Vite dev server 默认 5173）跨域访问
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
}));

// JSON body 解析：处理 POST /chat 的请求体 { message: string, sessionId: string }
app.use(express.json());

// ============================================================
// 2. 健康检查接口
//    用于验证服务器是否正常运行，以及 API Key 是否已配置
// ============================================================
app.get('/health', (_req: Request, res: Response) => {
  const hasApiKey = !!process.env['DEEPSEEK_API_KEY'];

  res.json({
    status: 'ok',
    timestamp: Date.now(),
    model: process.env['LLM_MODEL'] || 'deepseek-chat',
    apiKeyConfigured: hasApiKey,
    // 不暴露 API Key 的具体值（安全考虑）
    message: hasApiKey
      ? '✅ 电影史AI助手服务运行中'
      : '⚠️ 请配置 DEEPSEEK_API_KEY 环境变量',
  });
});

// ============================================================
// 3. 清除会话记忆接口（可选 — 供"新对话"按钮调用）
// ============================================================
app.post('/clear', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId?: string };

  if (!sessionId) {
    res.status(400).json({ error: '缺少 sessionId 参数' });
    return;
  }

  clearSessionMemory(sessionId);
  res.json({ success: true, message: '会话记忆已清除' });
});

// ============================================================
// 4. ★ 核心接口：POST /chat — SSE 流式对话
//
// 请求格式：
//   POST /chat
//   Content-Type: application/json
//   { "message": "1927年发生了什么？", "sessionId": "abc123" }
//
// 响应格式（SSE 数据流）：
//   data: {"type":"text","content":"1927年"}
//   data: {"type":"text","content":"是第一部有声片..."}
//   data: {"type":"tool","content":"scrollToNode","meta":{"args":{"year":1927}}}
//   data: {"type":"action","content":"正在跳转到1927","meta":{"actionType":"scroll",...}}
//   data: {"type":"done","content":""}
//
// 每种 type 的含义：
//   text:   LLM 生成的文本 token → 前端累积为打字机效果
//   tool:   Agent 开始调用工具 → 前端展示工具调用提示
//   action: 工具触发的页面动作 → 前端执行时间轴滚动/音效播放
//   error:  错误信息 → 前端展示错误提示
//   done:   流结束 → 前端停止 loading 状态
// ============================================================
app.post('/chat', async (req: Request, res: Response) => {
  const { message, sessionId } = req.body as {
    message?: string;
    sessionId?: string;
  };

  // --- 参数校验 ---
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: '消息不能为空' });
    return;
  }

  // 安全检查：限制消息长度，防止恶意输入
  if (message.length > 2000) {
    res.status(400).json({ error: '消息过长，请控制在2000字以内' });
    return;
  }

  // 生成或使用已有的 sessionId（用于记忆管理）
  const sid: string = sessionId || randomUUID();

  // --- 设置 SSE 响应头 ---
  // SSE 协议要求：
  //   Content-Type: text/event-stream  → 浏览器知道这是 SSE 流
  //   Cache-Control: no-cache          → 禁止缓存
  //   Connection: keep-alive           → 保持连接
  //   X-Accel-Buffering: no            → 禁用 nginx 缓冲（部署时有用）
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  // 发送初始连接确认事件
  res.write(`data: ${JSON.stringify({ type: 'text', content: '' })}\n\n`);

  // ============================================================
  // SSE 事件发送器 — 闭包捕获 res 对象
  // 将事件序列化为 JSON 并通过 SSE data: 行发送
  // 每个事件以 \n\n 结尾（SSE 协议要求双换行表示事件结束）
  // ============================================================
  const sendEvent = (
    type: 'text' | 'tool' | 'action' | 'error' | 'done',
    content: string,
    meta?: Record<string, unknown>
  ): void => {
    const packet = { type, content, ...(meta ? { meta } : {}) };
    // SSE 格式: data: <JSON>\n\n
    // 每行必须以 "data: " 开头，以 "\n\n" 结尾
    res.write(`data: ${JSON.stringify(packet)}\n\n`);
  };

  // 标记连接是否已关闭（用于错误恢复）
  let isClosed = false;

  // 监听客户端断开连接
  req.on('close', () => {
    isClosed = true;
    console.log(`🔌 客户端断开连接 (会话 ${sid.slice(0, 8)})`);
  });

  try {
    console.log(`📩 收到消息 (会话 ${sid.slice(0, 8)}): "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`);

    // ★ 核心调用：运行 LangChain Agent，流式推送结果
    await runAgentStream(message.trim(), sid, sendEvent);
  } catch (error) {
    // 全局错误兜底
    if (!isClosed) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error('❌ 服务器错误:', errorMsg);
      sendEvent('error', `服务器内部错误: ${errorMsg}`);
      sendEvent('done', '');
    }
  } finally {
    // 确保连接关闭（如果客户端还在）
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// ============================================================
// 5. 404 处理 — 未匹配的路由
// ============================================================
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: '未找到该接口。可用接口: POST /chat, GET /health, POST /clear' });
});

// ============================================================
// 6. 全局错误处理 — 未捕获的异常
// ============================================================
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('💥 未捕获错误:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// ============================================================
// 7. 启动服务器
// ============================================================
app.listen(PORT, () => {
  const hasApiKey = !!process.env['DEEPSEEK_API_KEY'];

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  🎞️  电影史AI光影助手 — Agent 服务              ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  端口: http://localhost:${PORT}                    ║`);
  console.log(`║  模型: ${process.env['LLM_MODEL'] || 'deepseek-chat'}                        ║`);
  console.log(`║  API:  ${hasApiKey ? '✅ 已配置' : '❌ 未配置'}                              ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  接口:                                           ║');
  console.log('║    POST /chat   — SSE 流式对话                   ║');
  console.log('║    GET  /health — 健康检查                       ║');
  console.log('║    POST /clear  — 清除会话记忆                   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  if (!hasApiKey) {
    console.warn('⚠️  警告: DEEPSEEK_API_KEY 未设置！');
    console.warn('   请复制 .env.example 为 .env 并填入你的 API Key');
    console.warn('   获取地址: https://platform.deepseek.com/api_keys');
    console.log('');
  }
});
