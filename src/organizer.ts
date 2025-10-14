import { GitHubRepo, ClassificationResult, GitHubList } from "./types";
import { GitHubClient } from "./github-client";
import { LLMClient } from "./llm-client";
import { FileBasedListsClient } from "./file-based-lists";
import { GitHubListsManager } from "./github-lists-manager";

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

  constructor(
    githubClient: GitHubClient,
    llmClient: LLMClient,
    fileBasedListsClient: FileBasedListsClient,
    githubListsManager: GitHubListsManager
  ) {
    this.githubClient = githubClient;
    this.llmClient = llmClient;
    this.fileBasedListsClient = fileBasedListsClient;
    this.githubListsManager = githubListsManager;
  }

  async organizeRepositories(repos: GitHubRepo[]): Promise<OrganizedRepos> {
    console.log(`正在分类 ${repos.length} 个仓库...`);

    // 使用 LLM 分类仓库
    const classifications = await this.llmClient.classifyRepositories(repos);

    // 按类别和子类别整理仓库
    const organized: OrganizedRepos = {};

    repos.forEach((repo, index) => {
      const classification = classifications[index];
      const category = classification.category;
      const subcategory = classification.subcategory || "通用";

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

  async createGitHubLists(
    organizedRepos: OrganizedRepos
  ): Promise<GitHubList[]> {
    const createdLists: GitHubList[] = [];

    // 创建基于文件的列表（不需要 GitHub API）
    console.log("📁 创建基于文件的列表...");
    const filePaths = await this.fileBasedListsClient.createAllLists(
      organizedRepos
    );

    console.log(`✅ 创建了 ${filePaths.length} 个列表文件`);
    console.log("📋 列表文件：");
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
          if (subcategory !== "通用" && data.repos.length > 0) {
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
    console.log("🔧 生成 GitHub Lists 创建工具...");
    await this.githubListsManager.generateListsCreationScript(organizedRepos);
    await this.githubListsManager.generateManualInstructions(organizedRepos);
    await this.githubListsManager.generateCSVForImport(organizedRepos);
    console.log("✅ GitHub Lists 创建工具已生成");

    // 将列表保存到文件以便手动创建 GitHub 列表
    await this.saveListsToFile(organizedRepos, createdLists);

    return createdLists;
  }

  async saveListsToFile(
    organizedRepos: OrganizedRepos,
    lists: GitHubList[]
  ): Promise<void> {
    const fs = require("fs").promises;

    let content = "# 手动创建 GitHub Lists\n\n";
    content += "使用此文件根据整理的仓库手动创建 GitHub 列表。\n\n";

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      content += `## ${category}\n\n`;

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          const listName =
            subcategory === "通用"
              ? `⭐ ${category}`
              : `⭐ ${category} - ${subcategory}`;
          content += `### ${listName}\n\n`;
          content += `**描述：** ${category} 类别的星标仓库${
            subcategory !== "通用" ? ` > ${subcategory}` : ""
          }\n\n`;
          content += `**仓库 (${data.repos.length} 个)：**\n\n`;

          data.repos.forEach(({ repo }) => {
            content += `- [${repo.name}](${repo.html_url}) - ${
              repo.description || "无描述"
            }\n`;
          });

          content += "\n---\n\n";
        }
      }
    }

    await fs.writeFile("github-lists-manual.md", content, "utf8");
    console.log("📄 已保存手动列表创建指南到：github-lists-manual.md");
  }

  generateReport(organizedRepos: OrganizedRepos): string {
    let report = "# GitHub 星标仓库整理报告\n\n";
    report += `生成时间：${new Date().toISOString()}\n\n`;

    const totalRepos = Object.values(organizedRepos)
      .flatMap((category) => Object.values(category))
      .reduce((sum, subcategory) => sum + subcategory.repos.length, 0);

    report += `整理的仓库总数：${totalRepos}\n\n`;

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      report += `## ${category}\n\n`;

      const categoryRepoCount = Object.values(subcategories).reduce(
        (sum, subcategory) => sum + subcategory.repos.length,
        0
      );

      report += `**仓库总数：** ${categoryRepoCount}\n\n`;

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          report += `### ${subcategory} (${data.repos.length} 个仓库)\n\n`;

          data.repos.forEach(({ repo, classification }) => {
            report += `- **[${repo.name}](${repo.html_url})**\n`;
            report += `  - 描述：${repo.description || "无描述"}\n`;
            report += `  - 语言：${repo.language || "未知"}\n`;
            report += `  - 星标数：${repo.stargazers_count}\n`;
            report += `  - 主题：${repo.topics.join(", ") || "无"}\n`;
            report += `  - 分类原因：${classification.reason}\n`;
            report += `  - 标签：${classification.tags.join(", ")}\n\n`;
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
    console.log(`报告已保存到：${filename}`);
  }
}
