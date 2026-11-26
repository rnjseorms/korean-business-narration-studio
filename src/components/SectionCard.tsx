import React, { useState } from 'react';
import { ScriptSection } from '../types';
import {
  Play,
  Pause,
  Download,
  Copy,
  Check,
  Edit3,
  RotateCcw,
  Sparkles,
  Volume2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileAudio,
} from 'lucide-react';

interface SectionCardProps {
  section: ScriptSection;
  isCurrentlyPlaying: boolean;
  onPlaySection: (section: ScriptSection) => void;
  onGenerateSection: (section: ScriptSection) => void;
  onUpdateText: (sectionId: string, newText: string) => void;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  section,
  isCurrentlyPlaying,
  onPlaySection,
  onGenerateSection,
  onUpdateText,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [textDraft, setTextDraft] = useState(section.text);
  const [copied, setCopied] = useState(false);

  // Approximate character count and speaking duration:
  // Korean speech speed in professional narration is about 5.5 ~ 6 characters per second
  const charCount = section.text.replace(/\s+/g, '').length;
  const estimatedSeconds = Math.round(charCount / 5.8);

  const handleCopy = () => {
    navigator.clipboard.writeText(section.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveText = () => {
    onUpdateText(section.id, textDraft);
    setIsEditing(false);
  };

  const handleDownload = () => {
    if (!section.audioBase64) return;
    try {
      const binaryString = atob(section.audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sanitizedTitle = section.title.replace(/[\/\\?%*:|"<>]/g, '_');
      link.download = `제${section.order}장_${sanitizedTitle}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download section error', e);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isCurrentlyPlaying
          ? 'bg-slate-900 border-sky-500 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/40'
          : section.status === 'ready'
          ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Card Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-xl font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
              isCurrentlyPlaying
                ? 'bg-sky-500 text-white animate-pulse'
                : section.status === 'ready'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {section.order.toString().padStart(2, '0')}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {section.title}
              </h3>
              {section.status === 'ready' && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  생성 완료 ({section.durationSec ? `${section.durationSec}초` : 'WAV'})
                </span>
              )}
              {section.status === 'generating' && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  음성 생성 중...
                </span>
              )}
              {section.status === 'error' && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  오류 발생
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              {section.summary}
            </p>
          </div>
        </div>

        {/* Header Right Action & Meta */}
        <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>약 {estimatedSeconds}초</span>
            <span className="text-slate-600">·</span>
            <span>{charCount}자</span>
          </div>

          <button
            onClick={() => {
              if (isEditing) {
                handleSaveText();
              } else {
                setTextDraft(section.text);
                setIsEditing(true);
              }
            }}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title={isEditing ? '완료' : '대본 텍스트 수정'}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="대본 복사"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Script Content Area */}
      <div className="p-4 sm:p-5 bg-slate-950/40">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              rows={6}
              className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-950 border border-indigo-500/50 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 leading-relaxed font-sans"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setTextDraft(section.text);
                  setIsEditing(false);
                }}
                className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
              >
                취소
              </button>
              <button
                onClick={handleSaveText}
                className="px-3 py-1 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              >
                저장하기
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal selection:bg-indigo-500/30">
            {section.text}
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-950/80 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Playback or Audio Info */}
        <div className="flex items-center gap-2">
          {section.status === 'ready' && (
            <button
              onClick={() => onPlaySection(section)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                isCurrentlyPlaying
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isCurrentlyPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>일시정지</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  <span>듣기</span>
                </>
              )}
            </button>
          )}

          {section.status === 'ready' && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
              title="이 챕터 WAV 다운로드"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>WAV 다운로드</span>
            </button>
          )}
        </div>

        {/* Right: Section Generation Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onGenerateSection(section)}
            disabled={section.status === 'generating'}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
              section.status === 'generating'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : section.status === 'ready'
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
            }`}
          >
            {section.status === 'generating' ? (
              <>
                <span className="w-3 h-3 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                <span>합성 중...</span>
              </>
            ) : section.status === 'ready' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>다시 생성</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>이 섹션 음성 생성</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
