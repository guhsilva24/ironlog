import React, { useState, useEffect } from 'react';
import { AppData, ActiveTab, WorkoutDay, Meal, WaterState } from './types';
import { loadAppData, saveAppData, getTodayFormatted, getTodayDateString } from './utils/storage';
import { WorkoutSection } from './components/WorkoutSection';
import { DietSection } from './components/DietSection';
import { WaterSection } from './components/WaterSection';
import { SummarySection } from './components/SummarySection';
import { ChatSection } from './components/ChatSection';
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
} from 'lucide-react';

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
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased pb-20 sm:pb-8">
      {/* Top Header */}
      <header
        id="app-header"
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
                IronLog
              </h1>
            </div>
          </div>

          {/* Right Side: Navigation Tabs for Desktop + Theme Toggle Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <nav id="desktop-nav" className="hidden sm:flex items-center gap-1.5">
              <button
                id="desktop-tab-treino"
                type="button"
                onClick={() => setActiveTab('treino')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                id="desktop-tab-chat"
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>

              <button
                id="desktop-tab-resumo"
                type="button"
                onClick={() => setActiveTab('resumo')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'resumo'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Resumo</span>
              </button>
            </nav>

            {/* Theme Toggle Button (Claro / Escuro) */}
            <button
              id="theme-toggle-btn"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs select-none"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
                  <span className="hidden md:inline text-xs font-semibold">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600 animate-in spin-in-180 duration-200" />
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
          />
        )}

        {activeTab === 'dieta' && (
          <DietSection
            meals={appData.meals}
            onUpdateMeals={handleUpdateMeals}
          />
        )}

        {activeTab === 'agua' && (
          <WaterSection
            water={appData.water}
            onUpdateWater={handleUpdateWater}
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

      {/* Mobile Bottom Navigation Bar (fácil de navegar no celular com o polegar) */}
      <nav
        id="mobile-nav"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg"
      >
        <button
          id="mobile-tab-treino"
          type="button"
          onClick={() => setActiveTab('treino')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'treino' ? 'text-orange-600 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <Dumbbell className="w-5 h-5" />
          <span className="text-[11px]">Treino</span>
        </button>

        <button
          id="mobile-tab-dieta"
          type="button"
          onClick={() => setActiveTab('dieta')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dieta' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[11px]">Nutrição</span>
        </button>

        <button
          id="mobile-tab-agua"
          type="button"
          onClick={() => setActiveTab('agua')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'agua' ? 'text-sky-600 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <Droplets className="w-5 h-5" />
          <span className="text-[11px]">Água</span>
        </button>

        <button
          id="mobile-tab-chat"
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'chat' ? 'text-violet-600 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[11px]">Chat</span>
        </button>

        <button
          id="mobile-tab-resumo"
          type="button"
          onClick={() => setActiveTab('resumo')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'resumo' ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[11px]">Resumo</span>
        </button>
      </nav>
    </div>
  );
}
