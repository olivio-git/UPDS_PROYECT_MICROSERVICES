import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/keel/button';
import { Card, CardContent } from '@/components/keel/card';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { Ban, LayoutDashboard, LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exitFullscreenSafely } from '@/lib/fullscreen';

/**
 * Terminal screen shown when the teacher CANCELS the session while the
 * student is taking the exam. Product rule: a cancelled session is not
 * graded, so — unlike ExamSubmittedScreen — this never says the exam was
 * sent, and no finish request is made. Shared by ExamRunnerHTTP and
 * AdaptiveExamRunner.
 */
export function SessionCancelledScreen() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    exitFullscreenSafely();
  }, []);

  return (
    <MainLayout hideHeader>
      <div className="min-h-screen flex items-center justify-center p-4">
        <GradientWrapper intensity="medium" size="lg">
          <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
            <CardContent className="p-8 text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-muted/50 border border-line flex items-center justify-center mx-auto">
                <Ban className="h-8 w-8 text-muted-foreground" />
              </div>

              <div className="space-y-1">
                <h1 className="text-lg font-semibold text-foreground">Sesión cancelada</h1>
                <p className="text-sm text-muted-foreground">
                  La sesión fue cancelada por el docente. Tus respuestas no se enviarán a calificar.
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

export default SessionCancelledScreen;
