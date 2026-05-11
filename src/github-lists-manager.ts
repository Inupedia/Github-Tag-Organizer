import { Octokit } from "@octokit/rest";
import { GitHubRepo, ClassificationResult } from "./types";
import { AppLanguage, getLocaleText, localize } from "./i18n";
import * as fs from "fs/promises";

export class GitHubListsManager {
  private octokit: Octokit;
  private username: string;
  private language: AppLanguage;

  constructor(token: string, username: string, language: AppLanguage = "zh") {
    this.octokit = new Octokit({
      auth: token,
    });
    this.username = username;
    this.language = language;
  }

  async generateListsCreationScript(organizedRepos: any): Promise<void> {
    let script = localize(this.language, {
      zh: `# GitHub Lists 创建脚本
# 使用方法：在浏览器控制台中运行此脚本

console.log("🚀 开始创建 GitHub Lists...");
`,
      en: `# GitHub Lists creation script
# Usage: run this script in the browser console

console.log("🚀 Starting GitHub Lists creation...");
`,
    });

    script += `
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
    console.log(\`📝 ${localize(this.language, {
      zh: "创建 List",
      en: "Creating List",
    })}: \${name}\`);
    
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
    
    console.log(\`✅ List "\${name}" ${localize(this.language, {
      zh: "创建完成",
      en: "created",
    })}\`);
    
  } catch (error) {
    console.error(\`❌ ${localize(this.language, {
      zh: "创建 List",
      en: "Failed to create List",
    })} "\${name}" ${localize(this.language, {
      zh: "失败",
      en: "",
    })}:\`, error);
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
          if (subcategory !== "通用" && (data as any).repos.length > 0) {
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
  console.log("${localize(this.language, {
    zh: "🎉 所有 Lists 创建完成！",
    en: "🎉 All Lists created!",
  })}");
}

// 开始创建
createAllLists();
`;

    await fs.writeFile("create-github-lists.js", script, "utf8");
    console.log(
      localize(this.language, {
        zh: "📄 已生成 GitHub Lists 创建脚本: create-github-lists.js",
        en: "📄 Generated GitHub Lists creation script: create-github-lists.js",
      })
    );
  }

  async generateManualInstructions(organizedRepos: any): Promise<void> {
    const locale = getLocaleText(this.language);
    let instructions = localize(this.language, {
      zh: `# GitHub Lists 手动创建指南

## 步骤 1：访问 GitHub Stars 页面
1. 打开 https://github.com/${this.username}?tab=stars
2. 确保你已经登录到 GitHub

## 步骤 2：创建 Lists

`,
      en: `# Manual GitHub Lists Creation Guide

## Step 1: Visit the GitHub Stars page
1. Open https://github.com/${this.username}?tab=stars
2. Make sure you are logged in to GitHub

## Step 2: Create Lists

`,
    });

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const categoryRepos = Object.values(subcategories as any).flatMap(
        (subcategory: any) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        instructions += localize(this.language, {
          zh: `### 创建 "⭐ ${category}" List\n\n`,
          en: `### Create "⭐ ${category}" List\n\n`,
        });
        instructions += localize(this.language, {
          zh: `**描述：** ${category} 类别的星标仓库 (${categoryRepos.length} 个)\n\n`,
          en: `**Description:** Starred repositories in ${category} category (${categoryRepos.length} repos)\n\n`,
        });
        instructions += localize(this.language, {
          zh: "**仓库列表：**\n",
          en: "**Repositories:**\n",
        });

        categoryRepos.forEach(({ repo }: any, index: number) => {
          instructions += `${index + 1}. [${repo.name}](${repo.html_url}) - ${
            repo.description || locale.noDescription
          }\n`;
        });

        instructions += localize(this.language, {
          zh: `\n**操作步骤：**\n1. 点击 "New list" 按钮\n2. 输入名称：⭐ ${category}\n3. 输入描述：${category} 类别的星标仓库\n4. 点击 "Create list"\n5. 逐个添加上述仓库到 List 中\n\n`,
          en: `\n**Steps:**\n1. Click "New list"\n2. Enter the name: ⭐ ${category}\n3. Enter the description: Starred repositories in ${category} category\n4. Click "Create list"\n5. Add the repositories above to the List one by one\n\n`,
        });
      }

      // 添加子分类
      const subcategoryNames = Object.keys(subcategories as any);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(
          subcategories as any
        )) {
          if (
            subcategory !== locale.genericSubcategory &&
            (data as any).repos.length > 0
          ) {
            instructions += localize(this.language, {
              zh: `### 创建 "⭐ ${category} - ${subcategory}" List\n\n`,
              en: `### Create "⭐ ${category} - ${subcategory}" List\n\n`,
            });
            instructions += localize(this.language, {
              zh: `**描述：** ${category} > ${subcategory} 的星标仓库 (${
                (data as any).repos.length
              } 个)\n\n`,
              en: `**Description:** Starred repositories in ${category} > ${subcategory} (${
                (data as any).repos.length
              } repos)\n\n`,
            });
            instructions += localize(this.language, {
              zh: "**仓库列表：**\n",
              en: "**Repositories:**\n",
            });

            (data as any).repos.forEach(({ repo }: any, index: number) => {
              instructions += `${index + 1}. [${repo.name}](${
                repo.html_url
              }) - ${repo.description || locale.noDescription}\n`;
            });

            instructions += localize(this.language, {
              zh: `\n**操作步骤：**\n1. 点击 "New list" 按钮\n2. 输入名称：⭐ ${category} - ${subcategory}\n3. 输入描述：${category} > ${subcategory} 的星标仓库\n4. 点击 "Create list"\n5. 逐个添加上述仓库到 List 中\n\n`,
              en: `\n**Steps:**\n1. Click "New list"\n2. Enter the name: ⭐ ${category} - ${subcategory}\n3. Enter the description: Starred repositories in ${category} > ${subcategory}\n4. Click "Create list"\n5. Add the repositories above to the List one by one\n\n`,
            });
          }
        }
      }
    }

    instructions += localize(this.language, {
      zh: `## 自动化脚本（可选）

如果你想要自动化创建过程，可以使用生成的 JavaScript 脚本：

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 复制并粘贴 \`create-github-lists.js\` 文件中的内容
4. 按回车执行

**注意：** 自动化脚本可能需要根据 GitHub 页面结构的变化进行调整。

## 完成后的效果

创建完成后，你应该能在 https://github.com/${this.username}?tab=stars 看到新的 Lists，每个 List 包含对应分类的仓库。
`,
      en: `## Automation script (optional)

If you want to automate the creation process, use the generated JavaScript script:

1. Open browser developer tools (F12)
2. Switch to the Console tab
3. Copy and paste the contents of \`create-github-lists.js\`
4. Press Enter to run it

**Note:** The automation script may need updates if GitHub changes its page structure.

## Result

After creation, you should see the new Lists at https://github.com/${this.username}?tab=stars. Each List contains the repositories for that classification.
`,
    });

    await fs.writeFile(
      "github-lists-manual-instructions.md",
      instructions,
      "utf8"
    );
    console.log(
      localize(this.language, {
        zh: "📄 已生成手动创建指南: github-lists-manual-instructions.md",
        en: "📄 Generated manual creation guide: github-lists-manual-instructions.md",
      })
    );
  }

  async generateCSVForImport(organizedRepos: any): Promise<void> {
    const locale = getLocaleText(this.language);
    let csv = localize(this.language, {
      zh: "列表名称,仓库 URL,描述\n",
      en: "List Name,Repository URL,Description\n",
    });

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const categoryRepos = Object.values(subcategories as any).flatMap(
        (subcategory: any) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        categoryRepos.forEach(({ repo }: any) => {
          csv += `"⭐ ${category}","${repo.html_url}","${
            repo.description || locale.noDescription
          }"\n`;
        });
      }

      // 添加子分类
      const subcategoryNames = Object.keys(subcategories as any);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(
          subcategories as any
        )) {
          if (
            subcategory !== locale.genericSubcategory &&
            (data as any).repos.length > 0
          ) {
            (data as any).repos.forEach(({ repo }: any) => {
              csv += `"⭐ ${category} - ${subcategory}","${repo.html_url}","${
                repo.description || locale.noDescription
              }"\n`;
            });
          }
        }
      }
    }

    await fs.writeFile("github-lists-import.csv", csv, "utf8");
    console.log(
      localize(this.language, {
        zh: "📄 已生成 CSV 导入文件: github-lists-import.csv",
        en: "📄 Generated CSV import file: github-lists-import.csv",
      })
    );
  }
}
