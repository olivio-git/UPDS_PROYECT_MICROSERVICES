import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Image as ImageIcon, Mic, Volume2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Importar los componentes de audio
import { AudioPlayer, AudioRecorder } from '@/components/audio';
import type { Question } from '../../types';

interface Props {
  formData: Partial<Question>;
  onChange: (data: Partial<Question>) => void;
  baseInputClass: string;
  audioFile: File | null;
  imageFile: File | null;
  onAudioChange: (file: File | null) => void;
  onImageChange: (file: File | null) => void;
}

const QuestionMultimedia: React.FC<Props> = ({
  formData,
  onChange,
  baseInputClass,
  audioFile,
  imageFile,
  onAudioChange,
  onImageChange,
}) => {
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isListeningQuestion = formData.competency === 'listening';
  const needsAudioInput = formData.type === 'audio_response';
  const canHaveMedia = true; // Cualquier pregunta puede tener multimedia
  
  // Determinar si debe mostrar la sección multimedia
  const showMultimedia = canHaveMedia && (
    isListeningQuestion || 
    needsAudioInput || 
    formData.content?.mediaUrl ||
    audioFile ||
    imageFile
  );

  const updateContent = (field: string, value: any) => {
    onChange({
      ...formData,
      content: {
        ...formData.content,
        [field]: value,
      },
    });
  };

  // Limpiar URLs de objeto cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Manejar grabación de audio completada
  const handleRecordingComplete = useCallback((audioBlob: Blob, audioUrl: string) => {
    try {
      // Limpiar URL anterior si existe
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      
      setRecordedAudioUrl(audioUrl);
      
      // Crear archivo a partir del blob
      const timestamp = Date.now();
      const audioFile = new File([audioBlob], `recording_${timestamp}.wav`, {
        type: 'audio/wav',
      });
      
      onAudioChange(audioFile);
      
      toast.success('Audio grabado correctamente');
    } catch (error) {
      console.error('Error al procesar la grabación:', error);
      toast.error('Error al procesar la grabación de audio');
    }
  }, [recordedAudioUrl, onAudioChange]);

  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
  }, []);

  const handleRecordingStop = useCallback(() => {
    setIsRecording(false);
  }, []);

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('audio/')) {
        toast.error('Por favor selecciona un archivo de audio válido');
        return;
      }
      
      // Validar tamaño (max 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('El archivo de audio es demasiado grande (máximo 50MB)');
        return;
      }
      
      onAudioChange(file);
      
      // Limpiar grabación previa si existe
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl(null);
      }
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor selecciona un archivo de imagen válido');
        return;
      }
      
      // Validar tamaño (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('El archivo de imagen es demasiado grande (máximo 10MB)');
        return;
      }
      
      onImageChange(file);
    }
  };

  const clearAudioFile = () => {
    onAudioChange(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const clearImageFile = () => {
    onImageChange(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  if (!showMultimedia) return null;

  return (
    <Card className="border border-line">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-blue-400" />
          Multimedia
        </CardTitle>
        <CardDescription>
          {isListeningQuestion && 'Audio requerido para comprensión auditiva'}
          {needsAudioInput && 'Configuración de respuesta de audio'}
          {!isListeningQuestion && !needsAudioInput && 'Audio e imagen opcional para enriquecer la pregunta'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Audio para listening */}
        {isListeningQuestion && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <Label className="text-base font-medium">
                Audio para Comprensión Auditiva *
              </Label>
            </div>

            {/* Mostrar reproductor de audio existente */}
            {formData.content?.mediaUrl && formData.content.mediaType === 'audio' && (
              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-3">Audio actual:</div>
                <AudioPlayer
                  src={formData.content.mediaUrl}
                  variant="compact"
                  title="Audio de la pregunta"
                  showControls={{
                    volume: true,
                    speed: true,
                    seek: true,
                    time: true,
                  }}
                  className="max-w-md"
                />
              </div>
            )}

            {/* Mostrar audio seleccionado */}
            {(audioFile || recordedAudioUrl) && (
              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-3">Audio seleccionado:</div>
                <AudioPlayer
                  src={recordedAudioUrl || (audioFile ? URL.createObjectURL(audioFile) : '')}
                  variant="compact"
                  title={audioFile?.name || 'Audio grabado'}
                  showControls={{
                    volume: true,
                    speed: true,
                    seek: true,
                    time: true,
                  }}
                  className="max-w-md"
                />
                <button
                  type="button"
                  onClick={clearAudioFile}
                  className="mt-2 text-sm text-red-400 hover:text-red-300"
                >
                  ✕ Eliminar audio
                </button>
              </div>
            )}

            {/* Botón para subir nuevo audio */}
            <div className="flex items-center gap-3">
              <label
                className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border transition-all hover:bg-gray-700/50 ${baseInputClass}`}
              >
                <Volume2 className="w-4 h-4" />
                <span>Seleccionar Audio</span>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileChange}
                  className="hidden"
                />
              </label>
              {audioFile && (
                <span className="text-sm text-green-400 flex items-center gap-1">
                  ✓ {audioFile.name}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Configuración para audio_response */}
        {needsAudioInput && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Mic className="w-5 h-5 text-red-400" />
              <Label className="text-base font-medium">
                Audio de Pregunta y Configuración
              </Label>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400 mb-4">
                Graba un audio con la pregunta o instrucciones que el estudiante escuchará antes de responder.
              </p>

              {/* Tipo de respuesta esperada */}
              <div className="space-y-2 mb-4">
                <Label>Tipo de respuesta esperada</Label>
                <Select
                  value={formData.content?.expectedResponseType || 'sentence'}
                  onValueChange={(value: 'word' | 'sentence' | 'paragraph') =>
                    updateContent('expectedResponseType', value)
                  }
                >
                  <SelectTrigger className={baseInputClass}>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border border-line">
                    <SelectItem value="word">Palabra</SelectItem>
                    <SelectItem value="sentence">Oración</SelectItem>
                    <SelectItem value="paragraph">Párrafo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mostrar reproductor si hay audio existente */}
              {formData.content?.mediaUrl && formData.content.mediaType === 'audio' && (
                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-2">Audio actual:</div>
                  <AudioPlayer
                    src={formData.content.mediaUrl}
                    variant="compact"
                    title="Audio de ejemplo"
                    showControls={{
                      volume: true,
                      speed: true,
                      seek: true,
                      time: true,
                    }}
                    className="max-w-md"
                  />
                </div>
              )}

              {/* Grabador de audio */}
              <div className="mb-4">
                <AudioRecorder
                  variant="compact"
                  maxDuration={180} // 3 minutos máximo
                  showWaveform={true}
                  onRecordingComplete={handleRecordingComplete}
                  onRecordingStart={handleRecordingStart}
                  onRecordingStop={handleRecordingStop}
                  className="mb-4"
                />
              </div>

              {/* Opción alternativa para subir archivo */}
              <div className="pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400 mb-2">
                  O sube un archivo de audio:
                </div>
                <label
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all hover:bg-gray-700/50 ${baseInputClass}`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Seleccionar archivo</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Imagen opcional para cualquier tipo de pregunta */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-green-400" />
            <Label className="text-base font-medium">Imagen (opcional)</Label>
          </div>

          {/* Mostrar imagen existente si hay */}
          {formData.content?.mediaUrl && formData.content.mediaType === 'image' && (
            <div className="mb-4 p-3 bg-gray-800/30 border border-gray-600 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Imagen actual:</div>
              <img
                src={formData.content.mediaUrl}
                alt="Imagen actual"
                className="h-32 w-auto rounded border border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => {
                  const url = formData.content?.mediaUrl;
                  if (url) window.open(url, '_blank');
                }}
                title="Click para ver imagen completa"
              />
            </div>
          )}

          {/* Mostrar imagen seleccionada */}
          {imageFile && (
            <div className="mb-4 p-3 bg-gray-800/30 border border-gray-600 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Imagen seleccionada:</div>
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Imagen seleccionada"
                className="h-32 w-auto rounded border border-gray-700"
              />
              <button
                type="button"
                onClick={clearImageFile}
                className="mt-2 text-sm text-red-400 hover:text-red-300"
              >
                ✕ Eliminar imagen
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border transition-all hover:bg-gray-700/50 ${baseInputClass}`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Seleccionar Imagen</span>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </label>
            {imageFile && (
              <span className="text-sm text-green-400 flex items-center gap-1">
                ✓ {imageFile.name}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuestionMultimedia;
