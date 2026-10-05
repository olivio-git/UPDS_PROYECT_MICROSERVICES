import { EmptyState } from "./EmptyState";

interface NoDataProps {
    message?: string
}

const NoDataComponent: React.FC<NoDataProps> = ({ message }) => (
    <EmptyState
        title={message ?? 'No se encontraron datos'}
        description="Actualmente no hay datos disponibles para mostrar."
    />
);

export default NoDataComponent;
