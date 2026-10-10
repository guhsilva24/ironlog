import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, Info } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isAlertOnly?: boolean; // If true, only shows an "OK / Entendi" button (replaces window.alert)
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  isDestructive = true,
  isAlertOnly = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="confirm-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="confirm-modal-container"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3 p-5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isAlertOnly
                ? 'bg-amber-100 text-amber-700'
                : isDestructive
                ? 'bg-red-100 text-red-600'
                : 'bg-blue-100 text-blue-600'
            }`}
          >
            {isAlertOnly ? (
              <Info className="w-5 h-5" />
            ) : isDestructive ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">{message}</p>
          </div>

          <button
            id="confirm-modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-100">
          {isAlertOnly ? (
            <button
              id="confirm-modal-ok-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              Entendi
            </button>
          ) : (
            <>
              <button
                id="confirm-modal-cancel-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                id="confirm-modal-action-btn"
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors cursor-pointer shadow-xs ${
                  isDestructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
