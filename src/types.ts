export interface WorkoutExercise {
  id: string;
  name: string;
  sets: string | number;
  reps: string | number;
  weight?: string;
  notes?: string;
  done: boolean;
}

export interface WorkoutDay {
  id: string;
  name: string;
  subtitle?: string;
  exercises: WorkoutExercise[];
}

export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  notes?: string;
  done: boolean;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface Meal {
  id: string;
  name: string;
  time?: string;
  items: FoodItem[];
}

export interface WaterLog {
  id: string;
  amountMl: number;
  timestamp: string;
}

export interface WaterState {
  dailyGoalMl: number;
  currentMl: number;
  logs: WaterLog[];
  lastDate: string; // YYYY-MM-DD
}

export type ActiveTab = 'treino' | 'dieta' | 'agua' | 'chat' | 'resumo';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
  errorCode?: number | string;
  errorDetails?: string;
}

export interface AppData {
  version: number;
  workoutDays: WorkoutDay[];
  meals: Meal[];
  water: WaterState;
  lastActiveDate: string; // YYYY-MM-DD for automatic daily reset
}

export interface DailyNutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  itemsCount: number;
  consumedCount: number;
  consumedCalories: number;
}

export interface DailyNutritionHistory {
  id: string;
  date: string; // YYYY-MM-DD
  dateFormatted: string;
  meals: Meal[];
  totals: DailyNutritionTotals;
  savedAt: string;
}
