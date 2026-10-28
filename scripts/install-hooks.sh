#!/usr/bin/env bash
# 为当前克隆启用仓库自带的 git hooks（防密钥泄漏）
set -euo pipefail
cd "$(dirname "$0")/.."

git config core.hooksPath scripts/git-hooks
chmod +x scripts/git-hooks/*

echo "✅ 已启用仓库钩子：core.hooksPath=$(git config core.hooksPath)"
echo "   现在提交时若检测到疑似 API Key 或 .env 实例文件，会被自动拦截。"
