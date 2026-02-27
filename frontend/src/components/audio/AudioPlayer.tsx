import { cn } from '@/lib/utils';
import { FastForward, Pause, Play, Rewind, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  artist?: string;
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
  const [duration, setDuration] = useState(0);
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
      setDuration(audio.duration);
      setIsLoading(false);
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
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
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
    if (isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 bg-red-900/20 border border-red-800/30 rounded-lg",
        className
      )}>
        <VolumeX className="w-5 h-5 text-red-400" />
        <span className="text-red-300 text-sm">{error}</span>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50",
        className
      )}>
        <audio ref={audioRef} src={src} preload="metadata" loop={loop} />
        
        <button
          onClick={togglePlay}
          disabled={isLoading}
          type='button'
          className="flex items-center justify-center w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full transition-all duration-200"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </button>

        {showControls.time && (
          <span className="text-xs text-gray-400 min-w-0 tabular-nums">
            {formatTime(currentTime)}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50",
        className
      )}>
        <audio ref={audioRef} src={src} preload="metadata" loop={loop} />
        
        <button
          onClick={togglePlay}
          disabled={isLoading}
          type='button'
          className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full transition-all duration-200"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>

        {showControls.seek && (
          <div className="flex-1 min-w-0">
            <div
              ref={progressRef}
              onClick={handleSeek}
              className="w-full h-2 bg-gray-700 rounded-full cursor-pointer relative overflow-hidden"
            >
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg transition-all duration-150"
                style={{ left: `${Math.max(0, progress - 0.5)}%` }}
              />
            </div>
          </div>
        )}

        {showControls.time && (
          <span className="text-sm text-gray-400 min-w-0 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
      </div>
    );
  }

  // Variant 'default' - reproductor completo
  return (
    <div className={cn(
      "bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm",
      className
    )}>
      <audio ref={audioRef} src={src} preload="metadata" loop={loop} />
      
      {/* Header con información */}
      {(title || artist) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-white font-medium text-lg truncate">{title}</h3>
          )}
          {artist && (
            <p className="text-gray-400 text-sm truncate">{artist}</p>
          )}
        </div>
      )}

      {/* Barra de progreso */}
      {showControls.seek && (
        <div className="mb-4">
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="w-full h-3 bg-gray-700/50 rounded-full cursor-pointer relative overflow-hidden group"
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
              style={{ left: `${Math.max(0, progress - 2)}%` }}
            />
          </div>
          
          {showControls.time && (
            <div className="flex justify-between text-xs text-gray-400 mt-1 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          )}
        </div>
      )}

      {/* Controles principales */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => skip(-10)}
          type="button"
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition-all duration-200"
          title="Retroceder 10s"
        >
          <Rewind className="w-5 h-5" />
        </button>

        <button
          onClick={reset}
          type='button'
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition-all duration-200"
          title="Reiniciar"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          disabled={isLoading}
          type='button'
          className="flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full transition-all duration-200 shadow-lg"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white ml-1" />
          )}
        </button>

        <button
          onClick={() => skip(10)}
          type='button'
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition-all duration-200"
          title="Avanzar 10s"
        >
          <FastForward className="w-5 h-5" />
        </button>
      </div>

      {/* Controles adicionales */}
      <div className="flex items-center justify-between">
        {/* Control de volumen */}
        {showControls.volume && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              type='button'
              className="p-1 text-gray-400 hover:text-white rounded transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer slider"
            />
          </div>
        )}

        {/* Control de velocidad */}
        {showControls.speed && (
          <div className="flex items-center gap-1">
            {[0.75, 1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => changePlaybackRate(rate)}
                type='button'
                className={cn(
                  "px-2 py-1 text-xs rounded transition-all duration-200",
                  playbackRate === rate
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                )}
              >
                {rate}x
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default AudioPlayer;