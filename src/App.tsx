import React, { useState, useMemo, useEffect } from 'react';
import { ScriptSection, TTSConfig, GenerationProgress } from './types';
import { DEFAULT_SCRIPT_SECTIONS, VOICE_OPTIONS } from './data/defaultScript';
import { Header } from './components/Header';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { TTSConfigPanel } from './components/TTSConfigPanel';
import { SectionCard } from './components/SectionCard';
import { ScriptInsightsModal } from './components/ScriptInsightsModal';
import { CustomScriptEditor, ScriptItem } from './components/CustomScriptEditor';
import {
  Sparkles,
  Download,
  FileText,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  HelpCircle,
  AlertCircle,
  Volume2,
  Radio,
  Edit,
  PenTool,
  Plus,
} from 'lucide-react';

const INITIAL_SCRIPTS: ScriptItem[] = [
  {
    id: 'script-1',
    round: '대본 1',
    title: '내레이션 대본',
    text: '',
    updatedAt: Date.now(),
  },
];

export default function App() {
  // Main view mode: 'editor' (direct paste) or 'chapters' (structured chapter cards)
  const [activeTab, setActiveTab] = useState<'editor' | 'chapters'>('editor');

  const [sections, setSections] = useState<ScriptSection[]>(DEFAULT_SCRIPT_SECTIONS);
  const [config, setConfig] = useState<TTSConfig>({
    voice: 'Charon',
    model: 'gemini-3.8-flash-lite-tts',
    style:
      '한국어 남성 내레이션. 묵직하고 깊은 초저음 동굴 보이스(low pitch). 침착하고 진중하며 긴장감을 주는 스토리텔링. 한 문장 한 문장을 무게감 있고 차분하게 천천히 전달.',
    silenceGapMs: 350,
    playbackSpeed: 1.0,
  });

  // Custom scripts collection
  const [scripts, setScripts] = useState<ScriptItem[]>(INITIAL_SCRIPTS);

  const [activeScriptId, setActiveScriptId] = useState<string>(
    INITIAL_SCRIPTS[0]?.id || 'script-1'
  );

  // Master audio state for Chapter Studio
  const [masterAudioBase64, setMasterAudioBase64] = useState<string | null>(null);
  const [masterDurationSec, setMasterDurationSec] = useState<number>(0);
  const [masterFileId, setMasterFileId] = useState<string | null>(null);

  // Active track loaded into the Audio Player
  const [activeTrack, setActiveTrack] = useState<{
    id: string; // 'master' or section id or script id
    title: string;
    subtitle?: string;
    audioBase64?: string;
    downloadUrl?: string;
    filename: string;
  }>({
    id: 'master',
    title: '한국어 비즈니스 컨설턴트 내레이션',
    subtitle: '스튜디오 오디오 플레이어',
    filename: '한국어_비즈니스_컨설턴트_내레이션.wav',
  });

  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);

  // Ensure any previous oversized localStorage cache is cleaned up to prevent QuotaExceededError
  useEffect(() => {
    try {
      localStorage.removeItem('narration_scripts_v1');
    } catch {}
  }, []);

  // Batch generation status
  const [batchProgress, setBatchProgress] = useState<GenerationProgress>({
    isGenerating: false,
    currentSectionIndex: 0,
    totalSections: sections.length,
    currentSectionTitle: '',
    percentage: 0,
  });

  // Insights / Script modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Computed summary metrics
  const totalCharacters = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.text.replace(/\s+/g, '').length, 0);
  }, [sections]);

  const completedSectionsCount = useMemo(() => {
    return sections.filter((s) => s.status === 'ready').length;
  }, [sections]);

  const fullScriptText = useMemo(() => {
    return sections
      .map((s) => `### 제${s.order}장: ${s.title}\n\n${s.text}`)
      .join('\n\n---\n\n');
  }, [sections]);

  // Handlers for scripts in memory (refreshing page clears all custom state as requested)
  // Handle saving an updated script item
  const handleSaveScript = (updated: ScriptItem) => {
    setScripts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleResetAllScripts = () => {
    setScripts(INITIAL_SCRIPTS);
    setActiveScriptId(INITIAL_SCRIPTS[1]?.id || INITIAL_SCRIPTS[0]?.id);
  };

  // Create new script round (e.g. 4차 대본, 5차 대본)
  const handleCreateNewScript = () => {
    const nextNumber = scripts.length + 1;
    const newScript: ScriptItem = {
      id: `script-round-${Date.now()}`,
      round: `${nextNumber}차 대본`,
      title: `${nextNumber}차 대본: 새로운 비즈니스 내레이션`,
      text: '',
      updatedAt: Date.now(),
    };
    setScripts((prev) => [...prev, newScript]);
    setActiveScriptId(newScript.id);
  };

  // Delete a script item
  const handleDeleteScript = (idToDelete: string) => {
    if (scripts.length <= 1) return;
    const remaining = scripts.filter((s) => s.id !== idToDelete);
    setScripts(remaining);
    setActiveScriptId(remaining[0].id);
  };

  // Play audio from CustomScriptEditor in the master player
  const handlePlayScriptAudio = (title: string, base64?: string, duration?: number, downloadUrl?: string) => {
    setActiveTrack({
      id: `script_${Date.now()}`,
      title,
      subtitle: duration ? `재생 시간: ${duration}초` : '직접 입력 대본 오디오',
      audioBase64: base64,
      downloadUrl: downloadUrl,
      filename: `${title.replace(/[\/\\?%*:|"<>]/g, '_')}.wav`,
    });
  };

  // Split text from CustomScriptEditor into chapters for Chapter Studio
  const handleSplitToChapters = (scriptTitle: string, fullText: string) => {
    const paragraphs = fullText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) return;

    const newSections: ScriptSection[] = paragraphs.map((para, index) => {
      const firstLine = para.split('\n')[0].substring(0, 30);
      return {
        id: `custom_sec_${Date.now()}_${index}`,
        order: index + 1,
        title: `${index + 1}단락: ${firstLine}...`,
        summary: `${para.length}자 · 예상 ${Math.round(para.length / 5.8)}초`,
        text: para,
        status: 'idle',
      };
    });

    setSections(newSections);
    setActiveTab('chapters');
  };

  // Update text of a section in Chapter Studio
  const handleUpdateSectionText = (sectionId: string, newText: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, text: newText, status: 'idle' } : s))
    );
  };

  // Play a specific section in the master audio player bar
  const handlePlaySection = (section: ScriptSection) => {
    if (!section.audioBase64) return;
    setActiveTrack({
      id: section.id,
      title: `제${section.order}장: ${section.title}`,
      subtitle: section.summary,
      audioBase64: section.audioBase64,
      downloadUrl: section.audioUrl,
      filename: `제${section.order}장_${section.title.replace(/[\/\\?%*:|"<>]/g, '_')}.wav`,
    });
  };

  // Switch player back to master audio
  const handlePlayMaster = () => {
    if (!masterAudioBase64) return;
    setActiveTrack({
      id: 'master',
      title: '한국어 비즈니스 컨설턴트 내레이션 (전체 완성본)',
      subtitle: `총 ${sections.length}개 챕터 연속 내레이션`,
      audioBase64: masterAudioBase64,
      downloadUrl: masterFileId ? `/api/tts/download/${masterFileId}` : undefined,
      filename: '한국어_비즈니스_컨설턴트_내레이션_완성본.wav',
    });
  };

  // Single section generation
  const handleGenerateSection = async (section: ScriptSection) => {
    setGlobalError(null);
    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, status: 'generating' } : s))
    );

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: section.text,
          voice: config.voice,
          model: config.model,
          style: config.style,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '음성 생성 실패');
      }

      setSections((prev) =>
        prev.map((s) =>
          s.id === section.id
            ? {
                ...s,
                status: 'ready',
                audioBase64: data.audioBase64,
                audioUrl: data.downloadUrl,
                fileId: data.fileId,
                durationSec: data.durationSec,
                fileSizeBytes: data.fileSizeBytes,
              }
            : s
        )
      );

      // Auto-load into player
      setActiveTrack({
        id: section.id,
        title: `제${section.order}장: ${section.title}`,
        subtitle: section.summary,
        audioBase64: data.audioBase64,
        downloadUrl: data.downloadUrl,
        filename: `제${section.order}장_${section.title.replace(/[\/\\?%*:|"<>]/g, '_')}.wav`,
      });
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.message || '섹션 음성 생성 실패');
      setSections((prev) =>
        prev.map((s) => (s.id === section.id ? { ...s, status: 'error', errorMessage: err.message } : s))
      );
    }
  };

  // Generate ALL sections & stitch master WAV in one click
  const handleGenerateAll = async () => {
    setGlobalError(null);
    setBatchProgress({
      isGenerating: true,
      currentSectionIndex: 0,
      totalSections: sections.length,
      currentSectionTitle: '전체 챕터 순차 음성 합성 시작...',
      percentage: 5,
    });

    setSections((prev) => prev.map((s) => ({ ...s, status: 'generating' })));

    try {
      const res = await fetch('/api/tts/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: sections.map((s) => ({
            id: s.id,
            title: s.title,
            text: s.text,
          })),
          voice: config.voice,
          model: config.model,
          style: config.style,
          silenceGapMs: config.silenceGapMs,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '전체 음성 생성 실패');
      }

      const returnedSectionsMap = new Map<string, any>(
        (data.sections || []).map((sec: any) => [sec.id, sec])
      );

      setSections((prev) =>
        prev.map((s) => {
          const match = returnedSectionsMap.get(s.id);
          if (match) {
            return {
              ...s,
              status: 'ready',
              audioBase64: match.audioBase64,
              durationSec: match.durationSec,
              fileSizeBytes: match.fileSizeBytes,
              fileId: match.fileId,
              audioUrl: `/api/tts/download/${match.fileId}`,
            };
          }
          return { ...s, status: 'ready' };
        })
      );

      setMasterAudioBase64(data.masterAudioBase64);
      setMasterDurationSec(data.totalDurationSec);
      setMasterFileId(data.masterFileId);

      setActiveTrack({
        id: 'master',
        title: '한국어 비즈니스 컨설턴트 내레이션 (전체 완성본)',
        subtitle: `${sections.length}개 챕터 완성 · 약 ${data.totalDurationSec}초`,
        audioBase64: data.masterAudioBase64,
        downloadUrl: data.masterDownloadUrl,
        filename: '한국어_남성_비즈니스_컨설턴트_내레이션_완성본.wav',
      });

      setBatchProgress({
        isGenerating: false,
        currentSectionIndex: sections.length,
        totalSections: sections.length,
        currentSectionTitle: '완료!',
        percentage: 100,
      });
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.message || '전체 음성 생성 중 오류가 발생했습니다.');
      setSections((prev) => prev.map((s) => (s.status === 'generating' ? { ...s, status: 'error' } : s)));
      setBatchProgress((prev) => ({ ...prev, isGenerating: false, error: err.message }));
    }
  };

  const handleDownloadMasterWav = () => {
    if (!masterAudioBase64) return;
    try {
      const binaryString = atob(masterAudioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '한국어_남성_비즈니스_컨설턴트_내레이션_완성본.wav';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download master WAV', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Top Header */}
      <Header
        totalChars={totalCharacters}
        totalSections={sections.length}
        completedSections={completedSectionsCount}
        hasMasterAudio={Boolean(masterAudioBase64)}
      />

      {/* Persistent Audio Player Bar */}
      <AudioPlayerBar
        title={activeTrack.title}
        subtitle={activeTrack.subtitle}
        audioBase64={activeTrack.audioBase64}
        downloadUrl={activeTrack.downloadUrl}
        defaultFilename={activeTrack.filename}
        playbackSpeed={config.playbackSpeed}
        onSpeedChange={(speed) => setConfig({ ...config, playbackSpeed: speed })}
        onPlaybackStateChange={setIsAudioPlaying}
      />

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Global Error Notice */}
        {globalError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{globalError}</span>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="text-xs text-rose-400 hover:text-white px-2 py-1 rounded bg-rose-500/20"
            >
              닫기
            </button>
          </div>
        )}

        {/* Studio Mode Navigation Switcher: Direct Editor vs Chapter View */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm ${
                activeTab === 'editor'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <PenTool className="w-4 h-4 text-amber-300" />
              <span>✍️ 대본 직접 입력 및 음성 생성</span>
            </button>

            <button
              onClick={() => setActiveTab('chapters')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm ${
                activeTab === 'chapters'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4 text-sky-300" />
              <span>📑 챕터별 구조화 스튜디오 ({sections.length}챕터)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 w-full sm:w-auto justify-end pr-2">
            <span className="hidden md:inline">현재 선택 보이스:</span>
            <span className="font-semibold text-slate-200 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
              {VOICE_OPTIONS.find((v) => v.id === config.voice)?.name || config.voice}
            </span>
          </div>
        </div>

        {/* TTS Voice Persona & Settings Deck */}
        <TTSConfigPanel config={config} onChange={setConfig} />

        {/* TAB 1: CUSTOM SCRIPT DIRECT INPUT (2차, 3차 대본) */}
        {activeTab === 'editor' && (
          <CustomScriptEditor
            config={config}
            scripts={scripts}
            activeScriptId={activeScriptId}
            isAudioPlaying={isAudioPlaying}
            onSelectScript={setActiveScriptId}
            onSaveScript={handleSaveScript}
            onCreateNewScript={handleCreateNewScript}
            onDeleteScript={handleDeleteScript}
            onResetAll={handleResetAllScripts}
            onSplitToChapters={handleSplitToChapters}
            onPlayAudio={handlePlayScriptAudio}
          />
        )}

        {/* TAB 2: STRUCTURED CHAPTER STUDIO VIEW */}
        {activeTab === 'chapters' && (
          <div className="space-y-6">
            
            {/* Chapter Hero Banner */}
            <div className="relative rounded-3xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl overflow-hidden">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                    <span>챕터별 정밀 편집 및 마스터 음성 합성</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                    챕터별 대본 관리 및 원클릭 전체 음성 완성
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    각 챕터를 개별 청취·수정하거나, 전체 챕터를 공백 간격을 두고 하나의 단일 스튜디오 WAV 파일로 합성할 수 있습니다.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>총 {sections.length}개 챕터</span>
                    </div>
                    <span>·</span>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>약 3분 40초 내외</span>
                    </div>
                    <span>·</span>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{totalCharacters.toLocaleString()}자</span>
                    </div>
                  </div>
                </div>

                {/* Chapter Action Buttons */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                  <button
                    onClick={handleGenerateAll}
                    disabled={batchProgress.isGenerating}
                    className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-xl ${
                      batchProgress.isGenerating
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:from-indigo-400 hover:to-cyan-300 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02]'
                    }`}
                  >
                    {batchProgress.isGenerating ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>전체 음성 생성 진행 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>전체 챕터 음성 한번에 생성 (WAV)</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadMasterWav}
                      disabled={!masterAudioBase64}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition border ${
                        masterAudioBase64
                          ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-lg shadow-emerald-950/40'
                          : 'bg-slate-900/80 text-slate-500 border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>마스터 WAV 다운로드</span>
                    </button>

                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      <span>대본 가이드</span>
                    </button>
                  </div>

                  {masterAudioBase64 && (
                    <button
                      onClick={handlePlayMaster}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-300 bg-sky-950/50 border border-sky-800 hover:bg-sky-900/50 transition"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>플레이어에 마스터 트랙 로드 ({masterDurationSec}초)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {batchProgress.isGenerating && (
                <div className="mt-6 pt-5 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-300 font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span>전체 챕터 음성 합성 진행 중...</span>
                    </span>
                    <span className="text-cyan-400 font-mono font-bold">
                      {completedSectionsCount} / {sections.length} 완료
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-cyan-300 transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.max(8, (completedSectionsCount / sections.length) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Chapter Cards List */}
            <div className="space-y-4">
              {sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isCurrentlyPlaying={activeTrack.id === section.id}
                  onPlaySection={handlePlaySection}
                  onGenerateSection={handleGenerateSection}
                  onUpdateText={handleUpdateSectionText}
                />
              ))}
            </div>

          </div>
        )}

        {/* Footer info */}
        <footer className="pt-8 pb-12 border-t border-slate-800/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>한국어 남성 비즈니스 컨설턴트 내레이션 전용 파이프라인 (Gemini 3.8 Flash TTS)</span>
          </div>
          <div>
            <span>출력 포맷: WAV 24,000Hz 16-bit Mono PCM (방송/유튜브/팟캐스트 완벽 호환)</span>
          </div>
        </footer>

      </main>

      {/* Script Insights / Full Text Modal */}
      <ScriptInsightsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        fullScriptText={fullScriptText}
      />
    </div>
  );
}
