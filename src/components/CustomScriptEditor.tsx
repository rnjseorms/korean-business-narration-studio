import React, { useState } from 'react';
import { TTSConfig } from '../types';
import { VOICE_OPTIONS } from '../data/defaultScript';
import {
  Sparkles,
  Download,
  Play,
  Pause,
  Wand2,
  Trash2,
  Copy,
  Check,
  Plus,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  Scissors,
  FileAudio,
  RotateCcw,
} from 'lucide-react';

export interface ScriptItem {
  id: string;
  round: string; // e.g., '1차', '2차', '3차', '새 대본'
  title: string;
  text: string;
  audioBase64?: string;
  durationSec?: number;
  fileSizeBytes?: number;
  downloadUrl?: string;
  updatedAt: number;
}

interface CustomScriptEditorProps {
  config: TTSConfig;
  scripts: ScriptItem[];
  activeScriptId: string;
  isAudioPlaying?: boolean;
  onSelectScript: (id: string) => void;
  onSaveScript: (script: ScriptItem) => void;
  onCreateNewScript: () => void;
  onDeleteScript: (id: string) => void;
  onResetAll?: () => void;
  onSplitToChapters: (title: string, fullText: string) => void;
  onPlayAudio: (title: string, base64?: string, duration?: number, downloadUrl?: string) => void;
}

export const CustomScriptEditor: React.FC<CustomScriptEditorProps> = ({
  config,
  scripts,
  activeScriptId,
  isAudioPlaying = false,
  onSelectScript,
  onSaveScript,
  onCreateNewScript,
  onDeleteScript,
  onResetAll,
  onSplitToChapters,
  onPlayAudio,
}) => {
  const activeScript = scripts.find((s) => s.id === activeScriptId) || scripts[0];
  const selectedVoiceInfo = VOICE_OPTIONS.find((v) => v.id === config.voice) || VOICE_OPTIONS[0];

  const [title, setTitle] = useState(activeScript?.title || '내레이션 대본');
  const [text, setText] = useState(activeScript?.text || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Sync state when active script changes
  React.useEffect(() => {
    if (activeScript) {
      setTitle(activeScript.title);
      setText(activeScript.text);
      setGenerationError(null);
    }
  }, [activeScriptId]);

  // Character count & estimated speaking time (5.8 chars/sec)
  const charCount = text.replace(/\s+/g, '').length;
  const estimatedSeconds = Math.round(charCount / 5.8);
  const estMins = Math.floor(estimatedSeconds / 60);
  const estSecs = estimatedSeconds % 60;

  // Auto pronunciation & cleanup optimizer
  const handleAutoOptimize = () => {
    let optimized = text;

    const replacements: [RegExp, string][] = [
      [/\bBSD\b/gi, '비에스디'],
      [/\bPDF\b/gi, '피디에프'],
      [/\bCEO\b/gi, '씨이오'],
      [/\bCTA\b/gi, '씨티에이'],
      [/\bSNS\b/gi, '에스엔에스'],
      [/\bAI\b/gi, '에이아이'],
      [/\bB2B\b/gi, '비투비'],
      [/\bB2C\b/gi, '비투씨'],
      [/\bROI\b/gi, '알오아이'],
      [/\bCRM\b/gi, '씨알엠'],
      [/\bFAQ\b/gi, '에프에이큐'],
      [/\bQ&A\b/gi, '큐앤에이'],
    ];

    replacements.forEach(([pattern, repl]) => {
      optimized = optimized.replace(pattern, repl);
    });

    optimized = optimized.replace(/\[(?:지문|음악|효과음|bgm|자막|나레이션|내레이션)[^\]]*\]/gi, '');
    optimized = optimized.replace(/\((?:지문|음악|효과음|bgm|자막|나레이션|내레이션)[^)]*\)/gi, '');

    setText(optimized);
    setSuccessNotice('영문 약어(BSD→비에스디, PDF→피디에프 등) 및 연출 지문 정돈 완료!');
    setTimeout(() => setSuccessNotice(null), 3000);

    if (activeScript) {
      onSaveScript({ ...activeScript, text: optimized });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate real Gemini AI TTS with chosen voice
  const handleGenerateTTS = async () => {
    if (!text.trim()) {
      setGenerationError('대본 내용을 먼저 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: config.voice,
          model: config.model,
          style: config.style,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '음성 생성 중 오류가 발생했습니다.');
      }

      const audioBase64 = data.audioBase64;
      const totalDurationSec = data.durationSec;
      const totalBytes = data.fileSizeBytes;

      const updatedScript: ScriptItem = {
        ...activeScript,
        title,
        text,
        audioBase64,
        durationSec: totalDurationSec,
        fileSizeBytes: totalBytes,
        updatedAt: Date.now(),
      };

      onSaveScript(updatedScript);
      
      // Critical: Never interrupt audio if currently playing!
      if (isAudioPlaying) {
        setSuccessNotice(`"${title}" [${selectedVoiceInfo.name}] AI 음성 생성 완료! 현재 듣고 계신 음성을 방해하지 않도록 보존되었습니다. 청취 후 [듣기] 버튼을 누르시면 됩니다.`);
      } else {
        setSuccessNotice(`"${title}" [${selectedVoiceInfo.name}] AI 음성 생성 완료! 아래 [듣기] 버튼을 눌러 청취하실 수 있습니다.`);
      }
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || '음성 생성 실패');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadWav = () => {
    if (activeScript?.downloadUrl) {
      const link = document.createElement('a');
      link.href = activeScript.downloadUrl;
      link.download = `${title.replace(/[\/\\?%*:|"<>]/g, '_')}_${config.voice}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    if (!activeScript?.audioBase64) return;
    try {
      const binaryString = atob(activeScript.audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${title.replace(/[\/\\?%*:|"<>]/g, '_')}_${config.voice}.wav`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error', err);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      
      {/* Script History / Rounds Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>대본 직접 입력 및 음성 생성</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold">
                선택 보이스: {selectedVoiceInfo.name}
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            원하는 대본을 붙여넣고, 선택하신 <strong className="text-slate-200">{selectedVoiceInfo.name}</strong> 톤의 고음질 스튜디오 WAV 음성으로 즉시 변환하세요.
          </p>
        </div>

        {/* Script Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start sm:self-auto">
          {scripts.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectScript(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                item.id === activeScriptId
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{item.round}</span>
              {item.audioBase64 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          ))}

          <button
            onClick={onCreateNewScript}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/30 transition flex items-center gap-1"
            title="새 대본 추가"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 대본 추가</span>
          </button>

          {onResetAll && (
            <button
              onClick={() => {
                if (window.confirm('대본 및 오디오 상태를 초기 기본값으로 리셋하시겠습니까?')) {
                  onResetAll();
                }
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition flex items-center gap-1"
              title="대본 초기화 (기본 상태로 리셋)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>초기화</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successNotice}</span>
        </div>
      )}

      {generationError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{generationError}</span>
        </div>
      )}

      {/* Script Title & Formatting Tools Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            대본 제목 / 프로젝트 명
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (activeScript) onSaveScript({ ...activeScript, title: e.target.value });
            }}
            placeholder="예: 2차 대본 - 신뢰의 순서와 고객 설득"
            className="w-full text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Quick Helper Tools */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto pt-2 sm:pt-4">
          <button
            onClick={handleAutoOptimize}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-sky-400 hover:text-sky-300 transition"
            title="영문 약어(BSD, PDF 등) 한글 음차 및 지문 정돈"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>약어 한글발음 교정</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            title="대본 전체 복사"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사됨' : '복사'}</span>
          </button>

          {text.trim() && (
            <button
              onClick={() => {
                setText('');
                if (activeScript) onSaveScript({ ...activeScript, text: '' });
              }}
              className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-rose-300 transition"
              title="대본 내용 지우기"
            >
              내용 비우기
            </button>
          )}

          {scripts.length > 1 && (
            <button
              onClick={() => onDeleteScript(activeScript.id)}
              className="p-2 rounded-xl bg-slate-950 hover:bg-rose-500/20 border border-slate-800 text-slate-400 hover:text-rose-400 transition"
              title="이 대본 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Textarea Area */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (activeScript) onSaveScript({ ...activeScript, text: e.target.value });
          }}
          rows={12}
          placeholder="여기에 1차, 2차, 또는 3차 대본을 직접 붙여넣으세요.&#10;&#10;[안내]&#10;• 새로고침(F5) 시 모든 회차 대본이 완전히 초기화되어 항상 깨끗한 상태로 시작합니다.&#10;• 상단 음성 설정에서 원하는 내레이터를 선택하신 후 [AI 음성 생성하기]를 누르시면 고음질 스튜디오 WAV 음성이 생성됩니다."
          className="w-full text-xs sm:text-sm p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 leading-relaxed font-sans resize-y selection:bg-indigo-500/30"
        />

        <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-400">
          <Clock className="w-3 h-3 text-sky-400" />
          <span>
            약 {estMins > 0 ? `${estMins}분 ` : ''}{estSecs}초
          </span>
          <span className="text-slate-600">·</span>
          <span>{charCount.toLocaleString()}자</span>
        </div>
      </div>

      {/* Action Footer: Generation & Output */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        
        {/* Left: Split to Chapters Option */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => onSplitToChapters(title, text)}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-40"
            title="대본을 빈 줄바꿈 기준으로 나누어 챕터 카드로 전환"
          >
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            <span>단락별 챕터로 자동 분할하기</span>
          </button>
        </div>

        {/* Right: Main TTS Generation Button & Output */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* If audio generated: Play / Download buttons */}
          {(activeScript?.audioBase64 || activeScript?.downloadUrl) && (
            <>
              <button
                onClick={() =>
                  onPlayAudio(
                    title,
                    activeScript.audioBase64,
                    activeScript.durationSec,
                    activeScript.downloadUrl
                  )
                }
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-sky-950/40"
                title="플레이어에서 듣기"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>듣기</span>
              </button>

              <button
                onClick={handleDownloadWav}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-950/40"
                title="WAV 오디오 파일 다운로드"
              >
                <Download className="w-4 h-4" />
                <span>WAV 다운로드 ({activeScript.durationSec ? `${activeScript.durationSec}초` : '완성본'})</span>
              </button>
            </>
          )}

          {/* Primary Generate Button (Real Gemini AI Voice) */}
          <button
            onClick={handleGenerateTTS}
            disabled={isGenerating || !text.trim()}
            className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-xl ${
              isGenerating || !text.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:from-indigo-400 hover:to-cyan-300 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02]'
            }`}
          >
            {isGenerating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>[{selectedVoiceInfo.name}] AI 음성 합성 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>
                  {activeScript?.audioBase64
                    ? `[${selectedVoiceInfo.name}] 다시 생성하기 (WAV)`
                    : `[${selectedVoiceInfo.name}] AI 음성 생성 & 재생 (WAV)`}
                </span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Generated Audio Card Preview */}
      {(activeScript?.audioBase64 || activeScript?.downloadUrl) && (
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{title}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                  {activeScript.audioBase64 ? `생성 완료 (${selectedVoiceInfo.name})` : '스튜디오 샘플 완성'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                재생 시간: {activeScript.durationSec ? `${activeScript.durationSec}초` : '계산 중'} · 스튜디오 규격 24kHz Mono WAV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onPlayAudio(
                  title,
                  activeScript.audioBase64,
                  activeScript.durationSec,
                  activeScript.downloadUrl
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>플레이어에서 듣기</span>
            </button>
            <button
              onClick={handleDownloadWav}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>다운로드</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
