/**
 * tools.ts — LangChain 工具定义
 *
 * ============================================================
 * LangChain 概念对应：
 * 「Tool（工具）」是 LangChain Agent 的核心抽象——
 *   每个 Tool = name（名称）+ description（描述）+ schema（参数格式）+ func（执行函数）
 *   LLM 根据 description 判断何时调用该工具，根据 schema 提取结构化参数
 * ============================================================
 *
 * 本文件定义了 3 个工具，全部复用现有官网能力：
 *   1. scrollToNode — 触发前端时间轴滚动（复用 Cinema Evolution.html 的 DOM 结构）
 *   2. playEraSound  — 触发前端播放年代音效（复用官网 playEraSound 函数和 Web Audio API）
 *   3. queryBlog    — 搜索本地博客 Markdown 知识库（复用光影笔记博客文章数据）
 *
 * 工程决策：
 * - 为什么不直接操作 DOM？
 *   后端无法访问浏览器 DOM，通过 SSE 推送 action 事件，前端监听后执行对应操作
 *
 * - 为什么使用 tool() 而不是 DynamicStructuredTool？
 *   tool() 是 LangChain 0.3+ 推荐的简化 API，自动处理类型推断和参数校验
 *
 * - 为什么 Tool 的 func 通过 sendEvent 推送事件而不是 return 结果？
 *   Tool 的 return 值会返回给 LLM 作为"工具执行结果"，告知 LLM 操作已完成；
 *   同时 Tool 通过闭包捕获的 sendEvent 函数向前端推送"用户可见的动作"
 */

import { tool } from 'langchain';
import { z } from 'zod';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SoundType, EraNode } from './types.js';
import { mapYearToSound } from './types.js';

// ES Module 环境下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** SSE 事件发送器类型 — 由 index.ts 在请求处理时注入 */
export type SSEWriter = (type: 'text' | 'tool' | 'action' | 'error' | 'done', content: string, meta?: Record<string, unknown>) => void;

/** 加载年代数据（复用官网时间轴节点） */
function loadEraData(): EraNode[] {
  const dataPath = join(__dirname, 'eraData.json');
  const raw = readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw) as EraNode[];
}

// ============================================================
// 工具工厂函数 — 通过闭包注入 SSE 发送能力
// 每个请求创建独立的工具实例，确保 SSE 事件发送到正确的客户端连接
// ============================================================

/**
 * 创建 Agent 工具集
 * @param sendEvent - SSE 事件发送函数（由 Express 请求处理函数注入）
 * @returns LangChain Tool 数组
 *
 * LangChain 概念对应：
 *   tool() 返回一个 StructuredTool 实例，包含 name/description/schema/func 四个属性
 *   Agent 通过 Function Calling 机制自动选择并调用合适的 Tool
 */
export function createTools(sendEvent: SSEWriter) {
  const eraNodes = loadEraData();

  // ═══════════════════════════════════════════════════
  // Tool 1: scrollToNode — 滚动时间轴到指定年份节点
  // ═══════════════════════════════════════════════════
  const scrollToNode = tool(
    async ({ year }: { year: number }) => {
      // ============================================================
      // 工程决策：为什么不在这里直接执行滚动？
      // 后端运行在 Node.js 环境，没有浏览器 DOM 访问权限。
      // 所以 Tool 通过 SSE 向前端推送 action 事件，
      // 前端收到事件后调用：
      //   document.querySelector(`[data-era="${year}"]`).scrollIntoView({ behavior: 'smooth' })
      // 这保证了官网现有的 DOM 结构和滚动逻辑完全不被修改
      // ============================================================

      // 安全校验：year 必须在有效范围内（1895-2024）
      // 虽然 Zod schema 已做校验，但作为防御性编程再检查一次
      if (year < 1895 || year > 2024) {
        return `年份 ${year} 超出电影史时间轴范围（1895-2024），无法滚动。`;
      }

      // 查找最近的匹配节点（用户可能输入没有精确节点的年份，如 1950）
      const closest = [...eraNodes].sort(
        (a, b) => Math.abs(a.year - year) - Math.abs(b.year - year)
      )[0];

      // ★ 核心：通过 SSE 向前端推送滚动指令
      // 前端 ChatBox.vue 的 SSE 监听器收到后执行对应的 DOM 操作
      sendEvent('action', `正在跳转到 ${closest.year} 年`, {
        actionType: 'scroll',
        year: closest.year,
        title: closest.title,
      });

      return `已触发时间轴滚动到 ${closest.year} 年「${closest.title}」节点。用户可以看到该年份的电影史事件详情。`;
    },
    {
      name: 'scrollToNode',
      description:
        '滚动电影史时间轴到指定年份的节点。' +
        '当用户说"跳转到XX年"、"去XX年看看"、"滚动到XX"等时调用此工具。' +
        '参数 year 是一个 4 位数年份，如 1927、1999。',
      // ============================================================
      // LangChain 概念对应：
      // 「schema（Zod Schema）」定义了工具参数的格式和校验规则
      // LLM 看到 name + description + schema 后，
      // 会自动从用户自然语言中提取符合 schema 的结构化参数
      // 例如用户说"跳转到1927年" → LLM 提取 { year: 1927 }
      // ============================================================
      schema: z.object({
        year: z
          .number()
          .int()
          .min(1895)
          .max(2024)
          .describe('要滚动到的年份，例如 1927'),
      }),
    }
  );

  // ═══════════════════════════════════════════════════
  // Tool 2: playEraSound — 播放指定年代的电影音效
  // ═══════════════════════════════════════════════════
  const playEraSound = tool(
    async ({ year }: { year: number }) => {
      if (year < 1895 || year > 2024) {
        return `年份 ${year} 超出电影史范围，无法播放音效。`;
      }

      // 年份 → 音效类型映射（复用官网 playEraSound 的音效配置）
      // 音效类型: silent | jazz | orchestra | scifi | digital | ai
      const soundType: SoundType = mapYearToSound(year, eraNodes);

      // 音效类型的中文描述
      const soundLabels: Record<SoundType, string> = {
        silent: '默片时代的钢琴伴奏 🎹',
        jazz: '爵士时代的摇摆乐 🎷',
        orchestra: '黄金时代的交响乐 🎻',
        scifi: '科幻时代的电子合成乐 🎛️',
        digital: '数字时代的脉冲音 🎧',
        ai: 'AI 时代的未来感音景 🤖',
      };

      // ★ 核心：通过 SSE 向前端推送音效播放指令
      // 前端收到后调用官网已有的 playEraSound(era) 函数（Cinema Evolution.html line 1499）
      sendEvent('action', `正在播放 ${soundLabels[soundType]}`, {
        actionType: 'sound',
        year,
        sound: soundType,
      });

      return `已触发播放 ${year} 年对应的${soundLabels[soundType]}音效。`;
    },
    {
      name: 'playEraSound',
      description:
        '播放指定年份对应的电影时代音效。' +
        '当用户说"播个音效"、"放点音乐"、"来段XX年代的配乐"时调用此工具。' +
        '不同年代有不同的音效风格（默片钢琴/爵士乐/交响乐/电子乐等）。',
      schema: z.object({
        year: z
          .number()
          .int()
          .min(1895)
          .max(2024)
          .describe('目标年份，用于确定播放哪个年代的音效，例如 1927 播放爵士乐'),
      }),
    }
  );

  // ═══════════════════════════════════════════════════
  // Tool 3: queryBlog — 搜索博客电影史知识库
  // ═══════════════════════════════════════════════════
  const queryBlog = tool(
    async ({ keyword }: { keyword: string }) => {
      // ============================================================
      // 工程决策：为什么使用本地文件搜索而不是向量数据库？
      // 对于教学项目，简单的文件搜索即可满足需求：
      //   1. 文章数量少（<50篇），全量扫描性能足够
      //   2. 无需引入额外的向量数据库依赖
      //   3. 代码逻辑透明，便于初学者理解
      // 扩展方向（面试加分项）：使用 LangChain 的 VectorStore + Embeddings
      //   将 Markdown 文件向量化，实现语义搜索（详见 README.md 扩展思考题）
      // ============================================================

      const articlesDir = join(__dirname, '..', 'articles');

      if (!existsSync(articlesDir)) {
        return '博客文章目录不存在，知识库暂不可用。请联系管理员初始化文章数据。';
      }

      const files = readdirSync(articlesDir).filter((f) => f.endsWith('.md'));

      if (files.length === 0) {
        return '知识库中暂无文章，请先添加博客文章到 articles/ 目录。';
      }

      const results: Array<{ file: string; title: string; excerpt: string }> = [];

      for (const file of files) {
        const content = readFileSync(join(articlesDir, file), 'utf-8');

        // 简易关键词搜索：不区分大小写
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
          // 提取标题（Markdown 第一行的 # 标题）
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : file.replace('.md', '');

          // 提取相关段落（包含关键词的段落，最多 3 段，每段最多 200 字）
          const paragraphs = content.split('\n\n');
          const relevantParagraphs = paragraphs
            .filter(
              (p) =>
                p.toLowerCase().includes(keyword.toLowerCase()) &&
                !p.startsWith('#') // 跳过纯标题行
            )
            .map((p) => p.replace(/\n/g, ' ').trim())
            .slice(0, 3);

          if (relevantParagraphs.length > 0) {
            results.push({
              file,
              title,
              excerpt: relevantParagraphs.join(' …… ').slice(0, 400),
            });
          }
        }
      }

      if (results.length === 0) {
        return `未在知识库中找到与「${keyword}」相关的内容。请尝试其他关键词，或参考时间轴上的电影史节点。`;
      }

      // 格式化搜索结果供 LLM 使用
      return results
        .map(
          (r, i) =>
            `[${i + 1}]《${r.title}》: ${r.excerpt}`
        )
        .join('\n\n');
    },
    {
      name: 'queryBlog',
      description:
        '搜索电影史博客知识库，获取关于特定电影、导演、流派或历史事件的详细内容。' +
        '当用户问"XX电影讲了什么"、"XX导演有哪些作品"、"什么是XX流派"等问题时调用此工具。' +
        '关键词可以是电影名、导演名、年份、流派（如"默片"、"新浪潮"、"科幻"）等。',
      schema: z.object({
        keyword: z
          .string()
          .min(1)
          .max(100)
          .describe('搜索关键词，例如"爵士歌手"、"新好莱坞"、"卓别林"、"1895"'),
      }),
    }
  );

  // 返回工具数组 — LangChain 的 createOpenAIFunctionsAgent 接收 Tool[] 类型
  return [scrollToNode, playEraSound, queryBlog];
}
