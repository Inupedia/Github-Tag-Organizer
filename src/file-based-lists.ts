import { GitHubRepo, ClassificationResult } from "./types";
import * as fs from "fs/promises";
import * as path from "path";

export class FileBasedListsClient {
  private outputDir: string;

  constructor(outputDir: string = "./github-lists") {
    this.outputDir = outputDir;
  }

  async createAllLists(organizedRepos: {
    [key: string]: {
      [key: string]: {
        repos: Array<{
          repo: GitHubRepo;
          classification: ClassificationResult;
        }>;
      };
    };
  }): Promise<string[]> {
    // 确保输出目录存在
    await fs.mkdir(this.outputDir, { recursive: true });

    const createdFiles: string[] = [];

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      // 创建主类别列表
      const categoryRepos = Object.values(subcategories).flatMap(
        (subcategory) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        const filePath = await this.createListFile(
          `⭐ ${category}`,
          `Starred repositories in ${category} category`,
          categoryRepos
        );
        createdFiles.push(filePath);
      }

      // 如果有多个子类别，创建子类别列表
      const subcategoryNames = Object.keys(subcategories);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(subcategories)) {
          if (subcategory !== "通用" && data.repos.length > 0) {
            const filePath = await this.createListFile(
              `⭐ ${category} - ${subcategory}`,
              `Starred repositories in ${category} > ${subcategory}`,
              data.repos
            );
            createdFiles.push(filePath);
          }
        }
      }
    }

    // 创建主索引文件
    const indexPath = await this.createIndexFile(organizedRepos, createdFiles);
    createdFiles.push(indexPath);

    return createdFiles;
  }

  private async createListFile(
    name: string,
    description: string,
    repos: Array<{ repo: GitHubRepo; classification: ClassificationResult }>
  ): Promise<string> {
    const fileName = this.sanitizeFileName(name) + ".md";
    const filePath = path.join(this.outputDir, fileName);

    const content = this.generateListContent(name, description, repos);

    await fs.writeFile(filePath, content, "utf8");

    console.log(`📄 创建列表文件：${fileName}`);
    console.log(`   路径：${filePath}`);
    console.log(`   仓库数：${repos.length}`);

    return filePath;
  }

  private async createIndexFile(
    organizedRepos: {
      [key: string]: {
        [key: string]: {
          repos: Array<{
            repo: GitHubRepo;
            classification: ClassificationResult;
          }>;
        };
      };
    },
    createdFiles: string[]
  ): Promise<string> {
    const indexPath = path.join(this.outputDir, "README.md");

    let content = "# GitHub 星标仓库列表\n\n";
    content += `生成时间：${new Date().toISOString()}\n\n`;
    content += `创建的列表总数：${createdFiles.length}\n\n`;

    content += "## 可用列表\n\n";

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      content += `### ${category}\n\n`;

      const categoryRepos = Object.values(subcategories).flatMap(
        (subcategory) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        const fileName = this.sanitizeFileName(`⭐ ${category}`) + ".md";
        content += `- [${category}](${fileName}) (${categoryRepos.length} 个仓库)\n`;
      }

      const subcategoryNames = Object.keys(subcategories);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(subcategories)) {
          if (subcategory !== "通用" && data.repos.length > 0) {
            const fileName =
              this.sanitizeFileName(`⭐ ${category} - ${subcategory}`) + ".md";
            content += `  - [${subcategory}](${fileName}) (${data.repos.length} 个仓库)\n`;
          }
        }
      }

      content += "\n";
    }

    content += "## 使用方法\n\n";
    content += "1. 每个列表文件包含特定类别的仓库\n";
    content += "2. 您可以使用这些文件作为参考手动创建 GitHub 列表\n";
    content += "3. 从文件中复制仓库链接来创建您的 GitHub 列表\n\n";
    content += "## 手动创建 GitHub 列表\n\n";
    content += "1. 访问您的 GitHub 个人资料\n";
    content += "2. 点击左侧边栏中的 'Lists'\n";
    content += "3. 点击 'New list'\n";
    content += "4. 使用这些文件中的信息来填充您的列表\n\n";

    await fs.writeFile(indexPath, content, "utf8");

    console.log(`📋 创建索引文件：README.md`);
    console.log(`   路径：${indexPath}`);

    return indexPath;
  }

  private generateListContent(
    name: string,
    description: string,
    repos: Array<{ repo: GitHubRepo; classification: ClassificationResult }>
  ): string {
    let content = `# ${name}\n\n`;
    content += `${description}\n\n`;
    content += `**仓库总数：** ${repos.length}\n\n`;
    content += `**生成时间：** ${new Date().toISOString()}\n\n`;
    content += "## 仓库列表\n\n";

    repos.forEach(({ repo, classification }, index) => {
      content += `### ${index + 1}. [${repo.name}](${repo.html_url})\n\n`;
      content += `**描述：** ${repo.description || "无描述"}\n\n`;
      content += `**语言：** ${repo.language || "未知"}\n\n`;
      content += `**星标数：** ${repo.stargazers_count}\n\n`;
      content += `**主题：** ${repo.topics.join(", ") || "无"}\n\n`;
      content += `**分类：** ${classification.category}${
        classification.subcategory ? ` > ${classification.subcategory}` : ""
      }\n\n`;
      content += `**标签：** ${classification.tags.join(", ")}\n\n`;
      content += `**原因：** ${classification.reason}\n\n`;
      content += "---\n\n";
    });

    content += "## 手动创建 GitHub 列表\n\n";
    content += "从此文件创建 GitHub 列表：\n\n";
    content += "1. 访问您的 GitHub 个人资料\n";
    content += "2. 点击左侧边栏中的 'Lists'\n";
    content += "3. 点击 'New list'\n";
    content += "4. 给它命名：" + name + "\n";
    content += "5. 添加上面列出的仓库\n\n";
    content += "**要添加的仓库 URL：**\n\n";
    repos.forEach(({ repo }) => {
      content += `- ${repo.html_url}\n`;
    });

    return content;
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }
}
