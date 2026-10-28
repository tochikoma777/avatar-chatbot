# 架构说明（v1.0）

> 面向"我要改代码"的读者：先看第 1 节建立全局印象，再按第 6 节的扩展指南动手。
> 历史问题见 [AUDIT.md](./AUDIT.md)，决策理由见 [DECISIONS.md](./DECISIONS.md)。

---

## 1. 全局视图

```
┌───────────────────────────────────────── 浏览器 ─────────────────────────────────────────┐
│  React 18 (Vite 5)                                                                        │
│                                                                                            │
│  App.jsx  ── 持有：settings / persona / 全局 emotion / Toast / 请求 toast & 布局            │
│    ├─ StagePanel ── Live2DView（PixiJS） + SceneEffects（CSS 粒子） + BackgroundStudio      │
│    └─ ChatPanel ── MessageBubble / Markdown + Composer + 角色条                            │
│                                                                                            │
│  hooks/useChat ── 消息状态机 + localStorage + AbortController                              │
│  hooks/useTTS ── SpeechSynthesis：分句朗读 + boundary 事件 → Live2D 口型                    │
│  hooks/useSpeech ── SpeechRecognition：语音输入                                            │
│  services/api.js ── fetch + SSE 分帧解析                                                   │
└───────────────────────────────────────────┬───────────────────────────────────────────────┘
                                            │ HTTP/SSE  /api/v1/*
┌───────────────────────────────────────────▼───────────────────────────────────────────────┐
│  FastAPI (Python 3.12)                                                                     │
│                                                                                            │
│  api/v1/endpoints/{chat, generate, health, personas}                                       │
│      │ Depends(get_chat_service / get_image_generator)   ← 单例复用                        │
│  core/services.ChatService ── 编排：消息拼装 → 流式 → 工具循环 → 情绪事件                   │
│      ├─ core/adapters.DeepSeekAdapter ── AsyncOpenAI 流式调用                               │
│      ├─ core/personas               ── system prompt 库                                     │
│      └─ core/tools                  ── 7 个工具 + AST 安全求值                              │
│  core/image_gen.ImageGenerator ── Pollinations → LRU 缓存 → 程序化 SVG 兜底                 │
└───────────────────────────────────────────┬───────────────────────────────────────────────┘
                                            │
                            DeepSeek（OpenAI 协议） / Pollinations / wttr.in
```

**设计原则**

1. **后端无状态**：对话历史由前端携带（D-03），后端可水平扩展、重启不丢上下文。
2. **协议即契约**：SSE 事件类型（`content` / `emotion` / `status` / `error` / `finish_reason`）是前后端唯一耦合点，改动必须同步本文档与 `DECISIONS.md`。
3. **降级优先**：无 Key → 离线陪聊；生成超时 → 程序化背景；Live2D 失败 → CSS 小精灵；TTS 不支持 → 静默不报错。

---

## 2. 目录与职责

### 2.1 后端 `backend/app/`

| 文件 | 职责 | 关键点 |
| :--- | :--- | :--- |
| `main.py` | 应用装配 | 日志格式、CORS（支持 `allow_origin_regex` 放行任意 localhost 端口）、全局异常兜底 |
| `config.py` | 配置 | 全部有默认值；`get_settings()` 用 `lru_cache`；`Settings.llm_ready` 是唯一"是否能真聊"的判据 |
| `api/dependencies.py` | 单例注入 | 避免每个请求新建 AsyncOpenAI / 图像缓存 |
| `api/v1/endpoints/chat.py` | 流式对话入口 | `StreamingResponse(media_type="text/event-stream")` + 关闭 Nginx 缓冲 |
| `api/v1/endpoints/generate.py` | 背景生成 | 返回 data URI + `cached` / `fallback` 标记 |
| `api/v1/endpoints/health.py` | 健康检查 | 供前端显示"模型就绪 / 离线陪聊" |
| `core/adapters.py` | LLM 适配 | 只做"发起流式请求"，不解析业务 |
| `core/services.py` | 业务编排 | `EmotionBuffer`、`_stream_turn`、工具多轮、离线降级 |
| `core/personas.py` | 角色定义 | `Persona` dataclass + `system_prompt` + 语音建议 |
| `core/tools.py` | 工具 | `TOOL_REGISTRY` + `TOOLS`(schema) + `TOOL_LABELS` + `execute_tool` |
| `core/image_gen.py` | 图像 | 画风预设、LRU、URL 构造、SVG 兜底 |
| `core/models.py` | 请求/响应模型 | 含长度约束 |

### 2.2 前端 `frontend/src/`

| 目录 | 文件 | 职责 |
| :--- | :--- | :--- |
| `components/` | `StagePanel.jsx` | 舞台容器：场景切换、AI 背景、粒子层、HUD、背景工坊；持有 `aiBackground` 与画廊状态 |
| | `Live2DView.jsx` | 模型生命周期、口型/表情驱动、`poke()` 暴露给父组件 |
| | `SceneEffects.jsx` | 樱花/星点/光斑/浮尘/网格 5 类粒子，按 `effectsLevel` 缩放数量 |
| | `BackgroundStudio.jsx` | prompt 输入、画风选择、生成、上传、画廊、清除 |
| | `ChatPanel.jsx` | 头部状态、角色条、消息列表（自动滚动 + 用户上滑暂停）、输入区编排 |
| | `MessageBubble.jsx` | 气泡、行为按钮（复制/朗读/重生成/删除）、工具提示、错误与停止态 |
| | `Composer.jsx` | 自增高 textarea、Enter 发送、麦克风、发送/停止切换 |
| | `SettingsDrawer.jsx` | 5 组设置（语音合成/语音输入/看板娘/界面/对话） |
| | `Markdown.jsx` | 安全 Markdown 渲染（React 元素，无 innerHTML） |
| | `Toast.jsx` / `hooks/useToast.js` | 全局提示（context 与 Provider 分开以兼容 Fast Refresh） |
| | `Splash.jsx` | 首屏加载页（模型就绪或 4.5s 超时后收起） |
| | `Icons.jsx` | 内联 SVG 图标集 |
| `hooks/` | `useChat.js` | 消息状态机：发送、流式接收、工具提示排序、停止、重生成、删除、清空、导出 |
| | `useTTS.js` | 分句朗读、发音人选择、`onboundary` → 口型脉冲 |
| | `useSpeech.js` | ASR 生命周期、实时字幕、错误映射 |
| | `usePersistedState.js` | localStorage 持久化；key 变化时重读（切角色） |
| `services/` | `api.js` | `streamChat`（SSE 分帧）、`generateImage`、`fetchHealth`、`fetchPersonas` |
| `config/` | `personas.js` | 角色视觉与建议词（id 与后端对齐） |
| | `scenes.js` | 6 场景 + 7 画风预设 + prompt 占位词 |
| | `settings.js` | 默认设置、主题/特效/语言选项 |
| `styles/` | `base / layout / stage / chat / ui` | 令牌、骨架、舞台、对话、控件 |

---

## 3. 核心数据流

### 3.1 一次对话（含工具调用）

```
用户输入
  └─ ChatPanel → App.handleSend → useChat.send(text)
       ├─ 追加 user 消息（持久化）
       ├─ 追加 assistant 占位（streaming: true）
       ├─ history = toHistory(此前消息, 最近 12 轮)
       └─ services.streamChat({ message, personaId, systemPrompt, history, enableTools })

后端 POST /api/v1/chat/chat
  ├─ build_messages(): system(persona) + history(裁剪) + user
  ├─ yield {"status":"ready"}
  └─ for turn in 0..2:
       ├─ adapter.stream_completion(messages, tools=turn<max-1 ? TOOLS : None)
       ├─ 逐 chunk：
       │    ├─ delta.content → EmotionBuffer → {"emotion":...} / {"content":...}
       │    └─ delta.tool_calls → 累积 {id,name,arguments}
       ├─ 无工具调用 → break
       └─ 有工具调用：
            ├─ {"status":"tool_calling","label":"天气查询"}
            ├─ execute_tool(name, args) → {"status":"tool_result","message":"上海：晴…"}
            ├─ messages += [assistant(tool_calls), tool(result)]
            └─ 继续下一轮（模型据此生成自然语言回答）
  └─ yield {"finish_reason":"stop"}

前端
  ├─ content → 追加到 assistant.content（Markdown 实时渲染）
  ├─ emotion → 更新消息情绪 + 舞台情绪（表情/徽章）
  ├─ tool_calling → 在 assistant 之前插入 tool 气泡（pending）
  ├─ tool_result → 同一条 tool 气泡置 done + 结果文本
  └─ 结束后：streaming=false；若 settings.autoSpeak → useTTS.speak(content)
```

**为什么工具提示要插在 assistant 之前**：阅读顺序应为「我问 → 它查了什么 → 它的回答」。实现见 `useChat.js` 中 `tool_calling` 分支的 `splice(insertAt, 0, ...)`。

### 3.2 情绪链路

```
模型首行 [emotion:happy]
   → 后端 EmotionBuffer（最多缓冲 48 字符，超限原样放行）
   → SSE {"emotion":"happy"}
   → useChat 写入 message.emotion + App.emotion
   → StagePanel：mood-chip 文案 + Live2D 表情（f01~f06）/ 动作回退
   → MessageBubble：气泡无额外装饰（避免喧宾夺主）
```

### 3.3 语音闭环

```
ASR: 麦克风 → useSpeech → onFinal → setInput → 用户回车/点发送
TTS: 回复完成 → useTTS.speak(分段) → utterance.onboundary → pulseRef（时间戳）
     → Live2DView 的 rAF 循环读取 pulseRef：说话中正弦开合 + 边界事件加强开口度
```

### 3.4 Live2D 生命周期

```
mount
 └─ 动态 import('oh-my-live2d')           ← 独立 chunk，首屏不加载
     ├─ 失败 → setFailed(true) → 渲染 CSS 小精灵（应用继续可用）
     └─ 成功 → loadOml2d({ models:[{path, position, scale, mobilePosition}], parentElement })
          ├─ onLoad('success') → ready=true → onState('ready') → 收起 Splash
          └─ onLoad('fail')    → 降级
settings 变更
 └─ setModelScale / setModelPosition（官方 API，实时，不重建实例）
unmount
 └─ instance.stage.unMount()              ← 库没有 destroy，移除 DOM 即释放
```

**前提**：`index.html` 必须在模块脚本之前加载 `/lib/live2d.min.js`（Cubism 2.1 运行时），否则 `oh-my-live2d` 在模块求值阶段就会抛错。

---

## 4. 接口契约

### 4.1 `POST /api/v1/chat/chat`

```jsonc
{
  "message": "现在几点了？",          // 必填，1..4000
  "persona_id": "sakura",            // 可选，缺省 sakura
  "system_prompt": null,             // 可选，覆盖角色人设
  "history": [                        // 可选，前端截取最近 12 轮
    { "role": "user", "content": "…" },
    { "role": "assistant", "content": "…" }
  ],
  "enable_tools": true
}
```

响应 `text/event-stream`：

| 事件 | 出现时机 | 前端处理 |
| :--- | :--- | :--- |
| `{"status":"ready","persona":"sakura","offline":true?}` | 流开始 | 可忽略（`offline` 表示离线陪聊） |
| `{"emotion":"happy"}` | 首个正文之前 | 设置情绪 → 表情 |
| `{"content":"片段"}` | 每次增量 | 追加到气泡 |
| `{"status":"tool_calling","tool":"get_weather","label":"天气查询","message":"正在使用…"}` | 工具调用前 | 插入 pending 气泡 |
| `{"status":"tool_result",...,"message":"上海：晴…"}` | 工具返回后 | 置 done + 结果 |
| `{"error":"..."}` | 异常 | Toast + 气泡内错误行 |
| `{"finish_reason":"stop"}` | 正常结束 | 收尾（停止按钮复原、触发朗读） |

### 4.2 其他接口

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| GET | `/api/v1/health/health` | `{status, env, llm_ready, model, tools[], personas[]}` |
| GET | `/api/v1/personas/personas` | `{personas:[{id,name,tagline,greeting,voice}]}`（不含提示词） |
| POST | `/api/v1/generate/generate-image` | `{prompt, style, width=1280, height=800, seed?}` → `{image_data, cached, fallback}` |
| GET | `/api/v1/generate/styles` | `{styles:[{id,label}]}` |

---

## 5. 配置矩阵

| 环境变量 | 默认值 | 作用 |
| :--- | :--- | :--- |
| `DEEPSEEK_API_KEY` | `""` | 为空则进入离线陪聊 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 任意 OpenAI 协议服务 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名 |
| `TEMPERATURE` / `MAX_TOKENS` | `0.85` / `1024` | 生成参数 |
| `REQUEST_TIMEOUT` | `60` | LLM 请求超时（秒） |
| `MAX_HISTORY_TURNS` | `12` | 后端二次裁剪轮数 |
| `MAX_TOOL_TURNS` | `3` | 工具循环上限（最后一轮强制无工具） |
| `CORS_ORIGINS` | localhost:5173/4173 | JSON 数组；另有 `allow_origin_regex` 兜底 |
| `IMAGE_CACHE_SIZE` / `IMAGE_TIMEOUT` | `32` / `30` | 图像 LRU 容量 / 超时 |
| `VITE_BACKEND_URL`（前端） | `http://localhost:8000` | Vite dev 代理目标 |
| `VITE_API_BASE`（前端） | `/api/v1` | 直连后端时改这里 |

前端偏好（localStorage `avatar-chat.settings`）：`autoSpeak / voiceURI / rate / pitch / volume / asrEnabled / asrLang / showModel / modelScale / modelOffsetX / modelOffsetY / mouthSync / effectsLevel / themeAccent / bubbleAnimation / showTimestamps / customPersona / enableTools`。

---

## 6. 扩展指南

### 6.1 新增一个角色

1. `backend/app/core/personas.py` 的 `PERSONAS` 增加 `Persona(...)`（含 `system_prompt`，务必带上 `_BASE_RULE + _EMOTION_RULE`）；
2. `frontend/src/config/personas.js` 增加同 `id` 的视觉配置（`emoji/accent/aura/greeting/suggestions/voice`）；
3. 重启前端：角色条自动出现，历史按 `avatar-chat.history.<id>` 隔离。

### 6.2 新增一个工具

1. `core/tools.py` 写实现（`async def` 或普通函数均可）；
2. 注册 `TOOL_REGISTRY[name]`、`TOOLS` 里加 JSON Schema、`TOOL_LABELS` 加中文名；
3. 无需改前端——工具提示走通用 `status` 事件。若需前端特化展示，再在 `MessageBubble` 里按 `message.tool` 分支。

### 6.3 新增一个场景/画风

- 场景：`config/scenes.js` 增加 `{id,name,emoji,effect}`，并在 `styles/stage.css` 加 `.scene-<id>` 背景；
- 画风：`backend/app/core/image_gen.py` 的 `STYLE_PRESETS` 加 key + 英文后缀，前端 `config/scenes.js` 的 `IMAGE_STYLES` 加同名 id。

### 6.4 更换 Live2D 模型

改 `StagePanel.jsx` 的 `MODEL_PATH`。注意：

- **Cubism 2.1（`.moc`）** 需要 `public/lib/live2d.min.js`（已内置）；
- **Cubism 4（`.moc3`）** 需要另外引入 `live2dcubismcore.min.js`，并把 `index.html` 的运行时脚本换成 Cubism 4 Core；
- 模型目录放在 `public/models/<name>/`，确保 `*.model3.json` 内的相对路径正确。

### 6.5 新增一条 SSE 事件

后端 `services.py` 增加 `yield sse({...})`，前端 `useChat.js` 的 `onEvent` 增加分支——**同时更新本文档第 4.1 节与 `DECISIONS.md` 的动作记录**，否则协议会失控。

---

## 7. 已知限制（有意为之或待办）

| 限制 | 影响 | 计划 |
| :--- | :--- | :--- |
| 每个 token 都触发整条消息的 Markdown 重解析 | 超长回复（>2000 字）流式期间可能掉帧 | ROADMAP P1：按段落增量渲染 / 节流 |
| 历史不做容量上限 | 长期使用可能触发 localStorage 5MB 配额（写入已静默失败） | ROADMAP P2：保留最近 N 条 + 一键清理 |
| Live2D 依赖库内部结构 `instance.models.model.internalModel` | 升级 oh-my-live2d 可能失效（已 try/catch 降级为"无口型"） | 升级时重点回归；必要时改用官方 `oml2d` 新 API |
| 5 个角色共用同一套 Live2D 模型（Haru） | 角色差异只体现在文案/配色/音色 | ROADMAP P0：多模型与换装 |
| 无鉴权、无限流 | 公网部署存在被刷风险 | ROADMAP P2：仅部署到内网/本机；如需公网加 token + 限流 |
| 无自动化测试 | 重构靠人工验证 | ROADMAP P1：Vitest + Playwright |
| 离线模式为预置台词 | 未配 Key 时不能真正问答 | 属于设计取舍，保持即可 |
