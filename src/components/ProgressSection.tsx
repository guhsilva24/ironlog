import React, { useState } from 'react';
import { AppData, ActiveTab } from '../types';
import {
  loadWorkoutHistory,
  calculateExerciseVolume,
  getExerciseProgression,
  normalizeExerciseName,
  getLocalDateString,
} from '../utils/workoutHistory';
import {
  loadDailySummaries,
  loadWaterHistory,
  loadNutritionHistory,
  calculateNutritionTotals,
  loadWorkoutDaysHistory,
} from '../utils/storage';
import { useChat } from '../context/ChatContext';
import {
  TrendingUp,
  Award,
  Sparkles,
  Flame,
  Droplets,
  Calendar,
  Dumbbell,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface ProgressSectionProps {
  appData: AppData;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const ProgressSection: React.FC<ProgressSectionProps> = ({ appData, onNavigateTab }) => {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const { sendEvolutionAnalysis } = useChat();

  const handleAnalyzeEvolution = async () => {
    await sendEvolutionAnalysis();
    onNavigateTab('chat');
  };

  const todayStr = getLocalDateString();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (period - 1));
  const startStr = getLocalDateString(startDate);

  // Carregar dados dos históricos
  const allWorkouts = loadWorkoutHistory();
  const allWorkoutDays = loadWorkoutDaysHistory();
  const allWater = loadWaterHistory();
  const allNutrition = loadNutritionHistory();
  const allSummaries = loadDailySummaries();

  // Filtrar dados no período
  const periodWorkouts = allWorkouts.filter((w) => w.date >= startStr && w.date <= todayStr);
  const periodWorkoutDays = allWorkoutDays.filter((wd) => wd.date >= startStr && wd.date <= todayStr);
  const periodWater = allWater.filter((w) => w.date >= startStr && w.date <= todayStr);
  const periodNutrition = allNutrition.filter((n) => n.date >= startStr && n.date <= todayStr);
  const periodSummaries = allSummaries.filter((s) => s.date >= startStr && s.date <= todayStr);

  // Incluir dados do dia atual se existirem
  const todayNutritionTotals = calculateNutritionTotals(appData.meals);
  const todayCalories = todayNutritionTotals.consumedCalories;
  const todayProtein = todayNutritionTotals.protein;
  const todayWater = appData.water?.currentMl || 0;
  const waterGoal = appData.water?.dailyGoalMl || 2500;
  const caloriesGoal = appData.nutritionGoals?.calories;
  const proteinGoal = appData.nutritionGoals?.protein;

  // Montar mapa diário para os dias do período
  interface DayMetric {
    date: string;
    calories: number;
    protein: number;
    water: number;
    waterGoal: number;
    waterGoalMet: boolean;
    workoutCount: number;
    volume: number;
  }

  const daysMap = new Map<string, DayMetric>();

  // Preencher todos os dias do período
  for (let i = 0; i < period; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const dateStr = getLocalDateString(d);
    daysMap.set(dateStr, {
      date: dateStr,
      calories: 0,
      protein: 0,
      water: 0,
      waterGoal: waterGoal,
      waterGoalMet: false,
      workoutCount: 0,
      volume: 0,
    });
  }

  // Preencher com resumos e históricos
  periodSummaries.forEach((s) => {
    const day = daysMap.get(s.date);
    if (day) {
      day.calories = s.calories;
      day.protein = s.protein;
      day.water = s.waterMl;
      day.waterGoal = s.waterGoalMl;
      day.waterGoalMet = s.waterMl >= s.waterGoalMl;
      day.workoutCount = s.exercisesDoneCount;
    }
  });

  periodWater.forEach((w) => {
    const day = daysMap.get(w.date);
    if (day && day.water === 0) {
      day.water = w.totalMl;
      day.waterGoal = w.goalMl;
      day.waterGoalMet = w.totalMl >= w.goalMl;
    }
  });

  periodNutrition.forEach((n) => {
    const day = daysMap.get(n.date);
    if (day && day.calories === 0) {
      day.calories = n.totals.consumedCalories;
      day.protein = n.totals.protein;
    }
  });

  periodWorkouts.forEach((w) => {
    const day = daysMap.get(w.date);
    if (day) {
      day.volume += calculateExerciseVolume(w.sets, w.reps, w.weight);
      if (day.workoutCount === 0) day.workoutCount++;
    }
  });

  periodWorkoutDays.forEach((wd) => {
    const day = daysMap.get(wd.date);
    if (day) {
      if (wd.exercises && wd.exercises.length > 0) {
        if (day.workoutCount === 0) day.workoutCount = wd.exercises.length;
        if (day.volume === 0) {
          wd.exercises.forEach((ex) => {
            day.volume += calculateExerciseVolume(ex.sets, ex.reps, ex.weight);
          });
        }
      } else if (wd.completed && day.workoutCount === 0) {
        day.workoutCount = 1;
      }
    }
  });

  // Atualizar hoje se estiver no mapa
  const todayDay = daysMap.get(todayStr);
  if (todayDay) {
    if (todayCalories > 0) todayDay.calories = todayCalories;
    if (todayProtein > 0) todayDay.protein = todayProtein;
    if (todayWater > 0) {
      todayDay.water = todayWater;
      todayDay.waterGoalMet = todayWater >= waterGoal;
    }
    const todayDoneExercises = appData.workoutDays.reduce(
      (acc, d) => acc + d.exercises.filter((e) => e.done).length,
      0
    );
    if (todayDoneExercises > 0) todayDay.workoutCount = todayDoneExercises;
  }

  const daysList = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Médias de calorias e proteína (considerando dias com registro)
  const daysWithCalories = daysList.filter((d) => d.calories > 0);
  const avgCalories =
    daysWithCalories.length > 0
      ? Math.round(
          daysWithCalories.reduce((sum, d) => sum + d.calories, 0) / daysWithCalories.length
        )
      : 0;

  const daysWithProtein = daysList.filter((d) => d.protein > 0);
  const avgProtein =
    daysWithProtein.length > 0
      ? Math.round(
          daysWithProtein.reduce((sum, d) => sum + d.protein, 0) / daysWithProtein.length
        )
      : 0;

  // Dias em que bateu a meta de água
  const daysWithWater = daysList.filter((d) => d.water > 0);
  const daysWaterGoalMetCount = daysList.filter((d) => d.waterGoalMet).length;

  // Treinos e volume total no período
  const totalPeriodVolume = daysList.reduce((sum, d) => sum + d.volume, 0);
  const trainedDaysCount = daysList.filter((d) => d.workoutCount > 0 || d.volume > 0).length;

  // Exercícios com novo recorde no período
  const exerciseNames = Array.from(new Set(allWorkouts.map((w) => w.exerciseName)));
  const recordsInPeriod: { exerciseName: string; weight: string; date: string }[] = [];

  exerciseNames.forEach((name) => {
    const prog = getExerciseProgression(allWorkouts, name);
    // Verificar se a sessão de recorde caiu dentro do período
    const recordSession = prog.sessions.find(
      (s) => s.isRecord && s.date >= startStr && s.date <= todayStr
    );
    if (recordSession && recordSession.weight) {
      recordsInPeriod.push({
        exerciseName: name,
        weight: recordSession.weight,
        date: recordSession.formattedDate,
      });
    }
  });

  // Agrupamento semanal para o gráfico de volume (semanas de 7 dias)
  interface WeekBucket {
    label: string;
    volume: number;
    workoutsCount: number;
  }
  const weekBuckets: WeekBucket[] = [];
  const chunkSize = 7;
  for (let i = 0; i < daysList.length; i += chunkSize) {
    const chunk = daysList.slice(i, i + chunkSize);
    const firstDate = chunk[0].date.slice(5).replace('-', '/');
    const lastDate = chunk[chunk.length - 1].date.slice(5).replace('-', '/');
    const vol = chunk.reduce((sum, d) => sum + d.volume, 0);
    const workouts = chunk.filter((d) => d.workoutCount > 0 || d.volume > 0).length;
    weekBuckets.push({
      label: `${firstDate} a ${lastDate}`,
      volume: vol,
      workoutsCount: workouts,
    });
  }

  // Verifica se há dados no período
  const hasAnyData =
    totalPeriodVolume > 0 ||
    trainedDaysCount > 0 ||
    daysWithCalories.length > 0 ||
    daysWithWater.length > 0;

  return (
    <div id="progress-section" className="space-y-6">
      {/* Banner Superior com Filtro de Período e Botão de IA */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Progresso & Estatísticas
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Análise completa da evolução de treino, carga, nutrição e hidratação
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Período */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPeriod(7)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  period === 7
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriod(30)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  period === 30
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                30 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriod(90)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  period === 90
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                90 Dias
              </button>
            </div>

            {/* Botão de Análise com a IA */}
            <button
              id="analyze-evolution-btn"
              type="button"
              onClick={handleAnalyzeEvolution}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all shadow-xs cursor-pointer"
              title="Solicitar análise inteligente da evolução para o assistente"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analisar minha evolução</span>
            </button>
          </div>
        </div>
      </div>

      {!hasAnyData ? (
        /* Estado Vazio Claro */
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 shadow-2xs">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Ainda sem dados nesse período
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Marque seus treinos como feitos, registre seus alimentos e acompanhe sua ingestão de água para visualizar seus gráficos e médias aqui.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('treino')}
              className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors cursor-pointer"
            >
              Ir para Treino
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('dieta')}
              className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
            >
              Ir para Nutrição
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Métricas Principais em 4 Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Calorias Médias */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between text-amber-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">Calorias Médias</span>
                <Flame className="w-4 h-4" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {avgCalories > 0 ? avgCalories.toLocaleString('pt-BR') : '-'}
                </span>
                <span className="text-xs text-slate-500">kcal/dia</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {caloriesGoal ? `Meta: ${caloriesGoal.toLocaleString('pt-BR')} kcal` : 'Meta não definida'}
              </p>
            </div>

            {/* Proteínas Médias */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between text-blue-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">Proteína Média</span>
                <Dumbbell className="w-4 h-4" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {avgProtein > 0 ? avgProtein : '-'}
                </span>
                <span className="text-xs text-slate-500">g/dia</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {proteinGoal ? `Meta: ${proteinGoal} g` : 'Meta não definida'}
              </p>
            </div>

            {/* Meta de Água */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between text-sky-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">Meta de Água</span>
                <Droplets className="w-4 h-4" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {daysWaterGoalMetCount}
                </span>
                <span className="text-xs text-slate-500">de {daysList.length} dias</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {Math.round((daysWaterGoalMetCount / daysList.length) * 100)}% de sucesso
              </p>
            </div>

            {/* Volume Total e Treinos */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between text-orange-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">Volume Total</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {totalPeriodVolume > 0 ? totalPeriodVolume.toLocaleString('pt-BR') : '0'}
                </span>
                <span className="text-xs text-slate-500">kg</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {trainedDaysCount} {trainedDaysCount === 1 ? 'dia treinado' : 'dias treinados'}
              </p>
            </div>
          </div>

          {/* Gráfico 1: Volume Semanal e Frequência de Treinos (SVG) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                  Volume e Treinos por Semana
                </h3>
                <p className="text-xs text-slate-500">
                  Total de carga levantada (séries x reps x kg) e frequência
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {weekBuckets.length} {weekBuckets.length === 1 ? 'semana' : 'semanas'}
              </span>
            </div>

            {/* Barras em SVG */}
            {(() => {
              const maxVol = Math.max(1, ...weekBuckets.map((b) => b.volume));
              const svgW = 560;
              const svgH = 160;
              const barWidth = Math.max(24, Math.min(50, Math.floor((svgW - 80) / weekBuckets.length) - 15));
              const gap = (svgW - 80) / weekBuckets.length;

              return (
                <div className="w-full overflow-x-auto select-none pt-2">
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-44 text-slate-500">
                    {/* Linha base */}
                    <line x1="30" y1="125" x2={svgW - 20} y2="125" stroke="currentColor" strokeOpacity="0.15" />

                    {weekBuckets.map((wb, idx) => {
                      const x = 50 + idx * gap;
                      const barH = wb.volume > 0 ? Math.max(8, Math.round((wb.volume / maxVol) * 95)) : 4;
                      const y = 125 - barH;

                      return (
                        <g key={idx}>
                          {/* Barra de volume */}
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barH}
                            rx="5"
                            className="fill-orange-500 hover:fill-orange-600 transition-colors"
                          />
                          {/* Valor em kg no topo da barra */}
                          {wb.volume > 0 && (
                            <text
                              x={x + barWidth / 2}
                              y={y - 5}
                              textAnchor="middle"
                              className="text-[9px] fill-slate-700 dark:fill-slate-300 font-mono font-bold"
                            >
                              {wb.volume >= 1000 ? `${(wb.volume / 1000).toFixed(1)}k` : `${wb.volume}`}
                            </text>
                          )}
                          {/* Quantidade de treinos badge */}
                          <text
                            x={x + barWidth / 2}
                            y="140"
                            textAnchor="middle"
                            className="text-[10px] fill-slate-600 dark:fill-slate-400 font-sans font-semibold"
                          >
                            {wb.workoutsCount}t
                          </text>
                          {/* Rótulo da semana */}
                          <text
                            x={x + barWidth / 2}
                            y="152"
                            textAnchor="middle"
                            className="text-[8px] fill-slate-400 font-sans"
                          >
                            {wb.label.split(' a ')[0]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}
          </div>

          {/* Gráfico 2: Calorias por Dia e Comparativo com Meta */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Calorias Consumidas vs Meta
                </h3>
                <p className="text-xs text-slate-500">
                  Acompanhamento diário das calorias ingeridas
                </p>
              </div>
              {caloriesGoal && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-200/60">
                  Meta: {caloriesGoal} kcal
                </span>
              )}
            </div>

            {/* Linha SVG */}
            {(() => {
              const maxC = Math.max(
                caloriesGoal || 2000,
                ...daysList.map((d) => d.calories),
                1
              );
              const svgW = 560;
              const svgH = 140;
              const padLeft = 40;
              const padRight = 20;
              const padTop = 20;
              const padBottom = 25;
              const plotW = svgW - padLeft - padRight;
              const plotH = svgH - padTop - padBottom;

              const points = daysList.map((d, idx) => {
                const x = padLeft + (idx / Math.max(1, daysList.length - 1)) * plotW;
                const y = padTop + plotH - (d.calories / maxC) * plotH;
                return { x, y, cal: d.calories, date: d.date.slice(5).replace('-', '/') };
              });

              const pathD = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x},${p.y}`, '');

              const goalY = caloriesGoal ? padTop + plotH - (caloriesGoal / maxC) * plotH : null;

              return (
                <div className="w-full overflow-x-auto select-none pt-2">
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-40 text-slate-500">
                    {/* Linha da Meta pontilhada */}
                    {goalY !== null && (
                      <g>
                        <line
                          x1={padLeft}
                          y1={goalY}
                          x2={svgW - padRight}
                          y2={goalY}
                          stroke="#f59e0b"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                          strokeOpacity="0.8"
                        />
                        <text
                          x={svgW - padRight}
                          y={goalY - 4}
                          textAnchor="end"
                          className="text-[9px] fill-amber-600 font-bold font-mono"
                        >
                          Meta ({caloriesGoal}kcal)
                        </text>
                      </g>
                    )}

                    {/* Curva de consumo */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Pontos nas coordenadas */}
                    {points
                      .filter((_, idx) => idx % Math.ceil(daysList.length / 10) === 0 || idx === points.length - 1)
                      .map((pt, idx) => (
                        <g key={idx}>
                          <circle cx={pt.x} cy={pt.y} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                          <text
                            x={pt.x}
                            y={svgH - 6}
                            textAnchor="middle"
                            className="text-[8px] fill-slate-400 font-sans"
                          >
                            {pt.date}
                          </text>
                        </g>
                      ))}
                  </svg>
                </div>
              );
            })()}
          </div>

          {/* Seção 3: Novos Recordes Atingidos no Período */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  Exercícios com Novo Recorde no Período
                </h3>
                <p className="text-xs text-slate-500">
                  Exercícios em que você superou suas cargas anteriores nos últimos {period} dias
                </p>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-200/60">
                {recordsInPeriod.length} {recordsInPeriod.length === 1 ? 'recorde' : 'recordes'}
              </span>
            </div>

            {recordsInPeriod.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Nenhum novo recorde de carga registrado neste intervalo de {period} dias.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {recordsInPeriod.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {rec.exerciseName}
                      </h4>
                      <span className="text-[10px] text-slate-500">{rec.date}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-amber-800 dark:text-amber-300">
                        {rec.weight}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
