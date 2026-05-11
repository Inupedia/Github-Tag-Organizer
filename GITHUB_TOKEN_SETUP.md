# 🔑 GitHub Token 权限配置指南

## 权限要求

### 必需权限（最小配置）

#### 1. `repo` - 完整仓库访问权限
- **用途**：获取 starred 仓库信息
- **说明**：这是脚本的核心功能，用于读取你 starred 的所有仓库
- **包含权限**：
  - `repo:status` - 访问仓库状态
  - `repo_deployment` - 访问部署状态
  - `public_repo` - 访问公共仓库
  - `repo:invite` - 访问仓库邀请
  - `security_events` - 访问安全事件

#### 2. `read:user` - 读取用户信息
- **用途**：获取当前用户信息
- **说明**：用于确定当前登录用户，获取其 starred 仓库
- **包含权限**：
  - `user:email` - 读取用户邮箱
  - `user:follow` - 读取用户关注信息

### 可选权限（完整功能）

#### 3. `gist` - 创建 Gists
- **用途**：创建 GitHub Collections 作为 Lists 的替代方案
- **说明**：如果不需要 Collections 功能，可以不选择此权限
- **包含权限**：
  - `gist` - 创建、更新、删除 Gists

## 配置步骤

### 步骤 1：访问 GitHub Token 设置
1. 登录 GitHub
2. 点击右上角头像 → Settings
3. 左侧菜单选择 "Developer settings"
4. 选择 "Personal access tokens" → "Tokens (classic)"
5. 点击 "Generate new token" → "Generate new token (classic)"

### 步骤 2：配置 Token 信息
- **Note**：`GitHub Tag Organizer`（或任何你喜欢的名称）
- **Expiration**：选择适当的过期时间（建议 90 天或 1 年）
- **Scopes**：选择权限（见下方详细说明）

### 步骤 3：选择权限

#### 最小配置（推荐）
```
✅ repo
  ✅ repo:status
  ✅ repo_deployment  
  ✅ public_repo
  ✅ repo:invite
  ✅ security_events
✅ read:user
  ✅ user:email
  ✅ user:follow
```

#### 完整配置（包含 Collections 功能）
```
✅ repo
  ✅ repo:status
  ✅ repo_deployment  
  ✅ public_repo
  ✅ repo:invite
  ✅ security_events
✅ read:user
  ✅ user:email
  ✅ user:follow
✅ gist
  ✅ gist
```

### 步骤 4：生成并保存 Token
1. 点击 "Generate token"
2. **重要**：立即复制 token 并保存到安全的地方
3. Token 只会显示一次，无法再次查看

### 步骤 5：配置环境变量
将 token 添加到 `.env` 文件：
```env
GITHUB_TOKEN=ghp_your_token_here
```

## 权限说明

### 为什么需要这些权限？

| 权限 | 用途 | 是否必需 |
|------|------|----------|
| `repo` | 获取 starred 仓库列表和详细信息 | ✅ 必需 |
| `read:user` | 获取当前用户信息 | ✅ 必需 |
| `gist` | 创建 Collections 作为 Lists 替代 | ❌ 可选 |

### 自动同步 GitHub Star Lists

GitHub Personal Access Token 只能读取 starred 仓库，GitHub 目前没有官方 API 可用于创建或修改 Star Lists。本项目的全自动 Lists 同步需要额外配置浏览器登录会话 cookie：

```env
SYNC_GITHUB_LISTS=true
GITHUB_SESSION_COOKIES=_octo=...; user_session=...; logged_in=yes; ...
```

获取方式：

1. 登录 github.com
2. 打开浏览器开发者工具 → Network
3. 刷新任意 GitHub 页面
4. 选中一个 github.com 请求，在 Request Headers 中复制完整 `Cookie` 值

首次运行建议设置 `GITHUB_LISTS_DRY_RUN=true` 预览 LLM 分类和即将创建/更新的 Lists。

### 安全建议

1. **最小权限原则**：只选择必需的权限
2. **定期轮换**：建议每 90 天更换一次 token
3. **安全存储**：将 token 保存在安全的地方，不要提交到代码仓库
4. **及时撤销**：如果不再使用，及时在 GitHub 上撤销 token

## 故障排除

### 常见错误

#### 1. "Resource not accessible by personal access token"
- **原因**：Token 权限不足
- **解决**：检查是否选择了 `repo` 和 `read:user` 权限

#### 2. "Bad credentials"
- **原因**：Token 无效或过期
- **解决**：重新生成 token 并更新 `.env` 文件

#### 3. "API rate limit exceeded"
- **原因**：API 调用次数超限
- **解决**：等待重置或使用更少的仓库数量

#### 4. "无法找到 GitHub CSRF token"
- **原因**：`GITHUB_SESSION_COOKIES` 未配置、已过期，或不是从已登录的 github.com 请求复制
- **解决**：重新从浏览器复制完整 Cookie，并确认包含 `user_session` 和 `logged_in=yes`

### 验证 Token 权限

运行测试脚本验证 token 配置：
```bash
npm run test-setup
```

如果看到以下输出，说明配置正确：
```
✅ .env file exists
✅ GITHUB_TOKEN is configured
✅ Dependencies installed
✅ Project built
✅ Found X TypeScript files
```

## 总结

- **最小配置**：`repo` + `read:user`（推荐）
- **完整配置**：`repo` + `read:user` + `gist`
- **安全第一**：只选择必需的权限
- **定期更新**：建议每 90 天更换 token
