import {
  AppData,
  WorkoutDay,
  Meal,
  WaterState,
  ChatMessage,
  DailyNutritionHistory,
  DailyNutritionTotals,
} from '../types';

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

    // Check if the day has rolled over for automatic reset
    if (data.lastActiveDate && data.lastActiveDate !== today) {
      // 1. Archive the previous day's recorded nutrition into 'nutricao_historico'
      archiveNutritionDay(data.lastActiveDate, data.meals);

      // Auto-reset daily flags while keeping structures and water goal
      const resetDays = data.workoutDays.map((day) => ({
        ...day,
        exercises: day.exercises.map((ex) => ({ ...ex, done: false })),
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
    nutritionHistory: loadNutritionHistory(),
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

