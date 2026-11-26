export interface ScriptSection {
  id: string;
  order: number;
  title: string;
  summary: string;
  text: string;
  audioBase64?: string;
  audioUrl?: string;
  fileId?: string;
  durationSec?: number;
  fileSizeBytes?: number;
  status: 'idle' | 'generating' | 'ready' | 'error';
  errorMessage?: string;
}

export interface TTSVoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  toneDesc: string;
  characterDesc: string;
  badge: string;
}

export interface TTSConfig {
  voice: string;
  model: 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';
  style: string;
  silenceGapMs: number;
  playbackSpeed: number;
}

export interface GenerationProgress {
  isGenerating: boolean;
  currentSectionIndex: number;
  totalSections: number;
  currentSectionTitle: string;
  percentage: number;
  error?: string;
}
