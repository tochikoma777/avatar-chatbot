// 轻量内联 SVG 图标集（避免额外依赖，统一 currentColor 描边风格）
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconSend = (p) => (
  <svg {...base} {...p}><path d="M4 12l16-8-6 8 6 8-16-8z" /></svg>
);

export const IconStop = (p) => (
  <svg {...base} {...p}><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" stroke="none" /></svg>
);

export const IconMic = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const IconSettings = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
  </svg>
);

export const IconSparkles = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
    <path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
  </svg>
);

export const IconTrash = (p) => (
  <svg {...base} {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
);

export const IconCopy = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);

export const IconRefresh = (p) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const IconImage = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 17" />
  </svg>
);

export const IconUpload = (p) => (
  <svg {...base} {...p}><path d="M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
);

export const IconClose = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>
);

export const IconVolume = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9v6h3l5 4V5L7 9H4z" />
    <path d="M16 9a4 4 0 0 1 0 6" />
  </svg>
);

export const IconChevron = (p) => (
  <svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>
);

export const IconChat = (p) => (
  <svg {...base} {...p}><path d="M21 12a8 8 0 1 1-3.2-6.4M21 4v5h-5" /><path d="M8 12h8M8 15h5" /></svg>
);

export const IconStage = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="8" r="3.2" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
);

export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="M5 13l4 4L19 7" /></svg>
);
