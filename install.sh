#!/bin/bash

# GitHub Tag Organizer - Installation Script
# This script installs dependencies and builds the project

set -e

echo "🚀 Installing GitHub Tag Organizer..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your configuration:"
    echo "   - GITHUB_TOKEN: Your GitHub Personal Access Token"
    echo "   - LLM_API_URL: Your local LLM API endpoint"
    echo "   - LLM_MODEL: Your LLM model name"
fi

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env file with your configuration"
echo "   2. Run: npm run dev"
echo "   3. Check the generated files in the project directory"
echo ""
echo "📖 For more information, see README.md"