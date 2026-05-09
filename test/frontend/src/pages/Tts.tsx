import { useState, useRef } from "react";
import { TopBar } from "@/components/TopBar";
import { ModuleCard } from "@/components/ModuleCard";
import { StatusCard } from "@/components/StatusCard";
import { RulerScale } from "@/components/RulerScale";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/hooks/useAuth";
import { Play, Square, Volume2, Music, ArrowRight } from "lucide-react";

const speakers: Record<string, { value: string; label: string }[]> = {
  通用场景: [
    { value: "zh_female_qingchezizi_moon_bigtts", label: "清澈梓梓（女声）" },
    { value: "zh_female_wanwanxiaohe_moon_bigtts", label: "湾湾小何（女声）" },
    { value: "zh_male_beijingxiaoye_moon_bigtts", label: "北京小爷（男声）" },
    { value: "zh_male_yangguangqingnian_moon_bigtts", label: "阳光青年（男声）" },
    { value: "zh_female_linjianvhai_moon_bigtts", label: "邻家女孩（女声）" },
  ],
  角色扮演: [
    { value: "ICL_zh_female_bingjiao3_tob", label: "邪魅女王" },
    { value: "ICL_zh_male_badaozongcai_v1_tob", label: "霸道总裁" },
    { value: "zh_female_meilinvyou_moon_bigtts", label: "魅力女友" },
    { value: "zh_male_shenyeboke_moon_bigtts", label: "深夜播客" },
  ],
  趣味方言: [
    { value: "zh_male_guozhoudege_moon_bigtts", label: "广州德哥" },
    { value: "zh_male_haoyuxiaoge_moon_bigtts", label: "浩宇小哥" },
    { value: "zh_female_daimengchuanmei_moon_bigtts", label: "呆萌川妹" },
  ],
};

export default function Tts() {
  const { token } = useAuth();

  const [text, setText] = useState("你好，这是豆包语音合成的测试。");
  const [speaker, setSpeaker] = useState("zh_female_qingchezizi_moon_bigtts");
  const [status, setStatus] = useState("就绪");
  const [audioSrc, setAudioSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const synthesize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setStatus("合成中…");
    try {
      const resp = await fetch("/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, speaker }),
      });
      const data = await resp.json();
      if (data.error) {
        setStatus("失败: " + data.error);
      } else {
        setAudioSrc("data:audio/mp3;base64," + data.audio_base64);
        setStatus("完成");
      }
    } catch (err: any) {
      setStatus("异常: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleEnded = () => setIsPlaying(false);

  if (!token) {
    return (
      <div className="h-screen flex flex-col bg-bg text-fg">
        <TopBar center={<span>语音工坊 · 豆包 TTS</span>} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg-subtle">
              [ NO SIGNAL ]
            </div>
            <p className="text-[14px] text-fg-muted">请先登录以使用语音合成功能</p>
            <a
              href="/"
              className="inline-flex items-center gap-1 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-4 py-2 hover:bg-accent hover:text-bg transition-colors"
            >
              LOGIN →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg text-fg overflow-hidden">
      <TopBar center={<span>语音工坊 · 豆包 TTS</span>} />

      <div className="flex-1 flex min-h-0">
        {/* 左侧状态栏 */}
        <aside className="hidden lg:flex w-[220px] shrink-0 border-r border-border flex-col overflow-y-auto p-4 gap-4">
          <StatusCard label="引擎" value="豆包" />
          <StatusCard label="格式" value="MP3" />
          <StatusCard label="状态" value={loading ? "忙碌" : "空闲"} />
          <RulerScale direction="vertical" className="mt-2" />
        </aside>

        {/* 中间主区域 */}
        <main className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 gap-4 overflow-y-auto">
          {/* 播放控制 */}
          <ModuleCard
            label="播放控制"
            meta={audioSrc ? "就绪" : "空"}
            status={status}
            action={
              audioSrc && (
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-strong transition-colors"
                >
                  {isPlaying ? <Square size={12} /> : <Play size={12} />}
                  {isPlaying ? "暂停" : "播放"}
                </button>
              )
            }
          >
            <div className="px-4 py-4 flex items-center gap-4">
              <Button
                variant="solid"
                size="sm"
                onClick={synthesize}
                disabled={loading || !text.trim()}
              >
                <Volume2 size={14} strokeWidth={1.5} />
                {loading ? "合成中…" : "合成"}
              </Button>

              {audioSrc && (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Music size={14} className="text-fg-muted shrink-0" strokeWidth={1.5} />
                  <span className="text-[12px] text-fg-subtle truncate">
                    {text.length > 50 ? text.slice(0, 50) + "…" : text}
                  </span>
                </div>
              )}

              {!audioSrc && !loading && (
                <span className="text-[12px] text-fg-subtle">
                  输入文本并选择音色后点击合成
                </span>
              )}

              {loading && (
                <span className="flex items-center gap-1.5">
                  <span className="pulse-dot-1 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                  <span className="pulse-dot-2 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                  <span className="pulse-dot-3 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                </span>
              )}
            </div>
          </ModuleCard>

          {/* 波形 / 音频 */}
          <ModuleCard label="波形" meta={audioSrc ? "24kHz" : "—"}>
            <div className="px-4 py-6 flex items-center justify-center min-h-[120px]">
              {audioSrc ? (
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  controls
                  className="h-9 w-full"
                  onEnded={handleEnded}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                />
              ) : (
                <div className="text-[12px] text-fg-subtle">
                  暂无音频
                </div>
              )}
            </div>
          </ModuleCard>

          {/* 参数 */}
          <ModuleCard
            label="参数"
            meta={`${text.length} 字符`}
            className="focus-within:border-accent transition-colors duration-150"
            status={
              <span>
                音色 · {speakers["通用场景"].find(s => s.value === speaker)?.label || speaker}
              </span>
            }
            action={
              <button
                onClick={synthesize}
                disabled={loading || !text.trim()}
                className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-strong disabled:text-fg-subtle disabled:opacity-40 transition-colors"
              >
                合成 →
              </button>
            }
          >
            <div className="px-4 py-4 space-y-4">
              <div>
                <label className="block text-[12px] text-fg-muted mb-2">
                  文本内容
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="输入要合成的文本…"
                  className="w-full min-h-[80px] resize-y rounded-sm border border-border bg-overlay px-3 py-2 text-[14px] text-fg outline-none placeholder:text-fg-subtle focus:border-accent transition-colors duration-150"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] text-fg-muted mb-2">
                    音色
                  </label>
                  <Select
                    value={speaker}
                    onChange={(e) => setSpeaker(e.target.value)}
                  >
                    {Object.entries(speakers).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-[12px] text-fg-muted mb-2">
                    语速
                  </label>
                  <div className="h-10 flex items-center gap-3">
                    <span className="text-[12px] text-fg-subtle">1.0x</span>
                    <div className="flex-1 h-1 bg-border relative">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-3 bg-accent"
                        style={{ left: "50%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModuleCard>
        </main>

        {/* 右侧信息 */}
        <aside className="hidden xl:flex w-[320px] shrink-0 border-l border-border flex-col overflow-y-auto p-4 gap-4">
          <ModuleCard label="说明" meta="文档">
            <div className="px-4 py-3 space-y-3 text-[12px] text-fg-subtle leading-relaxed">
              <p>
                基于豆包语音大模型 TTS 服务，支持多种音色与情感风格。
              </p>
              <div className="border-t border-border/50 pt-2">
                <div className="text-fg-muted mb-1">接口</div>
                <div>POST /tts</div>
              </div>
              <div className="border-t border-border/50 pt-2">
                <div className="text-fg-muted mb-1">音色数</div>
                <div>{Object.values(speakers).flat().length} 种预设</div>
              </div>
            </div>
          </ModuleCard>

          <ModuleCard label="快捷音色" meta="常用">
            <div className="px-4 py-2 space-y-1">
              {Object.values(speakers)
                .flat()
                .slice(0, 5)
                .map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSpeaker(s.value)}
                    className="w-full flex items-center justify-between py-1.5 text-[12px] text-fg-subtle hover:text-fg transition-colors text-left"
                  >
                    <span className="truncate">{s.label}</span>
                    {speaker === s.value && (
                      <ArrowRight size={12} className="text-accent shrink-0" />
                    )}
                  </button>
                ))}
            </div>
          </ModuleCard>
        </aside>
      </div>
    </div>
  );
}
