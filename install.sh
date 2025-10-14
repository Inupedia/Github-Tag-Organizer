#!/bin/bash

# GitHub 标签整理器 - 安装脚本
# 此脚本安装依赖项并构建项目

set -e

echo "🚀 正在安装 GitHub 标签整理器..."

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未安装 Node.js。请先安装 Node.js 16+ 版本。"
    echo "   访问：https://nodejs.org/"
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ 需要 Node.js 16+ 版本。当前版本：$(node -v)"
    exit 1
fi

echo "✅ 检测到 Node.js $(node -v)"

# 安装依赖项
echo "📦 正在安装依赖项..."
npm install

# 构建项目
echo "🔨 正在构建项目..."
npm run build

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件。正在从模板创建..."
    cp env.example .env
    echo "📝 请编辑 .env 文件配置您的设置："
    echo "   - GITHUB_TOKEN: 您的 GitHub 个人访问令牌"
    echo "   - LLM_API_URL: 您的本地 LLM API 端点"
    echo "   - LLM_MODEL: 您的 LLM 模型名称"
fi

echo ""
echo "🎉 安装成功完成！"
echo ""
echo "📋 下一步："
echo "   1. 编辑 .env 文件配置您的设置"
echo "   2. 运行：npm run dev"
echo "   3. 检查项目目录中生成的文件"
echo ""
echo "📖 更多信息，请查看 README.md"