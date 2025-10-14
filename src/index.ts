import * as dotenv from "dotenv";
import { GitHubClient } from "./github-client";
import { LLMClient } from "./llm-client";
import { RepoOrganizer } from "./organizer";
import { FileBasedListsClient } from "./file-based-lists";
import { GitHubListsManager } from "./github-lists-manager";

// 加载环境变量
dotenv.config();

async function main() {
  try {
    // 验证环境变量
    const githubToken = process.env.GITHUB_TOKEN;
    const llmApiUrl = process.env.LLM_API_URL || "http://10.20.124.89:11435";
    const llmModel = process.env.LLM_MODEL || "deepseek-r1:32b";

    if (!githubToken) {
      console.error("错误：需要 GITHUB_TOKEN 环境变量");
      console.error("请创建一个包含 GitHub token 的 .env 文件");
      console.error(
        "您可以从这里获取 token：https://github.com/settings/tokens"
      );
      process.exit(1);
    }

    console.log("🚀 启动 GitHub 仓库整理器...\n");

    // 初始化客户端
    const githubClient = new GitHubClient(githubToken);
    const llmClient = new LLMClient(llmApiUrl, llmModel);
    const fileBasedListsClient = new FileBasedListsClient();

    // 获取当前用户
    console.log("📋 获取当前用户...");
    const username = await githubClient.getCurrentUser();
    console.log(`✅ 已登录为：${username}\n`);

    // 初始化 GitHub Lists 管理器
    const githubListsManager = new GitHubListsManager(githubToken, username);

    const organizer = new RepoOrganizer(
      githubClient,
      llmClient,
      fileBasedListsClient,
      githubListsManager
    );

    // 获取星标仓库
    console.log("⭐ 获取星标仓库...");
    const allStarredRepos = await githubClient.getStarredRepos(username);
    console.log(`✅ 找到 ${allStarredRepos.length} 个星标仓库\n`);

    if (allStarredRepos.length === 0) {
      console.log("未找到星标仓库。退出...");
      return;
    }

    // 限制仓库数量用于测试（设置 MAX_REPOS 环境变量来覆盖）
    const maxRepos = parseInt(process.env.MAX_REPOS || "50");
    const starredRepos = allStarredRepos.slice(0, maxRepos);

    if (starredRepos.length < allStarredRepos.length) {
      console.log(
        `⚠️  仅处理前 ${starredRepos.length} 个仓库（设置 MAX_REPOS 环境变量来更改此限制）\n`
      );
    }

    // 整理仓库
    console.log("🤖 使用 LLM 整理仓库...");
    const organizedRepos = await organizer.organizeRepositories(starredRepos);
    console.log("✅ 仓库整理成功\n");

    // 显示整理摘要
    console.log("📊 整理摘要：");
    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const totalRepos = Object.values(subcategories).reduce(
        (sum, subcategory) => sum + subcategory.repos.length,
        0
      );
      console.log(`  ${category}：${totalRepos} 个仓库`);

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          console.log(`    └─ ${subcategory}：${data.repos.length} 个仓库`);
        }
      }
    }
    console.log("");

    // 创建 GitHub 列表
    console.log("📝 创建 GitHub 列表...");
    const createdLists = await organizer.createGitHubLists(organizedRepos);
    console.log(`✅ 创建了 ${createdLists.length} 个 GitHub 列表\n`);

    // 生成并保存报告
    console.log("📄 生成整理报告...");
    const report = organizer.generateReport(organizedRepos);
    await organizer.saveReport(report);
    console.log("✅ 报告生成成功\n");

    // 显示创建的列表
    console.log("📋 创建的 GitHub 列表：");
    createdLists.forEach((list) => {
      console.log(`  - ${list.name}: ${list.description}`);
    });

    console.log("\n🎉 GitHub 仓库整理完成！");
    console.log("📄 查看 organization-report.md 文件获取详细信息");
  } catch (error) {
    console.error("❌ 发生错误：", error);
    process.exit(1);
  }
}

// 处理未处理的 Promise 拒绝
process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的拒绝：", promise, "原因：", reason);
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main();
}
