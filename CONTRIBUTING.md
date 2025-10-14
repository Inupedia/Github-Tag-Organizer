# Contributing to GitHub Tag Organizer

感谢你对 GitHub Tag Organizer 项目的关注！我们欢迎任何形式的贡献。

## 🚀 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议，请：

1. 检查 [Issues](https://github.com/Inupedia/github-tag-organizer/issues) 是否已经存在
2. 创建新的 Issue，包含：
   - 清晰的问题描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境信息（Node.js 版本、操作系统等）

### 提交代码

1. **Fork 项目**
2. **创建特性分支**：
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **提交更改**：
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **推送分支**：
   ```bash
   git push origin feature/amazing-feature
   ```
5. **创建 Pull Request**

## 📝 开发指南

### 环境设置

```bash
# 克隆你的 fork
git clone https://github.com/yourusername/github-tag-organizer.git
cd github-tag-organizer

# 安装依赖
npm install

# 创建环境变量文件
cp env.example .env
# 编辑 .env 文件添加你的配置
```

### 代码规范

- 使用 TypeScript
- 遵循现有的代码风格
- 添加适当的注释
- 确保类型安全
- 编写清晰的提交信息

### 测试

```bash
# 构建项目
npm run build

# 运行测试
npm test

# 开发模式
npm run dev
```

### 项目结构

```
src/
├── github-client.ts      # GitHub API 客户端
├── llm-client.ts         # LLM 客户端
├── organizer.ts          # 核心组织逻辑
├── file-based-lists.ts   # 文件系统列表生成
├── github-lists-manager.ts # GitHub Lists 管理
├── types.ts             # 类型定义
└── index.ts             # 入口文件
```

## 🎯 贡献类型

### 🐛 Bug 修复
- 修复现有功能的问题
- 改进错误处理
- 优化性能

### ✨ 新功能
- 添加新的分类算法
- 支持更多 LLM 提供商
- 改进输出格式
- 添加新的导出选项

### 📚 文档
- 改进 README
- 添加代码注释
- 创建使用示例
- 更新 API 文档

### 🧪 测试
- 添加单元测试
- 改进测试覆盖率
- 添加集成测试

## 🔍 代码审查

所有提交都会经过代码审查，请确保：

- 代码符合项目风格
- 添加了适当的测试
- 更新了相关文档
- 提交信息清晰明了

## 📞 获取帮助

如果你有任何问题，可以：

- 在 Issues 中提问
- 联系维护者
- 查看现有文档

## 📄 许可证

通过贡献代码，你同意你的贡献将在 MIT 许可证下发布。

---

再次感谢你的贡献！🎉
