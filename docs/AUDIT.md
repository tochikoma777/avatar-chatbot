# 审查报告：avatar-chatbot MVP（v0.5.0-mvp）

> 审查对象：`github.com/tochikoma777/avatar-chatbot` 原始 main 分支（commit `a4ee91a`，下称 **v0.5.0-mvp**）
> 审查时间：2026-10-28
> 审查范围：后端 FastAPI 全部源码、前端 React 全部源码、依赖与构建配置、仓库卫生、文档一致性
> 审查方法：逐文件静态审查 → 本地起服务实测（uvicorn + vite）→ 构造异常场景（无 API Key、无 Live2D 运行时）→ jsdom 冒烟渲染

---

## 1. 结论概览

原始项目是一个**结构清晰、能跑通 happy path 的 MVP**，但存在 3 个会直接导致「线上白屏 / 核心体验不成立」的缺陷，以及一批"看起来实现了、实际是空转"的功能。

| 维度 | P0（阻断） | P1（核心功能缺陷） | P2（体验/质量） | P3（代码卫生） | 合计 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 后端 | 2 | 3 | 4 | 2 | 11 |
| 前端 | 2 | 4 | 4 | 3 | 13 |
| 工程/仓库 | 0 | 2 | 2 | 3 | 7 |
| **合计** | **4** | **9** | **10** | **8** | **31** |

三个最致命的问题：

1. **前端会白屏**（F-02）：`oh-my-live2d` 在模块顶层校验 `window.Live2D`，而仓库里的 `live2d.min.js` 是一个 69 字节的 404 残留文件，且从未被 HTML 引用 → 生产构建不报错，浏览器一打开就整页报错。
2. **"流式对话"是假的**（B-01）：后端等模型整段生成完，再逐字符吐给前端，首字延迟等于整段生成耗时；真正写好但未被调用的 `chat_stream()` 成了死代码。
3. **没有多轮上下文**（B-02）：每次请求只带当前一句话，角色"转头就忘"，多轮对话体验不成立。

---

## 2. 后端问题清单

行号基于 v0.5.0-mvp 原始文件。

| ID | 严重级 | 位置 | 问题 | 影响 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| B-01 | P0 | `services.py:27-79`、`adapters.py:21-47` | 先用 `chat_non_stream()` 拿完整回复，再 `for char in content` 逐字符 `yield` | 首字延迟 = 整段生成时间；工具调用与文本无法同流；真流式 `chat_stream()` 从未被调用 | 已修复 |
| B-02 | P0 | `models.py:3-5`、`services.py:19-23` | `ChatRequest` 只有 `message` + `system_prompt`，无 history | 无多轮记忆；同一会话每轮都从零开始 | 已修复 |
| B-03 | P1 | `services.py:41-50` | 只处理 `tool_calls[0]`；`execute_tool(tool_name)` 不传 `arguments` | 并行工具调用丢失；任何需要参数的工具（如天气）无法工作 | 已修复 |
| B-04 | P1 | `config.py:5-11` | `deepseek_api_key` 必填 + `settings = Settings()` 在 import 时执行 | 没有 `.env` 时 uvicorn 直接启动失败，无法做健康检查/离线演示 | 已修复 |
| B-05 | P1 | `services.py:25-79` | 工具循环耗尽 3 次后直接 `break`，不发任何文本 | 复杂问题下用户收到空回复，且无任何错误提示 | 已修复 |
| B-06 | P2 | `main.py:12-18` | CORS 硬编码 `localhost:3000/5173` | 改端口/局域网访问即被拦；无法部署到其他域名 | 已修复 |
| B-07 | P2 | `image_gen.py:12,37` | 失败兜底用 Picsum 随机**照片**，且无缓存 | 二次元场景里突然出现真实照片；同 prompt 重复付费/耗时 | 已修复 |
| B-08 | P2 | `services.py:43`、`adapters.py:46` | `print()` 调试；异常字符串直接下发给前端 | 无结构化日志；泄露内部错误细节 | 已修复 |
| B-09 | P2 | `generate.py:27-29` | 异常分支返回 `image_data=""` | 前端只能 `alert('生成失败')`，无原因、无重试 | 已修复 |
| B-10 | P3 | `models.py:7-8`、`adapters.py:21`、`dependencies.py` | `ChatResponse` 死代码、`chat_stream` 死代码、`dependencies.py` 空文件 | 误导读代码的人；无法复用客户端实例 | 已修复 |
| B-11 | P3 | `models.py` | 无任何入参校验（长度/角色/数量） | 超长 prompt 可打爆 token；history 可被伪造注入 | 已修复 |

### 关键问题根因展开

**B-01 假流式**
```python
# v0.5.0-mvp  services.py:30-33, 76-78
response = await self.adapter.chat_non_stream(messages, TOOLS)
...
content = response.content or ""
for char in content:
    yield f"data: {json.dumps({'content': char})}\n\n"
```
作者为了让工具调用"完整可用"，改用了非流式接口，再用 for 循环模拟打字机。
代价是：**首字延迟 = 整段生成时间**（1~8s），且 `adapters.chat_stream()` 那套真正的 SSE 逻辑彻底闲置。
修复方向不是"二选一"，而是：**流式接口本身支持 tool_calls 增量**，边流边累积工具参数即可两者兼得（见 D-02）。

**B-04 配置即崩溃**
```python
deepseek_api_key: str = Field(..., alias="DEEPSEEK_API_KEY")   # ... 表示必填
settings = Settings()                                          # import 时求值
```
`Field(...)` 的 `...` 是 Pydantic 的"必填"标记。缺 `.env` 时，`uvicorn app.main:app` 在 import 阶段就抛 `ValidationError`，与"先能启动、再提示配置"的可用性目标冲突。

**B-07 兜底不协调**
Picsum 是免费图库（真实摄影），与"二次元看板娘"视觉体系完全冲突。且 `generate_image_base64` 无缓存，同一 prompt 会重复请求外部服务。

---

## 3. 前端问题清单

| ID | 严重级 | 位置 | 问题 | 影响 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| F-01 | P0 | `components/Live2DView.jsx:3`、`index.html`、`public/lib/live2d.min.js` | 静态 `import { loadOml2d } from 'oh-my-live2d'`；该库在模块顶层 `if (!window.Live2D) throw`（`node_modules/oh-my-live2d/dist/index.js:16429`）；仓库内 `live2d.min.js` 仅 69 字节（内容为 "Couldn't find the requested file ..."）且未在 HTML 中引入 | 浏览器一加载应用即抛错，**整页白屏**；`vite build` 不报错，问题只在运行时暴露 | 已修复 |
| F-02 | P0 | `Live2DView.jsx:59` | 口型动画调用 `instance.setParameterValueByName(...)`，但 oh-my-live2d 0.19 实例上**不存在该方法**（仅 `setModelScale` / `setModelPosition` / `reloadModel` 等） | 每帧抛 TypeError 被 `catch` 吞掉 → 口型同步**从未生效**；表情、动作同理 | 已修复 |
| F-03 | P1 | `ChatBox.jsx:103-105`、`chatApi.js:16-19` | 请求只发 `message` + 写死的 system_prompt，不发历史 | 无上下文；人设写死在组件里，无法切换 | 已修复 |
| F-04 | P1 | `ChatBox.jsx:94-149` | 无 `AbortController`；`fetch` 失败只 console.error；SSE 解析用 `catch (e) {}` 静默吞异常 | 生成中无法停止；网络错误无提示；半包/脏数据直接丢失 | 已修复 |
| F-05 | P1 | `ChatBox.jsx:57-63` | 每条新消息都强制朗读，无开关、无发音人/语速设置；长文本不切句 | 用户无法静音；Chrome 对 >15s 的 utterance 会截断 | 已修复 |
| F-06 | P1 | `App.jsx:53-75`、`ChatBox.jsx:219` | 用 `alert()` 报错；无 loading/empty/error 三态设计 | 体验粗糙；错误不可恢复 | 已修复 |
| F-07 | P2 | 全仓库 | 逻辑集中在 `App.jsx`(93 行) + `ChatBox.jsx`(203 行)，组件/hooks/service 无分层 | 无法复用、无法测试、改动易回归 | 已修复 |
| F-08 | P2 | 全仓库 | 无 localStorage 持久化、无角色切换、无导出、无设置面板 | 刷新丢对话；产品感缺失 | 已修复 |
| F-09 | P2 | `App.css` | 固定 `flex:1 / 1.5` 双栏、无任何 `@media`；背景只有纯渐变；模型与底部控制条绝对定位重叠 | 移动端被压成两条竖缝；视觉单薄；控件遮挡角色 | 已修复 |
| F-10 | P3 | `src/index.css` | 残留 Vite 模板样式（`#root { width:1126px; text-align:center; border-inline }`）。**注：该文件未被 main.jsx 引用**，属死代码，但一旦引入会直接破坏全屏布局 | 死代码误导；潜在布局地雷 | 已修复（删除并重建样式体系） |
| F-11 | P3 | `src/assets/`、`public/icons.svg`、`public/lib/live2d.min.js` | Vite 模板资源、图标集、404 残留文件 | 仓库噪音 | 已清理 |
| F-12 | P3 | `ChatBox.jsx:6-14` | `new SpeechRecognition()` 写在模块顶层 | SSR/测试环境下直接崩；多实例场景共享同一个 recognition 对象 | 已修复 |

### 关键问题根因展开

**F-01 白屏链路**
```
index.html ──没有──> /lib/live2d.min.js（而且该文件本身是 404 文本）
     │
     └─> src/main.jsx ──> App.jsx ──> StagePanel ──> Live2DView
                                                       └─ import 'oh-my-live2d'
                                                            └─ 顶层: if (!window.Live2D) throw new Error(...)
```
因为是**静态 import**，这段顶层代码会进入首屏 chunk，在任何组件渲染之前执行 → React 根本没机会挂载 → 白屏。
实测：用 jsdom 加载生产包，未注入运行时前 `#root` 为空；注入 `live2d.min.js` 后正常渲染。

**F-02 "假口型"**
原始实现每帧调用一个不存在的方法：
```js
instance.setParameterValueByName('ParamMouthOpenY', value);   // TypeError，被 catch 吞掉
```
oh-my-live2d 只暴露舞台/缩放/位置等高层 API，驱动参数必须向下触达 `instance.models.model.internalModel.coreModel`（Cubism 2 用 `setParamFloat`，Cubism 4 用 `setParameterValueById`）。

---

## 4. 工程与仓库问题

| ID | 严重级 | 位置 | 问题 | 影响 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| E-01 | P1 | `package.json:31` | 声明 `vite ^8.0.10`、`eslint ^10`，但运行环境为 Node 18（vite 7+/eslint 10 均要求 Node 20+） | `npm run dev` 直接失败；依赖声明与实际可运行环境不一致 | 已修复（降至 Vite 5 / ESLint 9） |
| E-02 | P1 | `package.json:25-26`、`README.md:45` | 声明 electron / electron-builder / concurrently / wait-on，`README` 结构图里也写了 `electron/`，但**仓库内不存在 electron 目录与主进程代码** | 安装时白下载 ~150MB 二进制；文档承诺与代码不符 | 已修复 |
| E-03 | P2 | `frontend/.vite/` | 构建缓存目录被提交进 git（11 个文件，含 sourcemap） | 仓库噪音、误导 diff | 已清理并加入 .gitignore |
| E-04 | P2 | `package.json:13-14` | `live2d-widget`、`live2d-widget-model-haru` 两个依赖未被任何代码引用 | 冗余依赖 | 已移除 |
| E-05 | P3 | `eslint.config.js:13` | 使用 `reactHooks.configs.flat.recommended`（v6 API），实际安装 v5 | `npm run lint` 直接抛 TypeError，lint 形同虚设 | 已修复 |
| E-06 | P3 | 根目录 `body.json` | 手写的 curl 示例请求体，字段为旧 schema | 照着调接口会 422 | 已更新 |
| E-07 | P3 | 全仓库 | 无任何自动化测试、无 CI、无 Dependabot | 重构无安全网（本次靠 jsdom 临时冒烟） | 部分（见路线图） |

---

## 5. 非缺陷类优化点（原项目没做，但明显影响"吸引力"）

| ID | 优化点 | 价值 | 状态 |
| :--- | :--- | :--- | :--- |
| O-01 | 多角色 / 人格切换 | 从"一个工具"变成"有角色感的产品" | 已实现（5 角色） |
| O-02 | 情绪 → 表情联动 | 让 Live2D 不只是"会动"，而是"有反应" | 已实现 |
| O-03 | 消息级操作（复制/重生成/删除/朗读） | 对话可用性的基本盘 | 已实现 |
| O-04 | 对话导出 / 本地持久化 | 减少"刷新即丢"的挫败感 | 已实现 |
| O-05 | 场景粒子（樱花/星轨/光斑/网格） | 二次元氛围的主要来源 | 已实现 |
| O-06 | AI 背景的画风预设与画廊 | 把"生成一张图"变成可反复使用的功能 | 已实现 |
| O-07 | 移动端单栏切换 | 手机上原本不可用 | 已实现 |
| O-08 | Markdown 渲染 | 代码/列表类回答可读性 | 已实现（自研安全渲染） |
| O-09 | 离线陪聊降级 | 没配 Key 也能演示、能截图 | 已实现 |
| O-10 | 设置面板（TTS/模型/特效/人设） | 用户可调，减少"要么全开要么全关" | 已实现 |

---

## 6. 复现与验证方法

```bash
# 1) 复现 B-04：删掉 .env 后启动（原版会直接崩）
cd backend && rm -f .env && uvicorn app.main:app --port 8000

# 2) 复现 F-01：jsdom 中加载生产包，不注入 live2d.min.js
#    现象：#root 为空，控制台 "Could not find Cubism 2 runtime."
#    注入 public/lib/live2d.min.js 后可正常渲染

# 3) 复现 B-01：观察首字延迟
curl -N -X POST localhost:8000/api/v1/chat/chat \
  -H 'Content-Type: application/json' -d '{"message":"你好"}'
#    原版：长时间无输出，随后字符"喷涌"
#    现版：立刻出现 status/emotion，随后逐 token 到达
```

修复后的验证结果见 [DECISIONS.md](./DECISIONS.md#4-验证记录)。
