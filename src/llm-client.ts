import axios from "axios";
import { GitHubRepo, ClassificationResult, LLMResponse } from "./types";

export class LLMClient {
  private apiUrl: string;
  private model: string;

  constructor(apiUrl: string, model: string) {
    this.apiUrl = apiUrl;
    this.model = model;
  }

  async classifyRepositories(
    repos: GitHubRepo[]
  ): Promise<ClassificationResult[]> {
    try {
      // Process repositories in batches to avoid timeout
      const batchSize = 20; // Process 20 repos at a time
      const allClassifications: ClassificationResult[] = [];

      console.log(
        `Processing ${repos.length} repositories in batches of ${batchSize}...`
      );

      for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(repos.length / batchSize);

        console.log(
          `Processing batch ${batchNumber}/${totalBatches} (${batch.length} repositories)...`
        );

        const batchClassifications = await this.classifyBatch(batch);
        allClassifications.push(...batchClassifications);

        // Add a small delay between batches to avoid overwhelming the LLM
        if (i + batchSize < repos.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return allClassifications;
    } catch (error) {
      console.error("Error calling LLM:", error);
      throw error;
    }
  }

  private async classifyBatch(
    repos: GitHubRepo[]
  ): Promise<ClassificationResult[]> {
    try {
      const prompt = this.createClassificationPrompt(repos);

      const response = await axios.post(
        `${this.apiUrl}/v1/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert at categorizing GitHub repositories. Analyze the provided repositories and classify them into meaningful categories with subcategories and tags. Return your response as valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 120000, // 2 minutes timeout for each batch
        }
      );

      const content = response.data.choices[0].message.content;
      return this.parseClassificationResponse(content, repos);
    } catch (error) {
      console.error(`Error processing batch:`, error);
      // Return fallback classifications for this batch
      return repos.map((repo) => ({
        category: this.getFallbackCategory(repo),
        tags:
          repo.topics.length > 0 ? repo.topics : [repo.language || "Unknown"],
        reason: `Fallback classification based on language: ${
          repo.language || "Unknown"
        } and topics: ${repo.topics.join(", ") || "None"}`,
      }));
    }
  }

  private createClassificationPrompt(repos: GitHubRepo[]): string {
    const repoData = repos.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      topics: repo.topics,
      stars: repo.stargazers_count,
    }));

    return `Please analyze the following GitHub repositories and classify them into meaningful categories. For each repository, provide:

1. A main category (e.g., "Web Development", "Machine Learning", "DevOps", "Mobile Development", "Data Science", "Tools & Utilities", "Libraries & Frameworks", "Learning Resources", etc.)
2. An optional subcategory for more specific classification
3. Relevant tags (array of strings)
4. A brief reason for the classification

Return the response as a JSON array where each object has this structure:
{
  "category": "string",
  "subcategory": "string (optional)",
  "tags": ["string1", "string2", ...],
  "reason": "string"
}

Repositories to classify:
${JSON.stringify(repoData, null, 2)}

Please ensure the JSON is valid and properly formatted.`;
  }

  private parseClassificationResponse(
    content: string,
    repos: GitHubRepo[]
  ): ClassificationResult[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        // Ensure we have the right number of classifications
        if (Array.isArray(parsed) && parsed.length === repos.length) {
          return parsed;
        }
      }

      // Fallback: create basic classifications
      console.warn(
        "Failed to parse LLM response, using fallback classifications"
      );
      return repos.map((repo) => ({
        category: this.getFallbackCategory(repo),
        tags:
          repo.topics.length > 0 ? repo.topics : [repo.language || "Unknown"],
        reason: `Classified based on language: ${
          repo.language || "Unknown"
        } and topics: ${repo.topics.join(", ") || "None"}`,
      }));
    } catch (error) {
      console.error("Error parsing LLM response:", error);
      // Return fallback classifications
      return repos.map((repo) => ({
        category: this.getFallbackCategory(repo),
        tags:
          repo.topics.length > 0 ? repo.topics : [repo.language || "Unknown"],
        reason: `Fallback classification based on language: ${
          repo.language || "Unknown"
        }`,
      }));
    }
  }

  private getFallbackCategory(repo: GitHubRepo): string {
    const language = repo.language?.toLowerCase();
    const description = repo.description?.toLowerCase() || "";
    const topics = repo.topics.map((t) => t.toLowerCase());

    if (
      language === "javascript" ||
      language === "typescript" ||
      language === "html" ||
      language === "css"
    ) {
      return "Web Development";
    }
    if (
      language === "python" &&
      (description.includes("ml") ||
        description.includes("ai") ||
        description.includes("data"))
    ) {
      return "Machine Learning";
    }
    if (
      language === "python" &&
      (description.includes("web") ||
        description.includes("api") ||
        description.includes("django") ||
        description.includes("flask"))
    ) {
      return "Web Development";
    }
    if (
      language === "java" ||
      language === "kotlin" ||
      language === "swift" ||
      language === "dart"
    ) {
      return "Mobile Development";
    }
    if (
      language === "go" ||
      language === "rust" ||
      language === "c++" ||
      language === "c"
    ) {
      return "System Programming";
    }
    if (
      topics.includes("docker") ||
      topics.includes("kubernetes") ||
      topics.includes("devops")
    ) {
      return "DevOps";
    }
    if (
      topics.includes("learning") ||
      topics.includes("tutorial") ||
      topics.includes("course")
    ) {
      return "Learning Resources";
    }

    return "Tools & Utilities";
  }
}
