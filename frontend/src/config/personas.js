// 角色（人格）配置：前端负责视觉呈现，后端保存对应的系统提示词。
// id 必须与 backend/app/core/personas.py 中的 PERSONAS 保持一致。

export const PERSONAS = [
  {
    id: 'sakura',
    name: '樱庭 咲',
    tagline: '温柔学姐 · 樱花社',
    emoji: '🌸',
    accent: '#ff7bb8',
    accentSoft: '#ffd7ea',
    aura: 'sakura',
    greeting: '你来啦～今天想聊点什么呢？咲会一直陪着你的 (｡･ω･｡)ﾉ',
    suggestions: [
      '今天有点累，陪我聊会儿吧',
      '讲个冷知识给我听',
      '现在几点了？',
      '帮我算一下 (128+72)×3',
    ],
    voice: { rate: 1.0, pitch: 1.2 },
  },
  {
    id: 'neko',
    name: '喵呜 Neko',
    tagline: '元气猫娘 · 好奇心MAX',
    emoji: '🐱',
    accent: '#ffb454',
    accentSoft: '#ffe6c2',
    aura: 'sunset',
    greeting: '喵呜～欢迎回家！今天要不要一起晒太阳呀 (=^･ω･^=)',
    suggestions: [
      '喵呜，今天天气怎么样？',
      '帮我掷个骰子',
      '来一句二次元台词',
      '晚饭吃火锅还是烤肉？',
    ],
    voice: { rate: 1.15, pitch: 1.35 },
  },
  {
    id: 'tsundere',
    name: '绫波 凛',
    tagline: '傲娇同桌 · 口是心非',
    emoji: '💢',
    accent: '#7aa2ff',
    accentSoft: '#d8e4ff',
    aura: 'starry',
    greeting: '哼，才、才不是特意等你的呢！只是刚好有空而已……',
    suggestions: [
      '凛，教我一道数学题',
      '你今天心情怎么样？',
      '陪我练习一下自我介绍',
      '帮我查一下上海的天气',
    ],
    voice: { rate: 1.1, pitch: 1.1 },
  },
  {
    id: 'maid',
    name: '小夜',
    tagline: '万能女仆 · 咖啡馆',
    emoji: '☕',
    accent: '#b98bff',
    accentSoft: '#e8dcff',
    aura: 'simple',
    greeting: '欢迎回来，主人。咖啡刚煮好，请慢慢享用 ☕',
    suggestions: [
      '小夜，帮我安排一下今天的任务',
      '推荐一首适合写代码的音乐',
      '现在几点了？',
      '给我一句鼓励的话',
    ],
    voice: { rate: 0.98, pitch: 1.05 },
  },
  {
    id: 'idol',
    name: '星奈 Hoshina',
    tagline: '元气偶像 · 舞台之上',
    emoji: '⭐',
    accent: '#5ee0ff',
    accentSoft: '#d6f6ff',
    aura: 'cyber',
    greeting: '嗨呀～今天的你也闪闪发光哦！要和星奈一起开演唱会吗？',
    suggestions: [
      '给我打打气！',
      '来一句热血台词',
      '帮我做个选择：跑步 / 睡觉',
      '讲讲你的舞台故事',
    ],
    voice: { rate: 1.2, pitch: 1.3 },
  },
];

export const DEFAULT_PERSONA_ID = 'sakura';

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}
