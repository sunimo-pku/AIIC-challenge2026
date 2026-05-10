/**
 * 统一 API 请求封装
 * - 自动附加 Authorization header
 * - 统一处理 401 未授权 → 跳转登录页
 * - 统一处理网络错误
 */

/**
 * 安全解析 JSON 响应。
 *
 * 历史踩坑：调用方常常直接 `await resp.json()`，但当 nginx 504 / 502 / 连接重置
 * 或者后端崩了的时候，回来的是一段 HTML 错误页（`<html><head><title>504...`），
 * `.json()` 抛 ``SyntaxError: Unexpected token '<', "<html> <h"... is not valid JSON``，
 * 直接被 toast 出来用户完全看不懂。
 *
 * 这里：
 *  - 如果 content-type 不是 application/json，先把 body 当文本读，再尝试从中提取
 *    `<title>` 作为可读 message（nginx 错误页都带 title），fall back 到 status code。
 *  - 抛一个普通 `Error(message)`，message 是用户可读的中文。
 *  - 调用方仍然可以根据 resp.ok 来分流，本函数不替你判断成功/失败，只负责把 body
 *    解析成对象 / 抛出可读异常。
 */
export async function parseJsonResponse<T = any>(resp: Response): Promise<T> {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("json")) {
    let detail = "";
    try {
      const text = await resp.text();
      // nginx 默认错误页：<title>504 Gateway Time-out</title>
      const m = text.match(/<title>([^<]+)<\/title>/i);
      if (m) detail = m[1].trim();
      else if (text) detail = text.trim().slice(0, 120);
    } catch { /* ignore */ }
    if (resp.status === 502 || resp.status === 504) {
      throw new Error(`后端响应超时（HTTP ${resp.status}${detail ? "·" + detail : ""}），请稍后重试`);
    }
    if (resp.status >= 500) {
      throw new Error(`后端异常（HTTP ${resp.status}${detail ? "·" + detail : ""}）`);
    }
    if (resp.status >= 400) {
      throw new Error(`请求失败（HTTP ${resp.status}${detail ? "·" + detail : ""}）`);
    }
    throw new Error(`返回不是 JSON（HTTP ${resp.status}${detail ? "·" + detail : ""}）`);
  }
  try {
    return await resp.json();
  } catch (e: any) {
    throw new Error(`响应解析失败：${e?.message || "JSON 损坏"}`);
  }
}

export async function apiFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    // 只有 body 是字符串时才默认加 json header
    if (typeof init.body === "string") {
      headers.set("Content-Type", "application/json");
    }
  }

  try {
    const resp = await fetch(input, { ...init, headers });
    if (resp.status === 401) {
      localStorage.removeItem("token");
      // 登录页路径是 `/`（不是 /login）。前端 App.tsx 没注册 /login 路由，
      // 后端也没有 /login 的 SPA fallback——跳错地址会让用户卡在 FastAPI 的
      // 404 JSON 页面。这里和 useAuth 的 `app:unauthorized` handler 保持一致。
      window.location.href = "/";
      // 抛出让调用方知道已经跳转
      throw new Error("Unauthorized");
    }
    return resp;
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error("网络异常，请检查连接");
    }
    throw err;
  }
}

/**
 * 压缩图片为指定最大宽高的 base64
 * @param base64 原始 base64
 * @param maxWidth 最大宽度
 * @param maxHeight 最大高度
 * @param quality JPEG 质量 0-1
 */
export function compressImage(
  base64: string,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      // 统一转为 jpeg，去掉 alpha 通道，体积更小
      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}
