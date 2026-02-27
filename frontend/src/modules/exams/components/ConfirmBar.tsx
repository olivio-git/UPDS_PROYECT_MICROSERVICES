import React from "react";

interface Props {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "default" | "danger";
}

const ConfirmBar: React.FC<Props> = ({
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  tone = "default",
}) => {
  const toneClasses =
    tone === "danger"
      ? "bg-red-900/30 border-red-700/40"
      : "bg-dark-light border-line";

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] md:w-[720px] ${toneClasses} border rounded-xl shadow-lg`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-200">{message}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-transparent border border-line rounded-lg text-gray-300 hover:bg-black/20"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-white ${tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmBar;
