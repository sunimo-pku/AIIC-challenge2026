import { useLocation, useParams } from "react-router-dom";

/**
 * 解析当前 Stage 页面的运行模式与上下文。
 *
 * 路径约定：
 *   /interview/practice/stage/:n           → mode=practice, sessionId=null
 *   /interview/mock/:sessionId/stage/:n    → mode=simulation, sessionId=number
 *
 * 老路径（兼容性兜底）：
 *   /interview/stage/:n                    → mode=simulation, sessionId 由 InterviewContext.session 提供
 *
 * 实现注意：本项目 App.tsx 把 5 个 stage 路径写成了字面量
 * `/interview/practice/stage/0`...`/stage/4`（而不是单一 `:n` 占位符），
 * 因此 react-router 的 useParams() 在这些路径上拿不到 stage——
 * 必须直接从 location.pathname 用正则解析，否则 stage 永远是 0、
 * 顶部 nav 高亮会卡死在第一关。
 */
export type InterviewMode = "practice" | "simulation";

export interface InterviewModeContext {
  mode: InterviewMode;
  sessionId: number | null;
  stage: number;
}

const STAGE_RE = /\/stage\/(\d+)(?:\/|$)/;
const MOCK_SESSION_RE = /\/interview\/mock\/(\d+)/;

export function useInterviewMode(): InterviewModeContext {
  const location = useLocation();
  const params = useParams();
  const path = location.pathname;
  const isPractice = path.startsWith("/interview/practice");

  // sessionId：优先从 route params（react-router 在 mock 路由能拿到 :sessionId），
  // 兜底从 URL 正则解析（防御 useInterviewMode 在非 stage 路由场景被调用时仍可用）
  const sessionIdFromParams = params.sessionId;
  const sessionIdFromPath = path.match(MOCK_SESSION_RE)?.[1];
  const sessionIdRaw = sessionIdFromParams ?? sessionIdFromPath ?? null;

  // stage：直接从 URL 正则解析，因为 5 个 stage 路径在 App.tsx 中写为字面量，
  // react-router 拿不到 :n 参数（这是高亮停留 bug 的根因）
  const stageMatch = path.match(STAGE_RE);
  const stageFromPath = stageMatch ? parseInt(stageMatch[1], 10) : null;
  const stageFromParams = params.n ?? params.stage;

  return {
    mode: isPractice ? "practice" : "simulation",
    sessionId: sessionIdRaw ? parseInt(String(sessionIdRaw), 10) : null,
    stage: stageFromPath ?? (stageFromParams ? parseInt(stageFromParams, 10) : 0),
  };
}
