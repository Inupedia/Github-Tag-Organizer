const metadata = {
  owner: "Inupedia",
  repo: "Github-Tag-Organizer",
  description:
    "LLM-powered GitHub Star Lists organizer that automatically classifies starred repositories, creates missing lists, and syncs assignments.",
  homepage: "https://github.com/Inupedia/Github-Tag-Organizer#readme",
  topics: [
    "github",
    "github-stars",
    "star-lists",
    "llm",
    "ai",
    "typescript",
    "automation",
    "repository-management",
    "starred-repos",
    "github-api",
    "ollama",
    "openai",
    "productivity",
    "developer-tools",
  ],
};

async function githubRequest(path, options = {}) {
  const token = process.env.GH_ADMIN_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Set GH_ADMIN_TOKEN or GITHUB_TOKEN before running this script.");
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body}`);
  }

  return response.status === 204 ? null : response.json();
}

async function main() {
  const repoPath = `/repos/${metadata.owner}/${metadata.repo}`;

  await githubRequest(repoPath, {
    method: "PATCH",
    body: JSON.stringify({
      description: metadata.description,
      homepage: metadata.homepage,
      has_issues: true,
      has_projects: true,
      has_wiki: false,
    }),
  });

  await githubRequest(`${repoPath}/topics`, {
    method: "PUT",
    body: JSON.stringify({ names: metadata.topics }),
  });

  console.log("Repository metadata updated:");
  console.log(`- Description: ${metadata.description}`);
  console.log(`- Homepage: ${metadata.homepage}`);
  console.log(`- Topics: ${metadata.topics.join(", ")}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
