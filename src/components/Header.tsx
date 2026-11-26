import React from 'react';
import { Headphones, Sparkles, Volume2 } from 'lucide-react';
import { BsdLogo } from './BsdLogo';

interface HeaderProps {
  totalChars: number;
  totalSections: number;
  completedSections: number;
  hasMasterAudio: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  totalChars,
  totalSections,
  completedSections,
  hasMasterAudio,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand Logo (User's BSD Logo) & Studio Subtitle */}
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <BsdLogo height={36} className="h-9 w-auto hover:opacity-95 transition" />
            </div>

            <div className="hidden sm:block border-l border-slate-800 pl-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                  내레이션 TTS 스튜디오
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                한국어 남성 비즈니스 컨설턴트 톤 · 24kHz 스튜디오 WAV 음성 생성
              </p>
            </div>
          </div>

          {/* Quick Specifications / Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">엔진:</span>
              <span className="font-semibold text-slate-200">Gemini 3.8 Flash TTS</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <Headphones className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">포맷:</span>
              <span className="font-semibold text-slate-200">24kHz 16-bit WAV</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">진행률:</span>
              <span className="font-semibold text-emerald-400">
                {completedSections} / {totalSections} 챕터
              </span>
              {hasMasterAudio && (
                <span className="inline-flex items-center text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40 ml-1">
                  마스터 완성
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
