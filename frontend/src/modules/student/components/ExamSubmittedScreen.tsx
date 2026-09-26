import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/keel/button';
import { Card, CardContent } from '@/components/keel/card';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { CheckCircle, LayoutDashboard, LogOut, Mail } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ExamSubmittedScreenProps {
  /**
   * Display name of the exam just submitted, when known. Threaded through
   * router state from ExamPreparation — absent after a hard refresh (state
   * is lost), in which case a neutral label is shown instead.
   */
  examName?: string;
  /** When the finish request actually succeeded. Defaults to "now" when omitted. */
  submittedAt?: Date | string | null;
}

/**
 * Terminal screen shown after ANY successful exam submission — manual
 * finish, auto-submit on time-up, or a session ended/cancelled remotely by
 * a supervisor. Shared by both ExamRunnerHTTP and AdaptiveExamRunner.
 *
 * Product decision: exams run in a computer lab with rotating groups, so the
 * student must never wait here. Grading always happens in the background
 * (exam-service publishes `exam.attempt.finished` to Kafka, grading-service
 * grades asynchronously) — this screen never polls for a result and never
 * shows a score, even for adaptive/placement exams. The student closes their
 * own session; there is no automatic logout.
 */
export function ExamSubmittedScreen({ examName, submittedAt }: ExamSubmittedScreenProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  // The attempt is over — release the browser out of fullscreen so the
  // action buttons below behave like any normal page. Browser lockdown
  // itself is already disarmed by the caller (isActive/sessionStatus flip
  // before this screen renders), so no further infractions can be recorded;
  // this just cleans up the visual kiosk state left over from the exam.
  useEffect(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        // Nothing to degrade to — the page works the same outside fullscreen.
      });
    }
  }, []);

  const formattedTime = (() => {
    try {
      return new Date(submittedAt ?? Date.now()).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  })();

  return (
    <MainLayout hideHeader>
      <div className="min-h-screen flex items-center justify-center p-4">
        <GradientWrapper intensity="medium" size="lg">
          <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
            <CardContent className="p-8 text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-700/50 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="space-y-1">
                <h1 className="text-lg font-semibold text-foreground">Examen enviado</h1>
                {examName && <p className="text-sm text-foreground/80">{examName}</p>}
                {formattedTime && (
                  <p className="text-xs text-muted-foreground">Enviado el {formattedTime}</p>
                )}
              </div>

              <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground flex items-start gap-2 text-left">
                <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Tus respuestas quedaron guardadas. Te avisaremos por correo y notificación
                  cuando tu resultado esté disponible, y también lo verás en{' '}
                  <span className="font-medium text-foreground/80">Mis resultados</span>.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={() => logout()} className="w-full gap-2">
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </Button>
                <Button
                  onClick={() => navigate('/student/dashboard')}
                  variant="outline"
                  className="w-full gap-2 border-line bg-transparent text-foreground/80 hover:bg-muted hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Ir a mi panel
                </Button>
              </div>
            </CardContent>
          </Card>
        </GradientWrapper>
      </div>
    </MainLayout>
  );
}

export default ExamSubmittedScreen;
