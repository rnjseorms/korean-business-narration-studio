import React, { useState } from 'react';
import { PHONETIC_OPTIMIZATION_POINTS } from '../data/defaultScript';
import { FileText, Copy, Check, Download, X, HelpCircle, CheckCircle2 } from 'lucide-react';

interface ScriptInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullScriptText: string;
}

export const ScriptInsightsModal: React.FC<ScriptInsightsModalProps> = ({
  isOpen,
  onClose,
  fullScriptText,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullScriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([fullScriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '한국어_비즈니스_컨설턴트_내레이션_대본.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">TTS 최적화 대본 및 음성 변환 가이드</h2>
              <p className="text-xs text-slate-400">자연스러운 한국어 남성 비즈니스 컨설턴트 구어체 반영 원리</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          
          {/* Phonetic Optimization Points */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <span>TTS 발음 최적화 적용 포인트</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PHONETIC_OPTIMIZATION_POINTS.map((pt, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-rose-400 line-through">{pt.original}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {pt.phonetic}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{pt.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Full Script Viewer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                전체 대본 전문 (Plain Text)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '복사 완료' : '전체 복사'}</span>
                </button>
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.txt 다운로드</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-sans text-xs text-slate-300 whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto select-all">
              {fullScriptText}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
