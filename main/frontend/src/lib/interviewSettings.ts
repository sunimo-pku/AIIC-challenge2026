/**
 * 全局面试设置（难度 + 面试官风格）
 * 按 user.id 隔离存储，所有面试 Stage 页面共用。
 */
export interface InterviewSettings {
  difficulty: "低" | "中" | "高";
  style: "温和引导型" | "严格追问型" | "压力面试型";
}

export const DEFAULT_SETTINGS: InterviewSettings = {
  difficulty: "中",
  style: "严格追问型",
};

export function getInterviewSettingsKey(userId?: number): string {
  if (userId) return `interview_settings_${userId}`;
  return "interview_settings_guest";
}

export function loadInterviewSettings(userId?: number): InterviewSettings {
  try {
    const raw = localStorage.getItem(getInterviewSettingsKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (["低", "中", "高"].includes(parsed.difficulty) &&
          ["温和引导型", "严格追问型", "压力面试型"].includes(parsed.style)) {
        return parsed as InterviewSettings;
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveInterviewSettings(settings: InterviewSettings, userId?: number): void {
  localStorage.setItem(getInterviewSettingsKey(userId), JSON.stringify(settings));
}
