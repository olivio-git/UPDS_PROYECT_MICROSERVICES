import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../atoms/button";

interface ErrorDataProps {
    onRetry?: () => void;
    errorMessage?: string;
}
const ErrorDataComponent: React.FC<ErrorDataProps> = ({
    onRetry,
    errorMessage
}) => {
    return (
        <div className="flex flex-col items-center justify-center space-y-6 px-12 py-16 mx-auto bg-red-50 rounded-3xl border border-line bg-box">
            <div className="p-3 rounded-full bg-red-100">
                <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-3 text-center">
                <h3 className="text-lg font-semibold text-white">
                    ¡Ups! Algo salió mal
                </h3>
                <p className="text-sm text-red-400 leading-relaxed">
                    {errorMessage ?? 'Ocurrió un error al cargar los datos'}. Por favor, intenta nuevamente.
                </p>
            </div>
            {onRetry && (
                <Button
                    onClick={onRetry}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full px-8 py-2"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Intentar nuevamente
                </Button>
            )}
        </div>
    );
}

export default ErrorDataComponent;