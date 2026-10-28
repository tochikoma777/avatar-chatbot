// 默认偏好设置（保存在 localStorage）
export const DEFAULT_SETTINGS = {
  // 语音合成
  autoSpeak: true,
  voiceURI: '',
  rate: 1.05,
  pitch: 1.15,
  volume: 1,

  // 语音识别
  asrEnabled: true,
  asrLang: 'zh-CN',

  // Live2D
  showModel: true,
  modelScale: 0.09,
  modelOffsetX: 0,
  modelOffsetY: 55,
  mouthSync: true,

  // 界面
  effectsLevel: 2, // 0 关闭 / 1 简约 / 2 华丽
  themeAccent: 'auto', // auto | pink | violet | cyan
  bubbleAnimation: true,
  showTimestamps: true,

  // 对话
  customPersona: '',
  enableTools: true,
};

export const ACCENT_THEMES = [
  { id: 'auto', label: '跟随角色' },
  { id: 'pink', label: '樱花粉' },
  { id: 'violet', label: '紫罗兰' },
  { id: 'cyan', label: '晴空蓝' },
];

export const EFFECT_LEVELS = [
  { id: 0, label: '关闭' },
  { id: 1, label: '简约' },
  { id: 2, label: '华丽' },
];

export const ASR_LANGS = [
  { id: 'zh-CN', label: '中文（普通话）' },
  { id: 'zh-TW', label: '中文（繁体）' },
  { id: 'en-US', label: 'English' },
  { id: 'ja-JP', label: '日本語' },
];
