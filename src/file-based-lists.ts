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
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    const createdFiles: string[] = [];

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      // Create main category list
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

      // Create subcategory lists if there are multiple subcategories
      const subcategoryNames = Object.keys(subcategories);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(subcategories)) {
          if (subcategory !== "General" && data.repos.length > 0) {
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

    // Create a master index file
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

    console.log(`📄 Created list file: ${fileName}`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Repositories: ${repos.length}`);

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

    let content = "# GitHub Starred Repositories Lists\n\n";
    content += `Generated on: ${new Date().toISOString()}\n\n`;
    content += `Total lists created: ${createdFiles.length}\n\n`;

    content += "## Available Lists\n\n";

    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      content += `### ${category}\n\n`;

      const categoryRepos = Object.values(subcategories).flatMap(
        (subcategory) => subcategory.repos
      );
      if (categoryRepos.length > 0) {
        const fileName = this.sanitizeFileName(`⭐ ${category}`) + ".md";
        content += `- [${category}](${fileName}) (${categoryRepos.length} repositories)\n`;
      }

      const subcategoryNames = Object.keys(subcategories);
      if (subcategoryNames.length > 1) {
        for (const [subcategory, data] of Object.entries(subcategories)) {
          if (subcategory !== "General" && data.repos.length > 0) {
            const fileName =
              this.sanitizeFileName(`⭐ ${category} - ${subcategory}`) + ".md";
            content += `  - [${subcategory}](${fileName}) (${data.repos.length} repositories)\n`;
          }
        }
      }

      content += "\n";
    }

    content += "## How to Use\n\n";
    content +=
      "1. Each list file contains repositories for a specific category\n";
    content +=
      "2. You can manually create GitHub Lists using these files as reference\n";
    content +=
      "3. Copy the repository links from the files to create your GitHub Lists\n\n";
    content += "## Manual GitHub List Creation\n\n";
    content += "1. Go to your GitHub profile\n";
    content += "2. Click on 'Lists' in the left sidebar\n";
    content += "3. Click 'New list'\n";
    content +=
      "4. Use the information from these files to populate your lists\n\n";

    await fs.writeFile(indexPath, content, "utf8");

    console.log(`📋 Created index file: README.md`);
    console.log(`   Path: ${indexPath}`);

    return indexPath;
  }

  private generateListContent(
    name: string,
    description: string,
    repos: Array<{ repo: GitHubRepo; classification: ClassificationResult }>
  ): string {
    let content = `# ${name}\n\n`;
    content += `${description}\n\n`;
    content += `**Total repositories:** ${repos.length}\n\n`;
    content += `**Generated on:** ${new Date().toISOString()}\n\n`;
    content += "## Repository List\n\n";

    repos.forEach(({ repo, classification }, index) => {
      content += `### ${index + 1}. [${repo.name}](${repo.html_url})\n\n`;
      content += `**Description:** ${repo.description || "No description"}\n\n`;
      content += `**Language:** ${repo.language || "Unknown"}\n\n`;
      content += `**Stars:** ${repo.stargazers_count}\n\n`;
      content += `**Topics:** ${repo.topics.join(", ") || "None"}\n\n`;
      content += `**Classification:** ${classification.category}${
        classification.subcategory ? ` > ${classification.subcategory}` : ""
      }\n\n`;
      content += `**Tags:** ${classification.tags.join(", ")}\n\n`;
      content += `**Reason:** ${classification.reason}\n\n`;
      content += "---\n\n";
    });

    content += "## Manual GitHub List Creation\n\n";
    content += "To create a GitHub List from this file:\n\n";
    content += "1. Go to your GitHub profile\n";
    content += "2. Click on 'Lists' in the left sidebar\n";
    content += "3. Click 'New list'\n";
    content += "4. Give it the name: " + name + "\n";
    content += "5. Add the repositories listed above\n\n";
    content += "**Repository URLs to add:**\n\n";
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
