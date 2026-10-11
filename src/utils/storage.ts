import {
  AppData,
  WorkoutDay,
  Meal,
  WaterState,
  ChatMessage,
  DailyNutritionHistory,
  DailyNutritionTotals,
} from '../types';
import { loadWorkoutHistory } from './workoutHistory';

const STORAGE_KEY = 'rotina_pessoal_app_data_v1';
export const NUTRITION_HISTORY_KEY = 'nutricao_historico';
const CHAT_STORAGE_KEY = 'chat_history';
const LEGACY_CHAT_STORAGE_KEY = 'rotina_pessoal_chat_history_v1';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateString(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };
      const formatted = new Intl.DateTimeFormat('pt-BR', options).format(dateObj);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function getTodayFormatted(): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const str = new Intl.DateTimeFormat('pt-BR', options).format(new Date());
  // Capitalize first letter
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Nutrition History Management
export function calculateNutritionTotals(meals: Meal[]): DailyNutritionTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sodium = 0;
  let itemsCount = 0;
  let consumedCount = 0;
  let consumedCalories = 0;

  meals.forEach((m) => {
    m.items.forEach((item) => {
      itemsCount++;
      if (item.calories) calories += item.calories;
      if (item.protein) protein += item.protein;
      if (item.carbs) carbs += item.carbs;
      if (item.fat) fat += item.fat;
      if (item.fibra_g) fiber += item.fibra_g;
      if (item.sodio_mg) sodium += item.sodio_mg;

      if (item.done) {
        consumedCount++;
        if (item.calories) consumedCalories += item.calories;
      }
    });
  });

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: fiber > 0 ? Math.round(fiber * 10) / 10 : undefined,
    sodium: sodium > 0 ? Math.round(sodium) : undefined,
    itemsCount,
    consumedCount,
    consumedCalories: Math.round(consumedCalories),
  };
}

export function loadNutritionHistory(): DailyNutritionHistory[] {
  try {
    const raw = localStorage.getItem(NUTRITION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Falha ao carregar histórico de nutrição:', err);
    return [];
  }
}

export function saveNutritionHistory(history: DailyNutritionHistory[]): void {
  try {
    localStorage.setItem(NUTRITION_HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Falha ao salvar histórico de nutrição:', err);
  }
}

export function archiveNutritionDay(dateStr: string, meals: Meal[]): boolean {
  try {
    const totals = calculateNutritionTotals(meals);
    // If no food items were registered in any meal on that day, nothing to archive
    if (totals.itemsCount === 0) {
      return false;
    }

    const history = loadNutritionHistory();
    const entry: DailyNutritionHistory = {
      id: `nutri-${dateStr}`,
      date: dateStr,
      dateFormatted: formatDateString(dateStr),
      meals: JSON.parse(JSON.stringify(meals)),
      totals,
      savedAt: new Date().toISOString(),
    };

    // If an entry for this exact date already exists, update it, otherwise add to front
    const existingIndex = history.findIndex((h) => h.date === dateStr);
    let updated: DailyNutritionHistory[];
    if (existingIndex !== -1) {
      updated = [...history];
      updated[existingIndex] = entry;
    } else {
      updated = [entry, ...history];
    }

    // Sort descending by date (most recent first)
    updated.sort((a, b) => b.date.localeCompare(a.date));
    saveNutritionHistory(updated);
    return true;
  } catch (err) {
    console.error('Falha ao arquivar nutrição no histórico:', err);
    return false;
  }
}

export function deleteNutritionHistoryDay(idOrDate: string): void {
  try {
    const history = loadNutritionHistory();
    const updated = history.filter((h) => h.id !== idOrDate && h.date !== idOrDate);
    saveNutritionHistory(updated);
  } catch (err) {
    console.error('Falha ao remover item do histórico:', err);
  }
}

export const WATER_HISTORY_KEY = 'agua_historico';
export const DAILY_SUMMARY_KEY = 'resumo_diario';
export const SHARE_DATA_WITH_AI_KEY = 'share_data_with_ai';
export const WORKOUT_DAYS_HISTORY_KEY = 'treino_dias_historico';
export const DAILY_WORKOUT_STATUS_KEY = 'treino_dia_status';

export interface DailyWorkoutStatusStorage {
  date: string; // AAAA-MM-DD
  completed: boolean;
  cardio: {
    done: boolean;
    type?: string;
    durationMinutes?: number | string;
  };
}

export function loadDailyWorkoutStatus(): DailyWorkoutStatusStorage {
  const today = getTodayDateString();
  const defaultStatus: DailyWorkoutStatusStorage = {
    date: today,
    completed: false,
    cardio: {
      done: false,
      type: '',
      durationMinutes: '',
    },
  };

  try {
    const raw = localStorage.getItem(DAILY_WORKOUT_STATUS_KEY);
    if (!raw) return defaultStatus;
    const parsed: DailyWorkoutStatusStorage = JSON.parse(raw);
    if (parsed.date !== today) {
      // Outro dia: reseta para hoje
      return defaultStatus;
    }
    return {
      date: today,
      completed: !!parsed.completed,
      cardio: {
        done: !!parsed.cardio?.done,
        type: parsed.cardio?.type || '',
        durationMinutes: parsed.cardio?.durationMinutes || '',
      },
    };
  } catch (err) {
    console.error('Falha ao carregar treino_dia_status:', err);
    return defaultStatus;
  }
}

export function saveDailyWorkoutStatus(status: DailyWorkoutStatusStorage): void {
  try {
    localStorage.setItem(DAILY_WORKOUT_STATUS_KEY, JSON.stringify(status));
  } catch (err) {
    console.error('Falha ao salvar treino_dia_status:', err);
  }
}

export function resetDailyWorkoutStatus(): void {
  try {
    const today = getTodayDateString();
    saveDailyWorkoutStatus({
      date: today,
      completed: false,
      cardio: { done: false, type: '', durationMinutes: '' },
    });
  } catch (err) {}
}

import { DailyWorkoutDaysHistory } from '../types';

export function loadWorkoutDaysHistory(): DailyWorkoutDaysHistory[] {
  try {
    const raw = localStorage.getItem(WORKOUT_DAYS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Falha ao carregar treino_dias_historico:', err);
    return [];
  }
}

export function saveWorkoutDaysHistory(history: DailyWorkoutDaysHistory[]): void {
  try {
    localStorage.setItem(WORKOUT_DAYS_HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Falha ao salvar treino_dias_historico:', err);
  }
}

export function archiveWorkoutDaySession(
  dateStr: string,
  workoutDays: WorkoutDay[],
  workoutStatus?: DailyWorkoutStatusStorage
): void {
  try {
    const status = workoutStatus || loadDailyWorkoutStatus();
    // Lista de exercícios concluídos hoje com marcação de falha
    const doneExercisesWithFailure = workoutDays.flatMap((day) =>
      day.exercises
        .filter((ex) => ex.done)
        .map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          failure: !!ex.failure,
        }))
    );

    // Se não houve atividade (sem treino concluído, sem cardio e sem exercícios feitos), não salva registro vazio
    if (!status.completed && !status.cardio?.done && doneExercisesWithFailure.length === 0) {
      return;
    }

    const entry: DailyWorkoutDaysHistory = {
      date: dateStr,
      completed: !!status.completed,
      cardioDone: !!status.cardio?.done,
      cardioType: status.cardio?.type?.trim() || undefined,
      cardioMinutes: status.cardio?.durationMinutes ? String(status.cardio.durationMinutes).trim() : undefined,
      exercises: doneExercisesWithFailure,
    };

    const history = loadWorkoutDaysHistory();
    const existingIndex = history.findIndex((h) => h.date === dateStr);
    let updated: DailyWorkoutDaysHistory[];
    if (existingIndex !== -1) {
      updated = [...history];
      updated[existingIndex] = entry;
    } else {
      updated = [entry, ...history];
    }
    updated.sort((a, b) => b.date.localeCompare(a.date));
    saveWorkoutDaysHistory(updated);
  } catch (err) {
    console.error('Falha ao arquivar treino_dias_historico:', err);
  }
}

export function clearWorkoutDaysHistory(): void {
  try {
    localStorage.removeItem(WORKOUT_DAYS_HISTORY_KEY);
  } catch (err) {
    console.error('Falha ao limpar treino_dias_historico:', err);
  }
}

export interface DailyWaterHistory {
  date: string; // AAAA-MM-DD local
  totalMl: number;
  goalMl: number;
}

export interface DailySummaryRecord {
  date: string; // AAAA-MM-DD local
  waterMl: number;
  waterGoalMl: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  exercisesDoneCount: number;
}

export function loadWaterHistory(): DailyWaterHistory[] {
  try {
    const raw = localStorage.getItem(WATER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Falha ao carregar agua_historico:', err);
    return [];
  }
}

export function saveWaterHistory(history: DailyWaterHistory[]): void {
  try {
    localStorage.setItem(WATER_HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Falha ao salvar agua_historico:', err);
  }
}

export function archiveWaterDay(dateStr: string, totalMl: number, goalMl: number): void {
  try {
    if (totalMl <= 0) return; // Se não houve consumo de água, não arquiva registro vazio
    const history = loadWaterHistory();
    const entry: DailyWaterHistory = {
      date: dateStr,
      totalMl: Math.round(totalMl),
      goalMl: Math.round(goalMl),
    };
    const existingIndex = history.findIndex((h) => h.date === dateStr);
    let updated: DailyWaterHistory[];
    if (existingIndex !== -1) {
      updated = [...history];
      updated[existingIndex] = entry;
    } else {
      updated = [entry, ...history];
    }
    updated.sort((a, b) => b.date.localeCompare(a.date));
    saveWaterHistory(updated);
  } catch (err) {
    console.error('Falha ao arquivar água no histórico:', err);
  }
}

export function clearWaterHistory(): void {
  try {
    localStorage.removeItem(WATER_HISTORY_KEY);
  } catch (err) {
    console.error('Falha ao limpar agua_historico:', err);
  }
}

export function loadDailySummaries(): DailySummaryRecord[] {
  try {
    const raw = localStorage.getItem(DAILY_SUMMARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Falha ao carregar resumo_diario:', err);
    return [];
  }
}

export function saveDailySummaries(summaries: DailySummaryRecord[]): void {
  try {
    localStorage.setItem(DAILY_SUMMARY_KEY, JSON.stringify(summaries));
  } catch (err) {
    console.error('Falha ao salvar resumo_diario:', err);
  }
}

export function archiveDailySummary(
  dateStr: string,
  meals: Meal[],
  water: WaterState,
  workoutDays: WorkoutDay[]
): void {
  try {
    const totals = calculateNutritionTotals(meals);
    const exercisesDoneCount = workoutDays.reduce(
      (acc, d) => acc + d.exercises.filter((e) => e.done).length,
      0
    );

    // Se o dia não teve nenhuma atividade registrada, não salva resumo vazio
    if (exercisesDoneCount === 0 && totals.consumedCalories === 0 && (water.currentMl || 0) === 0) {
      return;
    }

    const entry: DailySummaryRecord = {
      date: dateStr,
      waterMl: Math.round(water.currentMl || 0),
      waterGoalMl: Math.round(water.dailyGoalMl || 2500),
      calories: totals.consumedCalories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      exercisesDoneCount,
    };

    const summaries = loadDailySummaries();
    const existingIndex = summaries.findIndex((s) => s.date === dateStr);
    let updated: DailySummaryRecord[];
    if (existingIndex !== -1) {
      updated = [...summaries];
      updated[existingIndex] = entry;
    } else {
      updated = [entry, ...summaries];
    }
    updated.sort((a, b) => b.date.localeCompare(a.date));
    saveDailySummaries(updated);
  } catch (err) {
    console.error('Falha ao arquivar resumo_diario:', err);
  }
}

export function clearDailySummaries(): void {
  try {
    localStorage.removeItem(DAILY_SUMMARY_KEY);
  } catch (err) {
    console.error('Falha ao limpar resumo_diario:', err);
  }
}

export function getShareDataWithAi(): boolean {
  try {
    const saved = localStorage.getItem(SHARE_DATA_WITH_AI_KEY);
    if (saved === null) return true; // Ligada por padrão
    return saved !== 'false';
  } catch {
    return true;
  }
}

export function setShareDataWithAi(enabled: boolean): void {
  try {
    localStorage.setItem(SHARE_DATA_WITH_AI_KEY, enabled ? 'true' : 'false');
  } catch {}
}

// Minimal starter template with editable structure
export const INITIAL_DAYS: WorkoutDay[] = [
  {
    id: 'seg',
    name: 'Segunda-feira',
    subtitle: 'Ex: Peito & Tríceps',
    exercises: [
      {
        id: 'ex-1',
        name: 'Supino Reto',
        sets: 4,
        reps: '10 a 12',
        weight: '20kg cada lado',
        notes: 'Exemplo: aquecer bem antes',
        done: false,
      },
    ],
  },
  { id: 'ter', name: 'Terça-feira', subtitle: 'Ex: Costas & Bíceps', exercises: [] },
  { id: 'qua', name: 'Quarta-feira', subtitle: 'Ex: Pernas completo', exercises: [] },
  { id: 'qui', name: 'Quinta-feira', subtitle: 'Ex: Ombros & Trapézio', exercises: [] },
  { id: 'sex', name: 'Sexta-feira', subtitle: 'Ex: Braços & Core', exercises: [] },
  { id: 'sab', name: 'Sábado', subtitle: 'Ex: Cardio ou Descanso', exercises: [] },
  { id: 'dom', name: 'Domingo', subtitle: 'Ex: Descanso ativo', exercises: [] },
];

export const INITIAL_MEALS: Meal[] = [
  {
    id: 'meal-cafe',
    name: 'Café da Manhã',
    time: '08:00',
    items: [
      {
        id: 'food-1',
        name: 'Ovos mexidos',
        quantity: '2 unidades',
        notes: 'Exemplo: com azeite de oliva',
        done: false,
      },
    ],
  },
  { id: 'meal-almoco', name: 'Almoço', time: '12:30', items: [] },
  { id: 'meal-lanche', name: 'Lanche da Tarde', time: '16:00', items: [] },
  { id: 'meal-jantar', name: 'Jantar', time: '20:00', items: [] },
  { id: 'meal-ceia', name: 'Ceia', time: '22:30', items: [] },
];

export const INITIAL_WATER: WaterState = {
  dailyGoalMl: 2500,
  currentMl: 0,
  logs: [],
  lastDate: getTodayDateString(),
};

export const DEFAULT_APP_DATA: AppData = {
  version: 1,
  workoutDays: INITIAL_DAYS,
  meals: INITIAL_MEALS,
  water: INITIAL_WATER,
  lastActiveDate: getTodayDateString(),
};

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const today = getTodayDateString();

    if (!raw) {
      return { ...DEFAULT_APP_DATA, lastActiveDate: today };
    }

    const data: AppData = JSON.parse(raw);

    // Ensure backwards compatibility and default fields
    if (!data.workoutDays) data.workoutDays = INITIAL_DAYS;
    if (!data.meals) data.meals = INITIAL_MEALS;
    if (!data.water) data.water = INITIAL_WATER;
    if (!data.nutritionGoals) data.nutritionGoals = {};

    // Check if the day has rolled over for automatic reset
    if (data.lastActiveDate && data.lastActiveDate !== today) {
      // 1. Archive the previous day's recorded nutrition into 'nutricao_historico'
      archiveNutritionDay(data.lastActiveDate, data.meals);

      // 2. Archive previous day's water into 'agua_historico'
      archiveWaterDay(data.lastActiveDate, data.water.currentMl, data.water.dailyGoalMl || 2500);

      // 3. Archive previous day's complete summary into 'resumo_diario'
      archiveDailySummary(data.lastActiveDate, data.meals, data.water, data.workoutDays);

      // 4. Archive previous day's workout status (completion, cardio, failure items) into 'treino_dias_historico'
      archiveWorkoutDaySession(data.lastActiveDate, data.workoutDays);

      // Reseta status de cardio e conclusão do dia anterior
      resetDailyWorkoutStatus();

      // Auto-reset daily flags while keeping structures and water goal
      const resetDays = data.workoutDays.map((day) => ({
        ...day,
        exercises: day.exercises.map((ex) => ({ ...ex, done: false, failure: false })),
      }));

      // 2. Clear food items for the new day while keeping the meals structure (name, time, order) intact
      const resetMeals = data.meals.map((meal) => ({
        ...meal,
        items: [],
      }));

      const resetWater: WaterState = {
        ...data.water,
        currentMl: 0,
        logs: [],
        lastDate: today,
      };

      const refreshedData: AppData = {
        ...data,
        workoutDays: resetDays,
        meals: resetMeals,
        water: resetWater,
        nutritionGoals: data.nutritionGoals || {},
        lastActiveDate: today,
      };

      saveAppData(refreshedData);
      return refreshedData;
    }

    if (!data.lastActiveDate) {
      data.lastActiveDate = today;
      saveAppData(data);
    }

    return data;
  } catch (err) {
    console.error('Falha ao carregar dados do localStorage:', err);
    return DEFAULT_APP_DATA;
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Falha ao salvar dados no localStorage:', err);
  }
}

export function exportDataAsJson(data: AppData): void {
  const exportPayload = {
    ...data,
    treino: data.workoutDays,
    workoutDays: data.workoutDays,
    metas: data.nutritionGoals || {},
    nutritionGoals: data.nutritionGoals || {},
    nutritionHistory: loadNutritionHistory(),
    nutricao_historico: loadNutritionHistory(),
    workoutHistory: loadWorkoutHistory(),
    treino_historico: loadWorkoutHistory(),
    workoutDaysHistory: loadWorkoutDaysHistory(),
    treino_dias_historico: loadWorkoutDaysHistory(),
    waterHistory: loadWaterHistory(),
    agua_historico: loadWaterHistory(),
    dailySummaries: loadDailySummaries(),
    resumo_diario: loadDailySummaries(),
    chat_history: loadChatMessages(),
    chat_pending: loadChatPending(),
    tema: (typeof window !== 'undefined' ? localStorage.getItem('app_theme') : null) || 'light',
    share_data_with_ai: getShareDataWithAi(),
    treino_dia_status: loadDailyWorkoutStatus(),
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `backup_ironlog_${getTodayDateString()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function loadChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY) || localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Falha ao carregar mensagens do chat:', err);
    return [];
  }
}

export function saveChatMessages(messages: ChatMessage[]): void {
  try {
    const hasActualConversation = messages.some((m) => m.role === 'user');
    if (!hasActualConversation) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error('Falha ao salvar mensagens do chat:', err);
  }
}

export function clearChatMessages(): void {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
  } catch (err) {
    console.error('Falha ao limpar histórico do chat:', err);
  }
}

export const CHAT_PENDING_KEY = 'chat_pending';

export interface ChatPendingData {
  questionId: string;
  text: string;
  timestamp: number;
}

export function loadChatPending(): ChatPendingData | null {
  try {
    const raw = localStorage.getItem(CHAT_PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Falha ao carregar pergunta pendente do chat:', err);
    return null;
  }
}

export function saveChatPending(data: ChatPendingData): void {
  try {
    localStorage.setItem(CHAT_PENDING_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Falha ao salvar pergunta pendente do chat:', err);
  }
}

export function clearChatPending(): void {
  try {
    localStorage.removeItem(CHAT_PENDING_KEY);
  } catch (err) {
    console.error('Falha ao limpar pergunta pendente do chat:', err);
  }
}

