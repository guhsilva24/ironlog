import React, { useState, useEffect } from 'react';
import { WorkoutDay, WorkoutExercise } from '../types';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { ExerciseEvolutionModal } from './ExerciseEvolutionModal';
import { PastWeekWorkoutView } from './PastWeekWorkoutView';
import {
  Dumbbell,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  RotateCcw,
  Calendar,
  Layers,
  Repeat,
  Weight,
  FileText,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Flame,
  Zap,
  Activity,
  Timer,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  loadWorkoutHistory,
  recordWorkoutExerciseDone,
  removeWorkoutExerciseRecord,
  updateWorkoutExerciseRecord,
  getWeekRange,
  getExerciseProgression,
  WorkoutHistoryEntry,
  getDayOfWeekName,
} from '../utils/workoutHistory';
import {
  getTodayDateString,
  loadDailyWorkoutStatus,
  saveDailyWorkoutStatus,
  DailyWorkoutStatusStorage,
} from '../utils/storage';

interface WorkoutSectionProps {
  days: WorkoutDay[];
  onUpdateDays: (days: WorkoutDay[]) => void;
  targetWeekDate?: Date | null;
  onClearTargetWeekDate?: () => void;
}

export const WorkoutSection: React.FC<WorkoutSectionProps> = ({
  days,
  onUpdateDays,
  targetWeekDate,
  onClearTargetWeekDate,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<string>(days[0]?.id || '');

  // Histórico de treinos (treino_historico)
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>(() => loadWorkoutHistory());

  // Estado do treino de hoje (treino concluído, cardio) salvo em localStorage
  const [workoutStatus, setWorkoutStatus] = useState<DailyWorkoutStatusStorage>(() =>
    loadDailyWorkoutStatus()
  );

  // Navegação de semanas (segunda a domingo)
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(() => new Date());

  useEffect(() => {
    if (targetWeekDate) {
      setSelectedWeekDate(targetWeekDate);
      onClearTargetWeekDate?.();
    }
  }, [targetWeekDate, onClearTargetWeekDate]);

  const weekRange = getWeekRange(selectedWeekDate);

  // Modals state
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<WorkoutExercise | null>(null);

  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<WorkoutDay | null>(null);

  // Modal de evolução do exercício
  const [evolutionModal, setEvolutionModal] = useState<{
    isOpen: boolean;
    exerciseName: string;
    currentWeight?: string;
    isDoneToday?: boolean;
  }>({
    isOpen: false,
    exerciseName: '',
  });

  // In-app confirmation / alert modal state
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

  // Form states for exercise
  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState<string>('3');
  const [exReps, setExReps] = useState<string>('10-12');
  const [exWeight, setExWeight] = useState('');
  const [exNotes, setExNotes] = useState('');

  // Form states for day
  const [dayName, setDayName] = useState('');
  const [daySubtitle, setDaySubtitle] = useState('');

  const currentDay = days.find((d) => d.id === selectedDayId) || days[0];

  // Navegação de semana
  const handlePrevWeek = () => {
    setSelectedWeekDate((prev) => {
      const d = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setSelectedWeekDate((prev) => {
      const d = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7);
      return d;
    });
  };

  const handleGoToCurrentWeek = () => {
    setSelectedWeekDate(new Date());
  };

  // Helper: Open exercise modal for create
  const handleOpenAddExercise = () => {
    setEditingExercise(null);
    setExName('');
    setExSets('3');
    setExReps('10-12');
    setExWeight('');
    setExNotes('');
    setIsExerciseModalOpen(true);
  };

  // Helper: Open exercise modal for edit
  const handleOpenEditExercise = (exercise: WorkoutExercise) => {
    setEditingExercise(exercise);
    setExName(exercise.name);
    setExSets(String(exercise.sets));
    setExReps(String(exercise.reps));
    setExWeight(exercise.weight || '');
    setExNotes(exercise.notes || '');
    setIsExerciseModalOpen(true);
  };

  // Save exercise (create or edit)
  const handleSaveExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exName.trim()) return;

    if (editingExercise) {
      // Se o exercício editado já estiver marcado como feito hoje, atualiza também o histórico do dia
      if (editingExercise.done) {
        updateWorkoutExerciseRecord(editingExercise.name, {
          exerciseName: exName.trim(),
          sets: exSets.trim() || '3',
          reps: exReps.trim() || '10',
          weight: exWeight.trim() || undefined,
          notes: exNotes.trim() || undefined,
        });
        setHistory(loadWorkoutHistory());
      }

      const updatedDays = days.map((day) => ({
        ...day,
        exercises: day.exercises.map((ex) =>
          ex.id === editingExercise.id
            ? {
                ...ex,
                name: exName.trim(),
                sets: exSets.trim() || '3',
                reps: exReps.trim() || '10',
                weight: exWeight.trim() || undefined,
                notes: exNotes.trim() || undefined,
              }
            : ex
        ),
      }));
      onUpdateDays(updatedDays);
    } else {
      if (!currentDay) return;
      const newEx: WorkoutExercise = {
        id: 'ex-' + Date.now(),
        name: exName.trim(),
        sets: exSets.trim() || '3',
        reps: exReps.trim() || '10',
        weight: exWeight.trim() || undefined,
        notes: exNotes.trim() || undefined,
        done: false,
      };

      const updatedDays = days.map((day) => {
        if (day.id !== currentDay.id) return day;
        return {
          ...day,
          exercises: [...day.exercises, newEx],
        };
      });
      onUpdateDays(updatedDays);
    }

    setIsExerciseModalOpen(false);
  };

  // Delete exercise with in-app confirmation modal
  const handleDeleteExercise = (exercise: WorkoutExercise) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Exercício',
      message: `Tem certeza que deseja excluir o exercício "${exercise.name}"?`,
      confirmLabel: 'Excluir Exercício',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        const updatedDays = days.map((day) => ({
          ...day,
          exercises: day.exercises.filter((ex) => ex.id !== exercise.id),
        }));
        onUpdateDays(updatedDays);
      },
    });
  };

  // Toggle done status with automatic registration in treino_historico
  const handleToggleExerciseDone = (exId: string) => {
    const targetExercise = currentDay?.exercises.find((e) => e.id === exId);
    if (!targetExercise) return;

    const willBeDone = !targetExercise.done;

    if (willBeDone) {
      // 1. Salva automaticamente no histórico local
      recordWorkoutExerciseDone({
        exerciseName: targetExercise.name,
        sets: targetExercise.sets,
        reps: targetExercise.reps,
        weight: targetExercise.weight,
        notes: targetExercise.notes,
        dayOfWeek: currentDay?.name || getDayOfWeekName(getTodayDateString()),
      });
    } else {
      // 1. Se desmarcar, remove o registro daquele exercício daquela data
      removeWorkoutExerciseRecord(targetExercise.name);
    }

    // Atualiza estado local do histórico
    setHistory(loadWorkoutHistory());

    const updatedDays = days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) =>
        ex.id === exId
          ? {
              ...ex,
              done: willBeDone,
              // Se desmarcar "feito hoje", desliga a marcação de Falha também
              failure: willBeDone ? ex.failure : false,
            }
          : ex
      ),
    }));
    onUpdateDays(updatedDays);
  };

  // 1. Marcação por exercício: "Falha" (só pode ser ligado se feito hoje === true)
  const handleToggleFailure = (exId: string) => {
    const targetExercise = currentDay?.exercises.find((e) => e.id === exId);
    if (!targetExercise || !targetExercise.done) return;

    const nextFailure = !targetExercise.failure;
    const updatedDays = days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) =>
        ex.id === exId ? { ...ex, failure: nextFailure } : ex
      ),
    }));
    onUpdateDays(updatedDays);
  };

  // 2. Cardio do dia (hoje)
  const handleToggleCardioDone = () => {
    setWorkoutStatus((prev) => {
      const next = {
        ...prev,
        cardio: {
          ...prev.cardio,
          done: !prev.cardio.done,
        },
      };
      saveDailyWorkoutStatus(next);
      return next;
    });
  };

  const handleUpdateCardioDetails = (type: string, durationMinutes: string | number) => {
    setWorkoutStatus((prev) => {
      const next = {
        ...prev,
        cardio: {
          ...prev.cardio,
          type,
          durationMinutes,
        },
      };
      saveDailyWorkoutStatus(next);
      return next;
    });
  };

  // 3. Treino de hoje concluído
  const handleToggleWorkoutCompleted = () => {
    setWorkoutStatus((prev) => {
      const next = {
        ...prev,
        completed: !prev.completed,
      };
      saveDailyWorkoutStatus(next);
      return next;
    });
  };

  // Reset done status for current day with in-app confirmation
  const handleResetDayExercises = () => {
    if (!currentDay) return;
    setConfirmModal({
      isOpen: true,
      title: 'Zerar Checks de Hoje',
      message: `Deseja desmarcar todos os exercícios concluídos hoje em "${currentDay.name}"?`,
      confirmLabel: 'Zerar Checks',
      isDestructive: false,
      isAlertOnly: false,
      onConfirm: () => {
        // Remove os registros de hoje que forem desmarcados
        currentDay.exercises.forEach((ex) => {
          if (ex.done) {
            removeWorkoutExerciseRecord(ex.name);
          }
        });
        setHistory(loadWorkoutHistory());

        const updatedDays = days.map((day) => {
          if (day.id !== currentDay.id) return day;
          return {
            ...day,
            exercises: day.exercises.map((ex) => ({ ...ex, done: false, failure: false })),
          };
        });
        onUpdateDays(updatedDays);
      },
    });
  };

  // Open day modal for add
  const handleOpenAddDay = () => {
    setEditingDay(null);
    setDayName('');
    setDaySubtitle('');
    setIsDayModalOpen(true);
  };

  // Open day modal for edit
  const handleOpenEditDay = (day: WorkoutDay) => {
    setEditingDay(day);
    setDayName(day.name);
    setDaySubtitle(day.subtitle || '');
    setIsDayModalOpen(true);
  };

  // Save day (create or edit)
  const handleSaveDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayName.trim()) return;

    if (editingDay) {
      const updatedDays = days.map((d) =>
        d.id === editingDay.id
          ? {
              ...d,
              name: dayName.trim(),
              subtitle: daySubtitle.trim() || undefined,
            }
          : d
      );
      onUpdateDays(updatedDays);
    } else {
      const newDay: WorkoutDay = {
        id: 'day-' + Date.now(),
        name: dayName.trim(),
        subtitle: daySubtitle.trim() || undefined,
        exercises: [],
      };
      const updatedDays = [...days, newDay];
      onUpdateDays(updatedDays);
      setSelectedDayId(newDay.id);
    }
    setIsDayModalOpen(false);
  };

  // Delete day with in-app confirmation
  const handleDeleteDay = (day: WorkoutDay) => {
    if (days.length <= 1) {
      setConfirmModal({
        isOpen: true,
        title: 'Atenção',
        message: 'Você precisa manter pelo menos um dia na sua rotina de treinos.',
        confirmLabel: 'Entendido',
        isDestructive: false,
        isAlertOnly: true,
        onConfirm: () => {},
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Dia de Treino',
      message: `Tem certeza que deseja excluir o dia "${day.name}" e todos os seus ${day.exercises.length} exercício(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir Dia',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        const updatedDays = days.filter((d) => d.id !== day.id);
        onUpdateDays(updatedDays);
        if (selectedDayId === day.id) {
          setSelectedDayId(updatedDays[0]?.id || '');
        }
      },
    });
  };

  // Abre modal de evolução para um exercício específico
  const handleOpenEvolution = (exercise: WorkoutExercise) => {
    setEvolutionModal({
      isOpen: true,
      exerciseName: exercise.name,
      currentWeight: exercise.weight,
      isDoneToday: exercise.done,
    });
  };

  const completedCount = currentDay?.exercises.filter((ex) => ex.done).length || 0;
  const totalCount = currentDay?.exercises.length || 0;
  const allExercisesDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div id="workout-section" className="space-y-5">
      {/* 3. Seletor de Semanas Anteriores (Segunda a Domingo) */}
      <div
        id="workout-week-selector"
        className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="prev-week-btn"
            type="button"
            onClick={handlePrevWeek}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              {weekRange.label}
            </span>
            {weekRange.isCurrentWeek ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                Hoje
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 px-2 py-0.5 rounded-full">
                Semana Passada
              </span>
            )}
          </div>

          <button
            id="next-week-btn"
            type="button"
            onClick={handleNextWeek}
            disabled={weekRange.isCurrentWeek}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Próxima semana"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {!weekRange.isCurrentWeek && (
          <button
            id="today-week-shortcut-btn"
            type="button"
            onClick={handleGoToCurrentWeek}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hoje
          </button>
        )}
      </div>

      {/* Condicional: Visualização da Semana Passada (Somente Leitura) vs Semana Atual Ativa */}
      {!weekRange.isCurrentWeek ? (
        <PastWeekWorkoutView
          weekRange={weekRange}
          history={history}
          onGoToCurrentWeek={handleGoToCurrentWeek}
          onOpenEvolution={(exName) =>
            setEvolutionModal({
              isOpen: true,
              exerciseName: exName,
            })
          }
        />
      ) : (
        <>
          {/* Resumo do Dia no Topo: "X de Y exercícios | Cardio: sim/não | Treino: concluído/pendente" */}
          <div
            id="today-workout-overview-bar"
            className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-700/60 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  workoutStatus.completed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                }`}
              >
                {workoutStatus.completed ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Activity className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                    Hoje
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {getDayOfWeekName(getTodayDateString())}
                  </span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>
                    <strong className="text-orange-400 font-black">{completedCount}</strong> de{' '}
                    <strong className="font-black">{totalCount}</strong> exercícios
                  </span>
                  <span className="text-slate-500 hidden sm:inline">|</span>
                  <span className="flex items-center gap-1.5">
                    Cardio:{' '}
                    <strong
                      className={workoutStatus.cardio.done ? 'text-emerald-400 font-black' : 'text-slate-400 font-bold'}
                    >
                      {workoutStatus.cardio.done ? 'sim' : 'não'}
                    </strong>
                    {workoutStatus.cardio.done && workoutStatus.cardio.durationMinutes && (
                      <span className="text-xs text-slate-400 font-medium">
                        ({workoutStatus.cardio.durationMinutes} min)
                      </span>
                    )}
                  </span>
                  <span className="text-slate-500 hidden sm:inline">|</span>
                  <span className="flex items-center gap-1.5">
                    Treino:{' '}
                    <strong
                      className={
                        workoutStatus.completed ? 'text-emerald-400 font-black' : 'text-amber-400 font-bold'
                      }
                    >
                      {workoutStatus.completed ? 'concluído' : 'pendente'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Sugestão contextual se todos os exercícios do dia foram feitos */}
            {allExercisesDone && !workoutStatus.completed && (
              <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  Todos os exercícios feitos! Deseja marcar o treino como concluído?
                </span>
                <button
                  type="button"
                  onClick={handleToggleWorkoutCompleted}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Concluir agora
                </button>
              </div>
            )}
          </div>

          {/* Cards do Topo: Treino de Hoje Concluído & Cardio do Dia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 3. Treino Concluído Card */}
            <div
              id="workout-completed-card"
              className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                workoutStatus.completed
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button
                    id="toggle-workout-completed-btn"
                    type="button"
                    onClick={handleToggleWorkoutCompleted}
                    className={`mt-0.5 p-1 rounded-xl transition-colors cursor-pointer shrink-0 ${
                      workoutStatus.completed
                        ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                    }`}
                    title={
                      workoutStatus.completed
                        ? 'Clique para desmarcar treino concluído'
                        : 'Clique para marcar treino como concluído'
                    }
                  >
                    {workoutStatus.completed ? (
                      <CheckCircle2 className="w-7 h-7 fill-emerald-100 dark:fill-emerald-900/60" />
                    ) : (
                      <Circle className="w-7 h-7" />
                    )}
                  </button>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>Treino de hoje concluído</span>
                      {workoutStatus.completed && (
                        <span className="text-[11px] font-black uppercase text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                          Concluído
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {workoutStatus.completed
                        ? 'Parabéns! O treino de hoje está registrado como concluído.'
                        : 'Marque quando finalizar seu treino, independente da quantidade de exercícios.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botão grande alternativo para toque fácil no celular */}
              <button
                id="big-workout-completed-toggle"
                type="button"
                onClick={handleToggleWorkoutCompleted}
                className={`mt-4 w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  workoutStatus.completed
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {workoutStatus.completed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Treino Concluído (Toque para desmarcar)
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4" />
                    Marcar Treino de Hoje como Concluído
                  </>
                )}
              </button>
            </div>

            {/* 2. Cardio do Dia Card */}
            <div
              id="cardio-card"
              className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                workoutStatus.cardio.done
                  ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    id="toggle-cardio-btn"
                    type="button"
                    onClick={handleToggleCardioDone}
                    className={`mt-0.5 p-1 rounded-xl transition-colors cursor-pointer shrink-0 ${
                      workoutStatus.cardio.done
                        ? 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                    }`}
                    title={
                      workoutStatus.cardio.done
                        ? 'Desmarcar cardio de hoje'
                        : 'Marcar que fez cardio hoje'
                    }
                  >
                    {workoutStatus.cardio.done ? (
                      <CheckCircle2 className="w-7 h-7 fill-amber-100 dark:fill-amber-900/60" />
                    ) : (
                      <Circle className="w-7 h-7" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>Cardio do dia</span>
                      {workoutStatus.cardio.done && (
                        <span className="text-[11px] font-black uppercase text-amber-700 bg-amber-100 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                          Feito
                        </span>
                      )}
                    </h3>
                    <label
                      htmlFor="cardio-checkbox-input"
                      onClick={handleToggleCardioDone}
                      className="text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer flex items-center gap-1.5 mt-0.5 select-none"
                    >
                      <span>Fiz cardio hoje</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Campos opcionais de tipo e duração em minutos */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Tipo de cardio (opcional)
                  </label>
                  <input
                    id="cardio-type-input"
                    type="text"
                    placeholder="Ex: esteira, bike, corrida..."
                    value={workoutStatus.cardio.type || ''}
                    onChange={(e) =>
                      handleUpdateCardioDetails(e.target.value, workoutStatus.cardio.durationMinutes || '')
                    }
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Duração em minutos (opcional)
                  </label>
                  <div className="relative">
                    <input
                      id="cardio-duration-input"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Ex: 30"
                      value={workoutStatus.cardio.durationMinutes || ''}
                      onChange={(e) =>
                        handleUpdateCardioDetails(workoutStatus.cardio.type || '', e.target.value)
                      }
                      className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium">
                      min
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Header card with day selection */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Rotina de Treinos</h2>
                  <p className="text-xs text-slate-500">Organize os exercícios por dia da semana</p>
                </div>
              </div>

              <button
                id="add-day-btn"
                type="button"
                onClick={handleOpenAddDay}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Adicionar Dia
              </button>
            </div>

            {/* Days Horizontal Scroll / Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {days.map((day) => {
                const isSelected = day.id === (currentDay?.id || selectedDayId);
                const dayDone = day.exercises.length > 0 && day.exercises.every((e) => e.done);
                const hasExercises = day.exercises.length > 0;

                return (
                  <button
                    key={day.id}
                    id={`day-tab-${day.id}`}
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{day.name}</span>
                    {hasExercises && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                          isSelected
                            ? dayDone
                              ? 'bg-orange-800 text-orange-100'
                              : 'bg-orange-500 text-white'
                            : dayDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {day.exercises.filter((e) => e.done).length}/{day.exercises.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Details & Exercises */}
          {currentDay && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200 space-y-5">
              {/* Day header banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-800">{currentDay.name}</h3>
                    <button
                      id="edit-day-name-btn"
                      type="button"
                      onClick={() => handleOpenEditDay(currentDay)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Editar nome do dia"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      id="delete-day-btn"
                      type="button"
                      onClick={() => handleDeleteDay(currentDay)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Apagar este dia"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {currentDay.subtitle && (
                    <p className="text-sm text-slate-500 mt-0.5">{currentDay.subtitle}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {totalCount > 0 && (
                    <button
                      id="reset-day-exercises-btn"
                      type="button"
                      onClick={handleResetDayExercises}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Desmarcar todos os exercícios deste dia"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Zerar checks de hoje
                    </button>
                  )}

                  <button
                    id="add-exercise-btn"
                    type="button"
                    onClick={handleOpenAddExercise}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Exercício
                  </button>
                </div>
              </div>

              {/* Progress bar for selected day */}
              {totalCount > 0 && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <span>Progresso do dia:</span>
                    <span className="font-bold text-slate-800">
                      {completedCount} de {totalCount} concluídos (
                      {Math.round((completedCount / totalCount) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full sm:w-48 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Exercises list */}
              <div className="space-y-3">
                {currentDay.exercises.length === 0 ? (
                  <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl">
                    <Dumbbell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">
                      Nenhum exercício cadastrado para {currentDay.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Toque no botão abaixo para adicionar seu primeiro exercício neste dia.
                    </p>
                    <button
                      id="empty-add-exercise-btn"
                      type="button"
                      onClick={handleOpenAddExercise}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Exercício
                    </button>
                  </div>
                ) : (
                  currentDay.exercises.map((exercise) => {
                    const progression = getExerciseProgression(
                      history,
                      exercise.name,
                      exercise.weight,
                      exercise.done
                    );
                    const isNewRecord = progression.todayNewRecord;

                    return (
                      <div
                        key={exercise.id}
                        id={`exercise-item-${exercise.id}`}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 ${
                          exercise.done
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-slate-700 dark:text-slate-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                        }`}
                      >
                        {/* Linha 1: Checkbox (ícone de 28px) + nome do exercício (break-words) + selos */}
                        <div className="flex items-start gap-2.5 sm:gap-3 w-full">
                          <button
                            id={`toggle-exercise-${exercise.id}`}
                            type="button"
                            onClick={() => handleToggleExerciseDone(exercise.id)}
                            className={`p-1 -ml-1 rounded-xl transition-colors cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${
                              exercise.done
                                ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                            title={
                              exercise.done ? 'Marcar como não feito' : 'Marcar como feito hoje'
                            }
                            aria-label={
                              exercise.done ? 'Marcar como não feito' : 'Marcar como feito hoje'
                            }
                          >
                            {exercise.done ? (
                              <CheckCircle2 className="w-7 h-7 fill-emerald-100 dark:fill-emerald-900/60 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Circle className="w-7 h-7" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <h4
                                className={`text-base font-bold break-words ${
                                  exercise.done
                                    ? 'line-through text-slate-500 dark:text-slate-400'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {exercise.name}
                              </h4>
                              {exercise.done && (
                                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                                  Feito hoje
                                </span>
                              )}
                              {exercise.failure && (
                                <span className="text-[11px] font-black text-rose-700 bg-rose-100 dark:bg-rose-950/80 dark:text-rose-300 px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-800 flex items-center gap-1 shrink-0">
                                  🔥 Falha
                                </span>
                              )}
                              {isNewRecord && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-full shadow-2xs shrink-0">
                                  🏆 Novo recorde
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Linha 2, largura total do cartão: etiquetas de séries, reps e carga + observação */}
                        <div className="w-full space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg whitespace-nowrap">
                              <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                              {exercise.sets} {Number(exercise.sets) === 1 ? 'série' : 'séries'}
                            </span>

                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg whitespace-nowrap">
                              <Repeat className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                              {exercise.reps} reps
                            </span>

                            {exercise.weight && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-800 dark:text-orange-300 bg-orange-100/80 dark:bg-orange-950/60 px-2.5 py-1 rounded-lg whitespace-nowrap">
                                <Weight className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                                {exercise.weight}
                              </span>
                            )}
                          </div>

                          {exercise.notes && (
                            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 flex items-start gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                              <span className="whitespace-pre-wrap break-words">{exercise.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Linha 3: botões Falha, Evolução, Editar e Excluir lado a lado (altura mínima 44px) */}
                        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          {/* Botão Falha (flex-1 min-w-[96px] min-h-[44px]) */}
                          <button
                            id={`toggle-failure-${exercise.id}`}
                            type="button"
                            onClick={() => handleToggleFailure(exercise.id)}
                            disabled={!exercise.done}
                            title={
                              !exercise.done
                                ? 'Marque o exercício como feito para ativar a marcação de Falha'
                                : exercise.failure
                                ? 'Falha ativada: clique para desativar'
                                : 'Clique para marcar que chegou à falha muscular'
                            }
                            className={`flex-1 min-w-[96px] min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              !exercise.done
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                                : exercise.failure
                                ? 'bg-rose-500 text-white border-rose-600 shadow-xs ring-2 ring-rose-200 dark:ring-rose-950 font-black'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300'
                            }`}
                          >
                            <Flame
                              className={`w-4 h-4 shrink-0 ${
                                exercise.failure ? 'fill-white text-white' : 'text-slate-400'
                              }`}
                            />
                            <span>Falha</span>
                          </button>

                          {/* Botão Evolução (flex-1 min-w-[96px] min-h-[44px]) */}
                          <button
                            id={`evolution-btn-${exercise.id}`}
                            type="button"
                            onClick={() => handleOpenEvolution(exercise)}
                            className="flex-1 min-w-[96px] min-h-[44px] px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-200 dark:border-violet-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            title="Ver histórico e evolução deste exercício"
                          >
                            <TrendingUp className="w-4 h-4 shrink-0" />
                            <span>Evolução</span>
                          </button>

                          {/* Botão Editar (quadrado de 44px) */}
                          <button
                            id={`edit-exercise-btn-${exercise.id}`}
                            type="button"
                            onClick={() => handleOpenEditExercise(exercise)}
                            className="w-11 h-11 min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center justify-center"
                            title="Editar exercício"
                            aria-label="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Botão Excluir (quadrado de 44px) */}
                          <button
                            id={`delete-exercise-btn-${exercise.id}`}
                            type="button"
                            onClick={() => handleDeleteExercise(exercise)}
                            className="w-11 h-11 min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-900 transition-colors cursor-pointer flex items-center justify-center"
                            title="Excluir exercício"
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Exercise Form */}
      <Modal
        isOpen={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
        title={editingExercise ? 'Editar Exercício' : 'Novo Exercício'}
      >
        <form onSubmit={handleSaveExercise} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Exercício *
            </label>
            <input
              id="ex-name-input"
              type="text"
              required
              placeholder="Ex: Supino Reto, Agachamento Livre..."
              value={exName}
              onChange={(e) => setExName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Séries</label>
              <input
                id="ex-sets-input"
                type="text"
                placeholder="Ex: 3, 4"
                value={exSets}
                onChange={(e) => setExSets(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Repetições</label>
              <input
                id="ex-reps-input"
                type="text"
                placeholder="Ex: 10-12, 8, até a falha"
                value={exReps}
                onChange={(e) => setExReps(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Carga / Peso (opcional)
            </label>
            <input
              id="ex-weight-input"
              type="text"
              placeholder="Ex: 80 kg, 24 kg cada halter, peso do corpo"
              value={exWeight}
              onChange={(e) => setExWeight(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações / Instruções (opcional)
            </label>
            <textarea
              id="ex-notes-input"
              rows={2}
              placeholder="Ex: Descanso de 90s, cadência 2-0-2, focar na contração..."
              value={exNotes}
              onChange={(e) => setExNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsExerciseModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-exercise-btn"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors cursor-pointer"
            >
              Salvar Exercício
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Day Form */}
      <Modal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        title={editingDay ? 'Editar Dia de Treino' : 'Novo Dia de Treino'}
      >
        <form onSubmit={handleSaveDay} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Dia *
            </label>
            <input
              id="day-name-input"
              type="text"
              required
              placeholder="Ex: Segunda-feira, Treino A, Push..."
              value={dayName}
              onChange={(e) => setDayName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Foco / Grupos Musculares (opcional)
            </label>
            <input
              id="day-subtitle-input"
              type="text"
              placeholder="Ex: Peito, Tríceps e Ombro frontal"
              value={daySubtitle}
              onChange={(e) => setDaySubtitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDayModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-day-btn"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors cursor-pointer"
            >
              Salvar Dia
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Progressão / Evolução do Exercício */}
      <ExerciseEvolutionModal
        isOpen={evolutionModal.isOpen}
        onClose={() => setEvolutionModal((prev) => ({ ...prev, isOpen: false }))}
        exerciseName={evolutionModal.exerciseName}
        currentWeight={evolutionModal.currentWeight}
        isDoneToday={evolutionModal.isDoneToday}
        history={history}
      />

      {/* Confirmation Modal */}
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
