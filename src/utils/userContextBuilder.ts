import { AppData } from '../types';
import {
  loadWorkoutHistory,
  normalizeExerciseName,
  parseWeightValue,
} from './workoutHistory';
import {
  loadNutritionHistory,
  loadWaterHistory,
  loadDailySummaries,
  getTodayDateString,
  getShareDataWithAi,
  calculateNutritionTotals,
  loadDailyWorkoutStatus,
  loadWorkoutDaysHistory,
} from './storage';

/**
 * Constrói um resumo compacto em texto dos dados reais do usuário (até ~3.000 caracteres):
 * - Treinos cadastrados na rotina
 * - Evolução de carga dos exercícios (primeira carga, última carga e recorde)
 * - Últimos 14 dias de calorias/macros/água/treinos feitos
 * - Metas e data de hoje
 *
 * Nunca inventa valores. Se o usuário desativou o compartilhamento, retorna vazio.
 */
export function buildUserContextSummary(appData: AppData): string {
  if (!getShareDataWithAi()) {
    return '';
  }

  const todayStr = getTodayDateString();
  const sections: string[] = [];

  // 1. Data e Metas
  const goals = appData.nutritionGoals;
  const metasParts: string[] = [];
  metasParts.push(`Água: ${appData.water?.dailyGoalMl || 2500}ml`);
  if (goals?.calories) metasParts.push(`Calorias: ${goals.calories}kcal`);
  if (goals?.protein) metasParts.push(`Proteínas: ${goals.protein}g`);

  sections.push(`[Hoje: ${todayStr} | Metas: ${metasParts.join(', ')}]`);

  // 2. Treinos Cadastrados na Rotina
  if (appData.workoutDays && appData.workoutDays.length > 0) {
    const routineLines = appData.workoutDays
      .filter((d) => d.exercises && d.exercises.length > 0)
      .map((d) => {
        const exList = d.exercises
          .map((e) => `${e.name}${e.weight ? ` (${e.weight})` : ''}`)
          .join(', ');
        return `• ${d.name}: ${exList}`;
      });
    if (routineLines.length > 0) {
      sections.push(`[Rotina Cadastrada]\n${routineLines.join('\n')}`);
    }
  }

  // 3. Evolução de Carga dos Exercícios (primeira, última e recorde)
  const history = loadWorkoutHistory();
  if (history.length > 0) {
    const exerciseMap = new Map<string, typeof history>();
    history.forEach((entry) => {
      const key = normalizeExerciseName(entry.exerciseName);
      if (!exerciseMap.has(key)) exerciseMap.set(key, []);
      exerciseMap.get(key)!.push(entry);
    });

    const evolutionLines: string[] = [];
    exerciseMap.forEach((entries) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      const displayName = sorted[sorted.length - 1].exerciseName;
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      let maxW = 0;
      sorted.forEach((e) => {
        const w = parseWeightValue(e.weight);
        if (w !== null && w > maxW) maxW = w;
      });

      const firstStr = first.weight ? `${first.weight} (${first.date})` : `sem carga (${first.date})`;
      const lastStr = last.weight ? `${last.weight} (${last.date})` : `sem carga (${last.date})`;
      const recordStr = maxW > 0 ? `${maxW}kg` : 'sem carga';

      evolutionLines.push(`• ${displayName}: 1ª=${firstStr} -> Atual=${lastStr} | Recorde=${recordStr}`);
    });

    if (evolutionLines.length > 0) {
      // Prioriza os primeiros 15 exercícios para manter brevidade
      sections.push(`[Evolução de Cargas]\n${evolutionLines.slice(0, 15).join('\n')}`);
    }
  }

  // 4. Últimos 14 Dias de Histórico (calorias, macros, água e treinos feitos)
  const d14Ago = new Date();
  d14Ago.setDate(d14Ago.getDate() - 14);
  const cutoff14Str = `${d14Ago.getFullYear()}-${String(d14Ago.getMonth() + 1).padStart(2, '0')}-${String(d14Ago.getDate()).padStart(2, '0')}`;

  const nutritionHist = loadNutritionHistory().filter((n) => n.date >= cutoff14Str);
  const waterHist = loadWaterHistory().filter((w) => w.date >= cutoff14Str);
  const dailySummaries = loadDailySummaries().filter((s) => s.date >= cutoff14Str);

  const datesSet = new Set<string>();
  datesSet.add(todayStr);
  nutritionHist.forEach((n) => datesSet.add(n.date));
  waterHist.forEach((w) => datesSet.add(w.date));
  dailySummaries.forEach((s) => datesSet.add(s.date));
  history.filter((h) => h.date >= cutoff14Str).forEach((h) => datesSet.add(h.date));

  const sortedDates = Array.from(datesSet).sort().reverse().slice(0, 14);

  const dailyLogLines: string[] = [];
  sortedDates.forEach((date) => {
    const isToday = date === todayStr;
    const summary = dailySummaries.find((s) => s.date === date);
    const nutri = nutritionHist.find((n) => n.date === date);
    const waterEntry = waterHist.find((w) => w.date === date);
    const dayWorkouts = history.filter((h) => h.date === date);
    const daySessions = loadWorkoutDaysHistory().find((s) => s.date === date);
    const todayStatus = isToday ? loadDailyWorkoutStatus() : null;

    const cals = isToday
      ? calculateNutritionTotals(appData.meals).consumedCalories
      : summary?.calories || nutri?.totals.consumedCalories || 0;

    const prot = isToday
      ? calculateNutritionTotals(appData.meals).protein
      : summary?.protein || nutri?.totals.protein || 0;

    const waterMl = isToday
      ? appData.water?.currentMl || 0
      : summary?.waterMl || waterEntry?.totalMl || 0;

    const workoutNames = isToday
      ? appData.workoutDays.flatMap((d) =>
          d.exercises
            .filter((e) => e.done)
            .map((e) => `${e.name}${e.failure ? ' [falha]' : ''}`)
        )
      : daySessions?.exercises && daySessions.exercises.length > 0
      ? daySessions.exercises.map((e) => `${e.name}${e.failure ? ' [falha]' : ''}`)
      : dayWorkouts.map((w) => w.exerciseName);

    const isWorkoutCompleted = isToday ? todayStatus?.completed : daySessions?.completed;
    const cardioDone = isToday ? todayStatus?.cardio?.done : daySessions?.cardioDone;
    const cardioType = isToday ? todayStatus?.cardio?.type : daySessions?.cardioType;
    const cardioMin = isToday ? todayStatus?.cardio?.durationMinutes : daySessions?.cardioMinutes;

    const todayTotals = isToday ? calculateNutritionTotals(appData.meals) : null;
    const fiber = isToday ? todayTotals?.fiber : (nutri?.totals as any)?.fiber;
    const sodium = isToday ? todayTotals?.sodium : (nutri?.totals as any)?.sodium;

    const parts: string[] = [];
    if (cals > 0 || prot > 0) {
      let macroStr = `${cals}kcal (${prot}g prot`;
      if (fiber && fiber > 0) macroStr += `, ${Math.round(fiber * 10) / 10}g fib`;
      if (sodium && sodium > 0) macroStr += `, ${Math.round(sodium)}mg Na`;
      macroStr += ')';
      parts.push(macroStr);
    }
    if (waterMl > 0) parts.push(`água: ${waterMl}ml`);
    if (workoutNames.length > 0) {
      parts.push(`treino: ${workoutNames.join(', ')}${isWorkoutCompleted ? ' (concluído)' : ''}`);
    } else if (isWorkoutCompleted) {
      parts.push('treino concluído');
    }
    if (cardioDone) {
      parts.push(`cardio: ${cardioType ? `${cardioType} ` : ''}${cardioMin ? `${cardioMin}min` : 'feito'}`);
    }

    if (parts.length > 0) {
      dailyLogLines.push(`• ${date}${isToday ? ' (hoje)' : ''}: ${parts.join(' | ')}`);
    }
  });

  if (dailyLogLines.length > 0) {
    sections.push(`[Últimos 14 Dias]\n${dailyLogLines.join('\n')}`);
  }

  let finalSummary = sections.join('\n\n');
  if (finalSummary.length > 3000) {
    finalSummary = finalSummary.slice(0, 2980) + '\n... [dados resumidos]';
  }

  return finalSummary;
}
