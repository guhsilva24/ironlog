import React, { useState } from 'react';
import { WaterState } from '../types';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import {
  Droplets,
  Plus,
  RotateCcw,
  Target,
  Clock,
  Trash2,
  CheckCircle,
  Sparkles,
  Edit2,
} from 'lucide-react';

interface WaterSectionProps {
  water: WaterState;
  onUpdateWater: (water: WaterState) => void;
}

export const WaterSection: React.FC<WaterSectionProps> = ({ water, onUpdateWater }) => {
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState<boolean>(false);
  const [newGoal, setNewGoal] = useState<string>(String(water.dailyGoalMl));

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    isAlertOnly?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Excluir',
    isDestructive: true,
    isAlertOnly: false,
    onConfirm: () => {},
  });

  const percent = Math.min(
    100,
    Math.round((water.currentMl / (water.dailyGoalMl || 2500)) * 100)
  );
  const remaining = Math.max(0, water.dailyGoalMl - water.currentMl);
  const isGoalReached = water.currentMl >= water.dailyGoalMl;

  // Add water amount
  const handleAddWater = (amountMl: number) => {
    if (amountMl <= 0) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const newLog = {
      id: 'water-' + Date.now(),
      amountMl,
      timestamp: timeStr,
    };

    onUpdateWater({
      ...water,
      currentMl: water.currentMl + amountMl,
      logs: [newLog, ...water.logs],
    });
  };

  // Custom amount submit
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customAmount, 10);
    if (!isNaN(parsed) && parsed > 0) {
      handleAddWater(parsed);
      setCustomAmount('');
    }
  };

  // Remove a log entry
  const handleDeleteLog = (logId: string) => {
    const logToRemove = water.logs.find((l) => l.id === logId);
    if (!logToRemove) return;

    setConfirmModal({
      isOpen: true,
      title: 'Remover Registro de Água',
      message: `Deseja remover o registro de +${logToRemove.amountMl} ml (${logToRemove.timestamp})?`,
      confirmLabel: 'Remover',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        onUpdateWater({
          ...water,
          currentMl: Math.max(0, water.currentMl - logToRemove.amountMl),
          logs: water.logs.filter((l) => l.id !== logId),
        });
      },
    });
  };

  // Reset today's water
  const handleResetToday = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Zerar Consumo de Hoje',
      message: 'Tem certeza que deseja zerar o consumo de água registrado hoje?',
      confirmLabel: 'Zerar Água',
      isDestructive: false,
      isAlertOnly: false,
      onConfirm: () => {
        onUpdateWater({
          ...water,
          currentMl: 0,
          logs: [],
        });
      },
    });
  };

  // Save new daily goal
  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(newGoal, 10);
    if (!isNaN(parsed) && parsed >= 500) {
      onUpdateWater({
        ...water,
        dailyGoalMl: parsed,
      });
      setIsGoalModalOpen(false);
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Meta Inválida',
        message: 'Por favor, insira uma meta válida de pelo menos 500 ml.',
        isAlertOnly: true,
        onConfirm: () => {},
      });
    }
  };

  const quickButtons = [
    { label: '+150 ml', ml: 150, sub: 'Copo peq.' },
    { label: '+200 ml', ml: 200, sub: 'Copo padrão' },
    { label: '+300 ml', ml: 300, sub: 'Caneca' },
    { label: '+500 ml', ml: 500, sub: 'Garrafinha' },
    { label: '+750 ml', ml: 750, sub: 'Garrafa 750' },
    { label: '+1000 ml', ml: 1000, sub: '1 Litro' },
  ];

  return (
    <div id="water-section" className="space-y-6">
      {/* Main card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Controle de Água</h2>
              <p className="text-xs text-slate-500">
                Acompanhe e registre seu consumo diário de líquidos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="edit-goal-btn"
              type="button"
              onClick={() => {
                setNewGoal(String(water.dailyGoalMl));
                setIsGoalModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-sky-600" />
              Meta: {water.dailyGoalMl} ml
              <Edit2 className="w-3 h-3 text-slate-400" />
            </button>

            {water.currentMl > 0 && (
              <button
                id="reset-water-btn"
                type="button"
                onClick={handleResetToday}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Resetar consumo de hoje"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resetar dia
              </button>
            )}
          </div>
        </div>

        {/* Visual Progress Display */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-sky-50/50 to-sky-100/30 border border-sky-100 text-center space-y-4">
          <div className="inline-flex items-baseline justify-center gap-1.5">
            <span className="text-5xl sm:text-6xl font-extrabold text-sky-900 tracking-tight">
              {water.currentMl}
            </span>
            <span className="text-lg font-semibold text-sky-600">/ {water.dailyGoalMl} ml</span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 max-w-xl mx-auto">
            <div className="w-full bg-sky-200/70 h-4 rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isGoalReached ? 'bg-emerald-500' : 'bg-sky-600'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
              <span>{percent}% atingido</span>
              <span>
                {isGoalReached ? (
                  <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Meta batida!
                  </span>
                ) : (
                  <span>Faltam {remaining} ml</span>
                )}
              </span>
            </div>
          </div>

          {isGoalReached && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full animate-bounce">
              <Sparkles className="w-3.5 h-3.5" />
              Parabéns! Você alcançou a meta de hidratação hoje!
            </div>
          )}
        </div>

        {/* Quick Add Buttons */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Adicionar rapidamente:
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {quickButtons.map((btn) => (
              <button
                key={btn.ml}
                id={`quick-water-${btn.ml}`}
                type="button"
                onClick={() => handleAddWater(btn.ml)}
                className="py-3 px-2 flex flex-col items-center justify-center bg-slate-50 hover:bg-sky-50 active:scale-95 border border-slate-200 hover:border-sky-300 rounded-xl transition-all cursor-pointer group"
              >
                <span className="text-sm font-bold text-slate-800 group-hover:text-sky-700">
                  {btn.label}
                </span>
                <span className="text-[11px] text-slate-400 group-hover:text-sky-600">
                  {btn.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom manual addition input */}
        <form onSubmit={handleCustomSubmit} className="mt-5 pt-5 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Ou digite uma quantidade personalizada:
          </label>
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <input
                id="custom-water-input"
                type="number"
                step="10"
                min="10"
                max="5000"
                placeholder="Ex: 350"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-10"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                ml
              </span>
            </div>
            <button
              id="add-custom-water-btn"
              type="submit"
              disabled={!customAmount.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </form>
      </div>

      {/* History log for today */}
      {water.logs.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">
              Registros de Água de Hoje ({water.logs.length})
            </h3>
            <span className="text-xs text-slate-400">Toque na lixeira para corrigir engano</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {water.logs.map((log) => (
              <div
                key={log.id}
                id={`water-log-${log.id}`}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Droplets className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-slate-800">+{log.amountMl} ml</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.timestamp}
                  </span>
                </div>

                <button
                  id={`delete-water-log-${log.id}`}
                  type="button"
                  onClick={() => handleDeleteLog(log.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Desfazer este registro"
                  aria-label="Desfazer registro"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Edit Daily Goal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title="Definir Meta Diária de Água"
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Meta Diária (em mililitros) *
            </label>
            <div className="relative">
              <input
                id="goal-ml-input"
                type="number"
                step="100"
                min="500"
                max="10000"
                required
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-12"
                autoFocus
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">
                ml
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Exemplo: 2000 ml = 2 Litros | 2500 ml = 2,5 Litros | 3000 ml = 3 Litros
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {[2000, 2500, 3000, 3500].map((quickGoal) => (
              <button
                key={quickGoal}
                type="button"
                onClick={() => setNewGoal(String(quickGoal))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  newGoal === String(quickGoal)
                    ? 'bg-sky-50 border-sky-400 text-sky-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {quickGoal} ml ({quickGoal / 1000}L)
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              id="cancel-goal-modal-btn"
              type="button"
              onClick={() => setIsGoalModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-goal-modal-btn"
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              Salvar Meta
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation & Alert Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        isAlertOnly={confirmModal.isAlertOnly}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
};
