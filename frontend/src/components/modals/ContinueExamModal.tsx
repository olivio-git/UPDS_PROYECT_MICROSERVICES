import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { useActiveSessionDetection } from '@/hooks/useActiveSessionDetection';
import { AlertCircle, Clock, Play, X } from 'lucide-react';
import React from 'react';

interface ContinueExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  sessionData?: {
    sessionId: string;
    timeRemaining: number;
    startedAt: Date;
    status: string;
  } | null;
}

export const ContinueExamModal: React.FC<ContinueExamModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  sessionData
}) => {
  const { formatTimeRemaining } = useActiveSessionDetection({ checkOnMount: false });

  if (!isOpen || !sessionData) return null;

  const isExpiringSoon = sessionData.timeRemaining <= 300; // 5 minutes or less

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-white">Examen en Progreso</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-gray-400">
            Tienes un examen activo que puedes continuar
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Session Info */}
          <div className="bg-gray-800/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Sesión ID:</span>
              <span className="text-sm font-mono text-white">
                {sessionData.sessionId.slice(-8)}...
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Estado:</span>
              <span className="text-sm font-semibold text-green-400">
                {sessionData.status === 'in_progress' ? 'En Progreso' : sessionData.status}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Tiempo Restante:</span>
              <div className={`flex items-center gap-1 text-sm font-mono ${
                isExpiringSoon ? 'text-red-400' : 'text-blue-400'
              }`}>
                <Clock className="h-4 w-4" />
                <span>{formatTimeRemaining(sessionData.timeRemaining)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Iniciado:</span>
              <span className="text-sm text-gray-300">
                {new Date(sessionData.startedAt).toLocaleTimeString('es-ES')}
              </span>
            </div>
          </div>

          {/* Warning for expiring exams */}
          {isExpiringSoon && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Tu examen expirará pronto. Continúa inmediatamente para no perder tu progreso.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
            >
              Más Tarde
            </Button>
            <Button
              onClick={onContinue}
              className={`flex-1 ${
                isExpiringSoon
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Play className="h-4 w-4 mr-2" />
              Continuar Examen
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Tu progreso se guarda automáticamente cada 10 segundos
          </p>
        </CardContent>
      </Card>
    </div>
  );
};