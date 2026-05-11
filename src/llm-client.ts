import axios from "axios";
import {
  GitHubRepo,
  ClassificationResult,
  GitHubStarList,
  LLMResponse,
} from "./types";
import { AppLanguage, getLocaleText, localize } from "./i18n";

export class LLMClient {
  private apiUrl: string;
  private model: string;
  private language: AppLanguage;

  constructor(apiUrl: string, model: string, language: AppLanguage = "zh") {
    this.apiUrl = apiUrl;
    this.model = model;
    this.language = language;
  }

  async classifyRepositories(
    repos: GitHubRepo[],
    existingLists: GitHubStarList[] = []
  ): Promise<ClassificationResult[]> {
    try {
      const batchSize = 20; // 每次处理 20 个仓库
      const allClassifications: ClassificationResult[] = [];

      console.log(
        localize(this.language, {
          zh: `正在分批处理 ${repos.length} 个仓库，每批 ${batchSize} 个...`,
          en: `Processing ${repos.length} repositories in batches of ${batchSize}...`,
        })
      );

      for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(repos.length / batchSize);

        console.log(
          localize(this.language, {
            zh: `正在处理第 ${batchNumber}/${totalBatches} 批 (${batch.length} 个仓库)...`,
            en: `Processing batch ${batchNumber}/${totalBatches} (${batch.length} repositories)...`,
          })
        );

        const batchClassifications = await this.classifyBatch(
          batch,
          existingLists
        );
        allClassifications.push(...batchClassifications);

        // 在批次之间添加小延迟以避免使 LLM 过载
        if (i + batchSize < repos.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return allClassifications;
    } catch (error) {
      console.error(
        localize(this.language, {
          zh: "调用 LLM 时出错：",
          en: "Error calling LLM:",
        }),
        error
      );
      throw error;
    }
  }

  private async classifyBatch(
    repos: GitHubRepo[],
    existingLists: GitHubStarList[]
  ): Promise<ClassificationResult[]> {
    try {
      const prompt = this.createClassificationPrompt(repos, existingLists);

      const response = await axios.post(
        `${this.apiUrl}/v1/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: "system",
              content: this.createSystemPrompt(),
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
      return this.parseClassificationResponse(content, repos, existingLists);
    } catch (error) {
      console.error(
        localize(this.language, {
          zh: "处理批次时出错：",
          en: "Error processing batch:",
        }),
        error
      );
      return repos.map((repo) =>
        this.createFallbackClassification(repo, existingLists)
      );
    }
  }

  private createSystemPrompt(): string {
    return localize(this.language, {
      zh: "你是 GitHub Star Lists 整理专家。请将仓库归类到实用的 GitHub Star Lists，优先复用现有列表，并且只返回有效 JSON。",
      en: "You are an expert GitHub Star Lists organizer. Classify repositories into practical GitHub Star Lists, prefer reusing existing lists, and return only valid JSON.",
    });
  }

  private createClassificationPrompt(
    repos: GitHubRepo[],
    existingLists: GitHubStarList[]
  ): string {
    const repoData = repos.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      topics: repo.topics,
      stars: repo.stargazers_count,
    }));

    const existingListNames =
      existingLists.length > 0
        ? existingLists.map((list) => `- ${list.name}`).join("\n")
        : "(none yet)";

    const locale = getLocaleText(this.language);

    if (this.language === "en") {
      return `Please analyze the following GitHub repositories and classify them into meaningful GitHub Star Lists.

Existing GitHub Star Lists:
${existingListNames}

Rules:
1. Prefer reusing an existing GitHub Star List whenever it is a reasonable fit.
2. If no existing list fits, create a concise new list name in "listName".
3. Keep list names broad and useful. Avoid creating overly specific lists.
4. GitHub has a hard limit on Star Lists, so keep the total set small.
5. Each repository must be assigned to exactly one "listName".
6. Return only valid JSON. Do not include markdown code fences.

For each repository, provide:

1. A main category (for example: ${locale.categoryExamples
        .map((category) => `"${category}"`)
        .join(", ")}).
2. An optional subcategory for a more specific grouping.
3. Relevant tags as an array of strings.
4. A short reason for the classification.
5. A GitHub Star List name in "listName". Reuse an existing list first; otherwise provide the new list name to create.

Return a JSON array where each object has this structure:
{
  "repo": "owner/name",
  "listName": "string",
  "category": "string",
  "subcategory": "string (optional)",
  "tags": ["string1", "string2", ...],
  "reason": "string"
}

Repositories to classify:
${JSON.stringify(repoData, null, 2)}

Make sure the JSON is valid and well formatted.`;
    }

    return `请分析以下 GitHub 仓库，并将它们归类到有意义的 GitHub Star Lists。

现有 GitHub Star Lists：
${existingListNames}

规则：
1. 如果现有 GitHub Star List 合理匹配，请优先复用。
2. 如果没有合适的现有 List，请在 "listName" 中给出简洁的新 List 名称。
3. List 名称应宽泛且实用，避免过细分类。
4. GitHub Star Lists 有数量上限，请保持总分类数量较少。
5. 每个仓库必须且只能分配到一个 "listName"。
6. 只返回有效 JSON，不要包含 markdown 代码块。

每个仓库请提供：

1. 一个主类别（例如：${locale.categoryExamples
      .map((category) => `"${category}"`)
      .join("、")} 等）
2. 一个可选的子类别用于更具体的分类
3. 相关标签（字符串数组）
4. 分类的简要原因
5. 一个 GitHub Star List 名称（listName），优先使用现有 List，不存在时给出需要自动创建的新名称

以 JSON 数组形式返回响应，其中每个对象具有以下结构：
{
  "repo": "owner/name",
  "listName": "string",
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
    repos: GitHubRepo[],
    existingLists: GitHubStarList[]
  ): ClassificationResult[] {
    try {
      // 尝试从响应中提取 JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        if (Array.isArray(parsed)) {
          return this.normalizeClassifications(parsed, repos, existingLists);
        }
      }

      console.warn(
        localize(this.language, {
          zh: "解析 LLM 响应失败，使用备用分类",
          en: "Failed to parse LLM response, using fallback classification",
        })
      );
      return repos.map((repo) =>
        this.createFallbackClassification(repo, existingLists)
      );
    } catch (error) {
      console.error(
        localize(this.language, {
          zh: "解析 LLM 响应时出错：",
          en: "Error parsing LLM response:",
        }),
        error
      );
      return repos.map((repo) =>
        this.createFallbackClassification(repo, existingLists)
      );
    }
  }

  private normalizeClassifications(
    parsed: any[],
    repos: GitHubRepo[],
    existingLists: GitHubStarList[]
  ): ClassificationResult[] {
    const byRepo = new Map<string, any>();
    parsed.forEach((item, index) => {
      if (item?.repo) {
        byRepo.set(String(item.repo), item);
      } else if (repos[index]) {
        byRepo.set(repos[index].full_name, item);
      }
    });

    return repos.map((repo) => {
      const raw = byRepo.get(repo.full_name);
      if (!raw) {
        return this.createFallbackClassification(repo, existingLists);
      }

      const category =
        this.sanitizeText(raw.category) || this.getFallbackCategory(repo);
      const listName =
        this.sanitizeListName(raw.listName || raw.list || raw.githubList) ||
        this.findMatchingExistingList(category, existingLists) ||
        category;

      return {
        category,
        subcategory: this.sanitizeText(raw.subcategory),
        tags: this.normalizeTags(raw.tags, repo),
        reason:
          this.sanitizeText(raw.reason) ||
          localize(this.language, {
            zh: `LLM 将该仓库归类到 ${listName}`,
            en: `LLM classified this repository into ${listName}`,
          }),
        listName,
      };
    });
  }

  private createFallbackClassification(
    repo: GitHubRepo,
    existingLists: GitHubStarList[]
  ): ClassificationResult {
    const locale = getLocaleText(this.language);
    const category = this.getFallbackCategory(repo);
    const listName =
      this.findMatchingExistingList(category, existingLists) || category;

    return {
      category,
      listName,
      tags: repo.topics.length > 0 ? repo.topics : [repo.language || locale.unknown],
      reason: localize(this.language, {
        zh: `基于语言和主题的备用分类：${repo.language || locale.unknown} / ${
          repo.topics.join(", ") || locale.none
        }`,
        en: `Fallback classification based on language and topics: ${
          repo.language || locale.unknown
        } / ${repo.topics.join(", ") || locale.none}`,
      }),
    };
  }

  private normalizeTags(rawTags: any, repo: GitHubRepo): string[] {
    if (Array.isArray(rawTags)) {
      const tags = rawTags
        .map((tag) => this.sanitizeText(tag))
        .filter((tag) => tag.length > 0)
        .slice(0, 8);

      if (tags.length > 0) {
        return tags;
      }
    }

    return repo.topics.length > 0
      ? repo.topics
      : [repo.language || getLocaleText(this.language).unknown];
  }

  private findMatchingExistingList(
    category: string,
    existingLists: GitHubStarList[]
  ): string | undefined {
    const normalizedCategory = this.normalizeForCompare(category);
    return existingLists.find(
      (list) => this.normalizeForCompare(list.name) === normalizedCategory
    )?.name;
  }

  private sanitizeListName(value: any): string {
    return this.sanitizeText(value)
      .replace(/\s+/g, " ")
      .slice(0, 80)
      .trim();
  }

  private sanitizeText(value: any): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private normalizeForCompare(value: string): string {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private getFallbackCategory(repo: GitHubRepo): string {
    const categories = getLocaleText(this.language).categories;
    const language = repo.language?.toLowerCase();
    const description = repo.description?.toLowerCase() || "";
    const topics = repo.topics.map((t) => t.toLowerCase());

    if (
      language === "javascript" ||
      language === "typescript" ||
      language === "html" ||
      language === "css"
    ) {
      return categories.web;
    }
    if (
      language === "python" &&
      (description.includes("ml") ||
        description.includes("ai") ||
        description.includes("data"))
    ) {
      return categories.machineLearning;
    }
    if (
      language === "python" &&
      (description.includes("web") ||
        description.includes("api") ||
        description.includes("django") ||
        description.includes("flask"))
    ) {
      return categories.web;
    }
    if (
      language === "java" ||
      language === "kotlin" ||
      language === "swift" ||
      language === "dart"
    ) {
      return categories.mobile;
    }
    if (
      language === "go" ||
      language === "rust" ||
      language === "c++" ||
      language === "c"
    ) {
      return categories.systems;
    }
    if (
      topics.includes("docker") ||
      topics.includes("kubernetes") ||
      topics.includes("devops")
    ) {
      return categories.devops;
    }
    if (
      topics.includes("learning") ||
      topics.includes("tutorial") ||
      topics.includes("course")
    ) {
      return categories.learning;
    }

    return categories.tools;
  }
}
