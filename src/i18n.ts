export type AppLanguage = "zh" | "en";

export interface LocaleText {
  genericSubcategory: string;
  unknown: string;
  none: string;
  noDescription: string;
  categoryExamples: string[];
  categories: {
    web: string;
    machineLearning: string;
    mobile: string;
    systems: string;
    devops: string;
    learning: string;
    tools: string;
  };
}

const LOCALE_TEXT: Record<AppLanguage, LocaleText> = {
  zh: {
    genericSubcategory: "通用",
    unknown: "未知",
    none: "无",
    noDescription: "无描述",
    categoryExamples: [
      "Web 开发",
      "机器学习",
      "DevOps",
      "移动开发",
      "数据科学",
      "工具与实用程序",
      "库与框架",
      "学习资源",
    ],
    categories: {
      web: "Web 开发",
      machineLearning: "机器学习",
      mobile: "移动开发",
      systems: "系统编程",
      devops: "DevOps",
      learning: "学习资源",
      tools: "工具与实用程序",
    },
  },
  en: {
    genericSubcategory: "General",
    unknown: "Unknown",
    none: "None",
    noDescription: "No description",
    categoryExamples: [
      "Web Development",
      "Machine Learning",
      "DevOps",
      "Mobile Development",
      "Data Science",
      "Tools & Utilities",
      "Libraries & Frameworks",
      "Learning Resources",
    ],
    categories: {
      web: "Web Development",
      machineLearning: "Machine Learning",
      mobile: "Mobile Development",
      systems: "Systems Programming",
      devops: "DevOps",
      learning: "Learning Resources",
      tools: "Tools & Utilities",
    },
  },
};

export function parseLanguage(value?: string): AppLanguage {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized.startsWith("en")) {
    return "en";
  }
  if (
    normalized.startsWith("zh") ||
    normalized.startsWith("cn") ||
    normalized.includes("chinese")
  ) {
    return "zh";
  }
  return "zh";
}

export function getLanguageFromEnv(env: NodeJS.ProcessEnv): AppLanguage {
  return parseLanguage(
    env.OUTPUT_LANGUAGE || env.APP_LANGUAGE || env.LANGUAGE || env.LOCALE
  );
}

export function getLocaleText(language: AppLanguage): LocaleText {
  return LOCALE_TEXT[language];
}

export function localize<T>(language: AppLanguage, values: Record<AppLanguage, T>): T {
  return values[language];
}
