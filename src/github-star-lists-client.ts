import {
  GitHubRepo,
  GitHubStarList,
  GitHubStarListAssignment,
  GitHubStarListSyncSummary,
} from "./types";
import { AppLanguage, localize } from "./i18n";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://github.com",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

interface RepoListState {
  checkedListIds: string[];
  csrfToken: string;
  lists: GitHubStarList[];
}

export class GitHubStarListsClient {
  private readonly username: string;
  private readonly cookieHeader: string;
  private readonly requestDelayMs: number;
  private readonly language: AppLanguage;

  constructor(
    username: string,
    cookieHeader: string,
    requestDelayMs: number = 1000,
    language: AppLanguage = "zh"
  ) {
    this.username = username;
    this.cookieHeader = cookieHeader;
    this.requestDelayMs = requestDelayMs;
    this.language = language;
  }

  async getLists(sampleRepo: GitHubRepo): Promise<GitHubStarList[]> {
    const state = await this.fetchRepoListState(sampleRepo);
    return state.lists;
  }

  async createList(
    name: string,
    sampleRepo: GitHubRepo,
    description: string = ""
  ): Promise<GitHubStarList | null> {
    const csrfToken = await this.fetchCreateListCsrfToken();
    await this.delay();

    const formData = new FormData();
    formData.append("authenticity_token", csrfToken);
    formData.append("user_list[name]", name);
    formData.append("user_list[description]", description);
    formData.append("user_list[private]", "0");

    const response = await fetch(
      `https://github.com/stars/${encodeURIComponent(this.username)}/lists`,
      {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          Accept: "text/html",
          Referer: `https://github.com/${encodeURIComponent(
            this.username
          )}?tab=stars`,
          "X-Requested-With": "XMLHttpRequest",
          Cookie: this.cookieHeader,
        },
        body: formData,
        redirect: "manual",
      }
    );

    if (![200, 201, 301, 302, 303].includes(response.status)) {
      throw new Error(
        localize(this.language, {
          zh: `创建 GitHub Star List "${name}" 失败：HTTP ${response.status} ${response.statusText}`,
          en: `Failed to create GitHub Star List "${name}": HTTP ${response.status} ${response.statusText}`,
        })
      );
    }

    await this.delay();

    const lists = await this.getLists(sampleRepo);
    const createdList = lists.find((list) => list.name === name);
    if (!createdList) {
      console.warn(
        localize(this.language, {
          zh: `已提交创建 "${name}"，但刷新后未能找到该 List`,
          en: `Submitted creation for "${name}", but could not find the list after refresh`,
        })
      );
      return null;
    }

    return createdList;
  }

  async assignRepoToLists(
    repo: GitHubRepo,
    listIds: string[]
  ): Promise<boolean> {
    const state = await this.fetchRepoListState(repo);
    await this.delay();

    const mergedListIds = Array.from(
      new Set([...state.checkedListIds, ...listIds])
    );

    const formData = new FormData();
    formData.append("_method", "put");
    formData.append("authenticity_token", state.csrfToken);
    formData.append("repository_id", String(repo.id));
    formData.append("context", "user_list_menu");
    formData.append("list_ids[]", "");
    mergedListIds.forEach((listId) => formData.append("list_ids[]", listId));

    const response = await fetch(
      `https://github.com/${repo.full_name}/lists`,
      {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          Accept: "application/json",
          Referer: `https://github.com/${repo.full_name}`,
          "X-Requested-With": "XMLHttpRequest",
          Cookie: this.cookieHeader,
        },
        body: formData,
      }
    );

    await this.delay();
    return [200, 201, 204, 301, 302, 303].includes(response.status);
  }

  async syncAssignments(
    assignments: GitHubStarListAssignment[],
    sampleRepo: GitHubRepo,
    options: { dryRun?: boolean } = {}
  ): Promise<GitHubStarListSyncSummary> {
    const dryRun = options.dryRun ?? false;
    const existingLists = await this.getLists(sampleRepo);
    const listNameToList = new Map(
      existingLists.map((list) => [list.name, list])
    );
    const createdLists: GitHubStarList[] = [];
    const assignedRepos: GitHubStarListAssignment[] = [];
    const failedRepos: GitHubStarListAssignment[] = [];

    const requiredListNames = Array.from(
      new Set(assignments.map((assignment) => assignment.listName))
    );

    for (const listName of requiredListNames) {
      if (listNameToList.has(listName)) {
        continue;
      }

      if (dryRun) {
        console.log(
          localize(this.language, {
            zh: `   [dry-run] 将创建 GitHub Star List：${listName}`,
            en: `   [dry-run] Would create GitHub Star List: ${listName}`,
          })
        );
        continue;
      }

      console.log(
        localize(this.language, {
          zh: `   创建 GitHub Star List：${listName}`,
          en: `   Creating GitHub Star List: ${listName}`,
        })
      );
      const createdList = await this.createList(
        listName,
        sampleRepo,
        `Automatically categorized starred repositories for ${listName}`
      );

      if (createdList) {
        createdLists.push(createdList);
        listNameToList.set(createdList.name, createdList);
      }
    }

    for (const assignment of assignments) {
      const targetList = listNameToList.get(assignment.listName);
      if (!targetList) {
        failedRepos.push(assignment);
        console.warn(
          localize(this.language, {
            zh: `   跳过 ${assignment.repo.full_name}：找不到目标 List "${assignment.listName}"`,
            en: `   Skipping ${assignment.repo.full_name}: target list "${assignment.listName}" was not found`,
          })
        );
        continue;
      }

      if (dryRun) {
        console.log(
          localize(this.language, {
            zh: `   [dry-run] 将添加 ${assignment.repo.full_name} -> ${assignment.listName}`,
            en: `   [dry-run] Would add ${assignment.repo.full_name} -> ${assignment.listName}`,
          })
        );
        assignedRepos.push(assignment);
        continue;
      }

      const ok = await this.assignRepoToLists(assignment.repo, [targetList.id]);
      if (ok) {
        assignedRepos.push(assignment);
        console.log(
          `   ✅ ${assignment.repo.full_name} -> ${assignment.listName}`
        );
      } else {
        failedRepos.push(assignment);
        console.warn(
          localize(this.language, {
            zh: `   ⚠️  ${assignment.repo.full_name} 同步到 "${assignment.listName}" 失败`,
            en: `   ⚠️  Failed to sync ${assignment.repo.full_name} to "${assignment.listName}"`,
          })
        );
      }
    }

    return {
      existingLists,
      createdLists,
      assignedRepos,
      failedRepos,
      dryRun,
    };
  }

  private async fetchCreateListCsrfToken(): Promise<string> {
    const response = await fetch(
      `https://github.com/${encodeURIComponent(this.username)}?tab=stars`,
      {
        headers: {
          ...BROWSER_HEADERS,
          Accept: "text/html",
          Cookie: this.cookieHeader,
        },
        redirect: "follow",
      }
    );

    if (response.status !== 200) {
      throw new Error(
        localize(this.language, {
          zh: `获取 GitHub Star Lists 创建表单失败：HTTP ${response.status} ${response.statusText}`,
          en: `Failed to fetch GitHub Star Lists creation form: HTTP ${response.status} ${response.statusText}`,
        })
      );
    }

    const html = await response.text();
    return this.extractCsrfToken(html, `/stars/${this.username}/lists`);
  }

  private async fetchRepoListState(repo: GitHubRepo): Promise<RepoListState> {
    const response = await fetch(`https://github.com/${repo.full_name}/lists`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "text/html",
        Referer: `https://github.com/${repo.full_name}`,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: this.cookieHeader,
      },
    });

    if (response.status !== 200) {
      throw new Error(
        localize(this.language, {
          zh: `获取 ${repo.full_name} 的 Star Lists 状态失败：HTTP ${response.status} ${response.statusText}`,
          en: `Failed to fetch Star Lists state for ${repo.full_name}: HTTP ${response.status} ${response.statusText}`,
        })
      );
    }

    const html = await response.text();
    return {
      checkedListIds: this.extractCheckedListIds(html),
      csrfToken: this.extractCsrfToken(html),
      lists: this.extractLists(html),
    };
  }

  private extractLists(html: string): GitHubStarList[] {
    const inputTags = html.match(/<input\b[^>]*>/gi) ?? [];
    const lists: GitHubStarList[] = [];

    for (const inputTag of inputTags) {
      const attributes = this.parseAttributes(inputTag);
      if (
        attributes.type !== "checkbox" ||
        attributes.name !== "list_ids[]" ||
        !attributes.value
      ) {
        continue;
      }

      const inputIndex = html.indexOf(inputTag);
      const labelHtml = html.slice(inputIndex, inputIndex + 2000);
      const name = this.extractListName(labelHtml);
      if (!name) {
        continue;
      }

      lists.push({
        id: attributes.value,
        name,
      });
    }

    return lists;
  }

  private extractCheckedListIds(html: string): string[] {
    const inputTags = html.match(/<input\b[^>]*>/gi) ?? [];
    const checkedListIds: string[] = [];

    for (const inputTag of inputTags) {
      const attributes = this.parseAttributes(inputTag);
      if (
        attributes.type === "checkbox" &&
        attributes.name === "list_ids[]" &&
        attributes.value &&
        "checked" in attributes
      ) {
        checkedListIds.push(attributes.value);
      }
    }

    return checkedListIds;
  }

  private extractCsrfToken(html: string, actionPath?: string): string {
    const searchHtml = actionPath
      ? this.findFormHtmlByAction(html, actionPath) ?? html
      : html;

    const inputTags = searchHtml.match(/<input\b[^>]*>/gi) ?? [];
    for (const inputTag of inputTags) {
      const attributes = this.parseAttributes(inputTag);
      if (attributes.name === "authenticity_token" && attributes.value) {
        return attributes.value;
      }
    }

    throw new Error(
      localize(this.language, {
        zh: "无法找到 GitHub CSRF token。请检查 GITHUB_SESSION_COOKIES 是否已过期。",
        en: "Could not find GitHub CSRF token. Check whether GITHUB_SESSION_COOKIES has expired.",
      })
    );
  }

  private findFormHtmlByAction(
    html: string,
    actionPath: string
  ): string | null {
    const formMatches = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
    for (const formHtml of formMatches) {
      const openingTag = formHtml.match(/<form\b[^>]*>/i)?.[0];
      if (!openingTag) {
        continue;
      }

      const attributes = this.parseAttributes(openingTag);
      if (attributes.action === actionPath) {
        return formHtml;
      }
    }

    return null;
  }

  private extractListName(labelHtml: string): string {
    const truncateMatch = labelHtml.match(
      /<[^>]*class=["'][^"']*Truncate-text[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
    );
    if (truncateMatch) {
      return this.cleanHtmlText(truncateMatch[1]);
    }

    const labelMatch = labelHtml.match(/<label\b[^>]*>([\s\S]*?)<\/label>/i);
    if (labelMatch) {
      return this.cleanHtmlText(labelMatch[1]);
    }

    return "";
  }

  private parseAttributes(tag: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attrRegex =
      /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(tag)) !== null) {
      const [, key, doubleQuoted, singleQuoted, unquoted] = match;
      if (!key || key === "input" || key === "form") {
        continue;
      }

      attributes[key] = this.decodeHtml(
        doubleQuoted ?? singleQuoted ?? unquoted ?? ""
      );
    }

    return attributes;
  }

  private cleanHtmlText(html: string): string {
    return this.decodeHtml(html.replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  private async delay(): Promise<void> {
    if (this.requestDelayMs <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, this.requestDelayMs));
  }
}
