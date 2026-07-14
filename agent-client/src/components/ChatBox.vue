<script setup lang="ts">
/**
 * ChatBox.vue — AI 光影助手对话框组件
 *
 * ============================================================
 * 功能概览：
 * 1. SSE 流式接收 AI 回复（打字机效果，逐 token 渲染）
 * 2. 工具调用提示（"🎬 正在跳转到1927节点..."）
 * 3. 页面动作执行（时间轴滚动、年代音效播放 — 复用官网函数）
 * 4. 消息列表管理（用户消息 + AI 消息 + 工具提示 + 错误提示）
 * 5. 输入框支持 Enter 发送 / Shift+Enter 换行
 * 6. 胶片美学视觉风格（复用 Cinema Evolution.html 的 CSS 变量）
 *
 * 复用资源：
 * - CSS 变量体系：--gold / --cream / --film-dark / --velvet-red 等
 * - 字体系统：Cinzel + Inter + Noto Serif SC
 * - 官网 DOM 操作函数：playEraSound(era) / scrollIntoView
 * - 视觉元素：噪点纹理、暗角效果
 * ============================================================
 */

import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { createSSEClient } from '../utils/sse';
import type { SSEPacket } from '../types';

// ============================================================
// 类型定义
// ============================================================

/** 聊天消息 */
interface ChatMessage {
  /** 唯一标识（用于 Vue :key 和打字机动画） */
  id: string;
  /** 角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息文本内容 */
  content: string;
  /** 消息类型 */
  type: 'text' | 'tool' | 'action' | 'error';
  /** 时间戳 */
  timestamp: number;
  /** 工具名称（type=tool 时有值） */
  toolName?: string;
  /** 是否正在打字（AI 消息的逐字渲染动画） */
  isTyping?: boolean;
}

// ============================================================
// Props & Emits
// ============================================================

const props = withDefaults(
  defineProps<{
    welcomeMessage?: string;
    showCloseButton?: boolean;
  }>(),
  {
    welcomeMessage: '你好！我是光影AI助手 🎬',
    showCloseButton: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// ============================================================
// 响应式状态
// ============================================================

/** 消息列表 */
const messages = ref<ChatMessage[]>([]);

/** 输入框内容 */
const inputText = ref<string>('');

/** 是否正在等待 AI 回复 */
const isLoading = ref<boolean>(false);

/** 会话 ID（页面加载时生成，标签页级别） */
const sessionId = ref<string>(generateSessionId());

/** 消息列表容器引用（用于自动滚动） */
const messageContainer = ref<HTMLDivElement | null>(null);

/** 输入框引用（用于自动聚焦） */
const inputRef = ref<HTMLTextAreaElement | null>(null);

/** 当前正在打字的消息 ID（用于追加 token） */
let currentTypingId: string | null = null;

// ============================================================
// SSE 客户端初始化
// ============================================================

const sseClient = createSSEClient({
  // 开发环境通过 Vite proxy 转发，生产环境需配置实际地址
  baseUrl: '',
  maxRetries: 3,
  retryDelay: 1500,
});

// ============================================================
// 初始化欢迎消息
// ============================================================

onMounted(() => {
  if (props.welcomeMessage) {
    messages.value.push({
      id: 'welcome-' + Date.now(),
      role: 'assistant',
      content: props.welcomeMessage,
      type: 'text',
      timestamp: Date.now(),
    });
  }
  // 自动聚焦输入框
  nextTick(() => inputRef.value?.focus());
});

onUnmounted(() => {
  // 组件销毁时取消正在进行的 SSE 请求
  sseClient.abort();
});

// ============================================================
// 发送消息 — 核心交互函数
// ============================================================

async function sendMessage(): Promise<void> {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;

  // 1. 添加用户消息到列表
  const userMsg: ChatMessage = {
    id: 'user-' + Date.now(),
    role: 'user',
    content: text,
    type: 'text',
    timestamp: Date.now(),
  };
  messages.value.push(userMsg);

  // 2. 清空输入框
  inputText.value = '';

  // 3. 创建 AI 消息占位（用于打字机效果逐字填充）
  const aiMsgId = 'ai-' + Date.now();
  const aiMsg: ChatMessage = {
    id: aiMsgId,
    role: 'assistant',
    content: '',
    type: 'text',
    timestamp: Date.now(),
    isTyping: true,
  };
  messages.value.push(aiMsg);
  currentTypingId = aiMsgId;

  // 4. 设置 loading 状态
  isLoading.value = true;

  // 5. 滚动到底部
  await scrollToBottom();

  // 6. 通过 SSE 发送消息并接收流式回复
  try {
    await sseClient.sendMessage(text, sessionId.value, {
      // --- 收到文本 token → 追加到当前 AI 消息，实现打字机效果 ---
      onText: (token: string) => {
        const msg = messages.value.find((m) => m.id === aiMsgId);
        if (msg) {
          msg.content += token;
          // 每收到一个 token 就滚动，保持最新内容可见
          scrollToBottom();
        }
      },

      // --- Agent 调用工具 → 在消息列表中插入工具提示 ---
      onTool: (toolName: string, args: Record<string, unknown>) => {
        const toolLabels: Record<string, string> = {
          scrollToNode: `🎬 正在跳转到 ${args.year || '?'} 年节点...`,
          playEraSound: `🎵 正在播放 ${args.year || '?'} 年代音效...`,
          queryBlog: `📚 正在搜索电影史知识库: "${args.keyword || '?'}"...`,
        };

        const label = toolLabels[toolName] || `🔧 调用工具: ${toolName}`;

        messages.value.push({
          id: 'tool-' + Date.now(),
          role: 'system',
          content: label,
          type: 'tool',
          toolName,
          timestamp: Date.now(),
        });
        scrollToBottom();
      },

      // --- 执行页面动作 → 调用官网已有函数 ---
      onAction: (actionType: string, payload: Record<string, unknown>) => {
        if (actionType === 'scroll') {
          // ★ 复用官网时间轴 DOM 结构
          // Cinema Evolution.html 使用 data-era 属性标记节点
          // 此处调用 scrollIntoView 滚动到目标节点
          executeScrollAction(payload as { year: number; title?: string });
        } else if (actionType === 'sound') {
          // ★ 复用官网 Web Audio API 音效系统
          // Cinema Evolution.html 的 playEraSound(era) 函数 (line 1499)
          executeSoundAction(payload as { year: number; sound?: string });
        }

        // 在消息列表中添加动作确认提示
        const actionLabel = getActionLabel(actionType, payload);
        if (actionLabel) {
          messages.value.push({
            id: 'action-' + Date.now(),
            role: 'system',
            content: actionLabel,
            type: 'action',
            timestamp: Date.now(),
          });
          scrollToBottom();
        }
      },

      // --- 对话完成 ---
      onDone: (_fullResponse: string) => {
        // 标记打字完成
        const msg = messages.value.find((m) => m.id === aiMsgId);
        if (msg) {
          msg.isTyping = false;
        }
        currentTypingId = null;
        isLoading.value = false;
      },

      // --- 错误处理 ---
      onError: (errorMessage: string) => {
        messages.value.push({
          id: 'error-' + Date.now(),
          role: 'system',
          content: `❌ ${errorMessage}`,
          type: 'error',
          timestamp: Date.now(),
        });
        isLoading.value = false;
        scrollToBottom();
      },
    });
  } catch (error) {
    // 网络层兜底错误处理
    const errMsg = error instanceof Error ? error.message : '未知错误';
    messages.value.push({
      id: 'error-' + Date.now(),
      role: 'system',
      content: `❌ 网络连接失败: ${errMsg}`,
      type: 'error',
      timestamp: Date.now(),
    });
    isLoading.value = false;
  }
}

// ============================================================
// 官网动作执行函数（Bridge 层 — 连接 AI Agent 和现有官网逻辑）
// ============================================================

/**
 * 执行时间轴滚动 — 复用官网 DOM 结构
 *
 * Cinema Evolution.html 的时间轴节点结构：
 *   <div class="milestone-node" data-era="1927" data-sound="jazz">...</div>
 *
 * 此函数查找 data-era 属性匹配的节点，并平滑滚动到它
 */
function executeScrollAction(payload: { year: number; title?: string }): void {
  const { year } = payload;

  // 查找官网时间轴节点（data-era 属性匹配）
  const node = document.querySelector(`[data-era="${year}"]`);

  if (node) {
    // ★ 复用浏览器原生 scrollIntoView，官网已设置 scroll-behavior: auto
    // 这里显式使用 smooth 以确保动画效果
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 添加视觉反馈：短暂的发光脉冲
    node.classList.add('ai-highlight');
    setTimeout(() => node.classList.remove('ai-highlight'), 2000);

    console.log(`🎬 AI 助手触发: 时间轴滚动到 ${year} 年「${payload.title || ''}」`);
  } else {
    console.warn(`⚠️ 时间轴节点 data-era="${year}" 未找到，请确认官网 DOM 结构`);
    // 优雅降级：如果节点不存在（独立运行模式），记录日志而不报错
  }
}

/**
 * 执行年代音效播放 — 复用官网 Web Audio API
 *
 * Cinema Evolution.html 的 playEraSound(era) 函数 (line 1499):
 *   接收 era 字符串（'silent'|'jazz'|'orchestra'|'scifi'|'digital'|'ai'）
 *   使用 Web Audio API 创建振荡器并播放对应频率的声音
 *
 * 年份 → 音效映射（与官网 data-sound 属性保持一致）：
 *   1895 → silent    1927 → jazz      1939 → orchestra
 *   1977 → scifi     1999 → digital   2024 → ai
 */
function executeSoundAction(payload: { year: number; sound?: string }): void {
  const { year, sound: explicitSound } = payload;

  // 如果有显式传入的音效类型，直接使用；否则根据年份推断
  if (explicitSound) {
    // ★ 尝试调用官网的全局 playEraSound 函数
    callPlayEraSound(explicitSound);
    return;
  }

  // 年份到音效类型的映射（与官网 data-sound 属性一致）
  const yearToSound: Record<number, string> = {
    1895: 'silent',
    1902: 'silent',
    1915: 'silent',
    1927: 'jazz',
    1931: 'jazz',
    1939: 'orchestra',
    1941: 'orchestra',
    1954: 'orchestra',
    1960: 'jazz',
    1968: 'orchestra',
    1972: 'orchestra',
    1975: 'orchestra',
    1977: 'scifi',
    1982: 'scifi',
    1993: 'digital',
    1994: 'orchestra',
    1999: 'digital',
    2001: 'orchestra',
    2008: 'digital',
    2010: 'digital',
    2019: 'digital',
    2024: 'ai',
  };

  const sound = yearToSound[year] || 'orchestra';
  callPlayEraSound(sound);
}

/**
 * 调用官网的 playEraSound 函数（如果可用）
 * 如果是独立运行模式（未嵌入官网），则播放简化版音效
 */
function callPlayEraSound(era: string): void {
  // ★ 优先调用官网全局的 playEraSound 函数（Cinema Evolution.html line 1499）
  const globalWindow = window as Window & {
    playEraSound?: (era: string) => void;
  };

  if (typeof globalWindow.playEraSound === 'function') {
    globalWindow.playEraSound(era);
    console.log(`🎵 AI 助手触发: 播放年代音效 "${era}"（使用官网 Web Audio API）`);
  } else {
    // 独立运行模式：使用简化版 Web Audio API 音效
    console.log(`🎵 AI 助手触发: 播放年代音效 "${era}"（独立模式，使用内置音效生成器）`);
    playBuiltInSound(era);
  }
}

/**
 * 内置音效生成器（独立运行模式下的降级方案）
 * 当页面未嵌入 Cinema Evolution.html 时使用
 * 复用了官网 playEraSound 的音效配置逻辑
 */
function playBuiltInSound(era: string): void {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('⚠️ 当前浏览器不支持 Web Audio API');
      return;
    }

    const ctx = new AudioContextClass();

    // 音效配置 — 与 Cinema Evolution.html 的 sounds 对象完全一致
    const sounds: Record<string, { freq: number | number[]; type: OscillatorType }> = {
      silent: { freq: 440, type: 'sine' },
      jazz: { freq: [330, 392, 494], type: 'triangle' },
      orchestra: { freq: [262, 330, 392, 523], type: 'sine' },
      scifi: { freq: 200, type: 'sawtooth' },
      digital: { freq: [800, 1600], type: 'square' },
      ai: { freq: [1200, 1800, 2400], type: 'sine' },
    };

    const cfg = sounds[era] || sounds['silent'];
    if (!cfg) return;

    const freqs = Array.isArray(cfg.freq) ? cfg.freq : [cfg.freq];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cfg.type;
      osc.frequency.value = f;
      gain.gain.value = 0.06 / freqs.length;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5 + i * 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + 0.6 + i * 0.1);
    });
  } catch {
    console.warn('⚠️ Web Audio API 初始化失败');
  }
}

/** 获取动作类型的中文标签 */
function getActionLabel(
  actionType: string,
  payload: Record<string, unknown>
): string {
  switch (actionType) {
    case 'scroll':
      return `📍 时间轴已跳转到 ${payload.year || '?'} 年`;
    case 'sound':
      return `🔊 年代音效已触发`;
    default:
      return '';
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 格式化时间戳为 HH:MM 显示
 * 非响应式纯函数，在模板中直接调用
 */
function formatTime(ts: number): string {
  const date = new Date(ts);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** 生成唯一会话 ID */
function generateSessionId(): string {
  return 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/** 滚动消息列表到底部 */
async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
}

/** 处理键盘事件：Enter 发送，Shift+Enter 换行 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

/** 清空对话 */
function clearChat(): void {
  messages.value = [];
  currentTypingId = null;
  // 重新显示欢迎消息
  if (props.welcomeMessage) {
    messages.value.push({
      id: 'welcome-' + Date.now(),
      role: 'assistant',
      content: props.welcomeMessage,
      type: 'text',
      timestamp: Date.now(),
    });
  }
  // 清除服务端会话记忆
  fetch('/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId.value }),
  }).catch(console.error);

  // 聚焦输入框
  nextTick(() => inputRef.value?.focus());
}

/** 快捷问题示例 */
const quickQuestions: string[] = [
  '1927年发生了什么？然后跳过去播爵士乐',
  '介绍一下《星球大战》的历史意义',
  '带我去看1977年的节点',
];
</script>

<template>
  <div class="chat-box">
    <!-- ============================================================
         对话框头部
         ============================================================ -->
    <header class="chat-header">
      <div class="header-left">
        <span class="header-icon">🎞️</span>
        <h1 class="header-title">光影AI助手</h1>
      </div>
      <div class="header-right">
        <button
          class="header-btn"
          title="新对话"
          @click="clearChat"
        >
          ✨ 新对话
        </button>
        <button
          v-if="showCloseButton"
          class="header-btn header-btn-close"
          title="关闭"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
    </header>

    <!-- ============================================================
         消息列表
         ============================================================ -->
    <div
      ref="messageContainer"
      class="chat-messages"
    >
      <!-- 空状态 -->
      <div
        v-if="messages.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">🎬</div>
        <div class="empty-text">输入电影史问题开始对话</div>
        <div class="empty-hint">
          试试问：1927年发生了什么？或者：带我去看看爵士乐时代
        </div>
      </div>

      <!-- 消息列表渲染 -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="{
          'message-user': msg.role === 'user',
          'message-assistant': msg.role === 'assistant',
          'message-system': msg.role === 'system',
        }"
      >
        <!-- 用户消息（右对齐，深棕色气泡） -->
        <div v-if="msg.role === 'user'" class="message-bubble bubble-user">
          <div class="bubble-content">{{ msg.content }}</div>
          <div class="bubble-time">{{ formatTime(msg.timestamp) }}</div>
        </div>

        <!-- AI 消息（左对齐，胶片黄气泡，打字机效果） -->
        <div
          v-else-if="msg.role === 'assistant'"
          class="message-bubble bubble-ai"
        >
          <div class="bubble-content">
            {{ msg.content }}
            <!-- 打字光标动画 -->
            <span
              v-if="msg.isTyping"
              class="typing-cursor"
              aria-label="正在输入..."
            >▍</span>
          </div>
          <div class="bubble-time">{{ formatTime(msg.timestamp) }}</div>
        </div>

        <!-- 系统消息（工具调用/动作/错误，居中显示） -->
        <div v-else class="message-bubble bubble-system">
          <div class="bubble-content bubble-system-content">
            {{ msg.content }}
          </div>
        </div>
      </div>

      <!-- Loading 指示器（发送后等待首个 token 时显示） -->
      <div v-if="isLoading && currentTypingId" class="loading-indicator">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
    </div>

    <!-- ============================================================
         快捷问题
         ============================================================ -->
    <div v-if="messages.length <= 1" class="quick-questions">
      <button
        v-for="q in quickQuestions"
        :key="q"
        class="quick-btn"
        @click="inputText = q; sendMessage()"
      >
        {{ q }}
      </button>
    </div>

    <!-- ============================================================
         输入区域
         ============================================================ -->
    <footer class="chat-input-area">
      <div class="input-wrapper">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="chat-textarea"
          placeholder="输入电影史问题，Enter 发送，Shift+Enter 换行..."
          rows="1"
          :disabled="isLoading"
          @keydown="onKeydown"
        ></textarea>
        <button
          class="send-btn"
          :class="{ 'send-btn-loading': isLoading }"
          :disabled="!inputText.trim() || isLoading"
          title="发送消息"
          @click="sendMessage"
        >
          <span v-if="!isLoading">▶</span>
          <span v-else class="send-spinner">◌</span>
        </button>
      </div>
      <div class="input-hint">
        AI 回复基于电影史知识库 · 快捷键 Enter 发送
      </div>
    </footer>
  </div>
</template>
<style scoped>
/* ═══════════════════════════════════════════════════════
   ChatBox 样式 — 复用 Cinema Evolution.html 的胶片设计系统
   所有颜色、字体、间距与官网保持一致
   ═══════════════════════════════════════════════════════ */

/* ============================================================
   容器 — 胶片边框效果
   ============================================================ */
.chat-box {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  height: 85vh;
  max-height: 700px;
  background:
    linear-gradient(135deg, var(--film-dark) 0%, #0e0c08 50%, var(--film-dark) 100%);
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 4px;
  box-shadow:
    0 0 40px rgba(0, 0, 0, 0.6),
    inset 0 0 80px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  position: relative;
}

/* 胶片齿孔装饰（左右两侧） */
.chat-box::before,
.chat-box::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 12px,
    rgba(201, 168, 76, 0.15) 12px,
    rgba(201, 168, 76, 0.15) 18px
  );
  z-index: 2;
  pointer-events: none;
}
.chat-box::before { left: 8px; }
.chat-box::after  { right: 8px; }

/* ============================================================
   头部
   ============================================================ */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(201, 168, 76, 0.15);
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.4), transparent);
  z-index: 3;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 24px;
}

.header-title {
  font-family: 'Cinzel', 'Noto Serif SC', serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.08em;
  text-shadow: 0 0 20px rgba(201, 168, 76, 0.3);
}

.header-right {
  display: flex;
  gap: 8px;
}

.header-btn {
  padding: 6px 14px;
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 2px;
  background: transparent;
  color: var(--gold-dim);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
  background: rgba(201, 168, 76, 0.08);
}

.header-btn-close {
  font-size: 16px;
  padding: 4px 10px;
}

/* ============================================================
   消息列表区域
   ============================================================ */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 28px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 胶片噪点纹理叠加（CSS 实现） */
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  scroll-behavior: smooth;
}

/* ============================================================
   消息行 — 布局
   ============================================================ */
.message-row {
  display: flex;
  animation: message-in 0.3s ease-out;
}

@keyframes message-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.message-user {
  justify-content: flex-end;
}

.message-assistant {
  justify-content: flex-start;
}

.message-system {
  justify-content: center;
}

/* ============================================================
   消息气泡
   ============================================================ */
.message-bubble {
  max-width: 80%;
  padding: 10px 16px;
  border-radius: 4px;
  position: relative;
}

/* 用户气泡 — 深棕色，靠右 */
.bubble-user {
  background: linear-gradient(135deg, #3d291a 0%, #2a1a0e 100%);
  border: 1px solid rgba(201, 168, 76, 0.2);
  color: var(--cream);
  border-bottom-right-radius: 2px;
}

/* AI 气泡 — 胶片黄，靠左 */
.bubble-ai {
  background: linear-gradient(135deg, rgba(201, 168, 76, 0.12) 0%, rgba(139, 117, 48, 0.08) 100%);
  border: 1px solid rgba(201, 168, 76, 0.18);
  color: #f5e6c8;
  border-bottom-left-radius: 2px;
}

/* 系统气泡 — 居中工具/动作提示 */
.bubble-system {
  background: transparent;
  border: none;
  max-width: 90%;
  padding: 4px 12px;
}

.bubble-system-content {
  font-size: 13px;
  color: var(--gold-dim);
  text-align: center;
  opacity: 0.8;
  font-style: italic;
}

.bubble-content {
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
  white-space: pre-wrap;
}

.bubble-time {
  font-size: 10px;
  color: rgba(212, 200, 176, 0.35);
  margin-top: 4px;
  text-align: right;
}

/* ============================================================
   打字光标动画
   ============================================================ */
.typing-cursor {
  display: inline-block;
  animation: cursor-blink 1s step-end infinite;
  color: var(--gold);
  font-weight: bold;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

/* ============================================================
   Loading 三点动画
   ============================================================ */
.loading-indicator {
  display: flex;
  gap: 6px;
  padding: 8px 16px;
}

.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gold-dim);
  animation: dot-pulse 1.4s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1.2); }
}

/* ============================================================
   快捷问题
   ============================================================ */
.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 20px 12px;
  border-top: 1px solid rgba(201, 168, 76, 0.08);
}

.quick-btn {
  padding: 6px 14px;
  border: 1px solid rgba(201, 168, 76, 0.2);
  border-radius: 2px;
  background: rgba(201, 168, 76, 0.04);
  color: var(--gold-dim);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.quick-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
  background: rgba(201, 168, 76, 0.1);
}

/* ============================================================
   输入区域 — 底部固定
   ============================================================ */
.chat-input-area {
  padding: 12px 20px 16px;
  border-top: 1px solid rgba(201, 168, 76, 0.15);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.4), transparent);
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(201, 168, 76, 0.2);
  border-radius: 4px;
  padding: 8px 12px;
  transition: border-color 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--gold);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.1);
}

.chat-textarea {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--cream);
  font-family: 'Inter', 'Noto Serif SC', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 24px;
  max-height: 120px;
}

.chat-textarea::placeholder {
  color: rgba(212, 200, 176, 0.3);
}

.chat-textarea:disabled {
  opacity: 0.5;
}

.send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 1px solid var(--gold);
  border-radius: 50%;
  background: transparent;
  color: var(--gold);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.15);
  box-shadow: 0 0 16px rgba(201, 168, 76, 0.2);
}

.send-btn:disabled {
  border-color: rgba(201, 168, 76, 0.15);
  color: rgba(201, 168, 76, 0.25);
  cursor: not-allowed;
}

/* 发送按钮 loading 旋转动画 */
.send-btn-loading {
  border-color: rgba(201, 168, 76, 0.4);
}

.send-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.input-hint {
  font-size: 10px;
  color: rgba(139, 117, 48, 0.4);
  text-align: center;
  margin-top: 8px;
  letter-spacing: 0.05em;
}

/* ============================================================
   空状态
   ============================================================ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-text {
  font-family: 'Cinzel', 'Noto Serif SC', serif;
  font-size: 16px;
  color: var(--gold-dim);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 12px;
  color: rgba(139, 117, 48, 0.45);
}
</style>
