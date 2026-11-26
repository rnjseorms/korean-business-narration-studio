import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Download,
  FileAudio,
} from 'lucide-react';

interface AudioPlayerBarProps {
  title: string;
  subtitle?: string;
  audioBase64?: string;
  downloadUrl?: string;
  defaultFilename?: string;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  title,
  subtitle,
  audioBase64,
  downloadUrl,
  defaultFilename = 'korean_narration.wav',
  playbackSpeed,
  onSpeedChange,
  onPlaybackStateChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

  // Notify parent of playback state
  useEffect(() => {
    onPlaybackStateChange?.(isPlaying);
  }, [isPlaying, onPlaybackStateChange]);

  // Convert base64 or downloadUrl to playable audio URL safely without breaking playback
  useEffect(() => {
    if (!audioBase64 && !downloadUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setAudioBlobUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      let newUrl = '';

      if (audioBase64) {
        const binaryString = atob(audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/wav' });
        newUrl = URL.createObjectURL(blob);
      } else if (downloadUrl) {
        newUrl = downloadUrl;
      }

      // Clean up previous blob URL safely with a delay so ongoing decoder doesn't crash
      const oldUrl = currentBlobUrlRef.current;
      if (oldUrl && oldUrl.startsWith('blob:') && oldUrl !== newUrl) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(oldUrl);
          } catch {}
        }, 2000);
      }

      currentBlobUrlRef.current = newUrl;
      setAudioBlobUrl(newUrl);
      setCurrentTime(0);

      // Re-load element safely
      if (audioRef.current) {
        audioRef.current.load();
      }
    } catch (err) {
      console.error('Failed to parse audio base64 or url', err);
    }
  }, [audioBase64, downloadUrl]);

  // Handle Audio playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Setup audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      audio.playbackRate = playbackSpeed;
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [audioBlobUrl, playbackSpeed]);

  // Waveform visualization animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const barCount = 36;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;
        if (isPlaying) {
          const wave1 = Math.sin(i * 0.4 + phase);
          const wave2 = Math.cos(i * 0.2 - phase * 1.5);
          const wave3 = Math.sin(currentTime * 4 + i * 0.5);
          const amplitude = Math.abs((wave1 + wave2 + wave3) / 3);
          barHeight = Math.max(4, amplitude * (height * 0.85));
        } else if (duration > 0) {
          const shape = Math.sin((i / barCount) * Math.PI);
          barHeight = Math.max(3, shape * (height * 0.45));
        }

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;
        const isPassed = i / barCount <= (duration > 0 ? currentTime / duration : 0);

        if (isPassed && isPlaying) {
          ctx.fillStyle = '#38bdf8';
        } else if (isPassed) {
          ctx.fillStyle = '#6366f1';
        } else {
          ctx.fillStyle = '#334155';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 0.12 * playbackSpeed;
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, duration, playbackSpeed]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioBlobUrl) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        if (audio.readyState === 0 && audio.src) {
          audio.load();
        }
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Audio play error handled:', err);
      }
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const skipSeconds = (seconds: number) => {
    if (!audioRef.current) return;
    const target = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
        audioRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (!audioBlobUrl) return;
    const link = document.createElement('a');
    link.href = audioBlobUrl;
    link.download = defaultFilename.endsWith('.wav') ? defaultFilename : `${defaultFilename}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/95 border-b border-indigo-500/20 shadow-2xl backdrop-blur-md px-4 sm:px-6 py-4">
      <audio ref={audioRef} src={audioBlobUrl || undefined} preload="metadata" />

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Track Info & Dynamic Waveform */}
        <div className="flex items-center gap-4 w-full lg:w-1/3 min-w-0">
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/25">
            <FileAudio className="w-6 h-6" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                Studio Player
              </span>
              {audioBlobUrl ? (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Ready
                </span>
              ) : (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  음성 대기
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-white truncate mt-0.5">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>

          {/* Mini Waveform Canvas */}
          <div className="hidden sm:block shrink-0 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
            <canvas ref={canvasRef} width={130} height={32} className="block" />
          </div>
        </div>

        {/* Playback Controls & Progress Bar */}
        <div className="flex flex-col items-center gap-2 w-full lg:w-1/2">
          {/* Main Transport Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => skipSeconds(-5)}
              disabled={!audioBlobUrl}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-transparent"
              title="5초 뒤로"
            >
              <Rewind className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              disabled={!audioBlobUrl}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                audioBlobUrl
                  ? 'bg-gradient-to-tr from-indigo-500 to-sky-400 text-white hover:scale-105 hover:shadow-indigo-500/40'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skipSeconds(5)}
              disabled={!audioBlobUrl}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-transparent"
              title="5초 앞으로"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline scrub bar */}
          <div className="flex items-center gap-3 w-full max-w-xl">
            <span className="text-xs font-mono text-slate-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                disabled={!audioBlobUrl}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 disabled:cursor-not-allowed"
              />
            </div>
            <span className="text-xs font-mono text-slate-400 w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Speed, Volume & Download Action */}
        <div className="flex items-center justify-end gap-3 w-full lg:w-1/3">
          {/* Playback speed selector */}
          <div className="flex items-center bg-slate-950/80 rounded-lg p-1 border border-slate-800 text-xs">
            {[0.8, 1.0, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  playbackSpeed === speed
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <button
              onClick={toggleMute}
              className="p-1.5 rounded hover:text-white transition"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          {/* Direct File Download */}
          <button
            onClick={handleDownload}
            disabled={!audioBlobUrl}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-md ${
              audioBlobUrl
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
            title="WAV 오디오 파일 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
            <span>WAV 다운로드</span>
          </button>
        </div>
      </div>
    </div>
  );
};
