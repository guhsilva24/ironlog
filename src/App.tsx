import React, { useState, useEffect } from 'react';
import { AppData, ActiveTab, WorkoutDay, Meal, WaterState, NutritionGoals } from './types';
import { loadAppData, saveAppData, getTodayFormatted, getTodayDateString } from './utils/storage';
import { getTodayLocalDateString } from './utils/dateUtils';
import { WorkoutSection } from './components/WorkoutSection';
import { DietSection } from './components/DietSection';
import { WaterSection } from './components/WaterSection';
import { SummarySection } from './components/SummarySection';
import { ProgressSection } from './components/ProgressSection';
import { ChatSection } from './components/ChatSection';
import { MonthlyCalendarModal } from './components/MonthlyCalendarModal';
import { ChatProvider, useChat } from './context/ChatContext';
import {
  Dumbbell,
  Utensils,
  Droplets,
  LayoutDashboard,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Sun,
  Moon,
  BarChart3,
} from 'lucide-react';

interface AppContentProps {
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

function AppContent({
  appData,
  setAppData,
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
}: AppContentProps) {
  const { hasUnreadReply, sendMessage } = useChat();

  // Calendar modal state and cross-tab navigation state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarInitialDate, setCalendarInitialDate] = useState<string>(() =>
    getTodayLocalDateString()
  );
  const [dietSelectedDate, setDietSelectedDate] = useState<string>(() =>
    getTodayLocalDateString()
  );
  const [workoutTargetWeekDate, setWorkoutTargetWeekDate] = useState<Date | null>(null);

  const handleOpenCalendar = (date?: string) => {
    if (date) {
      setCalendarInitialDate(date);
    }
    setIsCalendarOpen(true);
  };

  const handleNavigateToDiet = (dateStr: string) => {
    setDietSelectedDate(dateStr);
    setActiveTab('dieta');
    setIsCalendarOpen(false);
  };

  const handleNavigateToWorkout = (dateStr: string) => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3) {
      setWorkoutTargetWeekDate(new Date(parts[0], parts[1] - 1, parts[2]));
    }
    setActiveTab('treino');
    setIsCalendarOpen(false);
  };

  const handleAskAiAboutDay = async (prompt: string) => {
    setActiveTab('chat');
    setIsCalendarOpen(false);
    await sendMessage(prompt);
  };

  // Handlers for section updates with instant synchronous persistence
  const handleUpdateWorkoutDays = (workoutDays: WorkoutDay[]) => {
    setAppData((prev) => {
      const updated = { ...prev, workoutDays };
      saveAppData(updated);
      return updated;
    });
  };

  const handleUpdateMeals = (meals: Meal[]) => {
    setAppData((prev) => {
      const updated = { ...prev, meals };
      saveAppData(updated);
      return updated;
    });
  };

  const handleUpdateNutritionGoals = (nutritionGoals: NutritionGoals) => {
    setAppData((prev) => {
      const updated = { ...prev, nutritionGoals };
      saveAppData(updated);
      return updated;
    });
  };

  const handleUpdateWater = (water: WaterState) => {
    setAppData((prev) => {
      const updated = { ...prev, water };
      saveAppData(updated);
      return updated;
    });
  };

  const handleUpdateFullData = (newData: AppData) => {
    setAppData(newData);
    saveAppData(newData);
  };

  // Badges calculation
  const totalExercises = appData.workoutDays.reduce((acc, d) => acc + d.exercises.length, 0);
  const doneExercises = appData.workoutDays.reduce(
    (acc, d) => acc + d.exercises.filter((e) => e.done).length,
    0
  );

  const totalFoodItems = appData.meals.reduce((acc, m) => acc + m.items.length, 0);
  const doneFoodItems = appData.meals.reduce(
    (acc, m) => acc + m.items.filter((i) => i.done).length,
    0
  );

  const waterPercent = Math.min(
    100,
    Math.round((appData.water.currentMl / (appData.water.dailyGoalMl || 2500)) * 100)
  );

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans antialiased pb-24 sm:pb-8">
      {/* Top Header */}
      <header
        id="app-header"
        className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                IronLog
              </h1>
            </div>
          </div>

          {/* Right Side: Navigation Tabs for Desktop + Theme Toggle Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <nav id="desktop-nav" className="hidden sm:flex items-center gap-1">
              <button
                id="desktop-tab-treino"
                type="button"
                onClick={() => setActiveTab('treino')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'treino'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Dumbbell className="w-4 h-4" />
                <span>Treino</span>
                {totalExercises > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      activeTab === 'treino'
                        ? 'bg-orange-800 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {doneExercises}/{totalExercises}
                  </span>
                )}
              </button>

              <button
                id="desktop-tab-dieta"
                type="button"
                onClick={() => setActiveTab('dieta')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dieta'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Nutrição</span>
                {totalFoodItems > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      activeTab === 'dieta'
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {doneFoodItems}/{totalFoodItems}
                  </span>
                )}
              </button>

              <button
                id="desktop-tab-agua"
                type="button"
                onClick={() => setActiveTab('agua')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'agua'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Droplets className="w-4 h-4" />
                <span>Água</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    activeTab === 'agua'
                      ? 'bg-sky-800 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {waterPercent}%
                </span>
              </button>

              <button
                id="desktop-tab-progresso"
                type="button"
                onClick={() => setActiveTab('progresso')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'progresso'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Progresso</span>
              </button>

              <button
                id="desktop-tab-chat"
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="relative flex items-center">
                  <MessageSquare className="w-4 h-4" />
                  {hasUnreadReply && activeTab !== 'chat' && (
                    <span
                      id="desktop-chat-unread-dot"
                      className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-violet-400 ring-2 ring-white dark:ring-slate-900 animate-pulse shadow-xs"
                      title="Nova resposta no chat"
                    />
                  )}
                </div>
                <span>Chat</span>
                {hasUnreadReply && activeTab !== 'chat' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping ml-0.5" />
                )}
              </button>

              <button
                id="desktop-tab-resumo"
                type="button"
                onClick={() => setActiveTab('resumo')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'resumo'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Resumo</span>
              </button>
            </nav>

            {/* Botão de Calendário no Cabeçalho (acesso de qualquer aba) */}
            <button
              id="header-calendar-btn"
              type="button"
              onClick={() => handleOpenCalendar()}
              aria-label="Abrir calendário de rotina"
              title="Abrir calendário mensal de rotina"
              className="min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs select-none"
            >
              <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="hidden md:inline text-xs font-semibold">Calendário</span>
            </button>

            {/* Theme Toggle Button (Claro / Escuro) */}
            <button
              id="theme-toggle-btn"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs select-none"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
                  <span className="hidden md:inline text-xs font-semibold">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300 animate-in spin-in-180 duration-200" />
                  <span className="hidden md:inline text-xs font-semibold">Escuro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        {activeTab === 'treino' && (
          <WorkoutSection
            days={appData.workoutDays}
            onUpdateDays={handleUpdateWorkoutDays}
            targetWeekDate={workoutTargetWeekDate}
            onClearTargetWeekDate={() => setWorkoutTargetWeekDate(null)}
          />
        )}

        {activeTab === 'dieta' && (
          <DietSection
            meals={appData.meals}
            onUpdateMeals={handleUpdateMeals}
            goals={appData.nutritionGoals}
            onUpdateGoals={handleUpdateNutritionGoals}
            selectedDate={dietSelectedDate}
            onSelectDate={(d) => setDietSelectedDate(d)}
            onOpenCalendar={() => handleOpenCalendar(dietSelectedDate)}
          />
        )}

        {activeTab === 'agua' && (
          <WaterSection
            water={appData.water}
            onUpdateWater={handleUpdateWater}
          />
        )}

        {activeTab === 'progresso' && (
          <ProgressSection
            appData={appData}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'chat' && <ChatSection />}

        {activeTab === 'resumo' && (
          <SummarySection
            appData={appData}
            onUpdateAppData={handleUpdateFullData}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      {/* Componente de Calendário Mensal (conecta treino, cardio, nutrição e água) */}
      <MonthlyCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        appData={appData}
        initialDate={calendarInitialDate}
        onNavigateToDiet={handleNavigateToDiet}
        onNavigateToWorkout={handleNavigateToWorkout}
        onAskAi={handleAskAiAboutDay}
      />

      {/* Mobile Bottom Navigation Bar */}
      <nav
        id="mobile-nav"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-1 py-1 flex items-center justify-around shadow-lg"
      >
        <button
          id="mobile-tab-treino"
          type="button"
          onClick={() => setActiveTab('treino')}
          className={`min-h-[48px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'treino' ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
          }`}
        >
          <Dumbbell className="w-5 h-5" />
          <span className="text-[10px]">Treino</span>
        </button>

        <button
          id="mobile-tab-dieta"
          type="button"
          onClick={() => setActiveTab('dieta')}
          className={`min-h-[48px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dieta' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px]">Nutrição</span>
        </button>

        <button
          id="mobile-tab-agua"
          type="button"
          onClick={() => setActiveTab('agua')}
          className={`min-h-[48px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'agua' ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
          }`}
        >
          <Droplets className="w-5 h-5" />
          <span className="text-[10px]">Água</span>
        </button>

        <button
          id="mobile-tab-progresso"
          type="button"
          onClick={() => setActiveTab('progresso')}
          className={`min-h-[48px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'progresso' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px]">Progresso</span>
        </button>

        <button
          id="mobile-tab-chat"
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`min-h-[48px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'chat' ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {hasUnreadReply && activeTab !== 'chat' && (
              <span
                id="mobile-chat-unread-dot"
                className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-violet-600 ring-2 ring-white dark:ring-slate-900 animate-pulse shadow-xs"
                title="Nova resposta no chat"
              />
            )}
          </div>
          <span className="text-[10px]">Chat</span>
        </button>

        <button
          id="mobile-tab-resumo"
          type="button"
          onClick={() => setActiveTab('resumo')}
          className={`min-h-[48px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'resumo' ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Resumo</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  const [appData, setAppData] = useState<AppData>(() => loadAppData());
  const [activeTab, setActiveTab] = useState<ActiveTab>('treino');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('app_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'dark';
        }
      } catch (e) {}
    }
    return 'light';
  });

  // Automatically sync theme with document element and localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('app_theme', theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Automatically persist any changes to localStorage
  useEffect(() => {
    saveAppData(appData);
  }, [appData]);

  // Automatically check if the day rolled over while the app is active
  useEffect(() => {
    const handleCheckDayChange = () => {
      const today = getTodayDateString();
      if (appData.lastActiveDate && appData.lastActiveDate !== today) {
        const refreshed = loadAppData();
        setAppData(refreshed);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleCheckDayChange();
      }
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', handleCheckDayChange);
    const interval = setInterval(handleCheckDayChange, 30000);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', handleCheckDayChange);
      clearInterval(interval);
    };
  }, [appData.lastActiveDate]);

  return (
    <ChatProvider activeTab={activeTab} appData={appData}>
      <AppContent
        appData={appData}
        setAppData={setAppData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    </ChatProvider>
  );
}
