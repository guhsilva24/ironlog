export interface WorkoutExercise {
  id: string;
  name: string;
  sets: string | number;
  reps: string | number;
  weight?: string;
  notes?: string;
  done: boolean;
  failure?: boolean; // Marcação "Falha" (só pode ser ligada se done === true)
}

export interface WorkoutDay {
  id: string;
  name: string;
  subtitle?: string;
  exercises: WorkoutExercise[];
}

export interface DailyCardioState {
  done: boolean;
  type?: string; // ex: esteira, bike, corrida
  durationMinutes?: number | string;
}

export interface DayWorkoutStatus {
  completed: boolean; // Treino de hoje concluído
  cardio: DailyCardioState;
  date: string; // AAAA-MM-DD local
}

export interface WorkoutDayExerciseHistoryItem {
  name: string;
  sets?: string | number;
  reps?: string | number;
  weight?: string;
  failure?: boolean;
}

export interface DailyWorkoutDaysHistory {
  date: string; // AAAA-MM-DD local (usando data do dispositivo e NÃO UTC)
  completed: boolean; // se o treino foi concluído
  cardioDone: boolean; // se fez cardio
  cardioType?: string; // tipo de cardio
  cardioMinutes?: number | string; // minutos de cardio
  exercises: WorkoutDayExerciseHistoryItem[]; // exercícios feitos com a marcação "Falha"
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

export type ActiveTab = 'treino' | 'dieta' | 'agua' | 'chat' | 'resumo' | 'progresso';

export interface NutritionGoals {
  calories?: number;
  protein?: number;
}

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
  nutritionGoals?: NutritionGoals;
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
