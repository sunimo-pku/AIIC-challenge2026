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
 */
export type InterviewMode = "practice" | "simulation";

export interface InterviewModeContext {
  mode: InterviewMode;
  sessionId: number | null;
  stage: number;
}

export function useInterviewMode(): InterviewModeContext {
  const location = useLocation();
  const params = useParams();
  const isPractice = location.pathname.startsWith("/interview/practice");
  const sessionIdRaw = params.sessionId;
  const stageRaw = params.n ?? params.stage;
  return {
    mode: isPractice ? "practice" : "simulation",
    sessionId: sessionIdRaw ? parseInt(sessionIdRaw, 10) : null,
    stage: stageRaw ? parseInt(stageRaw, 10) : 0,
  };
}
