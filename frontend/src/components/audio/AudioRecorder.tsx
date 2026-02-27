import { cn } from '@/lib/utils';
import { Download, Mic, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface AudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, audioUrl: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number; // en segundos
  className?: string;
  variant?: 'default' | 'compact' | 'minimal';
  autoStop?: boolean;
  showWaveform?: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  maxDuration = 300,
  className,
  variant = 'default',
  autoStop = true,
  showWaveform = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        onRecordingComplete?.(blob, url);
        stream.getTracks().forEach(track => track.stop());
      };

      if (showWaveform) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 256;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const monitorAudioLevel = () => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(average / 255);
          if (isRecording) {
            animationRef.current = requestAnimationFrame(monitorAudioLevel);
          }
        };
        monitorAudioLevel();
      }

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (autoStop && newDuration >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return newDuration;
        });
      }, 1000);

      onRecordingStart?.();
    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      onRecordingStop?.();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const playRecording = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setIsPlaying(false);
    setError(null);
  };

  const downloadRecording = () => {
    if (!audioBlob || !audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `recording_${new Date().toISOString().slice(0, 19)}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 bg-red-900/20 border border-red-800/30 rounded-lg",
        className
      )}>
        <Mic className="w-5 h-5 text-red-400" />
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
        {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
        {!audioUrl ? (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200",
              isRecording 
                ? "bg-red-600 hover:bg-red-700 animate-pulse" 
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {isRecording ? (
              <Square className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4 text-white" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={playRecording}
            className="flex items-center justify-center w-8 h-8 bg-green-600 hover:bg-green-700 rounded-full transition-all duration-200"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>
        )}
        <span className="text-xs text-gray-400 tabular-nums">
          {formatTime(duration)}
        </span>
        {audioUrl && (
          <button
            type="button"
            onClick={resetRecording}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
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
        {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
        <div className="flex items-center gap-2">
          {!audioUrl ? (
            <>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200",
                  isRecording 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isRecording ? (
                  <Square className="w-5 h-5 text-white" />
                ) : (
                  <Mic className="w-5 h-5 text-white" />
                )}
              </button>
              {isRecording && (
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="p-2 text-gray-400 hover:text-white rounded transition-colors"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={playRecording}
              className="flex items-center justify-center w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full transition-all duration-200"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>
          )}
        </div>
        {showWaveform && isRecording && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 bg-blue-400 rounded-full transition-all duration-150",
                  audioLevel > (i * 0.2) ? "opacity-100" : "opacity-30"
                )}
                style={{ height: `${Math.max(4, audioLevel * 20)}px` }}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 tabular-nums">
            {formatTime(duration)}
          </span>
          {maxDuration && (
            <span className="text-gray-500 text-xs">
              / {formatTime(maxDuration)}
            </span>
          )}
        </div>
        {audioUrl && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={downloadRecording}
              className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
              title="Descargar"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetRecording}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm",
      className
    )}>
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
      {showWaveform && isRecording && (
        <div className="mb-6">
          <div className="flex items-center justify-center gap-1 h-16">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-full transition-all duration-100",
                  audioLevel > (i * 0.05) ? "opacity-100" : "opacity-20"
                )}
                style={{ height: `${Math.max(4, audioLevel * 60 + Math.random() * 10)}px` }}
              />
            ))}
          </div>
        </div>
      )}
      <div className="text-center mb-6">
        <div className="text-3xl font-mono text-white mb-2">
          {formatTime(duration)}
        </div>
        {maxDuration && (
          <div className="text-sm text-gray-400">
            Máximo: {formatTime(maxDuration)}
          </div>
        )}
        {maxDuration && (
          <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${(duration / maxDuration) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4 mb-6">
        {!audioUrl ? (
          <>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                "flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 shadow-lg",
                isRecording 
                  ? "bg-red-600 hover:bg-red-700 animate-pulse" 
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isRecording ? (
                <Square className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
            {isRecording && (
              <button
                type="button"
                onClick={pauseRecording}
                className="flex items-center justify-center w-12 h-12 bg-gray-600 hover:bg-gray-700 rounded-full transition-all duration-200"
              >
                {isPaused ? (
                  <Play className="w-6 h-6 text-white ml-1" />
                ) : (
                  <Pause className="w-6 h-6 text-white" />
                )}
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={playRecording}
            className="flex items-center justify-center w-16 h-16 bg-green-600 hover:bg-green-700 rounded-full transition-all duration-200 shadow-lg"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </button>
        )}
      </div>
      <div className="text-center mb-4">
        {isRecording && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm">
              {isPaused ? 'Grabación pausada' : 'Grabando...'}
            </span>
          </div>
        )}
        {audioUrl && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span className="text-green-400 text-sm">
              Grabación completada
            </span>
          </div>
        )}
      </div>
      {audioUrl && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={downloadRecording}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Descargar</span>
          </button>
          <button
            type="button"
            onClick={resetRecording}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">Nueva grabación</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
