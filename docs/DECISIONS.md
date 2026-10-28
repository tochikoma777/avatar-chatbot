# 优化决策与动作记录（Decision & Action Log）

> 本文档记录"为什么这么改"和"具体改了什么"，是项目的可溯源依据。
> 问题编号（B-xx / F-xx / E-xx / O-xx）对应 [AUDIT.md](./AUDIT.md)；架构说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)；后续计划见 [ROADMAP.md](./ROADMAP.md)。

---

## 0. 文档约定

| 前缀 | 含义 | 何时新增 |
| :--- | :--- | :--- |
| `D-xx` | 决策（Decision）：有多个选项、需要长期维护的理由 | 每次做架构/技术选型时 |
| `A-xx` | 动作（Action）：一次成批的代码改动，可对应一个或多个 commit | 每完成一批改动时 |
| `N-xx` | 未采纳方案（Not adopted）：被评估并否决的选项及原因 | 否决时立即记录，避免后人重复讨论 |
| `V-xx` | 验证（Verification）：可复现的验证命令与结果 | 每批动作完成后 |

**追加规则**：只追加、不覆盖历史结论；若决策被推翻，新增一条 D 并在正文注明 `取代 D-xx`。

---

## 1. 仓库与版本策略

### D-01 继续在原仓库维护，用 tag + 分支保留 MVP 快照

**背景**：这是一次"同一产品从 MVP 到 v1 的重构"，改动量约 60 个文件（后端全部重写、前端目录级重构）。需要在"保持项目延续性"和"保留原始状态可回溯"之间取舍。

**选项**

| 方案 | 优点 | 缺点 |
| :--- | :--- | :--- |
| A. 原仓库直接覆盖 | 链接/star/fork/issue 全部延续；README 演进自然 | 历史里看不出"从哪一版开始重构" |
| B. 原仓库 + `v0.5.0-mvp` tag + 特性分支 + `v1.0.0` tag | 兼得延续性与可回溯性；可随时 `git diff v0.5.0-mvp..v1.0.0` 得到完整重构 diff | 需要多做一次打 tag / 分批评审的动作 |
| C. 新建仓库 | 干净历史、可换项目名 | 丢失原仓库的 star/issue/PR；两套仓库长期漂移；对开源项目是负面信号 |

**决策**：**B**。这是同一个产品，应当延续；MVP 用 tag + 分支固化即可满足"可回溯"。

**执行清单（待执行）**
```bash
git tag -a v0.5.0-mvp a4ee91a -m "MVP snapshot before v1 rebuild"
git switch -c feat/v1-rebuild
# 分批提交：backend → frontend 重构 → 视觉/功能 → 修复 Live2D 白屏 → 工具链清理 → docs
git switch main && git merge --no-ff feat/v1-rebuild
git tag -a v1.0.0 -m "v1.0.0: real streaming, personas, tools, anime UI"
```

**何时应该改用方案 C**：项目改名/换定位（例如从"我的看板娘"变成通用 Live2D 聊天框架）、或所有权/许可证发生变化时。

**关于旧 README**：**不做副本留档，直接覆盖**。理由：tag `v0.5.0-mvp` 已完整固化原始仓库状态，`git show v0.5.0-mvp:README.md` 可随时取回；再放一份 `README.old.md` 只会制造"哪份才权威"的歧义。同理，本项目的"历史截图"也应通过 tag 或 Release 附件保存，而不是留在工作区。

**代价**：main 分支上会有一条较大的 merge commit；建议在 PR 描述里贴本文档链接。

---

## 2. 架构决策

### D-02 后端改为「真流式 + 工具增量累积」，而不是流式/工具二选一

**背景**：原实现为了支持工具调用退化成非流式（B-01）。但 OpenAI 协议的 `stream=true` 本身就支持 `tool_calls` 的 delta。

**决策**：`adapters.stream_completion()` 统一走流式；`services._stream_turn()` 边转发 `delta.content`，边把 `delta.tool_calls[index]` 的 `id/name/arguments` 拼接起来。一轮结束若存在完整工具调用，则执行工具、把结果写回 `messages`，再发起下一轮流式。

**理由**：首字延迟降到网络 RTT 级别；工具能力不损失；实现只比非流式多约 20 行。

**约束**：工具最多 `MAX_TOOL_TURNS=3` 轮；最后一轮强制 `tools=None`，保证一定产出文本（修复 B-05）。

### D-03 上下文由前端携带，后端保持无状态

**选项**：① 服务端会话（Redis/SQLite）② 前端回传 history ③ 服务端内存字典

**决策**：②。`ChatRequest.history[]` 由前端从 `localStorage` 截取最近 12 轮回传，后端只做拼接与长度裁剪。

**理由**：项目定位是"本地/单机可跑"，引入存储层会显著抬高部署门槛；同时天然支持"每个角色各自一份历史"。

**代价**：历史可被前端篡改（对玩具项目可接受）；超长对话的 token 成本由前端裁剪策略控制。若将来做多端同步，再补服务端会话（记录在路线图）。

### D-04 情绪用「首行标签」协议，而不是结构化 JSON 输出

**背景**：需要让 Live2D/UI 感知"这句话是什么情绪"。

**决策**：系统提示词要求模型首行输出 `[emotion:happy]`（happy/shy/sad/angry/surprise/calm），标签之后换行输出正文。后端用 `EmotionBuffer` 在流的最前面截获标签，转成独立 SSE 事件 `{"emotion": "..."}`，正文照常流式。

**理由**：不破坏纯文本流；模型遵循成本低；解析失败（模型没输出）时最多缓冲 48 字符就原样放行，不会卡住流。

**代价**：多消耗 ~10 token/轮；极少数情况下标签会漏到正文（已用 48 字符上限兜底）。

### D-05 人设：前端管"长什么样"，后端管"怎么说话"

**决策**：`frontend/src/config/personas.js` 维护 id/名称/标语/emoji/主色/问候语/建议提问/音色建议；`backend/app/core/personas.py` 维护同 id 的 system_prompt。前端只传 `persona_id`，可选 `system_prompt` 覆盖（自定义人设）。

**理由**：视觉与提示词分别演进，互不阻塞；提示词不暴露给前端（避免被随意抓取）；`id` 作为唯一契约。

**风险**：两侧 id 必须手工保持一致。已在 README「扩展指南」中写明新增角色的 3 步流程。

### D-06 工具集：以"零密钥、可离线、有边界"为准入标准

**决策**：内置 7 个工具：时间、冷知识、天气（wttr.in）、掷骰、计算、二次元台词、随机选择。计算器使用 AST 白名单求值（仅数字与 `+ - * / % **` 与括号），拒绝函数调用/属性访问/超长表达式。

**理由**：不需要额外 API Key，克隆即可用；`calculate` 是唯一有注入风险的工具，用白名单而非 `eval`。

**验证**：`calculate("__import__('os').system('ls')")` 返回"这个式子算不出来"，`(128+72)*3` 返回 600。

**约定**：工具统一 `async`，`execute_tool()` 用 `inspect.isawaitable` 兼容同步/异步实现；参数用 `**kwargs` 传入，TypeError 时回退无参调用。

### D-07 图像生成：在线 + 程序化兜底 + LRU，且不再是"随机照片"

**选项**：① 只调在线（失败即报错）② 在线 + Picsum 照片兜底（原方案）③ 在线 + 本地程序化 SVG 兜底

**决策**：③。prompt 追加画风关键词（`anime scenery, makoto shinkai style...`）；`OrderedDict` 实现 32 条 LRU（key = 画风 + 种子 + 尺寸 + prompt）；失败时用 seed 生成渐变 + 光斑 + 花瓣 + 山影的 SVG 场景。

**理由**：兜底图也符合二次元调性；同 prompt 二次生成秒回；体积上 SVG 远小于位图。

**代价**：程序化图是"氛围图"而非"理解 prompt 的图"，仅作降级。

### D-08 配置健壮化：默认值 + 运行时能力探测 + 离线模式

**决策**：所有配置项给默认值，`DEEPSEEK_API_KEY` 允许为空；`Settings.llm_ready` 作为唯一判据；未配置时 `ChatService` 走 `_offline_stream()`，用预置台词流式回复并提示去配 `.env`；`/health` 返回 `llm_ready` 供前端显示"模型就绪/离线陪聊"。

**理由**：克隆即可 `uvicorn` 启动，降低上手门槛；前端能明确区分"后端挂了"与"没配 Key"（B-04、B-09）。

### D-09 前端按职责分层，一个组件只做一件事

**决策**：`components`（展示）/ `hooks`（状态与副作用）/ `services`（HTTP+SSE）/ `config`（常量与预设）/ `styles`（分文件 CSS）五层。

**理由**：原 `App.jsx` + `ChatBox.jsx` 把 SSE 解析、TTS、ASR、UI 混在一起（F-07），无法复用也无法定位问题。分层后：SSE 只在 `services/api.js`，流状态机只在 `hooks/useChat.js`，语音只在 `useTTS`/`useSpeech`。

**代价**：文件数从 5 → 24，新读者需要一次目录导览（已写在 ARCHITECTURE.md）。

### D-10 Live2D：运行时显式注入 + 动态 import + 能力探测三层防御

**背景**：F-01（白屏）与 F-02（假口型）都源于"假设库的行为"。

**决策**
1. 把 Cubism 2.1 运行时 `live2d.min.js`（129KB）**落到 `public/lib/`**，在 `index.html` 中以经典 `<script>` 在模块脚本之前注入 `window.Live2D`；
2. `oh-my-live2d` 改为**动态 `import()`**，并用 `try/catch` 包裹，运行时缺失时降级为 CSS 小精灵（不让整个应用陪葬）；
3. 参数驱动全部走**能力探测**：`internalModel.coreModel` → `setParameterValueById`（Cubism 4）→ `setParamFloat`（Cubism 2，`PARAM_MOUTH_OPEN_Y`）；
4. 就绪判断改用官方 `instance.onLoad(status)` 事件，而非轮询 canvas。

**收益**：白屏消除；口型真正生效；Live2D 被拆成独立 chunk（首屏 JS 从 1.18MB 降到 ~185KB，模型库按需加载）。

**风险**：`internalModel` 属于库的内部结构，升级 oh-my-live2d 时可能失效——已用能力探测 + try/catch 保证"最坏情况只是没有口型"，并在路线图中登记"升级时重点回归"。

### D-11 持久化：按角色分 key，设置做默认值合并

**决策**：`localStorage` key 约定为 `avatar-chat.settings` / `avatar-chat.persona` / `avatar-chat.scene` / `avatar-chat.history.<personaId>`。读取设置时与 `DEFAULT_SETTINGS` 做浅合并，保证新增配置项对老用户生效。

**实现要点**：`usePersistedState` 检测到 key 变化（切换角色）时在渲染阶段重读存储，否则 `useState` 只初始化一次会导致"切角色后历史不刷新"。

**代价**：单个角色历史不设上限，理论上可撑爆 5MB 配额（写入失败已静默忽略）。见路线图"历史裁剪"。

### D-12 视觉：CSS 变量 + 纯 CSS 粒子，不引入 UI 库/动画库

**选项**：① Tailwind + shadcn ② styled-components/Framer Motion ③ 手写 CSS 变量 + 分文件

**决策**：③。设计令牌集中在 `styles/base.css`（颜色/圆角/阴影/字体），`--persona-accent` 随角色切换，`[data-accent]` 支持三套主题；粒子（樱花/星点/光斑/浮尘/网格）用绝对定位 + keyframes，数量随 `effectsLevel` 缩放。

**理由**：项目是"看板娘"，美术风格自定义程度高于组件规范；零运行时依赖；`prefers-reduced-motion` 可整体降级。

**代价**：没有现成组件生态，新增控件要自己写样式（已在 `styles/ui.css` 沉淀 Switch/Range/Segmented/Toast 等）。

### D-13 Markdown 自研渲染，不引第三方解析器

**决策**：`components/Markdown.jsx` 支持代码块、行内代码、加粗/斜体/删除线、链接、标题、引用、无序列表；全部用 React 元素构造，不使用 `dangerouslySetInnerHTML`。

**理由**：避免 XSS 风险面；避免为 6 种语法引入 40+ KB 依赖；流式场景下只重渲染当前消息。

**代价**：不支持表格/嵌套列表等复杂语法（记录在路线图）。

### D-14 工具链降级到"与运行环境匹配"的版本

**决策**：Vite 5.4 / React 18.3 / ESLint 9 / @vitejs/plugin-react 4.3；移除 electron 全家桶与未使用的 live2d-widget 依赖。

**理由**：本机 Node 18，Vite 8 与 ESLint 10 均要求 Node 20+（E-01）；electron 无对应代码（E-02）。

**代价**：无法使用 Vite 7 的新特性；升级 Node 后可平滑再升（记录在路线图）。

### D-15 文档拆分：审查 / 决策 / 架构 / 路线图 / 经验手册，各司其职

**决策**
- `AUDIT.md`：**过去**的问题（编号 + 证据 + 影响 + 状态），回答"原来哪里不对"；
- `DECISIONS.md`：**为什么这么改**（选项/决策/代价）+ 动作与验证，回答"为什么是现在这样"；
- `ARCHITECTURE.md`：**现在是什么样**（模块职责/数据流/接口/扩展步骤），回答"我要改哪里"；
- `ROADMAP.md`：**接下来做什么**（优先级/工作量/验收标准），回答"下一步做什么"；
- `PLAYBOOK.md`：**换个项目还能怎么用**——把本次方法抽象成通用原则、流程、Checklist 与反模式，回答"下次接手类似项目该怎么做"。

**理由**：前四类问题读者不同（评审者 / 维护者 / 新同学 / 未来的自己），混在一份文档里会越写越乱；第五类跨项目复用，必须与项目细节解耦，否则会被具体实现绑死、无法迁移。

**边界**：`PLAYBOOK.md` 只写"可证伪的原则与可复制的流程"，不写本项目的实现细节（那属于 ARCHITECTURE）；每次项目结束把新教训补进去，编号递增、不重排。

### D-16 密钥管理：模板/实例分离 + 提交前拦截

**背景**：配置 API Key 时发生了真实事故——Key 被写进了 `backend/.env.example`（**被 git 追踪的模板文件**），一旦 `git add -A` 就会连同密钥一起提交、推送、公开。同时 `.gitignore` 只写了 `.env`，没有覆盖 `.env.local` / `.env.production` 等变体。

**选项**

| 方案 | 优点 | 缺点 |
| :--- | :--- | :--- |
| A. 只靠 `.gitignore` | 零成本 | 拦不住"写错文件"；变体文件名易漏；无法发现历史遗留 |
| B. `.gitignore` 全覆盖 + 模板/实例严格分离 + pre-commit 钩子 | 能拦住最常见失误（写错文件、`git add -A`）；离线可用；对新贡献者同样生效 | 钩子可被 `--no-verify` 绕过；`core.hooksPath` 是本地配置，新克隆需执行一次安装脚本 |
| C. 引入密钥管理服务 / Vault | 企业级轮换与审计 | 对单机可跑的项目过重，破坏"克隆即用" |

**决策**：**B**。

**落地**：`.gitignore` 覆盖 `.env`、`.env.*` 并显式 `!` 保留 `.env.example`；新增 `scripts/git-hooks/pre-commit`（扫描暂存内容中的 `sk-...` 与 `.env` 实例文件）与 `scripts/install-hooks.sh`（设置 `core.hooksPath`）；README 增加「密钥与安全」与「启动故障排查」两节。

**代价与边界**：钩子只是"降低概率"，不是安全边界；真正的兜底是**一旦怀疑泄露就立即轮换密钥**。文档必须把这条写在显眼位置，否则团队容易误以为"有钩子就安全"。

---

## 3. 动作记录

### A-01 后端：流式编排与工具循环重写
- 重写 `core/adapters.py`（`stream_completion`，`LLMNotConfiguredError`）、`core/services.py`（`EmotionBuffer`、`_stream_turn`、工具多轮、离线降级）
- 新增 `core/personas.py`（5 套人设 + 精简列表接口）
- 扩展 `core/tools.py`（7 工具、异步执行、AST 安全计算）
- `core/models.py` 增加 `history` / `enable_tools` / 长度校验；`config.py` 全量默认值 + `get_settings()` 缓存
- `api/dependencies.py` 提供 `ChatService` / `ImageGenerator` 单例；新增 `endpoints/personas.py`；`health.py` 返回 `llm_ready`/工具/角色
- 关联：B-01 ~ B-11

### A-02 前端：目录分层与组件重写
- 新增 `components/`：`StagePanel` `Live2DView` `SceneEffects` `BackgroundStudio` `ChatPanel` `MessageBubble` `Composer` `SettingsDrawer` `Markdown` `Toast` `Splash` `Icons`
- 新增 `hooks/`：`useChat`（流状态机/停止/重生成）、`useTTS`（分句+边界事件）、`useSpeech`（ASR）、`usePersistedState`、`useToast`
- 新增 `services/api.js`（SSE 分帧解析）、`config/{personas,scenes,settings}.js`
- 删除 `App.css`、`src/index.css`、`ChatBox.jsx`
- 关联：F-03 ~ F-08、F-12

### A-03 前端：视觉与动效
- `styles/base.css`（令牌 + 重置 + 滚动条）、`layout.css`（顶栏/双栏/响应式）、`stage.css`（6 场景 + 5 类粒子 + HUD + 背景工坊）、`chat.css`（气泡/消息/输入区/Markdown）、`ui.css`（按钮/抽屉/开关/滑块/Toast/Splash）
- 关键细节：`.stage { isolation: isolate }` 隔离 Live2D `position:fixed; z-index:9997` 的画布；HUD/背景工坊提升到 9998/9999
- 关联：F-09、O-05

### A-04 前端：功能增强
- 5 角色切换（独立历史）、设置抽屉（TTS/ASR/模型/界面/人设/工具开关）、对话导出 Markdown、消息复制/重生成/删除/朗读、空状态建议词、Toast 替代 alert、启动动画、移动端单栏切换
- 关联：O-01 ~ O-04、O-06 ~ O-10

### A-05 修复：Live2D 运行时缺失导致的白屏
- 引入 `public/lib/live2d.min.js`（129,056 B，Cubism 2.1 WebGL 运行时，来源：jsDelivr `dylanNew/live2d` 镜像）
- `index.html` 在模块脚本前注入 `<script src="/lib/live2d.min.js">`
- `Live2DView` 改为动态 `import('oh-my-live2d')` + try/catch + `onLoad` 事件 + `coreModel` 能力探测 + `stage.unMount()` 卸载
- 关联：F-01、F-02；同时带来首屏体积优化（见 V-05）

### A-06 工程与仓库清理
- `package.json`：移除 electron / electron-builder / concurrently / wait-on / live2d-widget / live2d-widget-model-haru；vite→5.4、eslint→9、react→18.3
- `eslint.config.js` 修正插件 API（`reactHooks.configs['recommended-latest']` + `ecmaVersion/sourceType`），lint 恢复可用
- 删除 `frontend/.vite/`、`src/assets/*`、`public/icons.svg`；`.gitignore` 补充 dist/.vite/.venv
- 关联：E-01 ~ E-05

### A-07 文档与示例
- 重写 `README.md`（功能矩阵/架构图/API 表/SSE 事件表/使用小贴士/文档导航）
- 新增 `docs/AUDIT.md`、`docs/DECISIONS.md`、`docs/ARCHITECTURE.md`、`docs/ROADMAP.md`
- 新增 `docs/PLAYBOOK.md`（跨项目复用的方法论：十条原则、接手流程、四文档模型、审查清单、"假实现"识别手册、提效技巧、反模式、通用 Checklist）
- 更新 `body.json` 为新 schema、`backend/.env.example` 补全可调项

### A-08 推送前全量回归：修复回归缺陷 + 语音看门狗
**触发**：按"推送前跑一遍完整测试"的要求执行回归，覆盖 T-01 ~ T-38（见 V-11）。

- **修复回归缺陷**：`core/tools.py` 的 `get_weather` 在去重时把 `data = resp.json()` 一并删掉，
  导致该工具必然抛 `NameError` 并落入降级分支（表面"网络不通"）。已补回并复测通过。
  *这是本次重构引入的缺陷，不在原项目审查清单内。*
- **健壮性**：`hooks/useTTS.js` 增加朗读看门狗——部分浏览器（尤其 Chrome 长句/被取消时）
  会漏发 `onend`，此前会让 `speaking` 永久为 true（表现为一直显示"说话中"、口型不停）。
  现在按字数与语速估算时长，超时强制复位并 cancel。
- **可观测性**：`Live2DView` 在 `onLoad('fail')` 时输出 `console.warn` 并带上模型路径，
  便于用户反馈"模型没出来"时定位（此前是静默降级）。

**验证**：V-11（59 项断言全部通过，0 失败）。

### A-09 密钥误置事件处置 + 真实模型链路修复

**现象**：用户配置 Key 后启动报错；排查发现两件事同时发生。

1. **启动失败根因**：我在上一轮验证时遗留的 uvicorn 仍占用 8000 端口，用户执行启动命令时报
   `ERROR: [Errno 98] Address already in use`。已结束遗留进程并释放 8000/5173。
2. **密钥误置**：Key 被写进 `backend/.env.example`（受版本控制）。`git log -S` 确认**从未提交**：
   - 还原 `.env.example` 为占位符版本；
   - 保留 `backend/.env`（含 Key，已被忽略）不动；
   - 新增 pre-commit 钩子并自测（伪造密钥文件被拦截，exit=1）；
   - `.gitignore` 扩展覆盖 `.env.*` 变体，同时显式保留 `.env.example`。

**同时修复**（真实模型暴露、此前被 mock 掩盖）：模型实际输出 `[calm]` 裸标签，而解析器只认
`[emotion:calm]`，导致标签直接出现在第一条回复的正文里。现在兼容 `[emotion:x]` / `[情绪：x]` /
`[x]` / `【x】` 四种写法，未知括号（如 `[注]`）原样保留，并去掉正文开头多余空行。

**验证**：V-12。

---

## 4. 验证记录

| ID | 验证项 | 命令 / 方法 | 结果 |
| :--- | :--- | :--- | :--- |
| V-01 | 前端构建 | `cd frontend && npm run build` | ✅ 通过；产物 `index.html 1.10 kB`、`css 28.41 kB`、`js 185.42 kB + 999.86 kB`（Live2D 已拆包） |
| V-02 | 前端静态检查 | `npm run lint` | ✅ 0 error（原配置直接抛 TypeError） |
| V-03 | 后端启动（无 Key） | `uvicorn app.main:app --port 8000` | ✅ 正常启动，日志 WARN "未检测到 DEEPSEEK_API_KEY，对话将进入离线陪聊模式" |
| V-04 | 接口冒烟 | `GET /api/v1/health/health` | ✅ 返回 `{"status":"ok","llm_ready":false,"tools":[7 项],"personas":[5 个]}` |
| V-05 | 流式对话（离线） | `curl -N -X POST /api/v1/chat/chat` | ✅ 依次收到 `status → emotion → content×N → finish_reason` |
| V-06 | 工具安全 | `execute_tool('calculate', '__import__("os").system("ls")')` | ✅ 拒绝执行，返回"这个式子算不出来"；`(128+72)*3` → 600 |
| V-07 | 图像生成 | `POST /api/v1/generate/generate-image` | ✅ 返回真实 JPEG data URI（Pollinations 可用）；失败路径由 SVG 兜底覆盖 |
| V-08 | 首屏渲染 | jsdom 加载生产包（注入 `live2d.min.js`） | ✅ `.app/.topbar/.stage/.chat/.empty-state/.composer` 均存在；5 角色条、6 场景条、4 条建议词 |
| V-09 | 完整对话流 | jsdom 模拟输入 + 点击发送，喂入预设 SSE | ✅ 用户/助手气泡各 1，工具提示 1 条且位于回复**之前**并标记完成，`strong/code/list` 均渲染，结束后按钮恢复为"发送" |
| V-10 | 白屏专项 | jsdom **不注入**运行时加载原构建 | ❌ 复现 `Could not find Cubism 2 runtime.`，`#root` 为空（证明 F-01 成立） |
| V-11 | **推送前全量回归** | 见下方明细 | ✅ 59 项断言全部通过；过程中发现并修复 2 个缺陷（见 A-08） |

### V-11 明细（2026-10-28 推送前）

| 域 | 断言数 | 覆盖内容 | 结果 |
| :--- | :---: | :--- | :--- |
| 后端接口 | 11 | SSE 头与事件时序（status → emotion → content → finish）、离线标记、分片数、空/超长消息 422、未知角色回落、CORS 预检与 localhost 正则 | 11/11 |
| 工具与生图 | 20 | schema↔注册表↔标签一致性、7 个工具正常路径、注入/除零/参数上限/非法 JSON 等异常路径、生图 data URI、缓存命中与一致性、非法尺寸 422 | 20/20 |
| 前端交互（jsdom） | 19 | 首屏骨架、5 角色/6 场景/4 建议词、发送与流式渲染、工具提示顺序与完成态、Markdown、情绪联动、持久化、切角色历史隔离、设置抽屉开关与 Esc | 19/19 |
| 构建与资源 | 7 | lint 0 error、build 产物、dev server、`/lib/live2d.min.js` 200/129056B、模型 JSON 200、模块转换、`/api` 代理 | 7/7 |
| 人工复测 | 2 | 天气工具修复后（北京 / Tokyo）返回真实数据 | 2/2 |

**本次回归的补充结论**

1. `get_weather` 的 `NameError` 属于**回归缺陷**（A-08 修复），说明"工具降级 + 友好文案"会掩盖真实错误——
   这类兜底必须伴随日志（`logger.warning` 已保留），否则 CI 绿灯也可能全是降级。
2. Live2D **无法在无头环境完成视觉验证**：SwiftShader 下 WebGL 可用、模型文件全部 200、
   库回调 `onLoad` 也能到达，但画面为空白（三种参数组合一致）。因此 Playwright 类 E2E
   （ROADMAP R-06）不应把"模型像素是否可见"作为断言，只能断言 canvas 存在与 `onLoad` 状态。

| V-12 | **真实模型链路**（配置 Key 后） | 两轮真实对话 + 情绪解析用例 | ✅ 通过；修复标签泄漏缺陷 |

### V-12 明细

| 检查项 | 结果 |
| :--- | :--- |
| `llm_ready` | ✅ true（`.env` 被正确读取） |
| 真实流式 + 工具调用（sakura / 查询时间） | ✅ 2.4s，事件含 `tool_calling` → `tool_result` → `content` → `finish_reason` |
| 第二角色（neko） | ✅ 1.5s，情绪 `happy`，口癖符合角色（咲不喵、猫娘才喵） |
| 情绪标签泄漏 | ❌ 修复前正文以 `[calm]` 开头 → ✅ 修复后无残留 |
| `EmotionBuffer` 用例（标准/裸标签/方头括号/中文情绪词/带空格/非情绪括号/无标签） | ✅ 7/7 |

**结论**：手写 SSE 假数据只能验证"协议解析"正确，**验证不了模型会不会按约定格式输出**。
真实链路必须至少跑一轮（PLAYBOOK 反模式"用 mock 掩盖外部依赖"）。

> 说明：V-08/V-09/V-10 使用临时脚本（jsdom@22 + esbuild IIFE 打包）执行，脚本未入库；正式测试方案见 ROADMAP P1。

---

## 5. 未采纳方案

| ID | 方案 | 否决原因 |
| :--- | :--- | :--- |
| N-01 | 用 WebSocket 替代 SSE | SSE 已足够（单向流），且 `StreamingResponse` 零额外依赖；WS 需要额外心跳/重连逻辑 |
| N-02 | 引入 Tailwind / shadcn | 看板娘项目视觉高度定制，工具类无法表达粒子与拟态层；也避免新增构建链 |
| N-03 | 引入 `react-markdown` + `remark-gfm` | 为 6 种语法引入 40+ KB 与 XSS 风险面；自研 120 行已覆盖场景 |
| N-04 | 服务端会话存储（Redis/SQLite） | 抬高部署门槛；本项目定位单机可跑。若做多端同步再评估 |
| N-05 | 保留 Picsum 作为图像兜底 | 真实照片与二次元场景冲突，观感割裂 |
| N-06 | 直接升级 Node 到 20 以保留 Vite 8 | 本机无 nvm，升级运行时属于环境变更，超出本次范围；已降级到 Vite 5 并登记升级路线 |
| N-07 | 把历史消息存进 `sessionStorage` | 关闭标签页即丢，与"刷新不丢"的目标相反 |
| N-08 | 重写为 Next.js/SSR | 项目是纯客户端应用（Live2D + 浏览器语音 API），SSR 无收益 |

---

## 6. 变更统计

- 后端：11 个文件修改 / 1 个新增（`personas.py`）+ 1 个新增 endpoint
- 前端：删除 4 个文件，新增 24 个文件（组件 12 / hooks 5 / config 3 / styles 5 + api.js）
- 文档：README 重写 + 新增 4 份 docs
- 依赖：移除 6 个（electron 类 4 + live2d-widget 类 2），降级 4 个，无新增运行时依赖
