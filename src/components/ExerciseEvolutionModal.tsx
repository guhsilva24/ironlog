import React from 'react';
import { Modal } from './Modal';
import {
  WorkoutHistoryEntry,
  getExerciseProgression,
  EvolutionSession,
  parseWeightValue,
} from '../utils/workoutHistory';
import {
  TrendingUp,
  Award,
  Calendar,
  Layers,
  Repeat,
  Weight,
  FileText,
  Flame,
} from 'lucide-react';

interface ExerciseEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  currentWeight?: string;
  isDoneToday?: boolean;
  history: WorkoutHistoryEntry[];
}

export const ExerciseEvolutionModal: React.FC<ExerciseEvolutionModalProps> = ({
  isOpen,
  onClose,
  exerciseName,
  currentWeight,
  isDoneToday,
  history,
}) => {
  if (!isOpen) return null;

  const progression = getExerciseProgression(history, exerciseName, currentWeight, isDoneToday);
  const { sessions, maxWeight, todayNewRecord, hasHistory } = progression;

  // Filtrar sessões com carga numérica para o gráfico SVG (ordem cronológica crescente)
  const chartSessions = [...sessions]
    .reverse()
    .filter((s) => s.numericWeight !== null && s.numericWeight > 0);

  // Dimensões do gráfico SVG
  const svgWidth = 520;
  const svgHeight = 175;
  const paddingLeft = 45;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  let points: { x: number; y: number; weight: number; date: string }[] = [];
  let pathD = '';
  let areaD = '';
  let minW = 0;
  let maxW = 0;

  if (chartSessions.length >= 2) {
    const weights = chartSessions.map((s) => s.numericWeight!);
    minW = Math.min(...weights);
    maxW = Math.max(...weights);
    const range = maxW === minW ? 10 : maxW - minW;
    const baseMin = maxW === minW ? Math.max(0, minW - 5) : minW;

    points = chartSessions.map((s, idx) => {
      const x = paddingLeft + (idx / (chartSessions.length - 1)) * chartWidth;
      const normalizedY = (s.numericWeight! - baseMin) / range;
      const y = paddingTop + chartHeight - normalizedY * chartHeight;
      return { x, y, weight: s.numericWeight!, date: s.formattedDate.slice(0, 5) };
    });

    pathD = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x},${p.y}`, '');
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const bottomY = paddingTop + chartHeight;
    areaD = `${pathD} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Evolução: ${exerciseName}`}>
      <div className="space-y-5">
        {/* Banner de Recorde e Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-orange-700 dark:text-orange-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Maior Carga</span>
              <Award className="w-4 h-4" />
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {maxWeight !== null ? `${maxWeight.toLocaleString('pt-BR')} kg` : 'Sem carga'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Última Carga</span>
              <Weight className="w-4 h-4" />
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {sessions.length > 0 && sessions[0].weight
                  ? sessions[0].weight
                  : currentWeight || '-'}
              </span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Sessões Feitas</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {sessions.length}
              </span>
              <span className="text-xs text-slate-500 font-medium">treinos</span>
            </div>
          </div>
        </div>

        {/* Alerta de Novo Recorde */}
        {todayNewRecord && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2.5 animate-in fade-in">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                  🏆 Novo Recorde Alcançado!
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                A carga de hoje superou todas as sessões anteriores deste exercício. Parabéns pela progressão!
              </p>
            </div>
          </div>
        )}

        {/* Gráfico de Linha da Carga (SVG) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Progressão de Carga
              </h4>
            </div>
            {chartSessions.length >= 2 && (
              <span className="text-[11px] text-slate-500 font-medium">
                {chartSessions.length} sessões registradas
              </span>
            )}
          </div>

          {chartSessions.length >= 2 ? (
            <div className="w-full overflow-x-auto select-none">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto max-h-48 text-slate-500"
              >
                <defs>
                  <linearGradient id="workoutChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Linhas de grade horizontais */}
                <line
                  x1={paddingLeft}
                  y1={paddingTop}
                  x2={svgWidth - paddingRight}
                  y2={paddingTop}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeDasharray="3 3"
                />
                <line
                  x1={paddingLeft}
                  y1={paddingTop + chartHeight / 2}
                  x2={svgWidth - paddingRight}
                  y2={paddingTop + chartHeight / 2}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeDasharray="3 3"
                />
                <line
                  x1={paddingLeft}
                  y1={paddingTop + chartHeight}
                  x2={svgWidth - paddingRight}
                  y2={paddingTop + chartHeight}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                />

                {/* Rótulos do eixo Y */}
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono font-medium"
                >
                  {maxW}kg
                </text>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + chartHeight + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono font-medium"
                >
                  {minW}kg
                </text>

                {/* Área preenchida com gradiente */}
                <path d={areaD} fill="url(#workoutChartGrad)" />

                {/* Linha principal */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Pontos nas coordenadas */}
                {points.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      fill="#ea580c"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    {/* Data no eixo X */}
                    <text
                      x={pt.x}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-400 font-sans"
                    >
                      {pt.date}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
              <p>Registre ao menos 2 treinos com carga para visualizar o gráfico de progressão.</p>
            </div>
          )}
        </div>

        {/* Lista das Últimas Sessões */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Histórico de Sessões
            </h4>
            <span className="text-[11px] text-slate-400">
              {sessions.length} {sessions.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-500">
                Nenhum treino concluído registrado para este exercício ainda.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Marque este exercício como feito para iniciar o rastreamento automático de evolução.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {sessions.map((session, idx) => (
                <div
                  key={`${session.date}-${idx}`}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {session.formattedDate}
                      </span>
                      <span className="text-slate-400 text-[11px]">({session.dayOfWeek})</span>
                      {session.isRecord && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded-md">
                          🏆 Recorde
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {session.sets} {Number(session.sets) === 1 ? 'série' : 'séries'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Repeat className="w-3 h-3 text-slate-400" />
                        {session.reps} reps
                      </span>
                      {session.notes && (
                        <span className="flex items-center gap-1 text-slate-500 italic max-w-[150px] truncate" title={session.notes}>
                          <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                          {session.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-sm text-slate-900 dark:text-white">
                      {session.weight ? session.weight : 'Sem carga'}
                    </div>

                    {session.weightDiffString !== '-' && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${
                          session.weightDiffType === 'positive'
                            ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60'
                            : session.weightDiffType === 'negative'
                            ? 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/60'
                            : 'text-slate-500 bg-slate-200/60 dark:bg-slate-700'
                        }`}
                      >
                        {session.weightDiffString}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botão de Fechar */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
