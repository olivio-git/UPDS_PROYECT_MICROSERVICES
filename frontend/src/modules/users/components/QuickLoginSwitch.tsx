import { Label } from "@/components/keel/label";
import { Switch } from "@/components/keel/switch";
import { authService } from "@/modules/auth/services/authService";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Admin switch for quick login: while on, every account signs in with email
 * and password only, without the code sent by email.
 */
const QuickLoginSwitch = () => {
  const [quickLogin, setQuickLogin] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    authService
      .getLoginSettings()
      .then((settings) => {
        if (active) setQuickLogin(settings?.quickLogin === true);
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleChange = async (checked: boolean) => {
    setIsSaving(true);
    try {
      const settings = await authService.updateLoginSettings(checked);
      setQuickLogin(settings.quickLogin);
      toast.success(settings.quickLogin ? "Inicio rápido activado" : "Inicio rápido desactivado");
    } catch (error) {
      const message = isAxiosError(error) ? error.response?.data?.message : undefined;
      toast.error(message || "No se pudo cambiar el inicio rápido");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor="quick-login">Inicio rápido (sin código)</Label>
        <p className="text-sm text-muted-foreground">
          {quickLogin
            ? "Activo: todos entran solo con correo y contraseña. Desactívalo al terminar la jornada."
            : "Todos reciben un código por correo antes de entrar."}
        </p>
      </div>
      <Switch
        id="quick-login"
        checked={quickLogin}
        onCheckedChange={handleChange}
        disabled={!isLoaded || isSaving}
      />
    </div>
  );
};

export default QuickLoginSwitch;
