import * as dotenv from "dotenv";
import { GitHubClient } from "./github-client";
import { LLMClient } from "./llm-client";
import { RepoOrganizer } from "./organizer";
import { FileBasedListsClient } from "./file-based-lists";
import { GitHubListsManager } from "./github-lists-manager";
import { GitHubStarListsClient } from "./github-star-lists-client";
import { GitHubStarList } from "./types";
import { getLanguageFromEnv, localize } from "./i18n";

// 加载环境变量
dotenv.config();

async function main() {
  try {
    // 验证环境变量
    const githubToken = process.env.GITHUB_TOKEN;
    const llmApiUrl = process.env.LLM_API_URL || "http://10.20.124.89:11435";
    const llmModel = process.env.LLM_MODEL || "deepseek-r1:32b";
    const githubSessionCookies =
      process.env.GITHUB_SESSION_COOKIES || process.env.GITHUB_COOKIE;
    const language = getLanguageFromEnv(process.env);
    const syncGitHubLists = process.env.SYNC_GITHUB_LISTS !== "false";
    const githubListsDryRun = process.env.GITHUB_LISTS_DRY_RUN === "true";
    const githubListsRequestDelayMs = parseInt(
      process.env.GITHUB_LISTS_REQUEST_DELAY_MS || "1000",
      10
    );

    if (!githubToken) {
      console.error(
        localize(language, {
          zh: "错误：需要 GITHUB_TOKEN 环境变量",
          en: "Error: GITHUB_TOKEN environment variable is required",
        })
      );
      console.error(
        localize(language, {
          zh: "请创建一个包含 GitHub token 的 .env 文件",
          en: "Please create a .env file containing a GitHub token",
        })
      );
      console.error(
        localize(language, {
          zh: "您可以从这里获取 token：https://github.com/settings/tokens",
          en: "You can get a token from: https://github.com/settings/tokens",
        })
      );
      process.exit(1);
    }

    console.log(
      localize(language, {
        zh: "🚀 启动 GitHub 仓库整理器...\n",
        en: "🚀 Starting GitHub repository organizer...\n",
      })
    );

    // 初始化客户端
    const githubClient = new GitHubClient(githubToken, language);
    const llmClient = new LLMClient(llmApiUrl, llmModel, language);
    const fileBasedListsClient = new FileBasedListsClient(
      "./github-lists",
      language
    );

    // 获取当前用户
    console.log(
      localize(language, {
        zh: "📋 获取当前用户...",
        en: "📋 Getting current user...",
      })
    );
    const username = await githubClient.getCurrentUser();
    console.log(
      localize(language, {
        zh: `✅ 已登录为：${username}\n`,
        en: `✅ Logged in as: ${username}\n`,
      })
    );

    // 初始化 GitHub Lists 管理器
    const githubListsManager = new GitHubListsManager(
      githubToken,
      username,
      language
    );
    const githubStarListsClient =
      syncGitHubLists && githubSessionCookies
        ? new GitHubStarListsClient(
            username,
            githubSessionCookies,
            Number.isNaN(githubListsRequestDelayMs)
              ? 1000
              : githubListsRequestDelayMs,
            language
          )
        : undefined;

    const organizer = new RepoOrganizer(
      githubClient,
      llmClient,
      fileBasedListsClient,
      githubListsManager,
      language
    );

    // 获取星标仓库
    console.log(
      localize(language, {
        zh: "⭐ 获取星标仓库...",
        en: "⭐ Fetching starred repositories...",
      })
    );
    const allStarredRepos = await githubClient.getStarredRepos(username);
    console.log(
      localize(language, {
        zh: `✅ 找到 ${allStarredRepos.length} 个星标仓库\n`,
        en: `✅ Found ${allStarredRepos.length} starred repositories\n`,
      })
    );

    if (allStarredRepos.length === 0) {
      console.log(
        localize(language, {
          zh: "未找到星标仓库。退出...",
          en: "No starred repositories found. Exiting...",
        })
      );
      return;
    }

    // 限制仓库数量用于测试（设置 MAX_REPOS 环境变量来覆盖）
    const maxRepos = parseInt(process.env.MAX_REPOS || "50", 10);
    const starredRepos =
      maxRepos > 0 ? allStarredRepos.slice(0, maxRepos) : allStarredRepos;

    if (starredRepos.length < allStarredRepos.length) {
      console.log(
        localize(language, {
          zh: `⚠️  仅处理前 ${starredRepos.length} 个仓库（设置 MAX_REPOS 环境变量来更改此限制）\n`,
          en: `⚠️  Processing only the first ${starredRepos.length} repositories (set MAX_REPOS to change this limit)\n`,
        })
      );
    }

    let existingStarLists: GitHubStarList[] = [];
    if (syncGitHubLists && githubStarListsClient) {
      console.log(
        localize(language, {
          zh: "📋 获取现有 GitHub Star Lists...",
          en: "📋 Fetching existing GitHub Star Lists...",
        })
      );
      existingStarLists = await githubStarListsClient.getLists(starredRepos[0]);
      console.log(
        localize(language, {
          zh: `✅ 找到 ${existingStarLists.length} 个现有 GitHub Star Lists\n`,
          en: `✅ Found ${existingStarLists.length} existing GitHub Star Lists\n`,
        })
      );
    } else if (syncGitHubLists) {
      console.warn(
        localize(language, {
          zh: "⚠️  未配置 GITHUB_SESSION_COOKIES，无法直接修改 GitHub Star Lists；将仅生成本地文件和指南。\n",
          en: "⚠️  GITHUB_SESSION_COOKIES is not configured, so GitHub Star Lists cannot be modified directly; only local files and guides will be generated.\n",
        })
      );
    }

    // 整理仓库
    console.log(
      localize(language, {
        zh: "🤖 使用 LLM 整理仓库...",
        en: "🤖 Organizing repositories with LLM...",
      })
    );
    const organizedRepos = await organizer.organizeRepositories(
      starredRepos,
      existingStarLists
    );
    console.log(
      localize(language, {
        zh: "✅ 仓库整理成功\n",
        en: "✅ Repositories organized successfully\n",
      })
    );

    // 显示整理摘要
    console.log(
      localize(language, {
        zh: "📊 整理摘要：",
        en: "📊 Organization summary:",
      })
    );
    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const totalRepos = Object.values(subcategories).reduce(
        (sum, subcategory) => sum + subcategory.repos.length,
        0
      );
      console.log(
        localize(language, {
          zh: `  ${category}：${totalRepos} 个仓库`,
          en: `  ${category}: ${totalRepos} repositories`,
        })
      );

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          console.log(
            localize(language, {
              zh: `    └─ ${subcategory}：${data.repos.length} 个仓库`,
              en: `    └─ ${subcategory}: ${data.repos.length} repositories`,
            })
          );
        }
      }
    }
    console.log("");

    // 创建 GitHub 列表
    console.log(
      localize(language, {
        zh: "📝 创建 GitHub 列表...",
        en: "📝 Creating GitHub lists...",
      })
    );
    const createdLists = await organizer.createGitHubLists(organizedRepos);
    console.log(
      localize(language, {
        zh: `✅ 创建了 ${createdLists.length} 个 GitHub 列表\n`,
        en: `✅ Created ${createdLists.length} GitHub lists\n`,
      })
    );

    if (syncGitHubLists && githubStarListsClient) {
      console.log(
        githubListsDryRun
          ? localize(language, {
              zh: "🔎 Dry run：预览 GitHub Star Lists 自动同步...",
              en: "🔎 Dry run: previewing GitHub Star Lists sync...",
            })
          : localize(language, {
              zh: "🔄 自动同步 GitHub Star Lists...",
              en: "🔄 Syncing GitHub Star Lists...",
            })
      );
      const syncSummary = await organizer.syncGitHubStarLists(
        organizedRepos,
        githubStarListsClient,
        { dryRun: githubListsDryRun }
      );
      console.log(
        localize(language, {
          zh: `✅ GitHub Star Lists 同步完成：${
            syncSummary.dryRun ? "预览" : "已处理"
          } ${syncSummary.assignedRepos.length} 个仓库，创建 ${
            syncSummary.createdLists.length
          } 个新 List，失败 ${syncSummary.failedRepos.length} 个\n`,
          en: `✅ GitHub Star Lists sync complete: ${
            syncSummary.dryRun ? "previewed" : "processed"
          } ${syncSummary.assignedRepos.length} repositories, created ${
            syncSummary.createdLists.length
          } new Lists, failed ${syncSummary.failedRepos.length}\n`,
        })
      );
    }

    // 生成并保存报告
    console.log(
      localize(language, {
        zh: "📄 生成整理报告...",
        en: "📄 Generating organization report...",
      })
    );
    const report = organizer.generateReport(organizedRepos);
    await organizer.saveReport(report);
    console.log(
      localize(language, {
        zh: "✅ 报告生成成功\n",
        en: "✅ Report generated successfully\n",
      })
    );

    // 显示创建的列表
    console.log(
      localize(language, {
        zh: "📋 创建的 GitHub 列表：",
        en: "📋 Created GitHub lists:",
      })
    );
    createdLists.forEach((list) => {
      console.log(`  - ${list.name}: ${list.description}`);
    });

    console.log(
      localize(language, {
        zh: "\n🎉 GitHub 仓库整理完成！",
        en: "\n🎉 GitHub repository organization complete!",
      })
    );
    console.log(
      localize(language, {
        zh: "📄 查看 organization-report.md 文件获取详细信息",
        en: "📄 See organization-report.md for details",
      })
    );
  } catch (error) {
    console.error("❌", error);
    process.exit(1);
  }
}

// 处理未处理的 Promise 拒绝
process.on("unhandledRejection", (reason, promise) => {
  const language = getLanguageFromEnv(process.env);
  console.error(
    localize(language, {
      zh: "未处理的拒绝：",
      en: "Unhandled rejection:",
    }),
    promise,
    localize(language, {
      zh: "原因：",
      en: "Reason:",
    }),
    reason
  );
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main();
}
