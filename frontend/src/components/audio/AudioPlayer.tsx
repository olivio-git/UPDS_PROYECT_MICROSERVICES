import { cn } from '@/lib/utils';
import { FastForward, Pause, Play, Rewind, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  artist?: string;
  knownDuration?: number; // seconds — use when src is a blob (MediaRecorder duration is Infinity)
  variant?: 'default' | 'compact' | 'minimal' | 'wave';
  showControls?: {
    volume?: boolean;
    speed?: boolean;
    seek?: boolean;
    time?: boolean;
    download?: boolean;
  };
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  title,
  artist,
  knownDuration,
  variant = 'default',
  showControls = {
    volume: true,
    speed: true,
    seek: true,
    time: true,
    download: false
  },
  className,
  onPlay,
  onPause,
  onEnd,
  // autoPlay = false,
  loop = false
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(knownDuration ?? 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedData = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      // If Infinity (MediaRecorder blob), keep knownDuration if provided
      setIsLoading(false);
    };

    const handleDurationChange = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnd?.();
    };

    const handleError = () => {
      setError('Error al cargar el audio');
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [src, onEnd]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        onPause?.();
      } else {
        await audio.play();
        setIsPlaying(true);
        onPlay?.();
      }
    } catch (error) {
      console.error('Error al reproducir audio:', error);
      setError('Error al reproducir el audio');
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressRef.current;
    
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const changePlaybackRate = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaybackRate(rate);
    audio.playbackRate = rate;
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const reset = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={cn("flex items-center gap-2.5 px-3 py-2.5 bg-card border border-border rounded-lg", className)}>
        <VolumeX className="w-4 h-4 text-destructive shrink-0" />
        <span className="text-destructive text-sm">{error}</span>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-2.5 px-2.5 py-2 bg-card border border-border rounded-lg", className)}>
        <audio ref={audioRef} src={src} preload="metadata" loop={loop} />
        <button
          onClick={togglePlay}
          disabled={isLoading}
          type="button"
          className="flex items-center justify-center w-7 h-7 bg-foreground hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-opacity"
        >
          {isLoading ? (
            <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3 text-background" />
          ) : (
            <Play className="w-3 h-3 text-background ml-0.5" />
          )}
        </button>
        {showControls.time && (
          <span className="text-xs text-muted-foreground tabular-nums">{formatTime(currentTime)}</span>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg", className)}>
        <audio ref={audioRef} src={src} preload="metadata" loop={loop} />
        <button
          onClick={togglePlay}
          disabled={isLoading}
          type="button"
          className="flex items-center justify-center w-8 h-8 bg-foreground hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-opacity shrink-0"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 text-background" />
          ) : (
            <Play className="w-4 h-4 text-background ml-0.5" />
          )}
        </button>
        {showControls.seek && (
          <div className="flex-1 min-w-0">
            <div
              ref={progressRef}
              onClick={handleSeek}
              className="w-full h-1 bg-border rounded-full cursor-pointer relative group"
            >
              <div className="h-full bg-foreground rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-foreground rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ left: `${Math.max(0, progress - 1)}%` }}
              />
            </div>
          </div>
        )}
        {showControls.time && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : '--:--'}
          </span>
        )}
      </div>
    );
  }

  // Variant 'default'
  return (
    <div className={cn("bg-card border border-border rounded-xl p-4", className)}>
      <audio ref={audioRef} src={src} preload="metadata" loop={loop} />

      {(title || artist) && (
        <div className="mb-3">
          {title && <p className="text-sm font-medium text-foreground truncate">{title}</p>}
          {artist && <p className="text-xs text-muted-foreground truncate">{artist}</p>}
        </div>
      )}

      {/* Progress bar */}
      {showControls.seek && (
        <div className="mb-3">
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="w-full h-1 bg-border rounded-full cursor-pointer relative group"
          >
            <div className="h-full bg-foreground rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              style={{ left: `${Math.max(0, progress - 1.5)}%` }}
            />
          </div>
          {showControls.time && (
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          )}
        </div>
      )}

      {/* Main controls */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={() => skip(-10)}
          type="button"
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition-colors"
          title="Retroceder 10s"
        >
          <Rewind className="w-4 h-4" />
        </button>
        <button
          onClick={reset}
          type="button"
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition-colors"
          title="Reiniciar"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={togglePlay}
          disabled={isLoading}
          type="button"
          className="flex items-center justify-center w-10 h-10 bg-foreground hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-opacity"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-background" />
          ) : (
            <Play className="w-5 h-5 text-background ml-0.5" />
          )}
        </button>
        <button
          onClick={() => skip(10)}
          type="button"
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition-colors"
          title="Avanzar 10s"
        >
          <FastForward className="w-4 h-4" />
        </button>
      </div>

      {/* Secondary controls */}
      <div className="flex items-center justify-between">
        {showControls.volume && (
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} type="button" className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
              {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-0.5 bg-border rounded-full appearance-none cursor-pointer audio-slider"
            />
          </div>
        )}
        {showControls.speed && (
          <div className="flex items-center gap-0.5">
            {[0.75, 1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => changePlaybackRate(rate)}
                type="button"
                className={cn(
                  "px-1.5 py-0.5 text-xs rounded transition-colors",
                  playbackRate === rate
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {rate}x
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .audio-slider::-webkit-slider-thumb {
          appearance: none;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: hsl(var(--foreground));
          cursor: pointer;
        }
        .audio-slider::-moz-range-thumb {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: hsl(var(--foreground));
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default AudioPlayer;