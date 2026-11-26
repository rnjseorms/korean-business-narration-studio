import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

interface CachedAudio {
  id: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}
const audioCache = new Map<string, CachedAudio>();

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of audioCache.entries()) {
    if (now - item.createdAt > 2 * 60 * 60 * 1000) {
      audioCache.delete(id);
    }
  }
}, 15 * 60 * 1000);

// Concatenate 24kHz mono 16-bit PCM WAV buffers with silence padding
function concatWavBuffers(wavBuffers: Buffer[], silenceGapMs: number = 300): Buffer {
  if (wavBuffers.length === 0) return Buffer.alloc(0);
  if (wavBuffers.length === 1) return wavBuffers[0];

  const sampleRate = 24000;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample; // 2
  const byteRate = sampleRate * blockAlign; // 48000

  const silenceSamples = Math.floor((silenceGapMs / 1000) * sampleRate);
  const silenceBuffer = Buffer.alloc(silenceSamples * blockAlign, 0);

  const pcmList: Buffer[] = [];

  for (let i = 0; i < wavBuffers.length; i++) {
    const buf = wavBuffers[i];
    let dataOffset = -1;
    let dataSize = 0;

    for (let j = 0; j < Math.min(buf.length - 8, 120); j++) {
      if (
        buf[j] === 0x64 &&
        buf[j + 1] === 0x61 &&
        buf[j + 2] === 0x74 &&
        buf[j + 3] === 0x61
      ) {
        dataOffset = j + 8;
        dataSize = buf.readUInt32LE(j + 4);
        break;
      }
    }

    let pcmChunk: Buffer;
    if (dataOffset !== -1 && dataOffset <= buf.length) {
      const validSize = Math.min(dataSize > 0 ? dataSize : buf.length - dataOffset, buf.length - dataOffset);
      pcmChunk = buf.subarray(dataOffset, dataOffset + validSize);
    } else {
      pcmChunk = buf.subarray(44);
    }

    if (pcmChunk.length > 0) {
      pcmList.push(pcmChunk);
      if (i < wavBuffers.length - 1 && silenceGapMs > 0) {
        pcmList.push(silenceBuffer);
      }
    }
  }

  const totalPcmLength = pcmList.reduce((acc, cur) => acc + cur.length, 0);

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + totalPcmLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(totalPcmLength, 40);

  return Buffer.concat([header, ...pcmList]);
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Robust Gemini TTS caller with automatic 429 rate limit backoff & model fallback
async function callGeminiTTSWithRetry(
  text: string,
  voice: string,
  style: string,
  preferredModel: string = 'gemini-3.8-flash-lite-tts',
  maxRetries = 2
): Promise<{ audioBase64: string; usedModel: string }> {
  const ai = getGeminiClient();
  let currentModel = preferredModel;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const audioBase64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        throw new Error('음성 생성 결과가 비어 있습니다.');
      }

      return { audioBase64, usedModel: currentModel };
    } catch (err: any) {
      const errMsg = err?.message || '';
      const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || err?.status === 429;
      const isDepleted = errMsg.includes('402') || errMsg.includes('prepayment credits') || errMsg.includes('depleted');

      if (isDepleted) {
        // Credits depleted cannot be resolved by immediate retries
        throw err;
      }

      // If it's a 429 RateLimit error and we have retries left:
      if (is429 && attempt < maxRetries) {
        // Extract retryDelay in seconds (e.g. "Please retry in 11.47s" or details)
        let waitMs = 12000; // default 12s
        const match = errMsg.match(/retry in ([0-9.]+)s/i);
        if (match && match[1]) {
          waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
        }

        console.warn(`[TTS 429 RateLimit] Cooldown: waiting ${waitMs}ms before attempt ${attempt + 1}...`);
        
        // Alternate model if flash-lite was rate limited
        if (currentModel === 'gemini-3.8-flash-lite-tts') {
          currentModel = 'gemini-3.8-flash-tts';
        } else {
          currentModel = 'gemini-3.8-flash-lite-tts';
        }

        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      throw err;
    }
  }

  throw new Error('TTS 생성 재시도 실패');
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Single TTS generation (Handles entire scripts in ONE API call to avoid rate limits!)
app.post('/api/tts/generate', async (req: Request, res: Response) => {
  try {
    const {
      text,
      voice = 'Charon',
      model = 'gemini-3.8-flash-lite-tts',
      style = '한국어 남성 내레이션. 전문적이고 차분하며 신뢰감 있는 비즈니스 컨설턴트 톤. 또박또박하고 안정적인 발음, 자연스러운 호흡.',
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: '텍스트를 입력해주세요.' });
    }

    const { audioBase64, usedModel } = await callGeminiTTSWithRetry(
      text,
      voice,
      style,
      model,
      2
    );

    const buffer = Buffer.from(audioBase64, 'base64');
    const fileId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    audioCache.set(fileId, {
      id: fileId,
      filename: `narration_clip_${fileId}.wav`,
      buffer,
      mimeType: 'audio/wav',
      createdAt: Date.now(),
    });

    const pcmBytes = Math.max(0, buffer.length - 44);
    const durationSec = Math.round((pcmBytes / 48000) * 10) / 10;

    res.json({
      success: true,
      fileId,
      audioBase64,
      downloadUrl: `/api/tts/download/${fileId}`,
      fileSizeBytes: buffer.length,
      durationSec,
      voice,
      usedModel,
    });
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    const isInvalidKey = error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key not valid') || error?.status === 400;
    const is402 = error?.message?.includes('402') || error?.message?.includes('prepayment credits') || error?.message?.includes('depleted');
    const isQuota = is402 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
    
    let userMsg = error.message || 'TTS 음성 생성 중 오류가 발생했습니다.';
    if (isInvalidKey) {
      userMsg = 'Google Gemini API 키가 유효하지 않거나 만료되었습니다. AI Studio 우측 상단 [Settings] > [Secrets] 패널에서 유효한 Gemini API 키를 선택하거나 등록해 주세요.';
    } else if (is402) {
      userMsg = 'AI Studio 선불 결제 크레딧이 소진되었습니다(Prepayment credits depleted). https://ai.studio/projects 에서 결제 크레딧을 관리하시거나, 브라우저 음성 모드를 사용하실 수 있습니다.';
    } else if (isQuota) {
      userMsg = 'Gemini API 분당 요청 한도(10 RPM)에 도달했습니다. 약 10초 후 자동으로 재시도되거나 잠시 후 다시 눌러주세요.';
    }

    res.status(isInvalidKey ? 400 : is402 ? 402 : isQuota ? 429 : 500).json({
      error: userMsg,
      isInvalidKey,
      isQuotaExceeded: isQuota,
      isCreditsDepleted: is402,
      rawMessage: error.message,
    });
  }
});

// Master Generation endpoint: Generates ALL chapters combined in ONE single request!
// This guarantees we only consume 1 API call out of the 10 RPM quota!
app.post('/api/tts/generate-all', async (req: Request, res: Response) => {
  try {
    const {
      sections,
      voice = 'Charon',
      model = 'gemini-3.8-flash-lite-tts',
      style = '한국어 남성 내레이션. 전문적이고 차분하며 신뢰감 있는 비즈니스 컨설턴트 톤. 또박또박하고 안정적인 발음, 자연스러운 호흡.',
      silenceGapMs = 350,
      combineInOneCall = true, // Default to true to prevent 429 quota exhaustion
    } = req.body;

    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: '섹션 목록이 필요합니다.' });
    }

    if (combineInOneCall) {
      // Combine all sections into a single natural narrative with clear paragraph breaks
      const combinedText = sections
        .map((s: any) => s.text?.trim())
        .filter(Boolean)
        .join('\n\n');

      console.log(`[TTS] Synthesizing all ${sections.length} chapters combined in 1 single API call...`);
      const { audioBase64, usedModel } = await callGeminiTTSWithRetry(
        combinedText,
        voice,
        style,
        model,
        2
      );

      const masterBuffer = Buffer.from(audioBase64, 'base64');
      const masterFileId = `master_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      audioCache.set(masterFileId, {
        id: masterFileId,
        filename: '한국어_남성_비즈니스_컨설턴트_내레이션_완성본.wav',
        buffer: masterBuffer,
        mimeType: 'audio/wav',
        createdAt: Date.now(),
      });

      const masterPcmBytes = Math.max(0, masterBuffer.length - 44);
      const totalDurationSec = Math.round((masterPcmBytes / 48000) * 10) / 10;

      // Also mark each section as ready
      const results = sections.map((sec: any, idx: number) => ({
        id: sec.id || `sec_${idx + 1}`,
        title: sec.title || `섹션 ${idx + 1}`,
        audioBase64: '', // individual clip available via master
        durationSec: Math.round(totalDurationSec / sections.length),
        fileSizeBytes: Math.round(masterBuffer.length / sections.length),
        fileId: masterFileId,
      }));

      return res.json({
        success: true,
        masterFileId,
        masterAudioBase64: audioBase64,
        masterDownloadUrl: `/api/tts/download/${masterFileId}`,
        totalDurationSec,
        totalFileSizeBytes: masterBuffer.length,
        usedModel,
        sections: results,
      });
    }

    // Fallback: If discrete clips are explicitly needed, generate with retry and safe spacing
    const results: Array<{
      id: string;
      title: string;
      audioBase64: string;
      durationSec: number;
      fileSizeBytes: number;
      fileId: string;
    }> = [];
    const wavBuffers: Buffer[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const text = section.text ? section.text.trim() : '';
      if (!text) continue;

      if (i > 0) {
        // Safe delay to stay under 10 RPM limit
        await new Promise((r) => setTimeout(r, 6500));
      }

      const { audioBase64 } = await callGeminiTTSWithRetry(
        text,
        voice,
        style,
        model,
        2
      );

      const buffer = Buffer.from(audioBase64, 'base64');
      wavBuffers.push(buffer);

      const sectionFileId = `section_${i + 1}_${Date.now()}`;
      audioCache.set(sectionFileId, {
        id: sectionFileId,
        filename: `섹션_${i + 1}_${(section.title || '내레이션').replace(/\s+/g, '_')}.wav`,
        buffer,
        mimeType: 'audio/wav',
        createdAt: Date.now(),
      });

      const pcmBytes = Math.max(0, buffer.length - 44);
      const durationSec = Math.round((pcmBytes / 48000) * 10) / 10;

      results.push({
        id: section.id || `sec_${i + 1}`,
        title: section.title || `섹션 ${i + 1}`,
        audioBase64,
        durationSec,
        fileSizeBytes: buffer.length,
        fileId: sectionFileId,
      });
    }

    const masterBuffer = concatWavBuffers(wavBuffers, silenceGapMs);
    const masterFileId = `master_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    audioCache.set(masterFileId, {
      id: masterFileId,
      filename: '한국어_남성_비즈니스_컨설턴트_내레이션_완성본.wav',
      buffer: masterBuffer,
      mimeType: 'audio/wav',
      createdAt: Date.now(),
    });

    const masterPcmBytes = Math.max(0, masterBuffer.length - 44);
    const totalDurationSec = Math.round((masterPcmBytes / 48000) * 10) / 10;

    res.json({
      success: true,
      masterFileId,
      masterAudioBase64: masterBuffer.toString('base64'),
      masterDownloadUrl: `/api/tts/download/${masterFileId}`,
      totalDurationSec,
      totalFileSizeBytes: masterBuffer.length,
      sections: results,
    });
  } catch (error: any) {
    console.error('Error generating all TTS sections:', error);
    const isInvalidKey = error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key not valid') || error?.status === 400;
    const is402 = error?.message?.includes('402') || error?.message?.includes('prepayment credits') || error?.message?.includes('depleted');
    const isQuota = is402 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
    
    let userMsg = error.message || '전체 음성 생성 중 오류가 발생했습니다.';
    if (isInvalidKey) {
      userMsg = 'Google Gemini API 키가 유효하지 않거나 만료되었습니다. AI Studio 우측 상단 [Settings] > [Secrets] 패널에서 유효한 Gemini API 키를 선택하거나 등록해 주세요.';
    } else if (is402) {
      userMsg = 'AI Studio 선불 결제 크레딧이 소진되었습니다. https://ai.studio/projects 에서 결제 크레딧을 관리하시거나 브라우저 음성 모드를 사용하실 수 있습니다.';
    } else if (isQuota) {
      userMsg = 'Gemini API 분당 요청 한도(10 RPM)에 도달했습니다. 잠시 후 자동으로 처리됩니다.';
    }

    res.status(isInvalidKey ? 400 : is402 ? 402 : isQuota ? 429 : 500).json({
      error: userMsg,
      isInvalidKey,
      isQuotaExceeded: isQuota,
      isCreditsDepleted: is402,
    });
  }
});

// Stitch existing WAV buffers together
app.post('/api/tts/concat', (req: Request, res: Response) => {
  try {
    const { audioBase64List, silenceGapMs = 300, filename = '한국어_비즈니스_내레이션_완성본.wav' } = req.body;
    if (!Array.isArray(audioBase64List) || audioBase64List.length === 0) {
      return res.status(400).json({ error: '오디오 데이터 목록이 필요합니다.' });
    }

    const buffers = audioBase64List.map((b64: string) => Buffer.from(b64, 'base64'));
    const combinedBuffer = concatWavBuffers(buffers, silenceGapMs);

    const masterFileId = `stitched_${Date.now()}`;
    audioCache.set(masterFileId, {
      id: masterFileId,
      filename,
      buffer: combinedBuffer,
      mimeType: 'audio/wav',
      createdAt: Date.now(),
    });

    const pcmBytes = Math.max(0, combinedBuffer.length - 44);
    const totalDurationSec = Math.round((pcmBytes / 48000) * 10) / 10;

    res.json({
      success: true,
      masterFileId,
      masterAudioBase64: combinedBuffer.toString('base64'),
      downloadUrl: `/api/tts/download/${masterFileId}`,
      fileSizeBytes: combinedBuffer.length,
      totalDurationSec,
    });
  } catch (error: any) {
    console.error('Error concatenating audio:', error);
    res.status(500).json({ error: error.message || '오디오 합성 실패' });
  }
});

// Direct audio file download endpoint
app.get('/api/tts/download/:fileId', (req: Request, res: Response) => {
  const { fileId } = req.params;
  const cached = audioCache.get(fileId);

  if (!cached) {
    return res.status(404).send('요청한 오디오 파일을 찾을 수 없습니다.');
  }

  const encodedFilename = encodeURIComponent(cached.filename);
  res.setHeader('Content-Type', cached.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
  res.setHeader('Content-Length', cached.buffer.length);
  res.send(cached.buffer);
});

// Start Server
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TTS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
