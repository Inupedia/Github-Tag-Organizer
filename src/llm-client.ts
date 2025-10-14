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
      // 分批处理仓库以避免超时
      const batchSize = 20; // 每次处理 20 个仓库
      const allClassifications: ClassificationResult[] = [];

      console.log(
        `正在分批处理 ${repos.length} 个仓库，每批 ${batchSize} 个...`
      );

      for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(repos.length / batchSize);

        console.log(
          `正在处理第 ${batchNumber}/${totalBatches} 批 (${batch.length} 个仓库)...`
        );

        const batchClassifications = await this.classifyBatch(batch);
        allClassifications.push(...batchClassifications);

        // 在批次之间添加小延迟以避免使 LLM 过载
        if (i + batchSize < repos.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return allClassifications;
    } catch (error) {
      console.error("调用 LLM 时出错：", error);
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
      console.error(`处理批次时出错：`, error);
      // 为此批次返回备用分类
      return repos.map((repo) => ({
        category: this.getFallbackCategory(repo),
        tags: repo.topics.length > 0 ? repo.topics : [repo.language || "未知"],
        reason: `基于语言的备用分类：${repo.language || "未知"} 和主题：${
          repo.topics.join(", ") || "无"
        }`,
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

1. 一个主类别（例如："Web 开发"、"机器学习"、"DevOps"、"移动开发"、"数据科学"、"工具与实用程序"、"库与框架"、"学习资源"等）
2. 一个可选的子类别用于更具体的分类
3. 相关标签（字符串数组）
4. 分类的简要原因

以 JSON 数组形式返回响应，其中每个对象具有以下结构：
{
  "category": "string",
  "subcategory": "string (optional)",
  "tags": ["string1", "string2", ...],
  "reason": "string"
}

要分类的仓库：
${JSON.stringify(repoData, null, 2)}

请确保 JSON 有效且格式正确。`;
  }

  private parseClassificationResponse(
    content: string,
    repos: GitHubRepo[]
  ): ClassificationResult[] {
    try {
      // 尝试从响应中提取 JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        // 确保我们有正确数量的分类
        if (Array.isArray(parsed) && parsed.length === repos.length) {
          return parsed;
        }
      }

      // 备用方案：创建基本分类
      console.warn("解析 LLM 响应失败，使用备用分类");
      return repos.map((repo) => ({
        category: this.getFallbackCategory(repo),
        tags: repo.topics.length > 0 ? repo.topics : [repo.language || "未知"],
        reason: `基于语言分类：${repo.language || "未知"} 和主题：${
          repo.topics.join(", ") || "无"
        }`,
      }));
    } catch (error) {
      console.error("解析 LLM 响应时出错：", error);
      // 返回备用分类
      return repos.map((repo) => ({
        category: this.getFallbackCategory(repo),
        tags: repo.topics.length > 0 ? repo.topics : [repo.language || "未知"],
        reason: `基于语言的备用分类：${repo.language || "未知"}`,
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
      return "Web 开发";
    }
    if (
      language === "python" &&
      (description.includes("ml") ||
        description.includes("ai") ||
        description.includes("data"))
    ) {
      return "机器学习";
    }
    if (
      language === "python" &&
      (description.includes("web") ||
        description.includes("api") ||
        description.includes("django") ||
        description.includes("flask"))
    ) {
      return "Web 开发";
    }
    if (
      language === "java" ||
      language === "kotlin" ||
      language === "swift" ||
      language === "dart"
    ) {
      return "移动开发";
    }
    if (
      language === "go" ||
      language === "rust" ||
      language === "c++" ||
      language === "c"
    ) {
      return "系统编程";
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
      return "学习资源";
    }

    return "工具与实用程序";
  }
}
