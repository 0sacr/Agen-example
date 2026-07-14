/**
 * agent.ts — LangChain Agent 配置与执行 (适配 LangChain 1.x)
 *
 * ============================================================
 * LangChain 1.x API 变更说明：
 *
 * 旧版 (0.3.x):
 *   createOpenAIFunctionsAgent() + AgentExecutor.fromAgentAndTools()
 *   → executor.streamEvents({ input, chat_history })
 *
 * 新版 (1.x):
 *   createAgent({ model, tools, systemPrompt })
 *   → agent.streamEvents({ messages: [...] })
 *
 * 核心变化：
 *   - 不再需要 AgentExecutor，agent 可直接 streamEvents
 *   - 对话历史通过 messages 数组传入，而不是单独的 chat_history 参数
 *   - systemPrompt 直接作为 createAgent 的参数
 * ============================================================
 */

import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { createTools } from './tools.js';
import type { SSEWriter } from './tools.js';

// ============================================================
// 环境变量读取
// ============================================================

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `❌ 缺少必需的环境变量: ${key}。请检查 .env 文件是否存在。`
    );
  }
  return value;
}

// ============================================================
// 成本估算
// DeepSeek V4: 输入 ¥1/百万token, 输出 ¥2/百万token
// 单次对话 ~1250 token → 约 ¥0.002
// ============================================================

// ============================================================
// 1. 创建 Chat Model（DeepSeek V4，兼容 OpenAI API）
// ============================================================
function createModel(): ChatOpenAI {
  const apiKey = getRequiredEnv('DEEPSEEK_API_KEY');
  const baseURL = process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com/v1';
  const modelName = process.env['LLM_MODEL'] || 'deepseek-chat';
  const temperature = parseFloat(process.env['LLM_TEMPERATURE'] || '0.7');

  return new ChatOpenAI({
    model: modelName,
    temperature,
    apiKey,
    configuration: {
      baseURL,
    },
    timeout: 30000,
  });
}

// ============================================================
// 2. System Prompt（电影史AI助手角色设定）
// ============================================================
const SYSTEM_PROMPT = `你是「光影AI助手」，一个专注于电影史（1895-2024）的智能对话助手。

## 你的身份
- 你生活在一座沉浸式电影博物馆的数字世界中
- 你的语气应该像一位博学但亲切的电影策展人
- 你的回答应该简洁、口语化，像在博物馆里面对面聊天

## 你可以做的事情
1. **查询电影史知识**：使用 queryBlog 工具搜索详细资料
2. **跳转时间轴**：使用 scrollToNode 工具帮用户导航到特定年份节点
3. **播放年代音效**：使用 playEraSound 工具播放对应年代的背景音乐

## 回答规则
- 优先使用工具查询知识后再回答，不要凭记忆编造信息
- 当用户说"跳过去"、"去看看"、"播放音乐"等动作时，务必调用对应工具
- 回答控制在3-5句话内，像博物馆导览员一样简洁

## 边界
- 只回答电影史相关问题
- 如果用户问不相关的问题，礼貌引导回电影史话题
- 不说"作为AI"、"根据我的训练数据"等暴露AI身份的话`;

// ============================================================
// 3. 对话记忆（Memory）
//    等价于旧版 BufferMemory(k=5)
// ============================================================

class ChatMemory {
  private store = new Map<string, BaseMessage[]>();
  private readonly maxTurns: number;

  constructor(maxTurns = 5) {
    this.maxTurns = maxTurns;
  }

  getHistory(sessionId: string): BaseMessage[] {
    return this.store.get(sessionId) || [];
  }

  addTurn(sessionId: string, userMessage: string, aiMessage: string): void {
    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, []);
    }
    const history = this.store.get(sessionId)!;
    history.push(new HumanMessage(userMessage));
    history.push(new AIMessage(aiMessage));

    const maxMessages = this.maxTurns * 2;
    while (history.length > maxMessages) {
      history.shift();
    }
  }

  clear(sessionId: string): void {
    this.store.delete(sessionId);
  }

  size(sessionId: string): number {
    return this.store.get(sessionId)?.length || 0;
  }
}

const memory = new ChatMemory(
  parseInt(process.env['MEMORY_K'] || '5', 10)
);

// ============================================================
// 4. 创建 Agent（LangChain 1.x API）
// ============================================================
async function createAgentInstance(
  tools: ReturnType<typeof createTools>
): Promise<ReturnType<typeof createAgent>> {
  const model = createModel();

  // ★ LangChain 1.x: createAgent 替代了旧版的 createOpenAIFunctionsAgent + AgentExecutor
  // 参数说明:
  //   model:       LLM 实例（ChatOpenAI）
  //   tools:       工具列表（scrollToNode / playEraSound / queryBlog）
  //   systemPrompt: 系统提示词，定义角色和行为规则
  const agent = createAgent({
    model,
    tools,
    systemPrompt: SYSTEM_PROMPT,
  });

  return agent;
}

// ============================================================
// 5. 流式执行 Agent 并推送 SSE 事件 (核心函数)
//
// LangChain 1.x 的 streamEvents API:
//   agent.streamEvents(
//     { messages: [...history, new HumanMessage(input)] },
//     { version: "v2" }
//   )
//
// 事件类型同旧版:
//   on_chat_model_stream → token 流
//   on_tool_start        → 工具调用开始
//   on_tool_end          → 工具调用结束
// ============================================================
export async function runAgentStream(
  userMessage: string,
  sessionId: string,
  sendEvent: SSEWriter
): Promise<void> {
  const chatHistory = memory.getHistory(sessionId);
  const tools = createTools(sendEvent);
  const agent = await createAgentInstance(tools);

  // ★ LangChain 1.x: 将历史消息和当前输入合并为一个 messages 数组
  const messages: BaseMessage[] = [
    ...chatHistory,
    new HumanMessage(userMessage),
  ];

  let fullResponse = '';

  try {
    // ★ streamEvents — 流式事件循环（同旧版，但调用方式不同）
    const eventStream = agent.streamEvents(
      { messages },
      { version: 'v2' }
    );

    for await (const event of eventStream) {
      // LLM 流式生成 token
      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk;
        if (chunk?.content && typeof chunk.content === 'string') {
          fullResponse += chunk.content;
          sendEvent('text', chunk.content);
        }
      }

      // Agent 开始调用工具
      if (event.event === 'on_tool_start') {
        const toolName: string = event.name || 'unknown';
        const toolInput = event.data?.input || {};
        sendEvent('tool', toolName, { args: toolInput });
        console.log(`🔧 Agent 调用工具: ${toolName}(${JSON.stringify(toolInput)})`);
      }

      // 工具执行完成
      if (event.event === 'on_tool_end') {
        const output = event.data?.output;
        console.log(
          `✅ 工具结果: ${typeof output === 'string' ? output.slice(0, 100) : '[非文本]'}...`
        );
      }
    }

    // 保存到记忆
    if (fullResponse) {
      memory.addTurn(sessionId, userMessage, fullResponse);
    }

    sendEvent('done', '');

    console.log(
      `💬 会话 ${sessionId.slice(0, 8)}: 记忆=${memory.size(sessionId)}条 回复=${fullResponse.length}字`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error(`❌ Agent 错误 (${sessionId.slice(0, 8)}):`, errorMessage);
    sendEvent('error', `抱歉，出了点问题：${errorMessage}。请稍后重试或检查 API Key 配置。`);
    sendEvent('done', '');
  }
}

export function clearSessionMemory(sessionId: string): void {
  memory.clear(sessionId);
}

export function getMemory(): ChatMemory {
  return memory;
}
