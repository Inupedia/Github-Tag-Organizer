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
    console.log(`Classifying ${repos.length} repositories...`);

    // Classify repositories using LLM
    const classifications = await this.llmClient.classifyRepositories(repos);

    // Organize repositories by category and subcategory
    const organized: OrganizedRepos = {};

    repos.forEach((repo, index) => {
      const classification = classifications[index];
      const category = classification.category;
      const subcategory = classification.subcategory || "General";

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

    // Create file-based lists (no GitHub API required)
    console.log("📁 Creating file-based lists...");
    const filePaths = await this.fileBasedListsClient.createAllLists(
      organizedRepos
    );

    console.log(`✅ Created ${filePaths.length} list files`);
    console.log("📋 List files:");
    filePaths.forEach((filePath, index) => {
      console.log(`   ${index + 1}. ${filePath}`);
    });

    // Also create the old-style virtual lists for backward compatibility
    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      // Create main category list
      const categoryList = await this.githubClient.createList(
        `⭐ ${category}`,
        `Starred repositories in ${category} category`,
        true
      );
      createdLists.push(categoryList);

      // Create subcategory lists if there are multiple subcategories
      const subcategoryNames = Object.keys(subcategories);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(subcategories)) {
          if (subcategory !== "General" && data.repos.length > 0) {
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

    // Generate GitHub Lists creation tools
    console.log("🔧 Generating GitHub Lists creation tools...");
    await this.githubListsManager.generateListsCreationScript(organizedRepos);
    await this.githubListsManager.generateManualInstructions(organizedRepos);
    await this.githubListsManager.generateCSVForImport(organizedRepos);
    console.log("✅ GitHub Lists creation tools generated");

    // Save lists to a file for manual GitHub list creation
    await this.saveListsToFile(organizedRepos, createdLists);

    return createdLists;
  }

  async saveListsToFile(
    organizedRepos: OrganizedRepos,
    lists: GitHubList[]
  ): Promise<void> {
    const fs = require("fs").promises;

    let content = "# GitHub Lists for Manual Creation\n\n";
    content +=
      "Use this file to manually create GitHub lists based on the organized repositories.\n\n";

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      content += `## ${category}\n\n`;

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          const listName =
            subcategory === "General"
              ? `⭐ ${category}`
              : `⭐ ${category} - ${subcategory}`;
          content += `### ${listName}\n\n`;
          content += `**Description:** Starred repositories in ${category}${
            subcategory !== "General" ? ` > ${subcategory}` : ""
          }\n\n`;
          content += `**Repositories (${data.repos.length}):**\n\n`;

          data.repos.forEach(({ repo }) => {
            content += `- [${repo.name}](${repo.html_url}) - ${
              repo.description || "No description"
            }\n`;
          });

          content += "\n---\n\n";
        }
      }
    }

    await fs.writeFile("github-lists-manual.md", content, "utf8");
    console.log(
      "📄 Saved manual list creation guide to: github-lists-manual.md"
    );
  }

  generateReport(organizedRepos: OrganizedRepos): string {
    let report = "# GitHub Starred Repositories Organization Report\n\n";
    report += `Generated on: ${new Date().toISOString()}\n\n`;

    const totalRepos = Object.values(organizedRepos)
      .flatMap((category) => Object.values(category))
      .reduce((sum, subcategory) => sum + subcategory.repos.length, 0);

    report += `Total repositories organized: ${totalRepos}\n\n`;

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      report += `## ${category}\n\n`;

      const categoryRepoCount = Object.values(subcategories).reduce(
        (sum, subcategory) => sum + subcategory.repos.length,
        0
      );

      report += `**Total repositories:** ${categoryRepoCount}\n\n`;

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          report += `### ${subcategory} (${data.repos.length} repos)\n\n`;

          data.repos.forEach(({ repo, classification }) => {
            report += `- **[${repo.name}](${repo.html_url})**\n`;
            report += `  - Description: ${
              repo.description || "No description"
            }\n`;
            report += `  - Language: ${repo.language || "Unknown"}\n`;
            report += `  - Stars: ${repo.stargazers_count}\n`;
            report += `  - Topics: ${repo.topics.join(", ") || "None"}\n`;
            report += `  - Classification reason: ${classification.reason}\n`;
            report += `  - Tags: ${classification.tags.join(", ")}\n\n`;
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
    console.log(`Report saved to: ${filename}`);
  }
}
