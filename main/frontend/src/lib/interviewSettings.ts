/**
 * 全局面试设置（难度 + 面试官风格）— 按"当前已登录用户"隔离 localStorage。
 *
 * 历史踩坑（已修）：
 *   早期 `loadInterviewSettings(userId?)` 由 TopBar 显式传 `user.id`，但所有
 *   Stage 页面都是 no-arg 调用，结果 TopBar 把数据写到 `interview_settings_${id}`，
 *   Stage 页面却读 `interview_settings_guest`，用户改的难度 / 风格永远不生效。
 *
 *   修法：所有调用方都 no-arg；key 由 `getCurrentUserKey()` 内部从 JWT
 *   token 的 `sub`（username）派生，TopBar 与 Stage 页面自然收敛到同一个 key。
 */
export interface InterviewSettings {
  difficulty: "低" | "中" | "高";
  style: "温和引导型" | "严格追问型" | "压力面试型";
}

export const DEFAULT_SETTINGS: InterviewSettings = {
  difficulty: "中",
  style: "严格追问型",
};

/** URL-safe Base64 解码（JWT 用 `-_` 替代了 `+/`，且省略了 padding）。 */
function b64urlDecode(s: string): string {
  let normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  // 中文场景下 atob → 字节序列 → 用 escape/decodeURIComponent 还原 UTF-8
  try {
    return decodeURIComponent(escape(atob(normalized)));
  } catch {
    return atob(normalized);
  }
}

/** 解析当前 token 的 `sub`（username）作为用户标识。失败时返回 null。 */
function decodeJwtSub(): string | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(b64urlDecode(parts[1]));
    return typeof payload?.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * 派生当前用户的存储 key。
 * - 已登录：`interview_settings_<username>`
 * - 未登录：`interview_settings_guest`
 *
 * 旧代码可能传 userId（兼容保留），优先用显式参数；否则按 JWT 推。
 */
export function getInterviewSettingsKey(userId?: number | string | null): string {
  if (userId !== undefined && userId !== null && userId !== "") {
    return `interview_settings_${userId}`;
  }
  const sub = decodeJwtSub();
  if (sub) return `interview_settings_${sub}`;
  return "interview_settings_guest";
}

export function loadInterviewSettings(userId?: number | string | null): InterviewSettings {
  try {
    const raw = localStorage.getItem(getInterviewSettingsKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        ["低", "中", "高"].includes(parsed.difficulty) &&
        ["温和引导型", "严格追问型", "压力面试型"].includes(parsed.style)
      ) {
        return parsed as InterviewSettings;
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveInterviewSettings(
  settings: InterviewSettings,
  userId?: number | string | null
): void {
  localStorage.setItem(
    getInterviewSettingsKey(userId),
    JSON.stringify(settings)
  );
}
