import { Alert, AlertDescription } from "@/components/atoms/alert";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Progress } from "@/components/atoms/progress";
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Mic,
  RotateCcw,
  Settings,
  Signal,
  Volume2,
  Wifi,
  WifiOff,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NetworkQuality {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  status: 'checking' | 'success' | 'warning' | 'error';
}

export interface MicrophoneTestResult {
  level: number;
  isWorking: boolean;
  isRecording: boolean;
  audioUrl?: string;
  duration?: number;
}

export interface CameraTestResult {
  hasPermission: boolean;
  isActive: boolean;
  resolution?: { width: number; height: number };
  error?: string;
}

// ================================
// INTERNET SPEED TEST COMPONENT
// ================================
interface InternetSpeedTestProps {
  onTestComplete: (result: NetworkQuality) => void;
  isActive: boolean;
}

export const InternetSpeedTest: React.FC<InternetSpeedTestProps> = ({ 
  onTestComplete, 
  isActive 
}) => {
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<NetworkQuality | null>(null);

  const runSpeedTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    
    try {
      const startTime = Date.now();
      
      // Test de latencia básico
      for (let i = 0; i <= 30; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      // Streaming-based download tests to measure real throughput.
      const testUrls = [
        'https://httpbin.org/bytes/1048576', // 1MB
        'https://httpbin.org/bytes/2097152', // 2MB
        'https://httpbin.org/bytes/5242880'  // 5MB
      ];

      const fetchAndMeasure = async (url: string, timeoutMs = 8000) => {
        try {
          const controller = new AbortController();
          const id = window.setTimeout(() => controller.abort(), timeoutMs);
          const start = performance.now();
          const resp = await fetch(url, { cache: 'no-cache', signal: controller.signal });
          clearTimeout(id);

          if (!resp.body || !resp.ok) return { bytes: 0, duration: 0 };

          const reader = resp.body.getReader();
          let done = false;
          let bytes = 0;

          while (!done) {
            const { value, done: d } = await reader.read();
            if (d) { done = true; break; }
            if (value) bytes += value.byteLength;
            // if bytes exceed a threshold we can stop early for faster results
            // but here we read full response to be accurate
          }

          const end = performance.now();
          const duration = Math.max(1, (end - start) / 1000);
          return { bytes, duration };
        } catch (err) {
          return { bytes: 0, duration: 0 };
        }
      };

  let totalMbps = 0;
  let validTests = 0;
  let rttSum = 0;

      for (let i = 0; i < testUrls.length; i++) {
        setProgress(30 + (i + 1) * 20);
        try {
          // measure RTT with a tiny fetch
          const rttStart = performance.now();
          try {
            await fetch(testUrls[i], { method: 'GET', cache: 'no-cache', signal: AbortSignal.timeout(3000) });
          } catch {}
          const rtt = Math.max(0, Math.round(performance.now() - rttStart));
          rttSum += rtt;

          const { bytes, duration } = await fetchAndMeasure(testUrls[i], 10000);
          if (bytes > 0 && duration > 0) {
            const mbps = (bytes * 8) / (duration * 1000 * 1000) * 1000; // convert to Mbps
            // above formula: bytes*8 bits / (duration sec) -> bits/sec, /1e6 -> Mbps
            const speedMbps = Math.round(mbps * 10) / 10;
            totalMbps += speedMbps;
            validTests++;
            // update intermediate result so UI shows progress
            setResult({ effectiveType: '4g', downlink: Math.round((totalMbps / validTests) * 10) / 10, rtt, quality: 'good', status: 'checking' });
          }
        } catch (e) {
          // ignore test failure
        }
      }

  const avgSpeed = validTests > 0 ? totalMbps / validTests : 0;
  const avgRtt = validTests > 0 ? Math.round(rttSum / validTests) : Math.round(Date.now() - startTime);

  // Finalizar progreso
      for (let i = 90; i <= 100; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
  const rtt = avgRtt;
      
      const quality: NetworkQuality['quality'] = 
        avgSpeed > 10 ? 'excellent' :
        avgSpeed > 5 ? 'good' :
        avgSpeed > 1 ? 'fair' : 'poor';
      
      const effectiveType: NetworkQuality['effectiveType'] = 
        avgSpeed > 10 ? '4g' :
        avgSpeed > 1.5 ? '3g' :
        avgSpeed > 0.4 ? '2g' : 'slow-2g';
      
      const testResult: NetworkQuality = {
        effectiveType,
        downlink: Math.round(avgSpeed * 10) / 10,
        rtt: Math.round(rtt),
        quality,
        status: quality === 'poor' ? 'warning' : 'success'
      };
      
      setResult(testResult);
      onTestComplete(testResult);
      
    } catch (error) {
      const errorResult: NetworkQuality = {
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 9999,
        quality: 'poor',
        status: 'error'
      };
      setResult(errorResult);
      onTestComplete(errorResult);
    } finally {
      setTesting(false);
    }
  }, [onTestComplete]);

  useEffect(() => {
    if (isActive) {
      runSpeedTest();
    }
  }, [isActive, runSpeedTest]);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return <Signal className="h-5 w-5 text-green-400" />;
      case 'good': return <Wifi className="h-5 w-5 text-blue-400" />;
      case 'fair': return <Wifi className="h-5 w-5 text-yellow-400" />;
      case 'poor': return <WifiOff className="h-5 w-5 text-red-400" />;
      default: return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {testing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Probando velocidad...</span>
            <span className="text-gray-400">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
      
      {result && (
        <div className="bg-gray-700/30 rounded-lg p-4 space-y-3 border border-gray-600/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getQualityIcon(result.quality)}
              <span className={`font-medium ${getQualityColor(result.quality)}`}>
                {result.quality === 'excellent' ? 'Excelente' :
                 result.quality === 'good' ? 'Buena' :
                 result.quality === 'fair' ? 'Regular' : 'Deficiente'}
              </span>
            </div>
            <Badge className={`${
              result.quality === 'excellent' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
              result.quality === 'good' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
              result.quality === 'fair' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
              'bg-red-500/20 text-red-300 border-red-500/30'
            }`}>
              {result.effectiveType.toUpperCase()}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Velocidad:</span>
              <span className="text-white ml-2">{result.downlink} Mbps</span>
            </div>
            <div>
              <span className="text-gray-400">Latencia:</span>
              <span className="text-white ml-2">{result.rtt}ms</span>
            </div>
          </div>
          
          <Button
            onClick={runSpeedTest}
            size="sm"
            variant="outline"
            className="w-full border-gray-600 text-gray-300"
            disabled={testing}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {testing ? 'Probando...' : 'Probar Nuevamente'}
          </Button>
        </div>
      )}
    </div>
  );
};

// ================================
// MICROPHONE TEST COMPONENT - FIXED
// ================================
interface MicrophoneTestProps {
  onTestComplete: (result: MicrophoneTestResult) => void;
}

export const MicrophoneTest: React.FC<MicrophoneTestProps> = ({ onTestComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  // permission state not needed; rely on error state
  const [error, setError] = useState<string | null>(null);
  const [maxLevel, setMaxLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalLevelRef = useRef(0);
  const [isSystemMuted, setIsSystemMuted] = useState(false);
  const muteHandlerRef = useRef<(() => void) | null>(null);
  const unmuteHandlerRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [testDurationSeconds, setTestDurationSeconds] = useState<number>(3);

  const startRecording = async () => {
    try {
      setError(null);
      setMaxLevel(0);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      streamRef.current = stream;
  // permission granted
      
      // Configurar análisis de audio
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
  analyserRef.current.fftSize = 512;
  analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Configurar MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus'
      };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'audio/mp4';
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      const chunks: BlobPart[] = [];
      
  mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstart = () => {
        isRecordingRef.current = true;
        setIsRecording(true);
        finalLevelRef.current = 0;
      };

      mediaRecorderRef.current.onerror = (ev: any) => {
        console.error('MediaRecorder error', ev);
        isRecordingRef.current = false;
        setIsRecording(false);
        setError('Error grabando audio');
      };

      mediaRecorderRef.current.onstop = () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedAudio(url);

          // Detener el stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          // ensure flags cleared
          isRecordingRef.current = false;
          setIsRecording(false);

          // Use the final sampled level to avoid off-by-one render delays
          const finalLevel = Math.max(maxLevel, finalLevelRef.current || 0);
          onTestComplete({
            level: finalLevel,
            isWorking: finalLevel > 0.05,
            isRecording: false,
            audioUrl: url,
            duration: testDurationSeconds
          });
        } catch (err) {
          console.error('Error in onstop handler:', err);
        }
      };
      
      // Iniciar grabación
      isRecordingRef.current = true;
      setIsRecording(true);
      try {
        mediaRecorderRef.current.start(100); // Grabar en chunks de 100ms
      } catch (err) {
        console.error('MediaRecorder start failed:', err);
      }
      
      // Analizar nivel de audio en tiempo real
      const updateAudioLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;

        // Use time-domain data for amplitude
        const timeData = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(timeData);

        // Compute RMS around center (128)
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128; // -1..1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const normalizedLevel = Math.min(1, rms);

        setAudioLevel(normalizedLevel);
        setMaxLevel(prev => Math.max(prev, normalizedLevel));
        finalLevelRef.current = Math.max(finalLevelRef.current, normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
      
      // Detener automáticamente después de configured seconds
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, Math.max(1000, testDurationSeconds * 1000));

      // Attach mute/unmute listeners to audio track if available
      try {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const onMute = () => setIsSystemMuted(true);
          const onUnmute = () => setIsSystemMuted(false);
          audioTrack.addEventListener('mute', onMute);
          audioTrack.addEventListener('unmute', onUnmute);
          muteHandlerRef.current = () => audioTrack.removeEventListener('mute', onMute);
          unmuteHandlerRef.current = () => audioTrack.removeEventListener('unmute', onUnmute);
          // Initial state
          setIsSystemMuted(Boolean((audioTrack as any).muted) || !audioTrack.enabled);
        }
      } catch (e) {
        // ignore
      }
      
  } catch (error: any) {
      console.error('Error accessing microphone:', error);
      let errorMessage = 'No se pudo acceder al micrófono.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permisos de micrófono denegados. Permite el acceso para continuar.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró ningún micrófono conectado.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'Acceso al micrófono cancelado.';
      }
      
  setError(errorMessage);
  // permission denied
  isRecordingRef.current = false;
  setIsRecording(false);
    }
  };

  const stopRecording = () => {
    // Stop regardless of closure state; rely on mediaRecorder state and ref
    try {
      isRecordingRef.current = false;
      setIsRecording(false);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch(e) { /* ignore */ }
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch(e) {}
        audioContextRef.current = null;
      }
      // cleanup mute/unmute listeners
      try {
        if (muteHandlerRef.current) { muteHandlerRef.current(); muteHandlerRef.current = null; }
        if (unmuteHandlerRef.current) { unmuteHandlerRef.current(); unmuteHandlerRef.current = null; }
      } catch(e) {}

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  };

  const playRecording = () => {
    if (recordedAudio) {
      const audio = new Audio(recordedAudio);
      audio.play().catch(console.error);
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // cleanup mute listeners & timeout
      try {
        if (muteHandlerRef.current) { muteHandlerRef.current(); muteHandlerRef.current = null; }
        if (unmuteHandlerRef.current) { unmuteHandlerRef.current(); unmuteHandlerRef.current = null; }
      } catch (e) {}
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div className="mt-4 space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="bg-gray-700/30 rounded-lg p-4 space-y-4 border border-gray-600/50">
        {/* Visualizador de nivel de audio estilo Zoom/Meet */}
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-4">
            {/* Círculo base */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-600"></div>
            
            {/* Círculo animado basado en el nivel de audio */}
            <div 
              className={`absolute inset-0 rounded-full border-4 transition-all duration-150 ${
                isRecording 
                  ? audioLevel > 0.3 
                    ? 'border-green-400 animate-pulse' 
                    : audioLevel > 0.1
                    ? 'border-blue-400'
                    : 'border-yellow-400'
                  : 'border-gray-600'
              }`}
              style={{
                transform: `scale(${1 + audioLevel * 0.8})`,
                opacity: 0.6 + audioLevel * 0.4
              }}
            ></div>
            
            {/* Ícono del micrófono */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Mic className={`h-8 w-8 ${
                isRecording 
                  ? audioLevel > 0.3 
                    ? 'text-green-400' 
                    : audioLevel > 0.1
                    ? 'text-blue-400'
                    : 'text-yellow-400'
                  : 'text-gray-400'
              }`} />
            </div>
          </div>
          
          {/* Barra de nivel de audio mejorada */}
          <div className="w-full bg-gray-600 rounded-full h-4 mb-4 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-100 ${
                audioLevel > 0.7 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                audioLevel > 0.3 ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                audioLevel > 0.1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 
                'bg-gray-500'
              }`}
              style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
            ></div>
          </div>
          
          <p className="text-sm text-gray-300 mb-4">
            {isRecording 
              ? `Grabando... Habla ahora (${Math.round(audioLevel * 100)}%)` 
              : recordedAudio 
                ? `Grabación completada - Nivel máximo: ${Math.round(maxLevel * 100)}%`
                : 'Haz clic para probar tu micrófono'
            }
          </p>
          {/* System mute indicator */}
          {isSystemMuted && (
            <p className="text-xs text-yellow-300 mb-2">El sistema reporta el micrófono como silenciado (muted).</p>
          )}
        </div>
        
        {/* Controles */}
        <div className="flex gap-2 justify-center">
          <Button
            onClick={startRecording}
            disabled={isRecording}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600"
            size="sm"
          >
            {isRecording ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Grabando...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Iniciar Prueba
              </>
            )}
          </Button>
          
          {recordedAudio && (
            <Button
              onClick={playRecording}
              variant="outline"
              className="border-gray-600 text-gray-300 bg-transparent"
              size="sm"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              Reproducir
            </Button>
          )}
        </div>
        {/* Duration control */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <label className="text-xs text-gray-400">Duración prueba (s):</label>
          <input
            type="number"
            min={1}
            max={30}
            value={testDurationSeconds}
            onChange={(e) => setTestDurationSeconds(Math.max(1, Math.min(30, Number(e.target.value) || 3)))}
            className="w-16 bg-gray-800 text-sm text-gray-200 border border-gray-600 rounded px-2 py-1"
          />
        </div>
        
        {/* Resultado */}
        {recordedAudio && (
          <div className="text-center p-3 bg-gray-600/30 rounded-lg">
            {maxLevel > 0.05 ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-green-300">
                  ✅ Micrófono funcionando correctamente
                </p>
                <p className="text-xs text-gray-400">
                  Nivel máximo detectado: {Math.round(maxLevel * 100)}%
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-300">
                  ⚠️ Nivel de audio muy bajo
                </p>
                <p className="text-xs text-gray-400">
                  Verifica que el micrófono esté conectado y configurado
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ================================
// CAMERA TEST COMPONENT - FIXED
// ================================
interface CameraTestProps {
  onTestComplete: (result: CameraTestResult) => void;
}

export const CameraTest: React.FC<CameraTestProps> = ({ onTestComplete }) => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{ label: string; id: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDevices, setVideoDevices] = useState<{ label: string; id: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const startCamera = async () => {
    try {
      setError(null);
      
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 30, min: 15 },
          ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {})
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
  // Guardar stream y activar; la asignación a videoRef y play se hace en un useEffect
  setStream(mediaStream);
  setIsActive(true);
      
      // Obtener información del dispositivo
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      setDeviceInfo({
        label: videoTrack.label || 'Cámara desconocida',
        id: videoTrack.id
      });
      
      onTestComplete({
        hasPermission: true,
        isActive: true,
        resolution: {
          width: settings.width || 640,
          height: settings.height || 480
        }
      });

      // After getting permission, enumerate devices so labels appear
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput').map(d => ({ label: d.label || 'Cámara', id: d.deviceId }));
        setVideoDevices(videoInputs);
        const stored = localStorage.getItem('preferredCamera');
        if (stored && videoInputs.some(v => v.id === stored)) {
          setSelectedDeviceId(stored);
        } else if (!selectedDeviceId && videoInputs.length > 0) {
          setSelectedDeviceId(videoInputs[0].id);
        }
      } catch (err) {
        // ignore
      }
      
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      
      let errorMessage = 'No se pudo acceder a la cámara.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permisos de cámara denegados. Permite el acceso para continuar.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró ninguna cámara conectada.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'Acceso a la cámara cancelado.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'La cámara está siendo usada por otra aplicación.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'La cámara no soporta la configuración solicitada.';
      }
      
      setError(errorMessage);
      setIsActive(false);
      
      onTestComplete({
        hasPermission: false,
        isActive: false,
        error: error.name
      });
    }
  };

  const listDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput').map(d => ({ label: d.label || 'Cámara', id: d.deviceId }));
      setVideoDevices(videoInputs);
      const stored = localStorage.getItem('preferredCamera');
      if (stored && videoInputs.some(v => v.id === stored)) {
        setSelectedDeviceId(stored);
      } else if (!selectedDeviceId && videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].id);
      }
    } catch (err) {
      // ignore
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
      setIsActive(false);
      setDeviceInfo(null);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  // Cleanup effect
  useEffect(() => {
    listDevices();
    return () => {
      stopCamera();
    };
  }, []);

  // When stream becomes available, attach to video element and play
  useEffect(() => {
    if (!stream || !videoRef.current) return;

    let mounted = true;

    const video = videoRef.current;
    video.srcObject = stream;

    const onLoaded = async () => {
      if (!mounted) return;
      try {
        await video.play();
  setAutoplayBlocked(false);
      } catch (err) {
        // Autoplay may be blocked; UI still shows preview once user interacts
        console.warn('Autoplay blocked or play failed:', err);
  setAutoplayBlocked(true);
      }
    };

    video.addEventListener('loadedmetadata', onLoaded);

    // Fallback: if loadedmetadata doesn't fire, try after 1s
    const fallback = setTimeout(() => onLoaded(), 1000);

    return () => {
      mounted = false;
      video.removeEventListener('loadedmetadata', onLoaded);
      clearTimeout(fallback);
    };
  }, [stream]);

  const enablePreview = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setAutoplayBlocked(false);
    } catch (err) {
      console.warn('Enable preview failed:', err);
    }
  };

  const applySelectedCamera = async () => {
    if (selectedDeviceId) {
      localStorage.setItem('preferredCamera', selectedDeviceId);
    }
    if (isActive) {
      stopCamera();
      // small delay to ensure tracks stopped
      setTimeout(() => startCamera(), 250);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription> 
        </Alert>
      )}
      
      <div className="bg-gray-700/30 rounded-lg p-4 space-y-4 border border-gray-600/50">
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
          {isActive ? (
            <>
              <video
                ref={videoRef} 
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Efecto espejo
              />
              
              {/* Indicador de grabación */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="bg-red-500 rounded-full w-3 h-3 animate-pulse"></div>
                <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">EN VIVO</span>
              </div>
              
              {/* Información del dispositivo */}
              {deviceInfo && (
                <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {deviceInfo.label}
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">Vista previa de la cámara</p>
                <p className="text-xs text-gray-200 mt-2">
                  Haz clic en "Iniciar Cámara" para probar
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 justify-center">
          <Button
            onClick={isActive ? stopCamera : startCamera}
            className={isActive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
            size="sm"
          >
            {isActive ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Detener Cámara
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Iniciar Cámara
              </>
            )}
          </Button>
          
          {isActive && (
            <Button
              onClick={startCamera}
              variant="outline"
              className="border-gray-600 text-gray-300 bg-transparent"
              size="sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              Reiniciar
            </Button>
          )}

          {/* Camera selection and apply */}
          <div className="flex items-center gap-2">
            <select
              value={selectedDeviceId || ''}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-gray-800 text-sm text-gray-200 border border-gray-600 rounded px-2 py-1"
            >
              {videoDevices.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>

            <Button onClick={applySelectedCamera} size="sm" variant="ghost" className="border-gray-600 text-gray-300">
              Aplicar
            </Button>
          </div>

          {autoplayBlocked && (
            <div className="ml-2">
              <Button onClick={enablePreview} size="sm" variant="outline" className="border-yellow-500 text-yellow-300">
                Habilitar Previsualización
              </Button>
            </div>
          )}
        </div>
        
        {/* Resultado */}
        {isActive && deviceInfo && (
          <div className="text-center p-3 bg-gray-600/30 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-green-300">
              ✅ Cámara funcionando correctamente
            </p>
            <p className="text-xs text-gray-400">
              {deviceInfo.label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
