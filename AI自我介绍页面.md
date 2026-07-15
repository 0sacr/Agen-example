# AI 自我介绍页面 — 完整设计 & 代码

---

## 一、设计定位

| 维度 | 设定 |
|---|---|
| **产品** | AI 助手品牌自我介绍页 |
| **受众** | 潜在用户、开发者、创意工作者 |
| **设计语言** | 深邃极简 · 温润金属 · 字体主导 |
| **情绪** | 信任、专业、温暖、克制 |
| **锚点** | Apple 式留白 × 高端腕表品牌质感 × 东方留白美学 |

---

## 二、设计系统

```yaml
色彩:
  背景: "#0b0b0d"          # 暖调深炭黑
  表层: "#141417"          # 卡片 / 区块底色
  主文字: "#f0ece4"        # 暖白
  次文字: "rgba(240,236,228,0.55)"
  强调色: "#c9a96e"        # 暖香槟金
  强调色暗: "#a8874e"      # hover / active
  边框: "rgba(255,255,255,0.06)"
  分割: "rgba(255,255,255,0.04)"

字体:
  主字体: "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', -apple-system, sans-serif"
  等宽: "'SF Mono', 'Cascadia Code', 'Consolas', monospace"
  字号阶梯: 13px / 15px / 18px / 24px / 40px / 72px / 120px
  行高: 1.5 (body) / 1.1 (display)

间距:
  基础单位: 8px
  常用倍率: 8 / 16 / 24 / 32 / 48 / 64 / 96 / 160

圆角: 6px (小而精)
阴影: 几乎不用 — 用色彩层次替代
动效: cubic-bezier(0.22, 0.61, 0.36, 1) — 柔和的缓出曲线
```

---

## 三、页面结构

```
┌─────────────────────────────────────────────┐
│  HERO                                        │
│  · 巨大标题 "Claude"                         │
│  · 副标题 能力宣言                            │
│  · 微妙的动态光晕                             │
├─────────────────────────────────────────────┤
│  CAPABILITIES (3×2 Grid)                     │
│  · 代码协作  · 内容创作                       │
│  · 数据分析  · 设计工程                       │
│  · 知识研究  · 自动化                         │
├─────────────────────────────────────────────┤
│  HIGHLIGHTS (横向卡片)                        │
│  · 上下文理解                                 │
│  · 多模态能力                                 │
│  · 工具生态                                   │
├─────────────────────────────────────────────┤
│  FLOW (三步流程)                              │
│  · 描述需求 → 深度思考 → 交付成果             │
├─────────────────────────────────────────────┤
│  FOOTER                                      │
└─────────────────────────────────────────────┘
```

---

## 四、完整代码

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Claude — AI 助手</title>
  <style>
    /* ===== CSS Variables ===== */
    :root {
      --bg: #0b0b0d;
      --surface: #141417;
      --surface-hover: #1a1a1e;
      --text: #f0ece4;
      --text-muted: rgba(240, 236, 228, 0.55);
      --text-faint: rgba(240, 236, 228, 0.28);
      --accent: #c9a96e;
      --accent-dim: #a8874e;
      --accent-glow: rgba(201, 169, 110, 0.15);
      --border: rgba(255, 255, 255, 0.06);
      --border-hover: rgba(255, 255, 255, 0.12);
      --divider: rgba(255, 255, 255, 0.04);

      --radius: 6px;
      --ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
      --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

      --font: 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', -apple-system, sans-serif;
      --font-mono: 'SF Mono', 'Cascadia Code', 'Consolas', 'Monaco', monospace;
    }

    /* ===== Reset ===== */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      font-size: 16px;
    }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }

    /* ===== Grain Texture Overlay ===== */
    body::after {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.035;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    /* ===== App Container ===== */
    #app {
      min-height: 100vh;
    }

    /* ===== Section Base ===== */
    .section {
      padding: 120px 40px;
      max-width: 1200px;
      margin: 0 auto;
    }

    @media (max-width: 768px) {
      .section {
        padding: 80px 24px;
      }
    }

    /* ===== Fade-Up Animation ===== */
    .fade-up {
      opacity: 0;
      transform: translateY(40px);
      transition: opacity 0.8s var(--ease-out), transform 0.8s var(--ease-out);
    }
    .fade-up.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* ===== Hero Section ===== */
    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 100vh;
      padding: 120px 40px 160px;
      position: relative;
    }

    .hero-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 600px;
      height: 600px;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero-tag {
      font-family: var(--font-mono);
      font-size: 13px;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 40px;
      padding: 6px 16px;
      border: 1px solid rgba(201, 169, 110, 0.25);
      border-radius: 100px;
    }

    .hero-title {
      font-size: clamp(64px, 10vw, 140px);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 0.95;
      color: var(--text);
      margin-bottom: 32px;
      position: relative;
      z-index: 1;
    }

    .hero-title .accent {
      color: var(--accent);
    }

    .hero-subtitle {
      font-size: clamp(18px, 2.2vw, 24px);
      color: var(--text-muted);
      max-width: 600px;
      line-height: 1.6;
      font-weight: 400;
      position: relative;
      z-index: 1;
      margin-bottom: 64px;
    }

    .hero-scroll-hint {
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      color: var(--text-faint);
      font-size: 12px;
      letter-spacing: 0.2em;
      cursor: pointer;
      transition: color 0.3s;
    }
    .hero-scroll-hint:hover {
      color: var(--text-muted);
    }
    .hero-scroll-hint::after {
      content: '';
      display: block;
      width: 1px;
      height: 40px;
      background: linear-gradient(to bottom, var(--text-faint), transparent);
      margin: 12px auto 0;
    }

    /* ===== Capabilities Grid ===== */
    .caps-header {
      text-align: center;
      margin-bottom: 80px;
    }
    .caps-header h2 {
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 16px;
    }
    .caps-header p {
      color: var(--text-muted);
      font-size: 18px;
    }

    .caps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: var(--divider);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    @media (max-width: 900px) {
      .caps-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 560px) {
      .caps-grid {
        grid-template-columns: 1fr;
      }
    }

    .cap-card {
      background: var(--surface);
      padding: 48px 40px;
      cursor: default;
      transition: background 0.4s var(--ease-out);
      position: relative;
      overflow: hidden;
    }
    .cap-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), var(--accent-glow), transparent 60%);
      opacity: 0;
      transition: opacity 0.5s;
    }
    .cap-card:hover {
      background: var(--surface-hover);
    }
    .cap-card:hover::before {
      opacity: 1;
    }

    .cap-icon {
      width: 40px;
      height: 40px;
      margin-bottom: 24px;
      position: relative;
      z-index: 1;
      color: var(--accent);
      opacity: 0.8;
    }

    .cap-card h3 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 12px;
      position: relative;
      z-index: 1;
    }

    .cap-card p {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.7;
      position: relative;
      z-index: 1;
    }

    /* ===== Highlights ===== */
    .highlights {
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: var(--divider);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .highlight-row {
      display: flex;
      align-items: center;
      background: var(--surface);
      padding: 48px 56px;
      gap: 56px;
      transition: background 0.4s var(--ease-out);
    }
    .highlight-row:hover {
      background: var(--surface-hover);
    }

    @media (max-width: 768px) {
      .highlight-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 20px;
        padding: 32px 28px;
      }
    }

    .highlight-label {
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.2em;
      color: var(--accent);
      min-width: 140px;
      text-transform: uppercase;
    }

    .highlight-content h3 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 8px;
    }

    .highlight-content p {
      font-size: 15px;
      color: var(--text-muted);
      max-width: 560px;
      line-height: 1.7;
    }

    /* ===== Flow Section ===== */
    .flow-steps {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 40px;
    }

    @media (max-width: 768px) {
      .flow-steps {
        grid-template-columns: 1fr;
        gap: 32px;
      }
    }

    .flow-step {
      text-align: center;
    }

    .flow-number {
      font-family: var(--font-mono);
      font-size: 13px;
      letter-spacing: 0.2em;
      color: var(--accent);
      margin-bottom: 24px;
    }

    .flow-divider {
      width: 100%;
      height: 1px;
      background: var(--divider);
      margin-bottom: 32px;
      position: relative;
    }
    .flow-divider::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }

    .flow-step h3 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 12px;
    }

    .flow-step p {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.7;
    }

    /* ===== Footer ===== */
    .footer {
      text-align: center;
      padding: 80px 40px;
      border-top: 1px solid var(--divider);
    }

    .footer-tagline {
      font-size: 24px;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: var(--text);
      margin-bottom: 16px;
    }

    .footer-note {
      font-size: 14px;
      color: var(--text-faint);
    }

    /* ===== Mouse Glow (applied via JS on caps-grid) ===== */
  </style>
</head>
<body>
  <div id="app">

    <!-- ===== HERO ===== -->
    <section class="hero">
      <div class="hero-glow"></div>
      <div class="hero-tag fade-up" style="transition-delay: 0.1s">AI · 助手</div>
      <h1 class="hero-title fade-up" style="transition-delay: 0.25s">
        Claude
      </h1>
      <p class="hero-subtitle fade-up" style="transition-delay: 0.4s">
        为思考者打造的 AI 伙伴<br />
        写代码 · 创内容 · 解难题 · 做设计
      </p>
      <div class="hero-scroll-hint" @click="scrollToSection('caps')">
        了解更多
      </div>
    </section>

    <!-- ===== CAPABILITIES ===== -->
    <section id="caps" class="section">
      <div class="caps-header fade-up">
        <h2>我能做什么</h2>
        <p>不只是对话 — 是真正的协作</p>
      </div>

      <div
        class="caps-grid fade-up"
        @mousemove="onGridMouseMove"
        @mouseleave="onGridMouseLeave"
      >
        <div
          v-for="(cap, i) in capabilities"
          :key="i"
          class="cap-card"
          :style="{ '--mx': mouseX + '%', '--my': mouseY + '%' }"
        >
          <div class="cap-icon" v-html="cap.icon"></div>
          <h3>{{ cap.title }}</h3>
          <p>{{ cap.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ===== HIGHLIGHTS ===== -->
    <section class="section">
      <div class="caps-header fade-up">
        <h2>为什么选择 Claude</h2>
        <p>深度而非广度，质量而非数量</p>
      </div>

      <div class="highlights fade-up">
        <div
          v-for="(h, i) in highlights"
          :key="i"
          class="highlight-row"
          :style="{ transitionDelay: (i * 0.1) + 's' }"
        >
          <div class="highlight-label">{{ h.label }}</div>
          <div class="highlight-content">
            <h3>{{ h.title }}</h3>
            <p>{{ h.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== FLOW ===== -->
    <section class="section">
      <div class="caps-header fade-up">
        <h2>如何开始</h2>
        <p>三步，简单直接</p>
      </div>

      <div class="flow-steps fade-up">
        <div
          v-for="(step, i) in steps"
          :key="i"
          class="flow-step"
        >
          <div class="flow-number">{{ step.num }}</div>
          <div class="flow-divider"></div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ===== FOOTER ===== -->
    <footer class="footer">
      <p class="footer-tagline">让 AI 成为你最好的协作伙伴</p>
      <p class="footer-note">Claude · 为创造而生</p>
    </footer>

  </div>

  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script>
    const { createApp, ref, onMounted, onUnmounted, nextTick } = Vue;

    createApp({
      setup() {
        // ===== Mouse position for card glow effect =====
        const mouseX = ref(50);
        const mouseY = ref(50);
        let gridEl = null;

        const onGridMouseMove = (e) => {
          if (!gridEl) return;
          const rect = gridEl.getBoundingClientRect();
          mouseX.value = ((e.clientX - rect.left) / rect.width) * 100;
          mouseY.value = ((e.clientY - rect.top) / rect.height) * 100;
        };

        const onGridMouseLeave = () => {
          mouseX.value = 50;
          mouseY.value = 50;
        };

        // ===== Scroll to section =====
        const scrollToSection = (id) => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        };

        // ===== Intersection Observer for fade-up animations =====
        let observer = null;

        const setupObserver = () => {
          observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.classList.add('visible');
                }
              });
            },
            { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
          );

          document.querySelectorAll('.fade-up').forEach((el) => {
            observer.observe(el);
          });
        };

        onMounted(() => {
          nextTick(() => {
            gridEl = document.querySelector('.caps-grid');
            // Trigger initial visible elements
            setTimeout(() => {
              document.querySelectorAll('.fade-up').forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight) {
                  el.classList.add('visible');
                }
              });
              setupObserver();
            }, 100);
          });
        });

        onUnmounted(() => {
          if (observer) observer.disconnect();
        });

        // ===== Data =====
        const capabilities = [
          {
            icon: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.6"/><path d="M12 16l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 28h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
            title: '代码协作',
            desc: '从架构设计到 Bug 修复，理解你的代码库，写出风格一致的代码。',
          },
          {
            icon: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.6"/><path d="M12 12h16v6H12z" stroke="currentColor" stroke-width="1.5"/><path d="M12 18h10v10H12z" stroke="currentColor" stroke-width="1.5"/><path d="M22 22h6v6h-6z" stroke="currentColor" stroke-width="1.5"/><line x1="18" y1="18" x2="22" y2="22" stroke="currentColor" stroke-width="1.5"/></svg>`,
            title: '内容创作',
            desc: '撰写文章、润色文案、翻译语言，让文字更有力量。',
          },
          {
            icon: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.6"/><circle cx="14" cy="14" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="26" cy="14" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="14" cy="28" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="26" cy="28" r="3" stroke="currentColor" stroke-width="1.5"/><line x1="17" y1="14" x2="23" y2="14" stroke="currentColor" stroke-width="1.5"/><line x1="17" y1="28" x2="23" y2="28" stroke="currentColor" stroke-width="1.5"/></svg>`,
            title: '数据分析',
            desc: '处理 CSV、JSON 和表格数据，自动生成洞察报告与可视化图表。',
          },
          {
            icon: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.6"/><circle cx="20" cy="14" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M10 32c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
            title: '设计工程',
            desc: '从设计系统到交互原型，帮你把创意变成精美的前端页面。',
          },
          {
            icon: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.6"/><circle cx="20" cy="20" r="10" stroke="currentColor" stroke-width="1.5"/><circle cx="20" cy="20" r="4" stroke="currentColor" stroke-width="1.5"/><line x1="20" y1="10" x2="20" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="20" y1="24" x2="20" y2="30" stroke="currentColor" stroke-width="1.5"/></svg>`,
            title: '知识研究',
            desc: '深度搜索、多源验证、结构化整理，把信息变成洞察。',
          },
          {
            icon: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.6"/><path d="M20 10v20M10 20h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="14" y="14" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/></svg>`,
            title: '自动化',
            desc: '脚本编写、CI/CD 配置、工作流优化 — 让重复的事自动完成。',
          },
        ];

        const highlights = [
          {
            label: '长上下文',
            title: '一次理解整个项目',
            desc: '支持超长上下文窗口，可以同时阅读整个代码库或数百页文档，全局在胸。',
          },
          {
            label: '多模态',
            title: '看得见，读得懂',
            desc: '支持图片、PDF、图表等多种格式输入，从视觉信息中提取关键洞察。',
          },
          {
            label: '工具生态',
            title: '连接你的工作流',
            desc: '集成终端、文件系统、浏览器和 API，直接在真实环境中执行任务。',
          },
        ];

        const steps = [
          {
            num: '01',
            title: '描述需求',
            desc: '用自然语言告诉 Claude 你想做什么 — 越具体，效果越好。',
          },
          {
            num: '02',
            title: '深度思考',
            desc: 'Claude 会自主规划步骤、查阅文件、搜索信息，给出完整方案。',
          },
          {
            num: '03',
            title: '交付成果',
            desc: '获得可直接使用的代码、文档或分析结果 — 不是建议，是产出。',
          },
        ];

        return {
          mouseX, mouseY,
          onGridMouseMove, onGridMouseLeave,
          scrollToSection,
          capabilities, highlights, steps,
        };
      },
    }).mount('#app');
  </script>
</body>
</html>
```

---

## 五、文件说明

| 文件 | 说明 |
|---|---|
| `AI自我介绍页面.md` | 本文件 — 设计文档 + 代码 |
| (手动提取) `index.html` | 将上面代码块中的 HTML 保存为独立文件即可在浏览器打开 |

---

## 六、预览与调试

1. 将上方 HTML 代码保存为 `index.html`
2. 双击在浏览器中打开
3. 效果：
   - 深色极简页面，暖金色点缀
   - 鼠标移动时能力卡片有光晕跟随
   - 滚动时元素依次淡入
   - 全响应式，手机端自动切换为单列布局

---

## 七、定制建议

| 需求 | 改法 |
|---|---|
| 换色系 | 修改 `:root` 中的 `--accent` 和 `--accent-dim` |
| 换标题 | 修改 `.hero-title` 中的文字 |
| 加更多卡片 | 在 `capabilities` 数组中追加对象 |
| 调整动效速度 | 修改 `.fade-up` 的 `transition` 时长 |
| 改字体 | 修改 `--font` 变量 |

---

> **设计原则**: 少即是多。色彩克制，留白充裕，字体分层清晰。动效服务于内容，不为炫而炫。
