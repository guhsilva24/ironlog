import React, { useRef, useState } from 'react';
import { AppData, ActiveTab } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  getTodayFormatted,
  exportDataAsJson,
  DEFAULT_APP_DATA,
  saveAppData,
  getTodayDateString,
  saveNutritionHistory,
} from '../utils/storage';
import {
  Calendar,
  Dumbbell,
  Utensils,
  Droplets,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface SummarySectionProps {
  appData: AppData;
  onUpdateAppData: (data: AppData) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  appData,
  onUpdateAppData,
  onNavigateTab,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workout stats
  let totalExercises = 0;
  let doneExercises = 0;
  appData.workoutDays.forEach((d) => {
    d.exercises.forEach((ex) => {
      totalExercises++;
      if (ex.done) doneExercises++;
    });
  });

  // Diet stats
  let totalFoods = 0;
  let doneFoods = 0;
  appData.meals.forEach((m) => {
    m.items.forEach((f) => {
      totalFoods++;
      if (f.done) doneFoods++;
    });
  });

  // Water stats
  const waterPercent = Math.min(
    100,
    Math.round((appData.water.currentMl / (appData.water.dailyGoalMl || 2500)) * 100)
  );

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
    confirmLabel: 'Confirmar',
    isDestructive: true,
    isAlertOnly: false,
    onConfirm: () => {},
  });

  // Reset today's actions
  const handleResetEverythingToday = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Resetar Progresso de Hoje',
      message: 'Deseja resetar todo o progresso de hoje? (Desmarcará exercícios e refeições e zerará a água consumida, mantendo todas as suas rotinas e dados salvos).',
      confirmLabel: 'Resetar Progresso',
      isDestructive: false,
      isAlertOnly: false,
      onConfirm: () => {
        const resetDays = appData.workoutDays.map((d) => ({
          ...d,
          exercises: d.exercises.map((e) => ({ ...e, done: false })),
        }));
        const resetMeals = appData.meals.map((m) => ({
          ...m,
          items: m.items.map((i) => ({ ...i, done: false })),
        }));
        const resetWater = {
          ...appData.water,
          currentMl: 0,
          logs: [],
          lastDate: getTodayDateString(),
        };

        const updated: AppData = {
          ...appData,
          workoutDays: resetDays,
          meals: resetMeals,
          water: resetWater,
          lastActiveDate: getTodayDateString(),
        };
        onUpdateAppData(updated);
      },
    });
  };

  // Clear everything to 100% blank
  const handleClearAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Começar do Zero',
      message: 'ATENÇÃO: Deseja apagar todos os treinos, refeições e histórico para começar 100% vazio? Essa ação não pode ser desfeita.',
      confirmLabel: 'Apagar Tudo',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        const blankData: AppData = {
          version: 1,
          workoutDays: [
            { id: 'seg', name: 'Segunda-feira', subtitle: '', exercises: [] },
            { id: 'ter', name: 'Terça-feira', subtitle: '', exercises: [] },
            { id: 'qua', name: 'Quarta-feira', subtitle: '', exercises: [] },
            { id: 'qui', name: 'Quinta-feira', subtitle: '', exercises: [] },
            { id: 'sex', name: 'Sexta-feira', subtitle: '', exercises: [] },
            { id: 'sab', name: 'Sábado', subtitle: '', exercises: [] },
            { id: 'dom', name: 'Domingo', subtitle: '', exercises: [] },
          ],
          meals: [
            { id: 'm1', name: 'Café da Manhã', items: [] },
            { id: 'm2', name: 'Almoço', items: [] },
            { id: 'm3', name: 'Jantar', items: [] },
          ],
          water: {
            dailyGoalMl: 2500,
            currentMl: 0,
            logs: [],
            lastDate: getTodayDateString(),
          },
          lastActiveDate: getTodayDateString(),
        };
        onUpdateAppData(blankData);
      },
    });
  };

  // Restore starter sample
  const handleRestoreSample = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Restaurar Exemplo Inicial',
      message: 'Deseja restaurar o modelo de exemplo inicial? Seus dados atuais serão substituídos pelo modelo inicial padrão.',
      confirmLabel: 'Restaurar Exemplo',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        onUpdateAppData({ ...DEFAULT_APP_DATA, lastActiveDate: getTodayDateString() });
      },
    });
  };

  // Import JSON backup
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.workoutDays && parsed.meals && parsed.water) {
          saveAppData(parsed);
          if (Array.isArray(parsed.nutritionHistory)) {
            saveNutritionHistory(parsed.nutritionHistory);
          }
          onUpdateAppData(parsed);
          setConfirmModal({
            isOpen: true,
            title: 'Backup Restaurado',
            message: 'Seus dados e histórico de nutrição foram restaurados com sucesso!',
            confirmLabel: 'Entendido',
            isAlertOnly: true,
            onConfirm: () => {},
          });
        } else {
          setConfirmModal({
            isOpen: true,
            title: 'Arquivo Inválido',
            message: 'O arquivo selecionado não contém um formato de backup compatível.',
            confirmLabel: 'Fechar',
            isAlertOnly: true,
            onConfirm: () => {},
          });
        }
      } catch (err) {
        setConfirmModal({
          isOpen: true,
          title: 'Erro na Leitura',
          message: 'Não foi possível ler o arquivo JSON de backup.',
          confirmLabel: 'Fechar',
          isAlertOnly: true,
          onConfirm: () => {},
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="summary-section" className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg mb-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {getTodayFormatted()}
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Visão Geral de Hoje</h2>
            <p className="text-xs text-slate-500 mt-1">
              Acompanhe seu progresso de treino, refeições e consumo de água
            </p>
          </div>

          <button
            id="master-reset-today-btn"
            type="button"
            onClick={handleResetEverythingToday}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            Resetar Progresso de Hoje
          </button>
        </div>
      </div>

      {/* 3 Pillars Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Treino Card */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                <Dumbbell className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Treino</span>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900">{doneExercises}</span>
                <span className="text-sm font-medium text-slate-500">
                  / {totalExercises} feitos
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totalExercises === 0
                  ? 'Nenhum exercício cadastrado'
                  : doneExercises === totalExercises && totalExercises > 0
                  ? '🎉 Todos os treinos concluídos!'
                  : 'Exercícios marcados como feitos'}
              </p>
            </div>

            {totalExercises > 0 && (
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(doneExercises / totalExercises) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>

          <button
            id="summary-go-to-workout-btn"
            type="button"
            onClick={() => onNavigateTab('treino')}
            className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
          >
            <span>Ver treinos da semana</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Nutrição Card */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Utensils className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Nutrição</span>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900">{doneFoods}</span>
                <span className="text-sm font-medium text-slate-500">/ {totalFoods} consumidos</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totalFoods === 0
                  ? 'Nenhum alimento cadastrado'
                  : doneFoods === totalFoods && totalFoods > 0
                  ? '👏 Nutrição completa do dia!'
                  : 'Itens de refeição consumidos'}
              </p>
            </div>

            {totalFoods > 0 && (
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(doneFoods / totalFoods) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>

          <button
            id="summary-go-to-diet-btn"
            type="button"
            onClick={() => onNavigateTab('dieta')}
            className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <span>Ver plano de nutrição</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Água Card */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Droplets className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Água</span>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900">
                  {appData.water.currentMl}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  / {appData.water.dailyGoalMl} ml
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {waterPercent >= 100
                  ? '💧 Meta de hidratação atingida!'
                  : `Faltam ${Math.max(0, appData.water.dailyGoalMl - appData.water.currentMl)} ml`}
              </p>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${waterPercent}%`,
                }}
              />
            </div>
          </div>

          <button
            id="summary-go-to-water-btn"
            type="button"
            onClick={() => onNavigateTab('agua')}
            className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors cursor-pointer"
          >
            <span>Registrar mais água</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offline Storage, Backup & Data Reset Section */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-600" />
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Armazenamento Local & Gerenciamento de Dados
            </h3>
            <p className="text-xs text-slate-500">
              Todos os seus dados são salvos com segurança no seu próprio navegador (offline).
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Export JSON */}
          <button
            id="export-backup-btn"
            type="button"
            onClick={() => exportDataAsJson(appData)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Baixar arquivo de backup com todos os seus dados"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Fazer Backup (JSON)
          </button>

          {/* Import JSON */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
          <button
            id="import-backup-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Carregar arquivo de backup salvo anteriormente"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            Restaurar Backup
          </button>

          {/* Clear all */}
          <button
            id="clear-all-data-btn"
            type="button"
            onClick={handleClearAllData}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
            title="Apaga todos os dados para começar 100% vazio"
          >
            <Trash2 className="w-4 h-4" />
            Começar do Zero (Limpar)
          </button>

          {/* Restore sample */}
          <button
            id="restore-sample-btn"
            type="button"
            onClick={handleRestoreSample}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Recarregar modelo de exemplo inicial"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
            Restaurar Exemplo
          </button>
        </div>
      </div>

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
