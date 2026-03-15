import { Package } from "lucide-react";
interface NoDataProps {
    message?: string
}
const NoDataComponent: React.FC<NoDataProps> = ({
    message
}) => {
    return (
        <div className="flex flex-col items-center justify-center space-y-6 px-12 py-16 mx-auto bg-box rounded-3xl border border-line">
            <div className="p-3 rounded-full bg-gray-800">
                <Package className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-3 text-center">
                <h3 className="text-lg font-semibold text-blue-600">
                    {message ?? 'No se encontraron datos'}
                </h3>
                <p className="text-sm text-blue-400 leading-relaxed">
                    Actualmente no hay datos disponibles para mostrar.
                </p>
            </div>
        </div>
    );
}

export default NoDataComponent;