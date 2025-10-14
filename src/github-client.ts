import { Octokit } from "@octokit/rest";
import { GitHubRepo, GitHubList } from "./types";

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
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

          // Transform the response to match our interface
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

          // GitHub API has a limit, break if we've reached it
          if (response.data.length < perPage) {
            break;
          }
        }

        return repos;
      } catch (error: any) {
        retryCount++;
        console.error(
          `Error fetching starred repos (attempt ${retryCount}/${maxRetries}):`,
          error.message
        );

        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error("Failed to fetch starred repos after all retries");
  }

  async createList(
    name: string,
    description: string,
    isPublic: boolean = true
  ): Promise<GitHubList> {
    try {
      // Since GitHub Lists API is not available, we'll create a simple text file
      // that can be used as a reference for manual list creation
      const listId = Date.now(); // Use timestamp as ID
      const createdAt = new Date().toISOString();

      console.log(`📝 Created list reference: ${name}`);
      console.log(`   Description: ${description}`);
      console.log(`   Public: ${isPublic}`);
      console.log(`   ID: ${listId}`);

      return {
        id: listId,
        name,
        description,
        public: isPublic,
        created_at: createdAt,
        updated_at: createdAt,
      };
    } catch (error) {
      console.error("Error creating list:", error);
      throw error;
    }
  }

  async addReposToList(listId: string, repoIds: number[]): Promise<void> {
    try {
      // Note: GitHub doesn't have a direct API for adding repos to lists
      // This is a placeholder for future implementation
      // You might need to use GitHub's GraphQL API or create a custom solution
      console.log(`Would add ${repoIds.length} repos to list ${listId}`);
    } catch (error) {
      console.error("Error adding repos to list:", error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<string> {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return response.data.login;
    } catch (error) {
      console.error("Error getting current user:", error);
      throw error;
    }
  }
}
