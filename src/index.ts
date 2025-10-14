import * as dotenv from "dotenv";
import { GitHubClient } from "./github-client";
import { LLMClient } from "./llm-client";
import { RepoOrganizer } from "./organizer";
import { FileBasedListsClient } from "./file-based-lists";
import { GitHubListsManager } from "./github-lists-manager";

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Validate environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const llmApiUrl = process.env.LLM_API_URL || "http://10.20.124.89:11435";
    const llmModel = process.env.LLM_MODEL || "deepseek-r1:32b";

    if (!githubToken) {
      console.error("Error: GITHUB_TOKEN environment variable is required");
      console.error("Please create a .env file with your GitHub token");
      console.error(
        "You can get a token from: https://github.com/settings/tokens"
      );
      process.exit(1);
    }

    console.log("🚀 Starting GitHub Repository Organizer...\n");

    // Initialize clients
    const githubClient = new GitHubClient(githubToken);
    const llmClient = new LLMClient(llmApiUrl, llmModel);
    const fileBasedListsClient = new FileBasedListsClient();

    // Get current user
    console.log("📋 Getting current user...");
    const username = await githubClient.getCurrentUser();
    console.log(`✅ Logged in as: ${username}\n`);

    // Initialize GitHub Lists manager
    const githubListsManager = new GitHubListsManager(githubToken, username);

    const organizer = new RepoOrganizer(
      githubClient,
      llmClient,
      fileBasedListsClient,
      githubListsManager
    );

    // Get starred repositories
    console.log("⭐ Fetching starred repositories...");
    const allStarredRepos = await githubClient.getStarredRepos(username);
    console.log(`✅ Found ${allStarredRepos.length} starred repositories\n`);

    if (allStarredRepos.length === 0) {
      console.log("No starred repositories found. Exiting...");
      return;
    }

    // Limit repositories for testing (set MAX_REPOS environment variable to override)
    const maxRepos = parseInt(process.env.MAX_REPOS || "50");
    const starredRepos = allStarredRepos.slice(0, maxRepos);

    if (starredRepos.length < allStarredRepos.length) {
      console.log(
        `⚠️  Processing only first ${starredRepos.length} repositories (set MAX_REPOS env var to change this limit)\n`
      );
    }

    // Organize repositories
    console.log("🤖 Organizing repositories using LLM...");
    const organizedRepos = await organizer.organizeRepositories(starredRepos);
    console.log("✅ Repositories organized successfully\n");

    // Display organization summary
    console.log("📊 Organization Summary:");
    for (const [category, subcategories] of Object.entries(organizedRepos)) {
      const totalRepos = Object.values(subcategories).reduce(
        (sum, subcategory) => sum + subcategory.repos.length,
        0
      );
      console.log(`  ${category}: ${totalRepos} repositories`);

      for (const [subcategory, data] of Object.entries(subcategories)) {
        if (data.repos.length > 0) {
          console.log(
            `    └─ ${subcategory}: ${data.repos.length} repositories`
          );
        }
      }
    }
    console.log("");

    // Create GitHub lists
    console.log("📝 Creating GitHub lists...");
    const createdLists = await organizer.createGitHubLists(organizedRepos);
    console.log(`✅ Created ${createdLists.length} GitHub lists\n`);

    // Generate and save report
    console.log("📄 Generating organization report...");
    const report = organizer.generateReport(organizedRepos);
    await organizer.saveReport(report);
    console.log("✅ Report generated successfully\n");

    // Display created lists
    console.log("📋 Created GitHub Lists:");
    createdLists.forEach((list) => {
      console.log(`  - ${list.name}: ${list.description}`);
    });

    console.log("\n🎉 GitHub repository organization completed successfully!");
    console.log(
      "📄 Check the organization-report.md file for detailed information"
    );
  } catch (error) {
    console.error("❌ Error occurred:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}
