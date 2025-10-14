import { Octokit } from "@octokit/rest";
import { GitHubRepo, ClassificationResult } from "./types";
import * as fs from "fs/promises";

export class GitHubListsManager {
  private octokit: Octokit;
  private username: string;

  constructor(token: string, username: string) {
    this.octokit = new Octokit({
      auth: token,
    });
    this.username = username;
  }

  async generateListsCreationScript(organizedRepos: any): Promise<void> {
    let script = `# GitHub Lists 创建脚本
# 使用方法：在浏览器控制台中运行此脚本

console.log("🚀 开始创建 GitHub Lists...");

// 等待页面加载
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(\`Element \${selector} not found within \${timeout}ms\`));
    }, timeout);
  });
}

// 创建 List 的函数
async function createList(name, description, repoUrls) {
  try {
    console.log(\`📝 创建 List: \${name}\`);
    
    // 点击 "New list" 按钮
    const newListButton = await waitForElement('[data-testid="new-list-button"], .btn-primary');
    newListButton.click();
    
    // 等待模态框出现
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 填写 List 名称
    const nameInput = await waitForElement('input[placeholder*="name"], input[placeholder*="Name"]');
    nameInput.value = name;
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // 填写描述（如果有）
    const descInput = document.querySelector('textarea[placeholder*="description"], textarea[placeholder*="Description"]');
    if (descInput) {
      descInput.value = description;
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // 点击创建按钮
    const createButton = document.querySelector('button[type="submit"], .btn-primary');
    createButton.click();
    
    // 等待 List 创建完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 添加仓库到 List
    for (const repoUrl of repoUrls) {
      console.log(\`➕ 添加仓库: \${repoUrl}\`);
      
      // 查找添加仓库的输入框
      const addRepoInput = document.querySelector('input[placeholder*="repository"], input[placeholder*="Repository"]');
      if (addRepoInput) {
        addRepoInput.value = repoUrl;
        addRepoInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 点击添加按钮
        const addButton = document.querySelector('button[type="submit"], .btn');
        if (addButton) {
          addButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log(\`✅ List "\${name}" 创建完成\`);
    
  } catch (error) {
    console.error(\`❌ 创建 List "\${name}" 失败:\`, error);
  }
}

// 要创建的 Lists 数据
const listsToCreate = [
`;

    // 生成 Lists 数据
    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const categoryRepos = Object.values(subcategories as any).flatMap(
        (subcategory: any) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        const repoUrls = categoryRepos.map(({ repo }: any) => repo.html_url);
        script += `  {
    name: "⭐ ${category}",
    description: "Starred repositories in ${category} category (${
          categoryRepos.length
        } repos)",
    repoUrls: ${JSON.stringify(repoUrls, null, 4)}
  },
`;
      }

      // 添加子分类
      const subcategoryNames = Object.keys(subcategories as any);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(
          subcategories as any
        )) {
          if (subcategory !== "General" && (data as any).repos.length > 0) {
            const repoUrls = (data as any).repos.map(
              ({ repo }: any) => repo.html_url
            );
            script += `  {
    name: "⭐ ${category} - ${subcategory}",
    description: "Starred repositories in ${category} > ${subcategory} (${
              (data as any).repos.length
            } repos)",
    repoUrls: ${JSON.stringify(repoUrls, null, 4)}
  },
`;
          }
        }
      }
    }

    script += `];

// 执行创建
async function createAllLists() {
  for (const list of listsToCreate) {
    await createList(list.name, list.description, list.repoUrls);
    // 等待一段时间再创建下一个
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  console.log("🎉 所有 Lists 创建完成！");
}

// 开始创建
createAllLists();
`;

    await fs.writeFile("create-github-lists.js", script, "utf8");
    console.log("📄 已生成 GitHub Lists 创建脚本: create-github-lists.js");
  }

  async generateManualInstructions(organizedRepos: any): Promise<void> {
    let instructions = `# GitHub Lists 手动创建指南

## 步骤 1：访问 GitHub Stars 页面
1. 打开 https://github.com/Inupedia?tab=stars
2. 确保你已经登录到 GitHub

## 步骤 2：创建 Lists

`;

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const categoryRepos = Object.values(subcategories as any).flatMap(
        (subcategory: any) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        instructions += `### 创建 "⭐ ${category}" List\n\n`;
        instructions += `**描述：** Starred repositories in ${category} category (${categoryRepos.length} repos)\n\n`;
        instructions += `**仓库列表：**\n`;

        categoryRepos.forEach(({ repo }: any, index: number) => {
          instructions += `${index + 1}. [${repo.name}](${repo.html_url}) - ${
            repo.description || "No description"
          }\n`;
        });

        instructions += `\n**操作步骤：**\n`;
        instructions += `1. 点击 "New list" 按钮\n`;
        instructions += `2. 输入名称：⭐ ${category}\n`;
        instructions += `3. 输入描述：Starred repositories in ${category} category\n`;
        instructions += `4. 点击 "Create list"\n`;
        instructions += `5. 逐个添加上述仓库到 List 中\n\n`;
      }

      // 添加子分类
      const subcategoryNames = Object.keys(subcategories as any);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(
          subcategories as any
        )) {
          if (subcategory !== "General" && (data as any).repos.length > 0) {
            instructions += `### 创建 "⭐ ${category} - ${subcategory}" List\n\n`;
            instructions += `**描述：** Starred repositories in ${category} > ${subcategory} (${
              (data as any).repos.length
            } repos)\n\n`;
            instructions += `**仓库列表：**\n`;

            (data as any).repos.forEach(({ repo }: any, index: number) => {
              instructions += `${index + 1}. [${repo.name}](${
                repo.html_url
              }) - ${repo.description || "No description"}\n`;
            });

            instructions += `\n**操作步骤：**\n`;
            instructions += `1. 点击 "New list" 按钮\n`;
            instructions += `2. 输入名称：⭐ ${category} - ${subcategory}\n`;
            instructions += `3. 输入描述：Starred repositories in ${category} > ${subcategory}\n`;
            instructions += `4. 点击 "Create list"\n`;
            instructions += `5. 逐个添加上述仓库到 List 中\n\n`;
          }
        }
      }
    }

    instructions += `## 自动化脚本（可选）

如果你想要自动化创建过程，可以使用生成的 JavaScript 脚本：

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 复制并粘贴 \`create-github-lists.js\` 文件中的内容
4. 按回车执行

**注意：** 自动化脚本可能需要根据 GitHub 页面结构的变化进行调整。

## 完成后的效果

创建完成后，你应该能在 https://github.com/Inupedia?tab=stars 看到新的 Lists，每个 List 包含对应分类的仓库。
`;

    await fs.writeFile(
      "github-lists-manual-instructions.md",
      instructions,
      "utf8"
    );
    console.log("📄 已生成手动创建指南: github-lists-manual-instructions.md");
  }

  async generateCSVForImport(organizedRepos: any): Promise<void> {
    let csv = "List Name,Repository URL,Description\n";

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const categoryRepos = Object.values(subcategories as any).flatMap(
        (subcategory: any) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        categoryRepos.forEach(({ repo }: any) => {
          csv += `"⭐ ${category}","${repo.html_url}","${
            repo.description || "No description"
          }"\n`;
        });
      }

      // 添加子分类
      const subcategoryNames = Object.keys(subcategories as any);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(
          subcategories as any
        )) {
          if (subcategory !== "General" && (data as any).repos.length > 0) {
            (data as any).repos.forEach(({ repo }: any) => {
              csv += `"⭐ ${category} - ${subcategory}","${repo.html_url}","${
                repo.description || "No description"
              }"\n`;
            });
          }
        }
      }
    }

    await fs.writeFile("github-lists-import.csv", csv, "utf8");
    console.log("📄 已生成 CSV 导入文件: github-lists-import.csv");
  }
}
