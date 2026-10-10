/**
 * Utilitários para registro e análise do histórico de treinos (treino_historico).
 *
 * Requisitos:
 * - Registro automático com data local (AAAA-MM-DD), dia da semana, séries, repetições, carga e observação.
 * - Suporta remoção ao desmarcar e atualização ao editar.
 * - Histórico preservado após o reset diário de meia-noite e limitado a 2 anos.
 * - Comparação de carga e novo recorde por exercício (ignorando maiúsculas, acentos e espaços extras).
 * - Navegação de semanas (de segunda a domingo) com resumo de volume (séries x reps x carga) e comparativo %.
 */

export const WORKOUT_HISTORY_KEY = 'treino_historico';

export interface WorkoutHistoryEntry {
  id: string; // Ex: "2026-10-06_supinoreto"
  date: string; // AAAA-MM-DD local do dispositivo
  dayOfWeek: string; // "Segunda-feira", "Terça-feira", etc.
  exerciseName: string;
  sets: string;
  reps: string;
  weight?: string;
  notes?: string;
}

/**
 * Normaliza o nome do exercício ignorando maiúsculas, acentos e espaços extras.
 */
export function normalizeExerciseName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Extrai o valor numérico em kg de uma string de carga (ex: "80 kg", "22.5", "12,5kg" -> 80, 22.5, 12.5).
 */
export function parseWeightValue(weightStr?: string): number | null {
  if (!weightStr) return null;
  const clean = weightStr.replace(',', '.');
  const match = clean.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Extrai o primeiro número de séries ou repetições (ex: "10-12" -> 10, "3" -> 3).
 */
export function parseFirstNumber(str?: string | number): number {
  if (str === undefined || str === null) return 0;
  if (typeof str === 'number') return str;
  const match = String(str).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Calcula o volume de um exercício (séries x reps x carga).
 * Se não houver carga especificada, retorna 0 kg de sobrecarga externa.
 */
export function calculateExerciseVolume(
  sets: string | number,
  reps: string | number,
  weight?: string
): number {
  const s = parseFirstNumber(sets);
  const r = parseFirstNumber(reps);
  const w = parseWeightValue(weight) || 0;
  return Math.round(s * r * w);
}

/**
 * Retorna o nome do dia da semana em português a partir de uma data AAAA-MM-DD local.
 */
export function getDayOfWeekName(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const name = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d);
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {}
  return '';
}

/**
 * Retorna a data local de hoje no formato AAAA-MM-DD (usando o fuso do dispositivo, NÃO UTC).
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Carrega todo o histórico de treinos do localStorage.
 */
export function loadWorkoutHistory(): WorkoutHistoryEntry[] {
  try {
    const raw = localStorage.getItem(WORKOUT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Falha ao carregar treino_historico:', err);
    return [];
  }
}

/**
 * Salva o histórico no localStorage, limitando a 2 anos para proteger o armazenamento.
 */
export function saveWorkoutHistory(entries: WorkoutHistoryEntry[]): void {
  try {
    // Limite de 2 anos a partir de hoje
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDateStr = getLocalDateString(twoYearsAgo);

    const pruned = entries.filter((e) => e.date >= cutoffDateStr);
    localStorage.setItem(WORKOUT_HISTORY_KEY, JSON.stringify(pruned));
  } catch (err) {
    console.error('Falha ao salvar treino_historico:', err);
  }
}

/**
 * Limpa o histórico de treinos (usado em "Começar do zero").
 */
export function clearWorkoutHistory(): void {
  try {
    localStorage.removeItem(WORKOUT_HISTORY_KEY);
  } catch (err) {
    console.error('Falha ao limpar treino_historico:', err);
  }
}

/**
 * Registra a conclusão de um exercício no histórico na data atual (ou especificada).
 */
export function recordWorkoutExerciseDone(data: {
  exerciseName: string;
  sets: string | number;
  reps: string | number;
  weight?: string;
  notes?: string;
  dayOfWeek?: string;
  date?: string;
}): void {
  const date = data.date || getLocalDateString();
  const dayOfWeek = data.dayOfWeek || getDayOfWeekName(date);
  const normalized = normalizeExerciseName(data.exerciseName);
  const id = `${date}_${normalized}`;

  const history = loadWorkoutHistory();
  // Remove entrada anterior daquele exercício naquela mesma data para substituir pela mais atualizada
  const withoutCurrent = history.filter(
    (e) => !(e.date === date && normalizeExerciseName(e.exerciseName) === normalized)
  );

  const entry: WorkoutHistoryEntry = {
    id,
    date,
    dayOfWeek,
    exerciseName: data.exerciseName.trim(),
    sets: String(data.sets).trim(),
    reps: String(data.reps).trim(),
    weight: data.weight?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
  };

  saveWorkoutHistory([entry, ...withoutCurrent]);
}

/**
 * Remove o registro de um exercício naquela data (usado quando o usuário desmarca "feito").
 */
export function removeWorkoutExerciseRecord(exerciseName: string, date?: string): void {
  const targetDate = date || getLocalDateString();
  const normalized = normalizeExerciseName(exerciseName);
  const history = loadWorkoutHistory();
  const filtered = history.filter(
    (e) => !(e.date === targetDate && normalizeExerciseName(e.exerciseName) === normalized)
  );
  saveWorkoutHistory(filtered);
}

/**
 * Atualiza o registro do dia caso o usuário edite a carga/séries/reps depois de marcar.
 */
export function updateWorkoutExerciseRecord(
  oldExerciseName: string,
  updatedData: {
    exerciseName: string;
    sets: string | number;
    reps: string | number;
    weight?: string;
    notes?: string;
  },
  date?: string
): void {
  const targetDate = date || getLocalDateString();
  const oldNormalized = normalizeExerciseName(oldExerciseName);
  const history = loadWorkoutHistory();

  const idx = history.findIndex(
    (e) => e.date === targetDate && normalizeExerciseName(e.exerciseName) === oldNormalized
  );

  if (idx !== -1) {
    const existing = history[idx];
    const newNormalized = normalizeExerciseName(updatedData.exerciseName);
    history[idx] = {
      ...existing,
      id: `${targetDate}_${newNormalized}`,
      exerciseName: updatedData.exerciseName.trim(),
      sets: String(updatedData.sets).trim(),
      reps: String(updatedData.reps).trim(),
      weight: updatedData.weight?.trim() || undefined,
      notes: updatedData.notes?.trim() || undefined,
    };
    saveWorkoutHistory(history);
  }
}

/**
 * Sessão enriquecida com cálculos de variação e recorde para o modal de evolução.
 */
export interface EvolutionSession {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  sets: string;
  reps: string;
  weight?: string;
  numericWeight: number | null;
  weightDiffString: string; // Ex: "+2,5 kg", "-1 kg", "0 kg", "-"
  weightDiffType: 'positive' | 'negative' | 'neutral' | 'none';
  isRecord: boolean;
  notes?: string;
}

/**
 * Calcula a progressão completa de um exercício pelo nome normalizado.
 */
export function getExerciseProgression(
  allHistory: WorkoutHistoryEntry[],
  exerciseName: string,
  currentWeightStr?: string,
  isDoneToday?: boolean
): {
  sessions: EvolutionSession[];
  maxWeight: number | null;
  todayNewRecord: boolean;
  hasHistory: boolean;
} {
  const target = normalizeExerciseName(exerciseName);
  const matches = allHistory.filter((e) => normalizeExerciseName(e.exerciseName) === target);

  // Ordena cronologicamente crescente para calcular as variações entre sessões consecutivas
  const sortedAsc = [...matches].sort((a, b) => a.date.localeCompare(b.date));

  let runningMax = -Infinity;
  const enrichedAsc: EvolutionSession[] = [];

  for (let i = 0; i < sortedAsc.length; i++) {
    const item = sortedAsc[i];
    const numericWeight = parseWeightValue(item.weight);

    let weightDiffString = '-';
    let weightDiffType: 'positive' | 'negative' | 'neutral' | 'none' = 'none';

    if (i > 0) {
      const prev = sortedAsc[i - 1];
      const prevNum = parseWeightValue(prev.weight);
      if (numericWeight !== null && prevNum !== null) {
        const diff = Number((numericWeight - prevNum).toFixed(2));
        if (diff > 0) {
          weightDiffString = `+${diff.toLocaleString('pt-BR')} kg`;
          weightDiffType = 'positive';
        } else if (diff < 0) {
          weightDiffString = `${diff.toLocaleString('pt-BR')} kg`;
          weightDiffType = 'negative';
        } else {
          weightDiffString = '0 kg';
          weightDiffType = 'neutral';
        }
      }
    }

    const isRecord = numericWeight !== null && numericWeight > runningMax && i > 0;
    if (numericWeight !== null && numericWeight > runningMax) {
      runningMax = numericWeight;
    }

    // Formata a data: "06/10/2026"
    const parts = item.date.split('-');
    const formattedDate =
      parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.date;

    enrichedAsc.push({
      date: item.date,
      formattedDate,
      dayOfWeek: item.dayOfWeek,
      sets: item.sets,
      reps: item.reps,
      weight: item.weight,
      numericWeight,
      weightDiffString,
      weightDiffType,
      isRecord,
      notes: item.notes,
    });
  }

  const maxWeight = runningMax === -Infinity ? null : runningMax;

  // Verifica se a carga de hoje é um novo recorde
  const todayStr = getLocalDateString();
  const pastSessions = sortedAsc.filter((s) => s.date < todayStr);
  const pastMaxWeight = pastSessions.reduce((max, s) => {
    const val = parseWeightValue(s.weight);
    return val !== null && val > max ? val : max;
  }, -Infinity);

  const parsedCurrentWeight = parseWeightValue(currentWeightStr);
  const todayEntry = sortedAsc.find((s) => s.date === todayStr);
  const effectiveTodayWeight =
    parsedCurrentWeight !== null
      ? parsedCurrentWeight
      : todayEntry
      ? parseWeightValue(todayEntry.weight)
      : null;

  const todayNewRecord =
    pastSessions.length > 0 &&
    pastMaxWeight > -Infinity &&
    effectiveTodayWeight !== null &&
    effectiveTodayWeight > pastMaxWeight;

  // Retorna sessões da mais recente para a mais antiga para exibição na lista
  const sessionsDesc = [...enrichedAsc].reverse();

  return {
    sessions: sessionsDesc,
    maxWeight,
    todayNewRecord,
    hasHistory: sessionsDesc.length > 0,
  };
}

/**
 * Informações dos dias de uma semana de segunda a domingo.
 */
export interface WeekDayInfo {
  dateStr: string; // AAAA-MM-DD
  dayOfWeekName: string; // Segunda-feira
  shortDayName: string; // Seg
  formattedDate: string; // 06/10
  isToday: boolean;
}

export interface WeekRange {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
  label: string; // "Semana de 06/10 a 12/10"
  days: WeekDayInfo[];
  isCurrentWeek: boolean;
}

/**
 * Calcula o intervalo de semana (Segunda a Domingo) contendo a data de referência.
 */
export function getWeekRange(referenceDate: Date = new Date()): WeekRange {
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const dayOfWeek = ref.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  // Segunda-feira é o início
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const startDateStr = getLocalDateString(monday);
  const endDateStr = getLocalDateString(sunday);

  const todayStr = getLocalDateString();
  const isCurrentWeek = todayStr >= startDateStr && todayStr <= endDateStr;

  const pad = (n: number) => String(n).padStart(2, '0');
  const label = `Semana de ${pad(monday.getDate())}/${pad(monday.getMonth() + 1)} a ${pad(
    sunday.getDate()
  )}/${pad(sunday.getMonth() + 1)}`;

  const SHORT_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = getLocalDateString(d);
    days.push({
      dateStr,
      dayOfWeekName: getDayOfWeekName(dateStr),
      shortDayName: SHORT_NAMES[i],
      formattedDate: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      isToday: dateStr === todayStr,
    });
  }

  return {
    startDate: monday,
    endDate: sunday,
    startDateStr,
    endDateStr,
    label,
    days,
    isCurrentWeek,
  };
}

/**
 * Resumo do volume de uma semana e comparativo com a semana imediatamente anterior.
 */
export function getWeekSummaryAndComparison(
  allHistory: WorkoutHistoryEntry[],
  weekRange: WeekRange
): {
  currentVolume: number;
  prevVolume: number;
  percentChange: number | null;
  trainedDaysCount: number;
  exercisesCount: number;
} {
  // Entradas da semana atual
  const currentEntries = allHistory.filter(
    (e) => e.date >= weekRange.startDateStr && e.date <= weekRange.endDateStr
  );

  let currentVolume = 0;
  currentEntries.forEach((e) => {
    currentVolume += calculateExerciseVolume(e.sets, e.reps, e.weight);
  });

  const trainedDates = new Set(currentEntries.map((e) => e.date));
  const trainedDaysCount = trainedDates.size;
  const exercisesCount = currentEntries.length;

  // Semana anterior (7 dias antes)
  const prevMonday = new Date(
    weekRange.startDate.getFullYear(),
    weekRange.startDate.getMonth(),
    weekRange.startDate.getDate() - 7
  );
  const prevSunday = new Date(
    weekRange.startDate.getFullYear(),
    weekRange.startDate.getMonth(),
    weekRange.startDate.getDate() - 1
  );
  const prevStartStr = getLocalDateString(prevMonday);
  const prevEndStr = getLocalDateString(prevSunday);

  const prevEntries = allHistory.filter(
    (e) => e.date >= prevStartStr && e.date <= prevEndStr
  );

  let prevVolume = 0;
  prevEntries.forEach((e) => {
    prevVolume += calculateExerciseVolume(e.sets, e.reps, e.weight);
  });

  let percentChange: number | null = null;
  if (prevVolume > 0) {
    percentChange = Math.round(((currentVolume - prevVolume) / prevVolume) * 100);
  }

  return {
    currentVolume,
    prevVolume,
    percentChange,
    trainedDaysCount,
    exercisesCount,
  };
}
