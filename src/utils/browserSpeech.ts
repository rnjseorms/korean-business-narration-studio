export interface BrowserVoiceConfig {
  voiceName?: string;
  persona?: 'Charon' | 'Fenrir' | 'Puck' | string;
  rate?: number;
  pitch?: number;
}

export function getAvailableKoreanVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  return voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.includes('ko') || lang.includes('kr') || name.includes('korean') || name.includes('한국');
  });
}

export function playBrowserTTS(
  text: string,
  options?: {
    voiceName?: string;
    persona?: string;
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): { cancel: () => void } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onError?.(new Error('현재 브라우저에서 Web Speech API를 지원하지 않습니다.'));
    return { cancel: () => {} };
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';

  // Customize pitch and rate according to selected persona
  let pitch = options?.pitch ?? 0.88;
  let rate = options?.rate ?? 0.92;

  if (options?.persona === 'Charon') {
    // 차분하고 신뢰감 있는 중저음 비즈니스 컨설턴트
    pitch = 0.82;
    rate = 0.92;
  } else if (options?.persona === 'Fenrir') {
    // 묵직하고 권위 있는 톤
    pitch = 0.75;
    rate = 0.95;
  } else if (options?.persona === 'Puck') {
    // 밝고 경쾌한 프레젠터 톤
    pitch = 1.05;
    rate = 1.05;
  }

  utterance.pitch = pitch;
  utterance.rate = rate;

  const koreanVoices = getAvailableKoreanVoices();
  if (koreanVoices.length > 0) {
    let chosenVoice: SpeechSynthesisVoice | undefined;

    // 1. If explicit voice name passed
    if (options?.voiceName) {
      chosenVoice = koreanVoices.find((v) => v.name === options.voiceName);
    }

    // 2. Otherwise find best match for persona (look for male voices if Charon/Fenrir)
    if (!chosenVoice) {
      const isMalePersona = options?.persona === 'Charon' || options?.persona === 'Fenrir';
      if (isMalePersona) {
        chosenVoice = koreanVoices.find(
          (v) =>
            v.name.includes('InJoon') ||
            v.name.includes('인준') ||
            v.name.includes('Male') ||
            v.name.includes('남성') ||
            v.name.includes('Minho') ||
            v.name.includes('민호')
        );
      }
    }

    // 3. Fallback to Google / Natural or first available
    if (!chosenVoice) {
      chosenVoice =
        koreanVoices.find((v) => v.name.includes('Natural') || v.name.includes('Google')) ||
        koreanVoices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }
  }

  utterance.onstart = () => {
    options?.onStart?.();
  };

  utterance.onend = () => {
    options?.onEnd?.();
  };

  utterance.onerror = (e) => {
    options?.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);

  return {
    cancel: () => {
      window.speechSynthesis.cancel();
    },
  };
}

export function stopBrowserTTS() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
