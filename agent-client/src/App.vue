<script setup lang="ts">
/**
 * App.vue — 应用根组件
 *
 * 功能：
 *   1. 渲染胶片质感背景（复用 Cinema Evolution.html 的 CSS 变量体系）
 *   2. 嵌入 ChatBox 对话框组件
 *   3. 管理全局状态：对话开关、音效状态（预留给官网集成）
 *
 * 复用资源：
 *   - CSS 变量：--sepia / --gold / --cream / --film-dark / --velvet-red 等（来自 Cinema Evolution.html）
 *   - 字体系统：Cinzel + Inter + Noto Serif SC（来自 Cinema Evolution.html）
 *   - 视觉元素：胶片颗粒 Canvas、暗角效果（CSS 实现）
 */
import { ref, onMounted, onUnmounted } from 'vue';
import ChatBox from './components/ChatBox.vue';

// ============================================================
// 状态管理
// ============================================================

/** 对话框是否展开 */
const isChatOpen = ref<boolean>(true);

/** 切换对话框显隐 */
function toggleChat(): void {
  isChatOpen.value = !isChatOpen.value;
}

// ============================================================
// 胶片颗粒 Canvas 动画（复用 Cinema Evolution.html 的视觉效果）
// ============================================================
let grainCanvas: HTMLCanvasElement | null = null;
let grainCtx: CanvasRenderingContext2D | null = null;
let grainAnimId: number | null = null;

/** 初始化胶片颗粒效果 */
function initFilmGrain(): void {
  grainCanvas = document.getElementById('film-grain') as HTMLCanvasElement;
  if (!grainCanvas) return;

  grainCtx = grainCanvas.getContext('2d');
  if (!grainCtx) return;

  resizeGrainCanvas();
  window.addEventListener('resize', resizeGrainCanvas);

  // 启动颗粒动画
  renderGrainFrame();
}

/** 调整颗粒 Canvas 尺寸 */
function resizeGrainCanvas(): void {
  if (!grainCanvas) return;
  grainCanvas.width = window.innerWidth;
  grainCanvas.height = window.innerHeight;
}

/** 单帧颗粒渲染 */
function renderGrainFrame(): void {
  if (!grainCtx || !grainCanvas) return;

  const { width, height } = grainCanvas;
  const imageData = grainCtx.createImageData(width, height);
  const data = imageData.data;

  // 每帧随机生成颗粒（类似 35mm 胶片的银盐颗粒效果）
  for (let i = 0; i < data.length; i += 4) {
    // 仅随机修改部分像素，创建颗粒感
    if (Math.random() < 0.05) {
      const noise = Math.random() * 30;
      data[i] = noise;     // R
      data[i + 1] = noise; // G
      data[i + 2] = noise; // B
      data[i + 3] = Math.random() * 15; // A（低透明度的颗粒）
    }
  }

  grainCtx.putImageData(imageData, 0, 0);
  grainAnimId = requestAnimationFrame(renderGrainFrame);
}

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
  initFilmGrain();
});

onUnmounted(() => {
  if (grainAnimId !== null) {
    cancelAnimationFrame(grainAnimId);
  }
  window.removeEventListener('resize', resizeGrainCanvas);
});
</script>

<template>
  <!--
    ★ 整个页面的 CSS 变量体系复用 Cinema Evolution.html
    包括 --sepia、--gold、--cream、--film-dark、--velvet-red 等
    确保 AI 助手对话框与现有官网视觉完全一致
  -->
  <div class="app-shell">
    <!-- 胶片颗粒 Canvas（复用官网的 #film-grain-canvas 概念） -->
    <canvas
      id="film-grain"
      class="film-grain-overlay"
      aria-hidden="true"
    ></canvas>

    <!-- 暗角遮罩（复用官网的 .aging-vignette） -->
    <div class="aging-vignette" aria-hidden="true"></div>

    <!-- 主内容区 — ChatBox 对话框 -->
    <main class="main-content">
      <ChatBox
        v-if="isChatOpen"
        welcome-message="你好！我是光影AI助手 🎬&#10;可以帮你查询电影史知识、跳转时间轴、播放年代音效。&#10;比如试试问我：「1927年发生了什么？然后跳过去播爵士乐」"
        @close="toggleChat"
      />
    </main>

    <!-- 底部状态栏 -->
    <footer class="app-footer">
      <span class="footer-text">
        复用 Cinema Evolution 设计系统 · LangChain Agent 驱动
      </span>
    </footer>
  </div>
</template>

<style>
/* ═══════════════════════════════════════════════════════
   GLOBAL STYLES — 复用 Cinema Evolution.html 设计系统
   所有 CSS 变量和设计 Token 与官网保持一致
   ═══════════════════════════════════════════════════════ */

/* ============================================================
   CSS 自定义属性（复用 Cinema Evolution.html 的 :root 变量）
   ============================================================ */
:root {
  --sepia: #3d291a;
  --sepia-light: #8b6914;
  --technicolor-r: #b30000;
  --technicolor-g: #006400;
  --technicolor-b: #00008b;
  --nh-blue: #1a1f2b;
  --cyber-cyan: #00ffff;
  --cyber-magenta: #ff00ff;
  --gold: #c9a84c;
  --gold-dim: #8b7530;
  --cream: #f5f0e8;
  --bg: #0a0a0a;
  --text: #d4c8b0;
  --film-dark: #1a1814;
  --film-mid: #2a2620;
  --velvet-red: #4a1018;
  --velvet-dark: #1a0508;
  --page-bg: #0a0a0a;
  --aging-grain: 0.12;
  --aging-warmth: 0;
  --aging-vignette: 0.3;

  /* 扩展变量（用于对话框） */
  --film-yellow: #d4a843;
  --film-cream: #f5e6c8;
  --film-brown: #5c3d2e;
  --film-shadow: rgba(0, 0, 0, 0.5);
}

/* ============================================================
   Reset & Base（复用官网样式）
   ============================================================ */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html {
  font-size: 16px;
  background: var(--page-bg);
}

body {
  font-family: 'Inter', 'Noto Serif SC', sans-serif;
  background: var(--page-bg);
  color: var(--text);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

/* Selection style — 复用官网 */
::selection { background: rgba(201, 168, 76, 0.3); color: #f5f0e8; }

/* Custom scrollbar — 复用官网暗色电影风格 */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #c9a84c55, #c9a84caa, #c9a84c55);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #c9a84c88, #c9a84ccc, #c9a84c88);
}

/* ============================================================
   胶片颗粒覆盖层（Canvas）— 复用官网 #film-grain-canvas
   ============================================================ */
.film-grain-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 9998;
  mix-blend-mode: overlay;
  opacity: var(--aging-grain);
}

/* ============================================================
   暗角效果 — 复用官网 .aging-vignette
   ============================================================ */
.aging-vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9997;
  background: radial-gradient(
    ellipse at center,
    transparent 55%,
    rgba(30, 15, 5, var(--aging-vignette)) 85%,
    rgba(10, 5, 0, 0.7) 100%
  );
}

/* ============================================================
   App Shell 布局
   ============================================================ */
.app-shell {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    ellipse at 50% 30%,
    #1a1410 0%,
    #0a0806 60%,
    #050505 100%
  );
}

.main-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 800px;
  padding: 20px;
  display: flex;
  justify-content: center;
}

/* ============================================================
   底部状态栏
   ============================================================ */
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9990;
  padding: 12px 24px;
  text-align: center;
  background: linear-gradient(to top, rgba(5, 5, 5, 0.7), transparent);
}

.footer-text {
  font-size: 11px;
  letter-spacing: 0.15em;
  color: var(--gold-dim);
  text-transform: uppercase;
  opacity: 0.6;
}
</style>
