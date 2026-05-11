import {
  GitHubRepo,
  ClassificationResult,
  GitHubList,
  GitHubStarList,
  GitHubStarListAssignment,
  GitHubStarListSyncSummary,
} from "./types";
import { GitHubClient } from "./github-client";
import { LLMClient } from "./llm-client";
import { FileBasedListsClient } from "./file-based-lists";
import { GitHubListsManager } from "./github-lists-manager";
import { GitHubStarListsClient } from "./github-star-lists-client";
import { AppLanguage, getLocaleText, localize } from "./i18n";

export interface OrganizedRepos {
  [category: string]: {
    [subcategory: string]: {
      repos: Array<{
        repo: GitHubRepo;
        classification: ClassificationResult;
      }>;
    };
  };
}

export class RepoOrganizer {
  private githubClient: GitHubClient;
  private llmClient: LLMClient;
  private fileBasedListsClient: FileBasedListsClient;
  private githubListsManager: GitHubListsManager;
  private language: AppLanguage;

  constructor(
    githubClient: GitHubClient,
    llmClient: LLMClient,
    fileBasedListsClient: FileBasedListsClient,
    githubListsManager: GitHubListsManager,
    language: AppLanguage = "zh"
  ) {
    this.githubClient = githubClient;
    this.llmClient = llmClient;
    this.fileBasedListsClient = fileBasedListsClient;
    this.githubListsManager = githubListsManager;
    this.language = language;
  }

  async organizeRepositories(
    repos: GitHubRepo[],
    existingStarLists: GitHubStarList[] = []
  ): Promise<OrganizedRepos> {
    console.log(
      localize(this.language, {
        zh: `正在分类 ${repos.length} 个仓库...`,
        en: `Classifying ${repos.length} repositories...`,
      })
    );

    // 使用 LLM 分类仓库
    const classifications = await this.llmClient.classifyRepositories(
      repos,
      existingStarLists
    );

    // 按类别和子类别整理仓库
    const organized: OrganizedRepos = {};

    repos.forEach((repo, index) => {
      const classification = classifications[index];
      const category = classification.listName || classification.category;
      const subcategory =
        classification.subcategory ||
        getLocaleText(this.language).genericSubcategory;

      if (!organized[category]) {
        organized[category] = {};
      }

      if (!organized[category][subcategory]) {
        organized[category][subcategory] = { repos: [] };
      }

      organized[category][subcategory].repos.push({
        repo,
        classification,
      });
    });

    return organized;
  }

  buildGitHubStarListAssignments(
    organizedRepos: OrganizedRepos
  ): GitHubStarListAssignment[] {
    const assignments: GitHubStarListAssignment[] = [];

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      for (const data of Object.values(subcategories)) {
        data.repos.forEach(({ repo, classification }) => {
          assignments.push({
            repo,
            classification,
            listName: classification.listName || category,
          });
        });
      }
    }

    return assignments;
  }

  async syncGitHubStarLists(
    organizedRepos: OrganizedRepos,
    starListsClient: GitHubStarListsClient,
    options: { dryRun?: boolean } = {}
  ): Promise<GitHubStarListSyncSummary> {
    const assignments = this.buildGitHubStarListAssignments(organizedRepos);
    if (assignments.length === 0) {
      return {
        existingLists: [],
        createdLists: [],
        assignedRepos: [],
        failedRepos: [],
        dryRun: options.dryRun ?? false,
      };
    }

    return starListsClient.syncAssignments(assignments, assignments[0].repo, {
      dryRun: options.dryRun,
    });
  }

  async createGitHubLists(
    organizedRepos: OrganizedRepos
  ): Promise<GitHubList[]> {
    const createdLists: GitHubList[] = [];

    // 创建基于文件的列表（不需要 GitHub API）
    console.log(
      localize(this.language, {
        zh: "📁 创建基于文件的列表...",
        en: "📁 Creating file-based lists...",
      })
    );
    const filePaths = await this.fileBasedListsClient.createAllLists(
      organizedRepos
    );

    console.log(
      localize(this.language, {
        zh: `✅ 创建了 ${filePaths.length} 个列表文件`,
        en: `✅ Created ${filePaths.length} list files`,
      })
    );
    console.log(
      localize(this.language, {
        zh: "📋 列表文件：",
        en: "📋 List files:",
      })
    );
    filePaths.forEach((filePath, index) => {
      console.log(`   ${index + 1}. ${filePath}`);
    });

    // 同时创建旧式虚拟列表以保持向后兼容性
    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      // 创建主类别列表
      const categoryList = await this.githubClient.createList(
        `⭐ ${category}`,
        `Starred repositories in ${category} category`,
        true
      );
      createdLists.push(categoryList);

      // 如果有多个子类别，创建子类别列表
      const subcategoryNames = Object.keys(subcategories);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(subcategories)) {
          if (
            subcategory !== getLocaleText(this.language).genericSubcategory &&
            data.repos.length > 0
          ) {
            const subcategoryList = await this.githubClient.createList(
              `⭐ ${category} - ${subcategory}`,
              `Starred repositories in ${category} > ${subcategory}`,
              true
            );
            createdLists.push(subcategoryList);
          }
        }
      }
    }

    // 生成 GitHub Lists 创建工具
    console.log(
      localize(this.language, {
        zh: "🔧 生成 GitHub Lists 创建工具...",
        en: "🔧 Generating GitHub Lists creation tools...",
      })
    );
    await this.githubListsManager.generateListsCreationScript(organizedRepos);
    await this.githubListsManager.generateManualInstructions(organizedRepos);
    await this.githubListsManager.generateCSVForImport(organizedRepos);
    console.log(
      localize(this.language, {
        zh: "✅ GitHub Lists 创建工具已生成",
        en: "✅ GitHub Lists creation tools generated",
      })
    );

    // 将列表保存到文件以便手动创建 GitHub 列表
    await this.saveListsToFile(organizedRepos, createdLists);

    return createdLists;
  }

  async saveListsToFile(
    organizedRepos: OrganizedRepos,
    lists: GitHubList[]
  ): Promise<void> {
    const fs = require("fs").promises;

    const locale = getLocaleText(this.language);
    let content = localize(this.language, {
      zh: "# 手动创建 GitHub Lists\n\n",
      en: "# Manual GitHub Lists Creation\n\n",
    });
    content += localize(this.language, {
      zh: "使用此文件根据整理的仓库手动创建 GitHub 列表。\n\n",
      en: "Use this file to manually create GitHub Lists from the organized repositories.\n\n",
    });

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      content += `## ${category}\n\n`;

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          const listName =
            subcategory === locale.genericSubcategory
              ? `⭐ ${category}`
              : `⭐ ${category} - ${subcategory}`;
          content += `### ${listName}\n\n`;
          content += localize(this.language, {
            zh: `**描述：** ${category} 类别的星标仓库${
              subcategory !== locale.genericSubcategory ? ` > ${subcategory}` : ""
            }\n\n`,
            en: `**Description:** Starred repositories in ${category}${
              subcategory !== locale.genericSubcategory ? ` > ${subcategory}` : ""
            }\n\n`,
          });
          content += localize(this.language, {
            zh: `**仓库 (${data.repos.length} 个)：**\n\n`,
            en: `**Repositories (${data.repos.length}):**\n\n`,
          });

          data.repos.forEach(({ repo }) => {
            content += `- [${repo.name}](${repo.html_url}) - ${
              repo.description || locale.noDescription
            }\n`;
          });

          content += "\n---\n\n";
        }
      }
    }

    await fs.writeFile("github-lists-manual.md", content, "utf8");
    console.log(
      localize(this.language, {
        zh: "📄 已保存手动列表创建指南到：github-lists-manual.md",
        en: "📄 Saved manual list creation guide to: github-lists-manual.md",
      })
    );
  }

  generateReport(organizedRepos: OrganizedRepos): string {
    const locale = getLocaleText(this.language);
    let report = localize(this.language, {
      zh: "# GitHub 星标仓库整理报告\n\n",
      en: "# GitHub Starred Repository Organization Report\n\n",
    });
    report += localize(this.language, {
      zh: `生成时间：${new Date().toISOString()}\n\n`,
      en: `Generated at: ${new Date().toISOString()}\n\n`,
    });

    const totalRepos = Object.values(organizedRepos)
      .flatMap((category) => Object.values(category))
      .reduce((sum, subcategory) => sum + subcategory.repos.length, 0);

    report += localize(this.language, {
      zh: `整理的仓库总数：${totalRepos}\n\n`,
      en: `Total repositories organized: ${totalRepos}\n\n`,
    });

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      report += `## ${category}\n\n`;

      const categoryRepoCount = Object.values(subcategories).reduce(
        (sum, subcategory) => sum + subcategory.repos.length,
        0
      );

      report += localize(this.language, {
        zh: `**仓库总数：** ${categoryRepoCount}\n\n`,
        en: `**Total repositories:** ${categoryRepoCount}\n\n`,
      });

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          report += localize(this.language, {
            zh: `### ${subcategory} (${data.repos.length} 个仓库)\n\n`,
            en: `### ${subcategory} (${data.repos.length} repositories)\n\n`,
          });

          data.repos.forEach(({ repo, classification }) => {
            report += `- **[${repo.name}](${repo.html_url})**\n`;
            report += localize(this.language, {
              zh: `  - 描述：${repo.description || locale.noDescription}\n`,
              en: `  - Description: ${repo.description || locale.noDescription}\n`,
            });
            report += localize(this.language, {
              zh: `  - 语言：${repo.language || locale.unknown}\n`,
              en: `  - Language: ${repo.language || locale.unknown}\n`,
            });
            report += localize(this.language, {
              zh: `  - 星标数：${repo.stargazers_count}\n`,
              en: `  - Stars: ${repo.stargazers_count}\n`,
            });
            report += localize(this.language, {
              zh: `  - 主题：${repo.topics.join(", ") || locale.none}\n`,
              en: `  - Topics: ${repo.topics.join(", ") || locale.none}\n`,
            });
            report += localize(this.language, {
              zh: `  - 分类原因：${classification.reason}\n`,
              en: `  - Classification reason: ${classification.reason}\n`,
            });
            report += localize(this.language, {
              zh: `  - 标签：${classification.tags.join(", ")}\n\n`,
              en: `  - Tags: ${classification.tags.join(", ")}\n\n`,
            });
          });
        }
      }
    }

    return report;
  }

  async saveReport(
    report: string,
    filename: string = "organization-report.md"
  ): Promise<void> {
    const fs = require("fs").promises;
    await fs.writeFile(filename, report, "utf8");
    console.log(
      localize(this.language, {
        zh: `报告已保存到：${filename}`,
        en: `Report saved to: ${filename}`,
      })
    );
  }
}
