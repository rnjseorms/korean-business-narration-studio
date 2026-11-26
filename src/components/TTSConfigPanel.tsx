import React, { useState, useRef } from 'react';
import { TTSConfig } from '../types';
import { VOICE_OPTIONS, STYLE_PRESETS } from '../data/defaultScript';
import { Sliders, Sparkles, User, Info, Check, Volume2, Shield, Play, Pause, Loader2 } from 'lucide-react';

interface TTSConfigPanelProps {
  config: TTSConfig;
  onChange: (newConfig: TTSConfig) => void;
}

export const TTSConfigPanel: React.FC<TTSConfigPanelProps> = ({ config, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomStyle, setIsCustomStyle] = useState(false);
  const [playingVoiceSample, setPlayingVoiceSample] = useState<string | null>(null);
  const [loadingVoiceSample, setLoadingVoiceSample] = useState<string | null>(null);
  const audioSampleRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoice = VOICE_OPTIONS.find((v) => v.id === config.voice) || VOICE_OPTIONS[0];

  const handleVoiceSelect = (voiceId: string) => {
    const chosen = VOICE_OPTIONS.find((v) => v.id === voiceId);
    let nextStyle = config.style;
    if (chosen?.gender === 'female' && config.style.includes('남성')) {
      nextStyle = STYLE_PRESETS[1].value; // 여성 수석 컨설턴트
    } else if (chosen?.gender === 'male' && config.style.includes('여성')) {
      nextStyle = STYLE_PRESETS[0].value; // 중저음 신뢰톤
    }
    onChange({ ...config, voice: voiceId, style: nextStyle });
  };

  const handlePlayVoiceSample = async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card select

    if (playingVoiceSample === voiceId) {
      if (audioSampleRef.current) {
        audioSampleRef.current.pause();
      }
      setPlayingVoiceSample(null);
      return;
    }

    try {
      setLoadingVoiceSample(voiceId);

      // Instant pre-rendered samples
      const prebuiltMap: Record<string, string> = {
        Charon: '/sample_male_charon.wav',
        Fenrir: '/sample_male_fenrir.wav',
        Puck: '/sample_male_puck.wav',
        Kore: '/sample_female_kore.wav',
        Aoede: '/sample_female_aoede.wav',
        Leda: '/sample_female_leda.wav',
      };

      if (prebuiltMap[voiceId]) {
        if (audioSampleRef.current) {
          audioSampleRef.current.pause();
        }
        const audio = new Audio(prebuiltMap[voiceId]);
        audioSampleRef.current = audio;
        audio.onended = () => {
          setPlayingVoiceSample(null);
        };
        await audio.play();
        setPlayingVoiceSample(voiceId);
        handleVoiceSelect(voiceId);
        setLoadingVoiceSample(null);
        return;
      }

      const sampleText =
        voiceId === 'Charon'
          ? '안녕하십니까. 중저음 신뢰톤 내레이터입니다. 고객의 전환 흐름과 핵심 가치를 함께 점검해 드립니다.'
          : voiceId === 'Fenrir'
          ? '안녕하십니까. 펜리르 비즈니스 내레이터입니다. 명확하고 신뢰감 있는 스피치를 전해드립니다.'
          : voiceId === 'Kore'
          ? '안녕하십니까. 여성 수석 컨설턴트 코레입니다. 비즈니스 전략과 브랜드 스피치를 안내해 드립니다.'
          : voiceId === 'Aoede'
          ? '안녕하세요. 아오이데입니다. 따뜻하고 진솔한 호소력으로 브랜드 스토리를 전해드립니다.'
          : voiceId === 'Leda'
          ? '안녕하십니까. 프리미엄 앰버서더 레다입니다. 정돈되고 품격 있는 내레이션을 제공합니다.'
          : '안녕하세요! 퍽 프레젠터입니다. 빠르고 스마트한 피칭과 친근한 가이드를 전해드립니다.';

      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voice: voiceId,
          model: config.model,
          style: config.style,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || '샘플 생성 실패');
      }

      if (audioSampleRef.current) {
        audioSampleRef.current.pause();
      }

      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      audioSampleRef.current = audio;

      audio.onended = () => {
        setPlayingVoiceSample(null);
      };

      await audio.play();
      setPlayingVoiceSample(voiceId);
      handleVoiceSelect(voiceId);
    } catch (err) {
      console.error('Failed to play sample:', err);
    } finally {
      setLoadingVoiceSample(null);
    }
  };

  const handleStyleSelect = (presetValue: string) => {
    setIsCustomStyle(false);
    onChange({ ...config, style: presetValue });
  };

  const handleCustomStyleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...config, style: e.target.value });
  };

  const maleVoices = VOICE_OPTIONS.filter((v) => v.gender === 'male');
  const femaleVoices = VOICE_OPTIONS.filter((v) => v.gender === 'female');

  const renderVoiceCard = (voice: (typeof VOICE_OPTIONS)[0]) => {
    const isSelected = config.voice === voice.id;
    const isPlayingSample = playingVoiceSample === voice.id;
    const isLoadingSample = loadingVoiceSample === voice.id;
    const isFemale = voice.gender === 'female';

    return (
      <div
        key={voice.id}
        onClick={() => handleVoiceSelect(voice.id)}
        className={`p-3.5 rounded-xl border transition relative overflow-hidden flex flex-col justify-between cursor-pointer ${
          isSelected
            ? isFemale
              ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500/50 shadow-lg shadow-rose-950/50'
              : 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-950/50'
            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <User
                className={`w-4 h-4 ${
                  isSelected
                    ? isFemale
                      ? 'text-rose-400'
                      : 'text-indigo-400'
                    : 'text-slate-500'
                }`}
              />
              <span className="font-bold text-sm text-white">{voice.name}</span>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isSelected
                  ? isFemale
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {voice.badge}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-300 line-clamp-1">{voice.toneDesc}</p>
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {voice.characterDesc}
          </p>
        </div>

        {/* Sample playback button right on the card */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={(e) => handlePlayVoiceSample(voice.id, e)}
            disabled={isLoadingSample}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
              isPlayingSample
                ? isFemale
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-sky-500 text-white animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={`${voice.name} 실제 AI 목소리 샘플 듣기`}
          >
            {isLoadingSample ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                <span>로딩...</span>
              </>
            ) : isPlayingSample ? (
              <>
                <Pause className="w-3 h-3 fill-current" />
                <span>정지</span>
              </>
            ) : (
              <>
                <Play
                  className={`w-3 h-3 fill-current ml-0.5 ${
                    isFemale ? 'text-rose-400' : 'text-sky-400'
                  }`}
                />
                <span>목소리 샘플 듣기</span>
              </>
            )}
          </button>

          {isSelected ? (
            <span
              className={`flex items-center gap-1 text-[11px] font-semibold ${
                isFemale ? 'text-rose-300' : 'text-indigo-300'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${isFemale ? 'text-rose-400' : 'text-indigo-400'}`} />
              <span>선택됨</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">클릭하여 선택</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Top Bar / Header of Settings */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>내레이션 음성 & 톤 설정</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  selectedVoice.gender === 'female'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-sky-500/15 text-sky-400 border-sky-500/25'
                }`}
              >
                {selectedVoice.gender === 'female'
                  ? '👩 여성 비즈니스 내레이터'
                  : '👨 남성 비즈니스 내레이터'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              현재 선택 보이스: <strong className="text-slate-200">{selectedVoice.name}</strong> · {selectedVoice.toneDesc}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 self-start sm:self-auto py-1 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 transition"
        >
          <span>{isOpen ? '설정 접기' : '상세 옵션 조절'}</span>
        </button>
      </div>

      {/* Voice Selection Cards: Male Voices followed by Female Voices below */}
      <div className="mt-4 space-y-4">
        {/* GROUP 1: 남성 내레이터 (3명) */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-1">
              <span>👨 한국인 남성 내레이터 (3명)</span>
            </span>
            <span className="text-[11px] text-slate-400">
              중저음 신뢰톤 · 비즈니스 수석 컨설턴트 · 스타트업 프레젠터
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {maleVoices.map(renderVoiceCard)}
          </div>
        </div>

        {/* GROUP 2: 여성 내레이터 (3명) - 남성음성 바로 아래 표시 */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1">
              <span>👩 한국인 여성 내레이터 (3명)</span>
            </span>
            <span className="text-[11px] text-slate-400">
              지적이고 단정한 수석 컨설턴트 · 차분한 스토리텔러 · 세련된 브랜드 앰버서더
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {femaleVoices.map(renderVoiceCard)}
          </div>
        </div>
      </div>

      {/* Expanded Details Section */}
      {isOpen && (
        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-200">
          
          {/* Tone Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              내레이션 연출 톤 (Speech Metadata Directive)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STYLE_PRESETS.map((preset) => {
                const isActive = !isCustomStyle && config.style === preset.value;
                return (
                  <button
                    key={preset.label}
                    onClick={() => handleStyleSelect(preset.value)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition ${
                      isActive
                        ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-slate-200 mb-0.5">{preset.label}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-2">{preset.value}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Directive Input */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400">직접 지시문 편집</span>
                {!isCustomStyle && (
                  <button
                    onClick={() => setIsCustomStyle(true)}
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    수정하기
                  </button>
                )}
              </div>
              <textarea
                value={config.style}
                onChange={handleCustomStyleChange}
                rows={2}
                className="w-full text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Model Engine & Inter-section Pause */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Gemini 음성 합성 모델
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onChange({ ...config, model: 'gemini-3.8-flash-lite-tts' })}
                  className={`flex-1 p-2 rounded-lg border text-xs text-center transition ${
                    config.model === 'gemini-3.8-flash-lite-tts'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Flash Lite TTS (초고속 권장)
                </button>
                <button
                  onClick={() => onChange({ ...config, model: 'gemini-3.8-flash-tts' })}
                  className={`flex-1 p-2 rounded-lg border text-xs text-center transition ${
                    config.model === 'gemini-3.8-flash-tts'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Flash TTS (정밀 연출)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex justify-between">
                <span>섹션 간 자연스러운 묵음 간격 (Gap)</span>
                <span className="text-sky-400 font-mono">{config.silenceGapMs} ms</span>
              </label>
              <input
                type="range"
                min={150}
                max={750}
                step={50}
                value={config.silenceGapMs}
                onChange={(e) => onChange({ ...config, silenceGapMs: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>짧은 호흡 (150ms)</span>
                <span>스튜디오 기본 (350ms)</span>
                <span>여유 있는 호흡 (750ms)</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
