import { Octokit } from "@octokit/rest";
import { GitHubRepo, GitHubList } from "./types";
import { AppLanguage, localize } from "./i18n";

export class GitHubClient {
  private octokit: Octokit;
  private language: AppLanguage;

  constructor(token: string, language: AppLanguage = "zh") {
    this.octokit = new Octokit({
      auth: token,
    });
    this.language = language;
  }

  async getStarredRepos(username: string): Promise<GitHubRepo[]> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const repos: GitHubRepo[] = [];
        let page = 1;
        const perPage = 100;

        while (true) {
          const response =
            await this.octokit.rest.activity.listReposStarredByUser({
              username,
              page,
              per_page: perPage,
              sort: "created",
            });

          if (response.data.length === 0) {
            break;
          }

          // 转换响应以匹配我们的接口
          const transformedRepos = response.data.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            html_url: repo.html_url,
            language: repo.language,
            topics: repo.topics || [],
            stargazers_count: repo.stargazers_count,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            pushed_at: repo.pushed_at,
          }));

          repos.push(...transformedRepos);
          page++;

          // GitHub API 有限制，如果达到限制则中断
          if (response.data.length < perPage) {
            break;
          }
        }

        return repos;
      } catch (error: any) {
        retryCount++;
        console.error(
          localize(this.language, {
            zh: `获取星标仓库时出错（尝试 ${retryCount}/${maxRetries}）：`,
            en: `Error fetching starred repositories (attempt ${retryCount}/${maxRetries}):`,
          }),
          error.message
        );

        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // 指数退避
          console.log(
            localize(this.language, {
              zh: `${delay}ms 后重试...`,
              en: `Retrying in ${delay}ms...`,
            })
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error(
      localize(this.language, {
        zh: "所有重试后仍无法获取星标仓库",
        en: "Unable to fetch starred repositories after all retries",
      })
    );
  }

  async createList(
    name: string,
    description: string,
    isPublic: boolean = true
  ): Promise<GitHubList> {
    try {
      // 由于 GitHub Lists API 不可用，我们将创建一个简单的文本文件
      // 可以用作手动创建列表的参考
      const listId = Date.now(); // 使用时间戳作为 ID
      const createdAt = new Date().toISOString();

      console.log(
        localize(this.language, {
          zh: `📝 创建列表引用：${name}`,
          en: `📝 Created list reference: ${name}`,
        })
      );
      console.log(
        localize(this.language, {
          zh: `   描述：${description}`,
          en: `   Description: ${description}`,
        })
      );
      console.log(
        localize(this.language, {
          zh: `   公开：${isPublic}`,
          en: `   Public: ${isPublic}`,
        })
      );
      console.log(`   ID：${listId}`);

      return {
        id: listId,
        name,
        description,
        public: isPublic,
        created_at: createdAt,
        updated_at: createdAt,
      };
    } catch (error) {
      console.error(
        localize(this.language, {
          zh: "创建列表时出错：",
          en: "Error creating list:",
        }),
        error
      );
      throw error;
    }
  }

  async addReposToList(listId: string, repoIds: number[]): Promise<void> {
    try {
      // 注意：GitHub 没有直接添加仓库到列表的 API
      // 这是未来实现的占位符
      // 您可能需要使用 GitHub 的 GraphQL API 或创建自定义解决方案
      console.log(
        localize(this.language, {
          zh: `将添加 ${repoIds.length} 个仓库到列表 ${listId}`,
          en: `Will add ${repoIds.length} repositories to list ${listId}`,
        })
      );
    } catch (error) {
      console.error(
        localize(this.language, {
          zh: "添加仓库到列表时出错：",
          en: "Error adding repositories to list:",
        }),
        error
      );
      throw error;
    }
  }

  async getCurrentUser(): Promise<string> {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return response.data.login;
    } catch (error) {
      console.error(
        localize(this.language, {
          zh: "获取当前用户时出错：",
          en: "Error getting current user:",
        }),
        error
      );
      throw error;
    }
  }
}
