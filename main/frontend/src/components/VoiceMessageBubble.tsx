import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";

/**
 * 语音消息气泡：替代 voiceMode 下用户气泡里的 ASR 转写文字。
 *
 * 需求：
 *  - 录完音之后，用户气泡里**不再显示 ASR 文字**，只显示一个进度条 + 播放按钮，
 *    点击可以重新播放本轮录音。
 *  - 但 LLM 拿到的依然是 ASR 文字（在 message.content 里），不能改。
 *
 * 实现：
 *  - audioUrl 是 TemplateB.handleVoiceComplete 生成的 blob: URL，仅当前 tab 内有效。
 *  - 历史 session 重新加载后没有 audioUrl —— 退化为不可回放的灰色占位，依然不
 *    显示文字（保持需求一致），但提示用户"已结束·无法回放"。
 *  - duration 优先用录音时长（前端自己计时的 audio_meta.duration），audio onLoaded
 *    metadata 拿到的 duration 偶尔不准（部分浏览器对 wav 解析的元数据延迟）。
 */
interface Props {
  audioUrl?: string | null;
  duration?: number;
}

function fmt(s: number): string {
  const sec = Math.max(0, Math.round(s));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function VoiceMessageBubble({ audioUrl, duration }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setCurrent(0);
    setPlaying(false);
    setErrored(false);
    if (!audioUrl) {
      setTotal(duration ?? 0);
      return;
    }
    const a = new Audio(audioUrl);
    audioRef.current = a;
    const onLoaded = () => {
      // wav 可能拿不到合理的 duration（Infinity / NaN），fallback 用录音时长
      const meta = isFinite(a.duration) && a.duration > 0 ? a.duration : (duration ?? 0);
      setTotal(meta);
    };
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onErr = () => setErrored(true);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
      audioRef.current = null;
    };
  }, [audioUrl, duration]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setErrored(true));
    }
  };

  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  // 没有 audioUrl 或加载失败：刷新后的历史消息走这条 fallback
  if (!audioUrl || errored) {
    return (
      <div className="flex items-center gap-3 min-w-[200px] py-0.5">
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Mic size={14} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full w-0" />
          </div>
          <div className="text-[10.5px] mt-1 opacity-70 font-mono tracking-wide whitespace-nowrap">
            VOICE · {total ? fmt(total) : "—"} · 已结束·无法回放
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-[220px] py-0.5">
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center shrink-0 transition-colors"
        aria-label={playing ? "暂停语音" : "播放语音"}
      >
        {playing ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white/85 transition-[width] duration-150 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10.5px] mt-1 opacity-85 font-mono tracking-wide whitespace-nowrap">
          {fmt(current)} / {fmt(total)}
        </div>
      </div>
    </div>
  );
}
