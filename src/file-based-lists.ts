import { GitHubRepo, ClassificationResult } from "./types";
import { AppLanguage, getLocaleText, localize } from "./i18n";
import * as fs from "fs/promises";
import * as path from "path";

export class FileBasedListsClient {
  private outputDir: string;
  private language: AppLanguage;

  constructor(outputDir: string = "./github-lists", language: AppLanguage = "zh") {
    this.outputDir = outputDir;
    this.language = language;
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
          if (
            subcategory !== getLocaleText(this.language).genericSubcategory &&
            data.repos.length > 0
          ) {
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

    console.log(
      localize(this.language, {
        zh: `📄 创建列表文件：${fileName}`,
        en: `📄 Created list file: ${fileName}`,
      })
    );
    console.log(
      localize(this.language, {
        zh: `   路径：${filePath}`,
        en: `   Path: ${filePath}`,
      })
    );
    console.log(
      localize(this.language, {
        zh: `   仓库数：${repos.length}`,
        en: `   Repositories: ${repos.length}`,
      })
    );

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

    const locale = getLocaleText(this.language);
    let content = localize(this.language, {
      zh: "# GitHub 星标仓库列表\n\n",
      en: "# GitHub Starred Repository Lists\n\n",
    });
    content += localize(this.language, {
      zh: `生成时间：${new Date().toISOString()}\n\n`,
      en: `Generated at: ${new Date().toISOString()}\n\n`,
    });
    content += localize(this.language, {
      zh: `创建的列表总数：${createdFiles.length}\n\n`,
      en: `Total lists created: ${createdFiles.length}\n\n`,
    });

    content += localize(this.language, {
      zh: "## 可用列表\n\n",
      en: "## Available Lists\n\n",
    });

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      content += `### ${category}\n\n`;

      const categoryRepos = Object.values(subcategories).flatMap(
        (subcategory) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        const fileName = this.sanitizeFileName(`⭐ ${category}`) + ".md";
        content += localize(this.language, {
          zh: `- [${category}](${fileName}) (${categoryRepos.length} 个仓库)\n`,
          en: `- [${category}](${fileName}) (${categoryRepos.length} repositories)\n`,
        });
      }

      const subcategoryNames = Object.keys(subcategories);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(subcategories)) {
          if (subcategory !== locale.genericSubcategory && data.repos.length > 0) {
            const fileName =
              this.sanitizeFileName(`⭐ ${category} - ${subcategory}`) + ".md";
            content += localize(this.language, {
              zh: `  - [${subcategory}](${fileName}) (${data.repos.length} 个仓库)\n`,
              en: `  - [${subcategory}](${fileName}) (${data.repos.length} repositories)\n`,
            });
          }
        }
      }

      content += "\n";
    }

    content += localize(this.language, {
      zh: "## 使用方法\n\n1. 每个列表文件包含特定类别的仓库\n2. 您可以使用这些文件作为参考手动创建 GitHub 列表\n3. 从文件中复制仓库链接来创建您的 GitHub 列表\n\n## 手动创建 GitHub 列表\n\n1. 访问您的 GitHub 个人资料\n2. 点击左侧边栏中的 'Lists'\n3. 点击 'New list'\n4. 使用这些文件中的信息来填充您的列表\n\n",
      en: "## Usage\n\n1. Each list file contains repositories for a specific category\n2. Use these files as a reference when manually creating GitHub Lists\n3. Copy repository links from the files into your GitHub Lists\n\n## Manually Create GitHub Lists\n\n1. Visit your GitHub profile\n2. Click 'Lists' in the sidebar\n3. Click 'New list'\n4. Use the information in these files to populate the list\n\n",
    });

    await fs.writeFile(indexPath, content, "utf8");

    console.log(
      localize(this.language, {
        zh: "📋 创建索引文件：README.md",
        en: "📋 Created index file: README.md",
      })
    );
    console.log(
      localize(this.language, {
        zh: `   路径：${indexPath}`,
        en: `   Path: ${indexPath}`,
      })
    );

    return indexPath;
  }

  private generateListContent(
    name: string,
    description: string,
    repos: Array<{ repo: GitHubRepo; classification: ClassificationResult }>
  ): string {
    let content = `# ${name}\n\n`;
    content += `${description}\n\n`;
    const locale = getLocaleText(this.language);
    content += localize(this.language, {
      zh: `**仓库总数：** ${repos.length}\n\n`,
      en: `**Total repositories:** ${repos.length}\n\n`,
    });
    content += localize(this.language, {
      zh: `**生成时间：** ${new Date().toISOString()}\n\n`,
      en: `**Generated at:** ${new Date().toISOString()}\n\n`,
    });
    content += localize(this.language, {
      zh: "## 仓库列表\n\n",
      en: "## Repositories\n\n",
    });

    repos.forEach(({ repo, classification }, index) => {
      content += `### ${index + 1}. [${repo.name}](${repo.html_url})\n\n`;
      content += localize(this.language, {
        zh: `**描述：** ${repo.description || locale.noDescription}\n\n`,
        en: `**Description:** ${repo.description || locale.noDescription}\n\n`,
      });
      content += localize(this.language, {
        zh: `**语言：** ${repo.language || locale.unknown}\n\n`,
        en: `**Language:** ${repo.language || locale.unknown}\n\n`,
      });
      content += localize(this.language, {
        zh: `**星标数：** ${repo.stargazers_count}\n\n`,
        en: `**Stars:** ${repo.stargazers_count}\n\n`,
      });
      content += localize(this.language, {
        zh: `**主题：** ${repo.topics.join(", ") || locale.none}\n\n`,
        en: `**Topics:** ${repo.topics.join(", ") || locale.none}\n\n`,
      });
      const classificationPath = `${classification.category}${
        classification.subcategory ? ` > ${classification.subcategory}` : ""
      }`;
      content += localize(this.language, {
        zh: `**分类：** ${classificationPath}\n\n`,
        en: `**Classification:** ${classificationPath}\n\n`,
      });
      content += localize(this.language, {
        zh: `**标签：** ${classification.tags.join(", ")}\n\n`,
        en: `**Tags:** ${classification.tags.join(", ")}\n\n`,
      });
      content += localize(this.language, {
        zh: `**原因：** ${classification.reason}\n\n`,
        en: `**Reason:** ${classification.reason}\n\n`,
      });
      content += "---\n\n";
    });

    content += localize(this.language, {
      zh: `## 手动创建 GitHub 列表\n\n从此文件创建 GitHub 列表：\n\n1. 访问您的 GitHub 个人资料\n2. 点击左侧边栏中的 'Lists'\n3. 点击 'New list'\n4. 给它命名：${name}\n5. 添加上面列出的仓库\n\n**要添加的仓库 URL：**\n\n`,
      en: `## Manually Create a GitHub List\n\nCreate a GitHub List from this file:\n\n1. Visit your GitHub profile\n2. Click 'Lists' in the sidebar\n3. Click 'New list'\n4. Name it: ${name}\n5. Add the repositories listed above\n\n**Repository URLs to add:**\n\n`,
    });
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
