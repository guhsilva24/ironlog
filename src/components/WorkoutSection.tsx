import React, { useState } from 'react';
import { WorkoutDay, WorkoutExercise } from '../types';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
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
} from 'lucide-react';

interface WorkoutSectionProps {
  days: WorkoutDay[];
  onUpdateDays: (days: WorkoutDay[]) => void;
}

export const WorkoutSection: React.FC<WorkoutSectionProps> = ({ days, onUpdateDays }) => {
  const [selectedDayId, setSelectedDayId] = useState<string>(days[0]?.id || '');

  // Modals state
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<WorkoutExercise | null>(null);

  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<WorkoutDay | null>(null);

  // In-app confirmation / alert modal state (never uses window.confirm or window.alert)
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
      // Edit existing across all days to guarantee correct update
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
      // Add new to active day
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

  // Toggle done status
  const handleToggleExerciseDone = (exId: string) => {
    const updatedDays = days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => (ex.id === exId ? { ...ex, done: !ex.done } : ex)),
    }));
    onUpdateDays(updatedDays);
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
        const updatedDays = days.map((day) => {
          if (day.id !== currentDay.id) return day;
          return {
            ...day,
            exercises: day.exercises.map((ex) => ({ ...ex, done: false })),
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
        message: 'Você precisa manter pelo menos um dia de treino cadastrado na sua rotina.',
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

  const completedCount = currentDay?.exercises.filter((ex) => ex.done).length || 0;
  const totalCount = currentDay?.exercises.length || 0;

  return (
    <div id="workout-section" className="space-y-6">
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
              currentDay.exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  id={`exercise-item-${exercise.id}`}
                  className={`p-4 rounded-xl border transition-all ${
                    exercise.done
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Checkbox and info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        id={`toggle-exercise-${exercise.id}`}
                        type="button"
                        onClick={() => handleToggleExerciseDone(exercise.id)}
                        className={`mt-0.5 flex-shrink-0 cursor-pointer p-1 rounded-lg transition-colors ${
                          exercise.done
                            ? 'text-emerald-600 hover:text-emerald-700'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title={exercise.done ? 'Marcar como não feito' : 'Marcar como feito hoje'}
                      >
                        {exercise.done ? (
                          <CheckCircle2 className="w-6 h-6 fill-emerald-100 text-emerald-600" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={`text-base font-bold ${
                              exercise.done ? 'line-through text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {exercise.name}
                          </h4>
                          {exercise.done && (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Feito hoje
                            </span>
                          )}
                        </div>

                        {/* Badges: Séries, Repetições, Carga */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            {exercise.sets} {Number(exercise.sets) === 1 ? 'série' : 'séries'}
                          </span>

                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Repeat className="w-3.5 h-3.5 text-slate-500" />
                            {exercise.reps} reps
                          </span>

                          {exercise.weight && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-800 bg-orange-100/80 px-2.5 py-1 rounded-lg">
                              <Weight className="w-3.5 h-3.5 text-orange-600" />
                              {exercise.weight}
                            </span>
                          )}
                        </div>

                        {/* Notes */}
                        {exercise.notes && (
                          <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-start gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span className="whitespace-pre-wrap">{exercise.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (Editar e Excluir claramente visíveis) */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        id={`edit-exercise-btn-${exercise.id}`}
                        type="button"
                        onClick={() => handleOpenEditExercise(exercise)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Editar exercício"
                        aria-label="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`delete-exercise-btn-${exercise.id}`}
                        type="button"
                        onClick={() => handleDeleteExercise(exercise)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Excluir exercício"
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Séries *
              </label>
              <input
                id="ex-sets-input"
                type="text"
                required
                placeholder="Ex: 4"
                value={exSets}
                onChange={(e) => setExSets(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Repetições *
              </label>
              <input
                id="ex-reps-input"
                type="text"
                required
                placeholder="Ex: 10-12 ou até a falha"
                value={exReps}
                onChange={(e) => setExReps(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Carga / Peso <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="ex-weight-input"
              type="text"
              placeholder="Ex: 25kg cada lado, halter 16kg, placa 7..."
              value={exWeight}
              onChange={(e) => setExWeight(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações / Dicas <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              id="ex-notes-input"
              rows={2}
              placeholder="Ex: Pegada fechada, descansar 60 segundos, focar na descida lenta..."
              value={exNotes}
              onChange={(e) => setExNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              id="cancel-ex-modal-btn"
              type="button"
              onClick={() => setIsExerciseModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-ex-modal-btn"
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              {editingExercise ? 'Salvar Alterações' : 'Adicionar Exercício'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Day Form */}
      <Modal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        title={editingDay ? 'Editar Dia de Treino' : 'Adicionar Dia de Treino'}
      >
        <form onSubmit={handleSaveDay} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Dia / Treino *
            </label>
            <input
              id="day-name-input"
              type="text"
              required
              placeholder="Ex: Segunda-feira, ou Treino A, Pernas..."
              value={dayName}
              onChange={(e) => setDayName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Foco ou Subtítulo <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="day-subtitle-input"
              type="text"
              placeholder="Ex: Peito, Tríceps & Ombro frontal"
              value={daySubtitle}
              onChange={(e) => setDaySubtitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              id="cancel-day-modal-btn"
              type="button"
              onClick={() => setIsDayModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-day-modal-btn"
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              {editingDay ? 'Salvar Dia' : 'Adicionar Dia'}
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
