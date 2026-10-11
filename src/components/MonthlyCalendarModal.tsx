import React, { useState, useMemo } from 'react';
import { AppData, DailyNutritionHistory, DailyWorkoutDaysHistory } from '../types';
import {
  loadWorkoutDaysHistory,
  loadNutritionHistory,
  loadWaterHistory,
  loadDailySummaries,
  loadDailyWorkoutStatus,
  calculateNutritionTotals,
} from '../utils/storage';
import { loadWorkoutHistory } from '../utils/workoutHistory';
import {
  getTodayLocalDateString,
  getMonthYearLabel,
  getDaysInMonth,
  getFirstWeekdayIndex,
  formatDateWithWeekday,
} from '../utils/dateUtils';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
  Dumbbell,
  Utensils,
  Droplets,
  Heart,
  Bot,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface MonthlyCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppData;
  initialDate?: string;
  onNavigateToDiet: (dateStr: string) => void;
  onNavigateToWorkout: (dateStr: string) => void;
  onAskAi: (prompt: string) => void;
}

export const MonthlyCalendarModal: React.FC<MonthlyCalendarModalProps> = ({
  isOpen,
  onClose,
  appData,
  initialDate,
  onNavigateToDiet,
  onNavigateToWorkout,
  onAskAi,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateString(), []);

  // Selected date state
  const [selectedDate, setSelectedDate] = useState<string>(() => initialDate || todayStr);

  // Month and year navigation
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const base = initialDate || todayStr;
    const parts = base.split('-');
    return parts.length === 3 ? parseInt(parts[0], 10) : new Date().getFullYear();
  });

  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => {
    const base = initialDate || todayStr;
    const parts = base.split('-');
    return parts.length === 3 ? parseInt(parts[1], 10) - 1 : new Date().getMonth();
  });

  // Cached historical records
  const workoutDaysHistory = useMemo(() => loadWorkoutDaysHistory(), [isOpen]);
  const workoutHistory = useMemo(() => loadWorkoutHistory(), [isOpen]);
  const nutritionHistory = useMemo(() => loadNutritionHistory(), [isOpen]);
  const waterHistory = useMemo(() => loadWaterHistory(), [isOpen]);
  const dailySummaries = useMemo(() => loadDailySummaries(), [isOpen]);
  const todayWorkoutStatus = useMemo(() => loadDailyWorkoutStatus(), [isOpen]);

  if (!isOpen) return null;

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const [y, m, d] = todayStr.split('-').map(Number);
    setCurrentYear(y);
    setCurrentMonthIndex(m - 1);
    setSelectedDate(todayStr);
  };

  // Helper to determine indicators for any date string
  const getDayIndicators = (dateStr: string) => {
    const isToday = dateStr === todayStr;

    // 1. Treino: treino concluído (de treino_dias_historico ou treino_historico, o que existir)
    let hasWorkout = false;
    let workoutCompleted = false;

    if (isToday) {
      const anyDone = appData.workoutDays.some((d) => d.exercises.some((e) => e.done));
      workoutCompleted = !!todayWorkoutStatus.completed;
      hasWorkout = workoutCompleted || anyDone;
    } else {
      const session = workoutDaysHistory.find((h) => h.date === dateStr);
      if (session) {
        workoutCompleted = !!session.completed;
        hasWorkout = session.completed || (session.exercises && session.exercises.length > 0);
      } else {
        const hasLegacy = workoutHistory.some((h) => h.date === dateStr);
        if (hasLegacy) {
          hasWorkout = true;
          workoutCompleted = true;
        }
      }
    }

    // 2. Cardio feito
    let cardioDone = false;
    if (isToday) {
      cardioDone = !!todayWorkoutStatus.cardio?.done;
    } else {
      const session = workoutDaysHistory.find((h) => h.date === dateStr);
      if (session) {
        cardioDone = !!session.cardioDone;
      }
    }

    // 3. Nutrição: dia com alimentos registrados
    let hasNutrition = false;
    if (isToday) {
      const count = appData.meals.reduce((acc, m) => acc + m.items.length, 0);
      hasNutrition = count > 0;
    } else {
      const entry = nutritionHistory.find((h) => h.date === dateStr);
      if (entry && (entry.totals?.itemsCount > 0 || entry.meals.some((m) => m.items.length > 0))) {
        hasNutrition = true;
      }
    }

    // 4. Água: meta batida (de agua_historico ou resumo_diario)
    let waterGoalMet = false;
    if (isToday) {
      waterGoalMet =
        appData.water.dailyGoalMl > 0 && appData.water.currentMl >= appData.water.dailyGoalMl;
    } else {
      const waterEntry = waterHistory.find((w) => w.date === dateStr);
      if (waterEntry && waterEntry.goalMl > 0 && waterEntry.totalMl >= waterEntry.goalMl) {
        waterGoalMet = true;
      } else {
        const summaryEntry = dailySummaries.find((s) => s.date === dateStr);
        if (
          summaryEntry &&
          summaryEntry.waterGoalMl > 0 &&
          summaryEntry.waterMl >= summaryEntry.waterGoalMl
        ) {
          waterGoalMet = true;
        }
      }
    }

    return {
      hasWorkout,
      workoutCompleted,
      cardioDone,
      hasNutrition,
      waterGoalMet,
    };
  };

  // Detailed snapshot for the selected date
  const getSelectedDayDetails = () => {
    const isToday = selectedDate === todayStr;

    // Treino
    let exercises: {
      name: string;
      sets?: string | number;
      reps?: string | number;
      weight?: string;
      failure?: boolean;
    }[] = [];
    let workoutCompleted = false;

    if (isToday) {
      workoutCompleted = !!todayWorkoutStatus.completed;
      appData.workoutDays.forEach((d) => {
        d.exercises.forEach((e) => {
          if (e.done) {
            exercises.push({
              name: e.name,
              sets: e.sets,
              reps: e.reps,
              weight: e.weight,
              failure: e.failure,
            });
          }
        });
      });
    } else {
      const session = workoutDaysHistory.find((h) => h.date === selectedDate);
      if (session) {
        workoutCompleted = !!session.completed;
        if (session.exercises && session.exercises.length > 0) {
          exercises = session.exercises;
        }
      }
      if (exercises.length === 0) {
        const legacy = workoutHistory.filter((h) => h.date === selectedDate);
        if (legacy.length > 0) {
          workoutCompleted = true;
          exercises = legacy.map((l) => ({
            name: l.exerciseName,
            sets: l.sets,
            reps: l.reps,
            weight: l.weight,
          }));
        }
      }
    }

    // Cardio
    let cardioDone = false;
    let cardioType = '';
    let cardioMinutes: string | number = '';

    if (isToday) {
      cardioDone = !!todayWorkoutStatus.cardio?.done;
      cardioType = todayWorkoutStatus.cardio?.type || '';
      cardioMinutes = todayWorkoutStatus.cardio?.durationMinutes || '';
    } else {
      const session = workoutDaysHistory.find((h) => h.date === selectedDate);
      if (session) {
        cardioDone = !!session.cardioDone;
        cardioType = session.cardioType || '';
        cardioMinutes = session.cardioMinutes || '';
      }
    }

    // Nutrição
    let nutritionTotals: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      sodium?: number;
      itemsCount: number;
    } | null = null;

    if (isToday) {
      const t = calculateNutritionTotals(appData.meals);
      if (t.itemsCount > 0) {
        nutritionTotals = {
          calories: t.calories,
          protein: t.protein,
          carbs: t.carbs,
          fat: t.fat,
          fiber: t.fiber,
          sodium: t.sodium,
          itemsCount: t.itemsCount,
        };
      }
    } else {
      const entry = nutritionHistory.find((h) => h.date === selectedDate);
      if (entry && entry.totals && entry.totals.itemsCount > 0) {
        nutritionTotals = {
          calories: entry.totals.calories,
          protein: entry.totals.protein,
          carbs: entry.totals.carbs,
          fat: entry.totals.fat,
          fiber: entry.totals.fiber,
          sodium: entry.totals.sodium,
          itemsCount: entry.totals.itemsCount,
        };
      } else {
        const sum = dailySummaries.find((s) => s.date === selectedDate);
        if (sum && (sum.calories > 0 || sum.protein > 0)) {
          nutritionTotals = {
            calories: sum.calories,
            protein: sum.protein,
            carbs: sum.carbs,
            fat: sum.fat,
            itemsCount: 1,
          };
        }
      }
    }

    // Água
    let waterMl: number | null = null;
    let waterGoalMl: number | null = null;
    let waterGoalMet = false;

    if (isToday) {
      waterMl = appData.water.currentMl;
      waterGoalMl = appData.water.dailyGoalMl;
      waterGoalMet = (waterGoalMl || 0) > 0 && waterMl >= (waterGoalMl || 0);
    } else {
      const waterEntry = waterHistory.find((w) => w.date === selectedDate);
      if (waterEntry) {
        waterMl = waterEntry.totalMl;
        waterGoalMl = waterEntry.goalMl;
        waterGoalMet = waterGoalMl > 0 && waterMl >= waterGoalMl;
      } else {
        const sum = dailySummaries.find((s) => s.date === selectedDate);
        if (sum) {
          waterMl = sum.waterMl;
          waterGoalMl = sum.waterGoalMl;
          waterGoalMet = waterGoalMl > 0 && waterMl >= waterGoalMl;
        }
      }
    }

    return {
      date: selectedDate,
      isToday,
      workoutCompleted,
      exercises,
      cardioDone,
      cardioType,
      cardioMinutes,
      nutritionTotals,
      waterMl,
      waterGoalMl,
      waterGoalMet,
    };
  };

  const selectedDetails = getSelectedDayDetails();

  // Prompt generator for AI question
  const handleAskAiAboutDay = () => {
    const formatted = formatDateWithWeekday(selectedDate);

    const workoutText =
      selectedDetails.exercises.length > 0
        ? `${selectedDetails.exercises.length} exercícios (${
            selectedDetails.workoutCompleted ? 'Treino concluído' : 'Em andamento'
          }): ` +
          selectedDetails.exercises
            .map(
              (e) =>
                `${e.name} ${e.sets}x${e.reps}${e.weight ? ` com ${e.weight}` : ''}${
                  e.failure ? ' [Falha]' : ''
                }`
            )
            .join(', ')
        : selectedDetails.workoutCompleted
        ? 'Treino marcado como concluído'
        : 'Nenhum exercício registrado';

    const cardioText = selectedDetails.cardioDone
      ? `Sim${selectedDetails.cardioType ? ` (${selectedDetails.cardioType})` : ''}${
          selectedDetails.cardioMinutes ? ` por ${selectedDetails.cardioMinutes} min` : ''
        }`
      : 'Sem cardio registrado';

    const nutritionText = selectedDetails.nutritionTotals
      ? `${selectedDetails.nutritionTotals.calories} kcal, ${selectedDetails.nutritionTotals.protein}g proteína, ${selectedDetails.nutritionTotals.carbs}g carboidratos, ${selectedDetails.nutritionTotals.fat}g gorduras (${selectedDetails.nutritionTotals.itemsCount} alimentos registrados)`
      : 'Sem refeições registradas';

    const waterText =
      selectedDetails.waterMl !== null && selectedDetails.waterGoalMl !== null
        ? `${selectedDetails.waterMl} ml de meta ${selectedDetails.waterGoalMl} ml (${
            selectedDetails.waterGoalMet ? 'meta batida' : 'meta não atingida'
          })`
        : 'Sem registro de água';

    const prompt = `Analise o meu dia ${formatted} com base nos dados reais que registrei no app:
- Treino: ${workoutText}
- Cardio: ${cardioText}
- Nutrição: ${nutritionText}
- Água: ${waterText}

Dê um feedback objetivo sobre a minha consistência e disciplina neste dia, destacando acertos, pontos de atenção e 2 recomendações práticas para os próximos dias.`;

    onClose();
    onAskAi(prompt);
  };

  // Calendar calculations
  const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
  const firstDayWeekIndex = getFirstWeekdayIndex(currentYear, currentMonthIndex); // 0 (Seg) to 6 (Dom)
  const weekdaysLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Calendário de Rotina
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualize seus treinos, cardio, refeições e água dia a dia
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar calendário"
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Month selector and "Hoje" button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mês anterior"
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-200 min-w-[150px] text-center select-none">
                {getMonthYearLabel(currentYear, currentMonthIndex)}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Próximo mês"
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoToToday}
              className="px-3.5 py-2.5 min-h-[44px] flex items-center justify-center rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              Hoje
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-2xs" />
              Treino
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-2xs" />
              Cardio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs" />
              Nutrição
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-2xs" />
              Água (meta batida)
            </span>
          </div>

          {/* Calendar Grid (Seg a Dom) */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-2 bg-slate-50/40 dark:bg-slate-900">
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {weekdaysLabels.map((label, idx) => (
                <div
                  key={idx}
                  className="py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none uppercase tracking-wider"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Empty padding cells for start of month */}
              {Array.from({ length: firstDayWeekIndex }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-12 sm:h-14 rounded-xl opacity-20" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(
                  2,
                  '0'
                )}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const indicators = getDayIndicators(dateStr);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    className={`h-12 sm:h-14 rounded-xl flex flex-col items-center justify-between p-1.5 transition-all cursor-pointer relative select-none ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-slate-900 dark:ring-white scale-[1.02] z-10'
                        : isToday
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-bold'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <span
                      className={`text-xs sm:text-sm font-bold leading-tight ${
                        isSelected
                          ? 'text-white dark:text-slate-900'
                          : isToday
                          ? 'text-blue-600 dark:text-blue-400'
                          : ''
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Dots indicator row */}
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-auto">
                      {indicators.hasWorkout && (
                        <span
                          title={indicators.workoutCompleted ? 'Treino concluído' : 'Treino registrado'}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-orange-400' : 'bg-orange-500'
                          }`}
                        />
                      )}
                      {indicators.cardioDone && (
                        <span
                          title="Cardio feito"
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-purple-300' : 'bg-purple-500'
                          }`}
                        />
                      )}
                      {indicators.hasNutrition && (
                        <span
                          title="Nutrição registrada"
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-emerald-300' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                      {indicators.waterGoalMet && (
                        <span
                          title="Meta de água batida"
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-sky-300' : 'bg-sky-500'
                          }`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel "Resumo do dia" */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Resumo do dia
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 capitalize">
                  {formatDateWithWeekday(selectedDate)}
                  {selectedDate === todayStr && (
                    <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 align-middle">
                      Hoje
                    </span>
                  )}
                </h3>
              </div>
            </div>

            {/* Grid with 4 metrics: Treino, Cardio, Nutrição, Água */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Treino card */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <Dumbbell className="w-4 h-4 text-orange-500" />
                    <span>Treino</span>
                  </div>
                  {selectedDetails.workoutCompleted ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Concluído
                    </span>
                  ) : selectedDetails.exercises.length > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                      {selectedDetails.exercises.length} feitos
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Sem treino</span>
                  )}
                </div>

                {selectedDetails.exercises.length > 0 ? (
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {selectedDetails.exercises.map((ex, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-0.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                      >
                        <span className="truncate font-medium">{ex.name}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-[11px] text-slate-500">
                            {ex.sets}x{ex.reps} {ex.weight ? `• ${ex.weight}` : ''}
                          </span>
                          {ex.failure && (
                            <span
                              title="Falha muscular"
                              className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400"
                            >
                              FALHA
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                    Nenhum exercício registrado neste dia.
                  </p>
                )}
              </div>

              {/* Cardio card */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <Heart className="w-4 h-4 text-purple-500" />
                    <span>Cardio</span>
                  </div>
                  {selectedDetails.cardioDone ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                      Realizado
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Não registrado</span>
                  )}
                </div>

                {selectedDetails.cardioDone ? (
                  <div className="text-slate-700 dark:text-slate-300 space-y-0.5">
                    <p className="font-semibold text-xs">
                      {selectedDetails.cardioType || 'Cardio do dia'}
                    </p>
                    {selectedDetails.cardioMinutes && (
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {selectedDetails.cardioMinutes} minutos
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                    Sem cardio registrado neste dia.
                  </p>
                )}
              </div>

              {/* Nutrição card */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <Utensils className="w-4 h-4 text-emerald-500" />
                    <span>Nutrição</span>
                  </div>
                  {selectedDetails.nutritionTotals ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      {selectedDetails.nutritionTotals.calories} kcal
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Sem registros</span>
                  )}
                </div>

                {selectedDetails.nutritionTotals ? (
                  <>
                    <div className="grid grid-cols-3 gap-1 text-[11px] text-center pt-1">
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Prot</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedDetails.nutritionTotals.protein}g
                        </span>
                      </div>
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Carb</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedDetails.nutritionTotals.carbs}g
                        </span>
                      </div>
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Gord</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedDetails.nutritionTotals.fat}g
                        </span>
                      </div>
                    </div>
                    {((selectedDetails.nutritionTotals.fiber !== undefined && selectedDetails.nutritionTotals.fiber > 0) ||
                      (selectedDetails.nutritionTotals.sodium !== undefined && selectedDetails.nutritionTotals.sodium > 0)) && (
                      <div className="flex items-center justify-center gap-3 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {selectedDetails.nutritionTotals.fiber !== undefined && selectedDetails.nutritionTotals.fiber > 0 && (
                          <span>Fibra: <strong className="text-teal-700 dark:text-teal-300">{Math.round(selectedDetails.nutritionTotals.fiber * 10) / 10}g</strong></span>
                        )}
                        {selectedDetails.nutritionTotals.sodium !== undefined && selectedDetails.nutritionTotals.sodium > 0 && (
                          <span>Sódio: <strong className="text-slate-700 dark:text-slate-300">{Math.round(selectedDetails.nutritionTotals.sodium)}mg</strong></span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                    Sem refeições registradas neste dia.
                  </p>
                )}
              </div>

              {/* Água card */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <Droplets className="w-4 h-4 text-sky-500" />
                    <span>Água</span>
                  </div>
                  {selectedDetails.waterGoalMet ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                      Meta batida
                    </span>
                  ) : selectedDetails.waterMl !== null ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Parcial
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Sem registros</span>
                  )}
                </div>

                {selectedDetails.waterMl !== null && selectedDetails.waterGoalMl !== null ? (
                  <div className="text-slate-700 dark:text-slate-300 space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{selectedDetails.waterMl} ml</span>
                      <span className="text-slate-400">meta: {selectedDetails.waterGoalMl} ml</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (selectedDetails.waterMl / (selectedDetails.waterGoalMl || 2500)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                    Sem registro de água neste dia.
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToDiet(selectedDate);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Ver nutrição deste dia</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToWorkout(selectedDate);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Dumbbell className="w-3.5 h-3.5" />
                <span>Ver treino deste dia</span>
              </button>

              <button
                type="button"
                onClick={handleAskAiAboutDay}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Perguntar à IA sobre este dia</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
