import React from 'react';
import {
  WorkoutHistoryEntry,
  WeekRange,
  getWeekSummaryAndComparison,
  calculateExerciseVolume,
} from '../utils/workoutHistory';
import {
  Calendar,
  Dumbbell,
  Layers,
  Repeat,
  Weight,
  FileText,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  BarChart3,
} from 'lucide-react';

interface PastWeekWorkoutViewProps {
  weekRange: WeekRange;
  history: WorkoutHistoryEntry[];
  onGoToCurrentWeek: () => void;
  onOpenEvolution: (exerciseName: string) => void;
}

export const PastWeekWorkoutView: React.FC<PastWeekWorkoutViewProps> = ({
  weekRange,
  history,
  onGoToCurrentWeek,
  onOpenEvolution,
}) => {
  const summary = getWeekSummaryAndComparison(history, weekRange);
  const { currentVolume, prevVolume, percentChange, trainedDaysCount, exercisesCount } = summary;

  return (
    <div className="space-y-6">
      {/* Resumo da Semana Passada */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 mb-1">
              <span>Histórico Somente Leitura</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Resumo da {weekRange.label}
            </h3>
            <p className="text-xs text-slate-500">
              Registro real dos treinos concluídos durante esta semana
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToCurrentWeek}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60 hover:bg-orange-100 dark:hover:bg-orange-900/60 border border-orange-200 dark:border-orange-800 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Voltar para Hoje
          </button>
        </div>

        {/* 3 Métricas da Semana */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Volume Total */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Volume Total</span>
              <BarChart3 className="w-4 h-4 text-orange-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {currentVolume.toLocaleString('pt-BR')} kg
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              séries × repetições × carga somados
            </p>
          </div>

          {/* Comparativo com a Semana Anterior */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                vs Semana Anterior
              </span>
              {percentChange !== null && percentChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-500" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              {percentChange !== null ? (
                <span
                  className={`text-2xl font-black ${
                    percentChange > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : percentChange < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`}
                </span>
              ) : (
                <span className="text-xl font-bold text-slate-500">
                  {prevVolume === 0 && currentVolume > 0 ? '+100%' : '-'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {prevVolume > 0
                ? `Semana anterior: ${prevVolume.toLocaleString('pt-BR')} kg`
                : 'Sem registro de volume na semana anterior'}
            </p>
          </div>

          {/* Frequência e Exercícios */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Treinos Feitos</span>
              <Dumbbell className="w-4 h-4 text-violet-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {trainedDaysCount} {trainedDaysCount === 1 ? 'dia' : 'dias'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {exercisesCount} {exercisesCount === 1 ? 'exercício concluído' : 'exercícios concluídos'}
            </p>
          </div>
        </div>
      </div>

      {/* Lista dos 7 Dias da Semana (Segunda a Domingo) */}
      <div className="space-y-4">
        {weekRange.days.map((dayInfo) => {
          // Filtrar os exercícios feitos nessa data
          const dayEntries = history.filter((e) => e.date === dayInfo.dateStr);
          let dayVolume = 0;
          dayEntries.forEach((e) => {
            dayVolume += calculateExerciseVolume(e.sets, e.reps, e.weight);
          });

          const hasWorkout = dayEntries.length > 0;

          return (
            <div
              key={dayInfo.dateStr}
              className={`rounded-2xl border transition-all ${
                hasWorkout
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/70 opacity-80'
              }`}
            >
              {/* Header do Dia */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      hasWorkout
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {dayInfo.shortDayName}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      {dayInfo.dayOfWeekName}
                    </h4>
                    <p className="text-[11px] text-slate-400">{dayInfo.formattedDate}</p>
                  </div>
                </div>

                {hasWorkout ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {dayEntries.length} {dayEntries.length === 1 ? 'exercício' : 'exercícios'}
                    </span>
                    {dayVolume > 0 && (
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        {dayVolume.toLocaleString('pt-BR')} kg
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 italic">
                    Descanso / Sem treino registrado
                  </span>
                )}
              </div>

              {/* Exercícios do Dia */}
              {hasWorkout && (
                <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800/60 space-y-3">
                  {dayEntries.map((exercise, idx) => {
                    const exVol = calculateExerciseVolume(
                      exercise.sets,
                      exercise.reps,
                      exercise.weight
                    );

                    return (
                      <div
                        key={`${exercise.id}-${idx}`}
                        className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {exercise.exerciseName}
                            </h5>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              <Layers className="w-3 h-3 text-slate-400" />
                              {exercise.sets} {Number(exercise.sets) === 1 ? 'série' : 'séries'}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              <Repeat className="w-3 h-3 text-slate-400" />
                              {exercise.reps} reps
                            </span>
                            {exercise.weight && (
                              <span className="inline-flex items-center gap-1 font-bold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded-md">
                                <Weight className="w-3 h-3" />
                                {exercise.weight}
                              </span>
                            )}
                            {exVol > 0 && (
                              <span className="text-[11px] text-slate-400">
                                (Vol: {exVol.toLocaleString('pt-BR')} kg)
                              </span>
                            )}
                          </div>

                          {exercise.notes && (
                            <div className="text-xs text-slate-500 italic flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span>{exercise.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => onOpenEvolution(exercise.exerciseName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <TrendingUp className="w-3 h-3" />
                            Evolução
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
