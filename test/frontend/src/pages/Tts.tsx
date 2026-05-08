import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Header } from "@/components/Header";
import { Volume2, Music, Mic2 } from "lucide-react";

const speakers: Record<string, { value: string; label: string }[]> = {
  "通用场景": [
    { value: "zh_female_qingchezizi_moon_bigtts", label: "清澈梓梓（女声）" },
    { value: "zh_female_wanwanxiaohe_moon_bigtts", label: "湾湾小何（女声）" },
    { value: "zh_male_beijingxiaoye_moon_bigtts", label: "北京小爷（男声）" },
    { value: "zh_male_yangguangqingnian_moon_bigtts", label: "阳光青年（男声）" },
    { value: "zh_female_linjianvhai_moon_bigtts", label: "邻家女孩（女声）" },
  ],
  "角色扮演": [
    { value: "ICL_zh_female_bingjiao3_tob", label: "邪魅女王" },
    { value: "ICL_zh_male_badaozongcai_v1_tob", label: "霸道总裁" },
    { value: "zh_female_meilinvyou_moon_bigtts", label: "魅力女友" },
    { value: "zh_male_shenyeboke_moon_bigtts", label: "深夜播客" },
  ],
  "趣味方言": [
    { value: "zh_male_guozhoudege_moon_bigtts", label: "广州德哥" },
    { value: "zh_male_haoyuxiaoge_moon_bigtts", label: "浩宇小哥" },
    { value: "zh_female_daimengchuanmei_moon_bigtts", label: "呆萌川妹" },
  ],
};

export default function Tts() {
  const [text, setText] = useState("你好，这是豆包语音合成的测试。");
  const [speaker, setSpeaker] = useState("zh_female_qingchezizi_moon_bigtts");
  const [status, setStatus] = useState("就绪");
  const [audioSrc, setAudioSrc] = useState("");
  const [loading, setLoading] = useState(false);

  const synthesize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setStatus("合成中...");
    try {
      const resp = await fetch("/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker }),
      });
      const data = await resp.json();
      if (data.error) {
        setStatus("合成失败: " + data.error);
      } else {
        setAudioSrc("data:audio/mp3;base64," + data.audio_base64);
        setStatus("合成完成");
      }
    } catch (err: any) {
      setStatus("请求异常: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      <Header icon={Mic2} title="语音合成" subtitle="豆包语音 · 大模型 TTS" />

      <Card>
        <CardHeader>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
            <Volume2 size={18} className="text-accent" />
          </div>
          <h2 className="flex-1 text-base font-semibold text-text">文本转语音</h2>
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            豆包语音
          </span>
        </CardHeader>

        <CardContent className="space-y-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要合成的文本..."
            className="min-h-[100px] w-full resize-y rounded-[var(--radius)] border border-border bg-bg-elevated p-4 text-sm text-text outline-none transition-all duration-200 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-ring"
          />

          <div className="flex flex-col gap-3 sm:flex-row">
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
            <Button
              variant="primary"
              onClick={synthesize}
              disabled={loading || !text.trim()}
              className="bg-emerald-500 hover:bg-emerald-400"
            >
              <Volume2 size={16} />
              {loading ? "合成中..." : "合成语音"}
            </Button>
          </div>

          {audioSrc && (
            <div className="rounded-[var(--radius)] border border-border bg-bg-secondary p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
                <Music size={14} />
                <span className="truncate">
                  {text.length > 40 ? text.slice(0, 40) + "..." : text}
                </span>
              </div>
              <audio src={audioSrc} controls autoPlay className="h-10 w-full" />
            </div>
          )}

          <p className="text-xs text-text-muted">
            选择音色后点击「合成语音」，音频将自动播放
          </p>
          <div className="text-[11px] text-text-muted">{status}</div>
        </CardContent>
      </Card>
    </div>
  );
}
