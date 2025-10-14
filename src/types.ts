export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface ClassificationResult {
  category: string;
  subcategory?: string;
  tags: string[];
  reason: string;
}

export interface GitHubList {
  id: number;
  name: string;
  description: string;
  public: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMResponse {
  classifications: ClassificationResult[];
}
