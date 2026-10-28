// 预设场景：id 对应 CSS 类 .scene-<id>，effect 决定叠加的粒子特效层。
export const SCENES = [
  { id: 'starry', name: '星夜', emoji: '✨', effect: 'stars' },
  { id: 'sakura', name: '樱花', emoji: '🌸', effect: 'petals' },
  { id: 'sunset', name: '黄昏', emoji: '🌇', effect: 'bokeh' },
  { id: 'classroom', name: '教室', emoji: '🏫', effect: 'dust' },
  { id: 'cyber', name: '霓虹', emoji: '🌃', effect: 'grid' },
  { id: 'simple', name: '简约', emoji: '◻️', effect: 'none' },
];

export const DEFAULT_SCENE_ID = 'sakura';

export function getScene(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

// AI 背景生成的风格预设（与后端 STYLE_PRESETS 对应）
export const IMAGE_STYLES = [
  { id: 'anime', label: '动漫插画' },
  { id: 'sakura', label: '樱花季' },
  { id: 'starry', label: '星夜' },
  { id: 'ghibli', label: '吉卜力' },
  { id: 'sunset', label: '黄昏' },
  { id: 'cyber', label: '赛博霓虹' },
  { id: 'watercolor', label: '水彩' },
];

export const SCENE_PROMPT_PLACEHOLDERS = [
  '星空下的樱花树与远山',
  '放学后的教室，夕阳洒进窗台',
  '赛博朋克霓虹街道，雨后反光',
  '漂浮着云海的幻想浮空岛',
  '夏日海边与白色灯塔',
];
