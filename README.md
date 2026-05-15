# Avatar Chatbot — 可视化智能虚拟助手

Avatar Chatbot 是一个二次元风格的可视化聊天机器人，拥有可交互的 Live2D 看板娘、流式对话、语音交互、AI 背景生成以及工具调用（Agent）能力。项目采用前后端分离架构，支持在浏览器运行，也可打包为独立的桌面应用。

## ✨ 功能特性

*   🎭 **Live2D 角色展示**：加载并显示二次元角色模型 (Haru)，支持自动眨眼、呼吸、拖拽交互。
*   💬 **流式智能对话**：集成 DeepSeek 大语言模型，支持人设定制和流式文本回复，对话如真人聊天。
*   🛠️ **Agent 工具调用**：AI 可自主调用工具完成任务，当前支持查询当前时间、获取趣味冷知识。
*   🎤 **语音输入 (ASR)**：浏览器内置语音识别，一句话即可与角色对话。
*   🔊 **语音合成 (TTS)**：AI 的回复会自动朗读出来，实现完整的语音对话闭环。
*   🎨 **AI 背景生成**：根据用户描述实时生成看板娘身后的背景图片，支持 AI 绘制。
*   🔄 **多背景预设**：内置多种风格背景（星夜、樱花、教室、简约），一键切换。
*   🎀 **精美 UI**：聊天气泡带头像和尾巴动画，消息淡入效果，暗色主题，交互友好。

## 🧱 技术栈

| 层 | 技术 |
| :--- | :--- |
| **前端** | React 18 + Vite, `oh-my-live2d` (Live2D 渲染), CSS3 动画 |
| **后端** | Python 3.11+ / FastAPI / Uvicorn, Poetry (依赖管理) |
| **AI 服务** | DeepSeek-V3 (对话), Pollinations.ai / Picsum (图像生成) |
| **语音** | Web Speech API (浏览器内置 ASR & TTS) |

## 📁 项目结构

```
avatar-chatbot/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/         # 路由端点 (chat, health, generate)
│   │   ├── core/           # 业务逻辑 (适配器, 服务, 工具, 图像生成)
│   │   └── config.py       # 环境配置
│   ├── .env.example        # 环境变量模板
│   └── pyproject.toml      # Poetry 依赖
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/     # 组件 (Live2DView, ChatBox)
│   │   ├── services/       # API 封装
│   │   └── App.jsx / App.css
│   ├── public/models/      # Live2D 模型文件
│   ├── electron/           # Electron 主进程
│   └── vite.config.js      # Vite 配置
└── README.md
```

## 🚀 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/tochikoma777/avatar-chatbot.git
cd avatar-chatbot
```

### 2. 启动后端
```bash
cd backend
poetry install
poetry shell
cp .env.example .env   # 编辑 .env 填入你的 DeepSeek API Key
uvicorn app.main:app --reload --port 8000
```

### 3. 启动前端
```bash
cd frontend
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`，左侧看板娘会向你微笑。


## 🖍️ 使用说明

*   **聊天**：在右侧输入框打字或点击 🎤 使用语音，AI 会流式回复并自动朗读。
*   **工具调用**：问“现在几点了”或“讲个冷知识”，AI 会调用相应工具并在对话框显示提示。
*   **背景**：在左侧下方输入描述词（如“星空樱花树”）并点击“生成背景”，AI 将为你创作独特场景。也可直接点击预设按钮切换。
*   **看板娘**：鼠标可拖拽角色，点击可触发反馈（默认有动作）。

## 📌 注意事项

*   首次使用语音功能时，浏览器会请求麦克风权限，请允许。
*   DeepSeek API Key 请在 `.env` 文件中配置，否则对话功能将不可用。

## 🤝 贡献与计划

本项目目前为 MVP 阶段，后续计划包括：
- [ ] 接入更自然的 TTS 引擎（如火山引擎）
- [ ] 实现口型与语音的精确同步
- [ ] 支持多个 Live2D 模型切换
- [ ] 增加联网搜索、天气查询等 Agent 工具
- [ ] 集成 AI 角色形象生成
- [ ] 支持自定义上传背景图片

欢迎提交 Issue 或 PR。

## 📄 许可证

MIT License