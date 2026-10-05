import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/keel/button";
import { EmptyState } from "./EmptyState";

interface ErrorDataProps {
    onRetry?: () => void;
    errorMessage?: string;
}

const ErrorDataComponent: React.FC<ErrorDataProps> = ({ onRetry, errorMessage }) => (
    <EmptyState
        tone="destructive"
        icon={AlertTriangle}
        title="Algo salió mal"
        description={`${errorMessage ?? 'Ocurrió un error al cargar los datos'}. Por favor, intenta nuevamente.`}
        action={onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw />
                Intentar nuevamente
            </Button>
        )}
    />
);

export default ErrorDataComponent;
