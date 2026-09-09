import React, { useState } from 'react';
import { Meal, FoodItem, DailyNutritionHistory } from '../types';
import {
  loadNutritionHistory,
  archiveNutritionDay,
  deleteNutritionHistoryDay,
  getTodayDateString,
} from '../utils/storage';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import {
  Utensils,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  RotateCcw,
  FileText,
  Scale,
  Sparkles,
  Flame,
  AlertCircle,
  Loader2,
  Bot,
  User,
  ArrowLeft,
  Send,
  ArrowUp,
  ArrowDown,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  BookmarkPlus,
} from 'lucide-react';

interface DietSectionProps {
  meals: Meal[];
  onUpdateMeals: (meals: Meal[]) => void;
}

export const DietSection: React.FC<DietSectionProps> = ({ meals, onUpdateMeals }) => {
  // Meal modal states
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [mealName, setMealName] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealInsertPosition, setMealInsertPosition] = useState<string>('end');

  // Food item modal states
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [currentMealIdForFood, setCurrentMealIdForFood] = useState<string>('');
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [foodMode, setFoodMode] = useState<'ai' | 'manual'>('ai');

  // AI input states
  const [aiDescription, setAiDescription] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [aiConversation, setAiConversation] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [aiFollowUpInput, setAiFollowUpInput] = useState('');

  // Manual / Edit food states
  const [foodName, setFoodName] = useState('');
  const [foodQuantity, setFoodQuantity] = useState('');
  const [foodCalories, setFoodCalories] = useState<string>('');
  const [foodProtein, setFoodProtein] = useState<string>('');
  const [foodCarbs, setFoodCarbs] = useState<string>('');
  const [foodFat, setFoodFat] = useState<string>('');
  const [foodNotes, setFoodNotes] = useState('');

  // History modal states
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [nutritionHistory, setNutritionHistory] = useState<DailyNutritionHistory[]>([]);
  const [expandedHistoryDayId, setExpandedHistoryDayId] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyNotification, setHistoryNotification] = useState<string | null>(null);

  const handleOpenHistory = () => {
    const list = loadNutritionHistory();
    setNutritionHistory(list);
    setHistorySearchQuery('');
    setExpandedHistoryDayId(list.length === 1 ? list[0].id : null);
    setIsHistoryModalOpen(true);
  };

  const handleToggleExpandHistoryDay = (id: string) => {
    setExpandedHistoryDayId((prev) => (prev === id ? null : id));
  };

  const handleDeleteHistoryEntry = (entry: DailyNutritionHistory) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Histórico do Dia',
      message: `Tem certeza que deseja remover o histórico do dia ${entry.dateFormatted || entry.date}?`,
      confirmLabel: 'Remover',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        deleteNutritionHistoryDay(entry.id);
        const updated = loadNutritionHistory();
        setNutritionHistory(updated);
        if (expandedHistoryDayId === entry.id) {
          setExpandedHistoryDayId(null);
        }
      },
    });
  };

  const handleArchiveTodayNow = () => {
    const todayStr = getTodayDateString();
    const success = archiveNutritionDay(todayStr, meals);
    if (success) {
      const updated = loadNutritionHistory();
      setNutritionHistory(updated);
      setExpandedHistoryDayId(`nutri-${todayStr}`);
      setHistoryNotification('Cópia do dia atual salva no histórico com sucesso!');
      setTimeout(() => setHistoryNotification(null), 3500);
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Nenhum alimento registrado hoje',
        message: 'Adicione pelo menos um alimento no plano de refeições de hoje antes de salvar uma cópia no histórico.',
        isAlertOnly: true,
        onConfirm: () => {},
      });
    }
  };

  // In-app confirmation / alert modal state (never uses window.confirm or window.alert)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    isAlertOnly?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Excluir',
    isDestructive: true,
    isAlertOnly: false,
    onConfirm: () => {},
  });

  // Open modal to add meal
  const handleOpenAddMeal = () => {
    setEditingMeal(null);
    setMealName('');
    setMealTime('');
    setMealInsertPosition('end');
    setIsMealModalOpen(true);
  };

  // Helper to ensure meal time string conforms to HH:mm for type="time"
  const normalizeTimeForInput = (time?: string): string => {
    if (!time) return '';
    const match = time.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = match[1].padStart(2, '0');
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }
    return '';
  };

  // Open modal to edit meal
  const handleOpenEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setMealName(meal.name);
    setMealTime(normalizeTimeForInput(meal.time));
    setIsMealModalOpen(true);
  };

  // Save meal
  const handleSaveMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName.trim()) return;

    if (editingMeal) {
      const updated = meals.map((m) =>
        m.id === editingMeal.id
          ? {
              ...m,
              name: mealName.trim(),
              time: mealTime.trim() || undefined,
            }
          : m
      );
      onUpdateMeals(updated);
    } else {
      const newMeal: Meal = {
        id: 'meal-' + Date.now(),
        name: mealName.trim(),
        time: mealTime.trim() || undefined,
        items: [],
      };

      if (mealInsertPosition === 'start') {
        onUpdateMeals([newMeal, ...meals]);
      } else if (mealInsertPosition.startsWith('after:')) {
        const targetId = mealInsertPosition.replace('after:', '');
        const targetIdx = meals.findIndex((m) => m.id === targetId);
        if (targetIdx !== -1) {
          const updated = [...meals];
          updated.splice(targetIdx + 1, 0, newMeal);
          onUpdateMeals(updated);
        } else {
          onUpdateMeals([...meals, newMeal]);
        }
      } else {
        onUpdateMeals([...meals, newMeal]);
      }
    }
    setIsMealModalOpen(false);
  };

  // Reorder meal position (move up or down)
  const handleMoveMeal = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === meals.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newMeals = [...meals];
    const temp = newMeals[index];
    newMeals[index] = newMeals[targetIndex];
    newMeals[targetIndex] = temp;

    onUpdateMeals(newMeals);
  };

  // Delete meal with in-app confirmation modal
  const handleDeleteMeal = (meal: Meal) => {
    if (meals.length <= 1) {
      setConfirmModal({
        isOpen: true,
        title: 'Atenção',
        message: 'Você precisa manter pelo menos uma refeição cadastrada no seu plano alimentar.',
        isAlertOnly: true,
        onConfirm: () => {},
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Refeição',
      message: `Tem certeza que deseja excluir a refeição "${meal.name}" e todos os seus ${meal.items.length} alimento(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir Refeição',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        onUpdateMeals(meals.filter((m) => m.id !== meal.id));
      },
    });
  };

  // Open food modal to add
  const handleOpenAddFood = (mealId: string) => {
    setCurrentMealIdForFood(mealId);
    setEditingFood(null);
    setFoodMode('ai');
    setAiDescription('');
    setAiConversation([]);
    setAiFollowUpInput('');
    setEstimateError(null);
    setFoodName('');
    setFoodQuantity('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
    setFoodNotes('');
    setIsFoodModalOpen(true);
  };

  // Open food modal to edit
  const handleOpenEditFood = (mealId: string, food: FoodItem) => {
    setCurrentMealIdForFood(mealId);
    setEditingFood(food);
    setFoodMode('manual');
    setAiDescription('');
    setAiConversation([]);
    setAiFollowUpInput('');
    setEstimateError(null);
    setFoodName(food.name);
    setFoodQuantity(food.quantity);
    setFoodCalories(food.calories !== undefined ? String(food.calories) : '');
    setFoodProtein(food.protein !== undefined ? String(food.protein) : '');
    setFoodCarbs(food.carbs !== undefined ? String(food.carbs) : '');
    setFoodFat(food.fat !== undefined ? String(food.fat) : '');
    setFoodNotes(food.notes || '');
    setIsFoodModalOpen(true);
  };

  // Helper to process estimated items and add them to the meal
  const applyEstimatedItems = (items: any[]) => {
    if (!items || items.length === 0) {
      setEstimateError('Nenhum alimento pôde ser identificado.');
      setIsEstimating(false);
      return;
    }

    const newItems: FoodItem[] = items.map((item: any, idx: number) => ({
      id: `food-${Date.now()}-${idx}`,
      name: item.nome || 'Alimento',
      quantity: item.quantidade || '1 porção',
      calories: typeof item.calorias === 'number' ? item.calorias : undefined,
      protein: typeof item.proteina_g === 'number' ? item.proteina_g : undefined,
      carbs: typeof item.carboidrato_g === 'number' ? item.carboidrato_g : undefined,
      fat: typeof item.gordura_g === 'number' ? item.gordura_g : undefined,
      notes: item.observacao || item.notes || undefined,
      done: false,
    }));

    const updated = meals.map((m) => {
      if (m.id !== currentMealIdForFood) return m;
      return {
        ...m,
        items: [...m.items, ...newItems],
      };
    });

    onUpdateMeals(updated);
    setIsFoodModalOpen(false);
    setAiDescription('');
    setAiConversation([]);
    setAiFollowUpInput('');
  };

  // Estimate food nutrition via Gemini AI (initial request)
  const handleEstimateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiDescription.trim() || !currentMealIdForFood || isEstimating) return;

    setIsEstimating(true);
    setEstimateError(null);

    try {
      const response = await fetch('/api/estimate-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiDescription.trim() }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg =
          data?.message ||
          data?.error ||
          'Não foi possível estimar os nutrientes do alimento informado. Tente descrever com mais detalhes ou preencha manualmente.';
        setEstimateError(errorMsg);
        setIsEstimating(false);
        return;
      }

      // Check if IA is requesting clarification for regional dishes or ingredients
      if (data?.type === 'clarification' && data?.question) {
        setAiConversation([
          { role: 'user', content: aiDescription.trim() },
          { role: 'assistant', content: data.question },
        ]);
        setAiFollowUpInput('');
        setIsEstimating(false);
        return;
      }

      if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
        applyEstimatedItems(data.items);
      } else {
        setEstimateError(
          data?.message ||
            'Não foi possível identificar os alimentos. Tente detalhar melhor a descrição.'
        );
      }
    } catch (err: any) {
      console.error('Erro na requisição de estimativa:', err);
      setEstimateError(
        'Não foi possível conectar com o serviço de IA. Tente novamente ou use o preenchimento manual.'
      );
    } finally {
      setIsEstimating(false);
    }
  };

  // Submit user clarification to the nutrition AI chat
  const handleClarificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiFollowUpInput.trim() || !currentMealIdForFood || isEstimating) return;

    setIsEstimating(true);
    setEstimateError(null);

    const followUpText = aiFollowUpInput.trim();
    const currentConv = [...aiConversation];
    setAiConversation([
      ...currentConv,
      { role: 'user', content: followUpText },
    ]);
    setAiFollowUpInput('');

    try {
      const response = await fetch('/api/estimate-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: followUpText,
          history: currentConv,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg =
          data?.message ||
          data?.error ||
          'Não foi possível estimar os nutrientes com essas informações. Tente detalhar mais ou use o modo manual.';
        setEstimateError(errorMsg);
        setIsEstimating(false);
        return;
      }

      // If IA needs another clarification
      if (data?.type === 'clarification' && data?.question) {
        setAiConversation((prev) => [
          ...prev,
          { role: 'assistant', content: data.question },
        ]);
        setIsEstimating(false);
        return;
      }

      if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
        applyEstimatedItems(data.items);
      } else {
        setEstimateError(
          data?.message ||
            'Não foi possível identificar os alimentos. Tente detalhar melhor a descrição.'
        );
      }
    } catch (err: any) {
      console.error('Erro na requisição de esclarecimento:', err);
      setEstimateError(
        'Não foi possível conectar com o serviço de IA. Tente novamente ou use o preenchimento manual.'
      );
    } finally {
      setIsEstimating(false);
    }
  };

  // Reset AI chat to start over
  const handleResetAiConversation = () => {
    setAiConversation([]);
    setAiFollowUpInput('');
    setEstimateError(null);
  };

  // Save food item manually (or when editing)
  const handleSaveFoodManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim()) return;

    const calNum = foodCalories.trim() !== '' ? Math.max(0, Math.round(Number(foodCalories) || 0)) : undefined;
    const protNum = foodProtein.trim() !== '' ? Math.max(0, Math.round(Number(foodProtein) || 0)) : undefined;
    const carbsNum = foodCarbs.trim() !== '' ? Math.max(0, Math.round(Number(foodCarbs) || 0)) : undefined;
    const fatNum = foodFat.trim() !== '' ? Math.max(0, Math.round(Number(foodFat) || 0)) : undefined;

    if (editingFood) {
      // Edit food across all meals to guarantee finding and updating the exact item
      const updated = meals.map((m) => ({
        ...m,
        items: m.items.map((item) =>
          item.id === editingFood.id
            ? {
                ...item,
                name: foodName.trim(),
                quantity: foodQuantity.trim() || 'A gosto',
                calories: calNum,
                protein: protNum,
                carbs: carbsNum,
                fat: fatNum,
                notes: foodNotes.trim() || undefined,
              }
            : item
        ),
      }));
      onUpdateMeals(updated);
    } else {
      if (!currentMealIdForFood) return;
      const newItem: FoodItem = {
        id: 'food-' + Date.now(),
        name: foodName.trim(),
        quantity: foodQuantity.trim() || 'A gosto',
        calories: calNum,
        protein: protNum,
        carbs: carbsNum,
        fat: fatNum,
        notes: foodNotes.trim() || undefined,
        done: false,
      };
      const updated = meals.map((m) => {
        if (m.id !== currentMealIdForFood) return m;
        return {
          ...m,
          items: [...m.items, newItem],
        };
      });
      onUpdateMeals(updated);
    }
    setIsFoodModalOpen(false);
  };

  // Delete food item with in-app confirmation modal
  const handleDeleteFood = (meal: Meal, food: FoodItem) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Alimento',
      message: `Tem certeza que deseja excluir "${food.name}" de ${meal.name}?`,
      confirmLabel: 'Excluir Alimento',
      isDestructive: true,
      isAlertOnly: false,
      onConfirm: () => {
        const updated = meals.map((m) => ({
          ...m,
          items: m.items.filter((item) => item.id !== food.id),
        }));
        onUpdateMeals(updated);
      },
    });
  };

  // Toggle food item done
  const handleToggleFoodDone = (mealId: string, foodId: string) => {
    const updated = meals.map((m) => {
      if (m.id !== mealId) return m;
      return {
        ...m,
        items: m.items.map((item) =>
          item.id === foodId ? { ...item, done: !item.done } : item
        ),
      };
    });
    onUpdateMeals(updated);
  };

  // Reset all food checks for the day with in-app confirmation modal
  const handleResetDietToday = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Zerar Checks de Hoje',
      message: 'Deseja desmarcar todos os alimentos consumidos hoje no seu plano de nutrição?',
      confirmLabel: 'Zerar Checks',
      isDestructive: false,
      isAlertOnly: false,
      onConfirm: () => {
        const updated = meals.map((m) => ({
          ...m,
          items: m.items.map((item) => ({ ...item, done: false })),
        }));
        onUpdateMeals(updated);
      },
    });
  };

  // Stats and macro calculations
  let totalItems = 0;
  let doneItems = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let consumedCalories = 0;
  let consumedProtein = 0;
  let consumedCarbs = 0;
  let consumedFat = 0;

  meals.forEach((m) => {
    m.items.forEach((item) => {
      totalItems++;
      if (item.calories) totalCalories += item.calories;
      if (item.protein) totalProtein += item.protein;
      if (item.carbs) totalCarbs += item.carbs;
      if (item.fat) totalFat += item.fat;

      if (item.done) {
        doneItems++;
        if (item.calories) consumedCalories += item.calories;
        if (item.protein) consumedProtein += item.protein;
        if (item.carbs) consumedCarbs += item.carbs;
        if (item.fat) consumedFat += item.fat;
      }
    });
  });

  return (
    <div id="diet-section" className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Plano de Nutrição</h2>
              <p className="text-xs text-slate-500">
                Organize suas refeições e acompanhe os alimentos e macronutrientes do dia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="nutrition-history-btn"
              type="button"
              onClick={handleOpenHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
              title="Visualizar histórico de refeições e macros de dias anteriores"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Histórico
            </button>

            {totalItems > 0 && (
              <button
                id="reset-diet-today-btn"
                type="button"
                onClick={handleResetDietToday}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Desmarcar todos os alimentos de hoje"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Zerar checks de hoje
              </button>
            )}

            <button
              id="add-meal-btn"
              type="button"
              onClick={handleOpenAddMeal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Nova Refeição
            </button>
          </div>
        </div>

        {/* Global diet progress */}
        {totalItems > 0 && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>Alimentos consumidos hoje:</span>
              <span className="font-bold text-slate-800">
                {doneItems} de {totalItems} ({Math.round((doneItems / totalItems) * 100)}%)
              </span>
            </div>
            <div className="w-full sm:w-48 bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${totalItems > 0 ? (doneItems / totalItems) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Daily Macros Total Summary */}
        {totalCalories > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Total de Macronutrientes Estimados do Dia
              </span>
              {consumedCalories > 0 && (
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                  {consumedCalories} kcal consumidas hoje
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide block">
                  Calorias
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-extrabold text-amber-950">{totalCalories}</span>
                  <span className="text-xs text-amber-700 font-medium">kcal</span>
                </div>
                {consumedCalories > 0 && (
                  <span className="text-[11px] text-amber-700/80 block mt-0.5">
                    {consumedCalories} kcal ingeridas
                  </span>
                )}
              </div>

              <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide block">
                  Proteínas
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-extrabold text-blue-950">{totalProtein}</span>
                  <span className="text-xs text-blue-700 font-medium">g</span>
                </div>
                {consumedProtein > 0 && (
                  <span className="text-[11px] text-blue-700/80 block mt-0.5">
                    {consumedProtein}g ingeridas
                  </span>
                )}
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide block">
                  Carboidratos
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-extrabold text-emerald-950">{totalCarbs}</span>
                  <span className="text-xs text-emerald-700 font-medium">g</span>
                </div>
                {consumedCarbs > 0 && (
                  <span className="text-[11px] text-emerald-700/80 block mt-0.5">
                    {consumedCarbs}g ingeridos
                  </span>
                )}
              </div>

              <div className="bg-purple-50/60 border border-purple-200/60 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wide block">
                  Gorduras
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-extrabold text-purple-950">{totalFat}</span>
                  <span className="text-xs text-purple-700 font-medium">g</span>
                </div>
                {consumedFat > 0 && (
                  <span className="text-[11px] text-purple-700/80 block mt-0.5">
                    {consumedFat}g ingeridas
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 text-right">
              * Valores são estimativas geradas por IA e podem não ser exatos.
            </p>
          </div>
        )}
      </div>

      {/* Meals List */}
      <div className="space-y-4">
        {meals.map((meal, index) => {
          const mealCompleted = meal.items.length > 0 && meal.items.every((i) => i.done);

          // Calculate meal specific totals
          const mealTotals = meal.items.reduce(
            (acc, item) => ({
              calories: acc.calories + (item.calories || 0),
              protein: acc.protein + (item.protein || 0),
              carbs: acc.carbs + (item.carbs || 0),
              fat: acc.fat + (item.fat || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return (
            <div
              key={meal.id}
              id={`meal-card-${meal.id}`}
              className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200 space-y-4"
            >
              {/* Meal header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Reorder arrows */}
                  {meals.length > 1 && (
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 mr-0.5">
                      <button
                        id={`move-up-meal-btn-${meal.id}`}
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveMeal(index, 'up')}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                        title={index === 0 ? 'Primeira refeição' : 'Mover refeição para cima'}
                        aria-label="Mover refeição para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`move-down-meal-btn-${meal.id}`}
                        type="button"
                        disabled={index === meals.length - 1}
                        onClick={() => handleMoveMeal(index, 'down')}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                        title={index === meals.length - 1 ? 'Última refeição' : 'Mover refeição para baixo'}
                        aria-label="Mover refeição para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-slate-800">{meal.name}</h3>

                  {meal.time && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {meal.time}
                    </span>
                  )}

                  {mealCompleted && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Refeição Completa
                    </span>
                  )}

                  {/* Meal Macros Summary Badge */}
                  {mealTotals.calories > 0 && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                      <span className="font-bold text-amber-700">{mealTotals.calories} kcal</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-blue-700 font-semibold">{mealTotals.protein}g P</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-emerald-700 font-semibold">{mealTotals.carbs}g C</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-purple-700 font-semibold">{mealTotals.fat}g G</span>
                    </div>
                  )}

                  <button
                    id={`edit-meal-btn-${meal.id}`}
                    type="button"
                    onClick={() => handleOpenEditMeal(meal)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Editar nome da refeição"
                    aria-label="Editar refeição"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id={`delete-meal-btn-${meal.id}`}
                    type="button"
                    onClick={() => handleDeleteMeal(meal)}
                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Excluir refeição"
                    aria-label="Excluir refeição"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  id={`add-food-btn-${meal.id}`}
                  type="button"
                  onClick={() => handleOpenAddFood(meal.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Alimento
                </button>
              </div>

              {/* Food Items */}
              <div className="space-y-2">
                {meal.items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Nenhum alimento cadastrado nesta refeição. Toque em "+ Adicionar Alimento".
                  </p>
                ) : (
                  meal.items.map((food) => (
                    <div
                      key={food.id}
                      id={`food-item-${food.id}`}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        food.done
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Checkbox and Food Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          id={`toggle-food-${food.id}`}
                          type="button"
                          onClick={() => handleToggleFoodDone(meal.id, food.id)}
                          className={`cursor-pointer flex-shrink-0 transition-colors ${
                            food.done
                              ? 'text-emerald-600 hover:text-emerald-700'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title={food.done ? 'Desmarcar' : 'Marcar como consumido'}
                        >
                          {food.done ? (
                            <CheckCircle2 className="w-5 h-5 fill-emerald-100 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold ${
                                food.done ? 'line-through text-slate-400' : 'text-slate-800'
                              }`}
                            >
                              {food.name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                              <Scale className="w-3 h-3 text-emerald-600" />
                              {food.quantity}
                            </span>
                          </div>

                          {/* Visible Macros Breakdown */}
                          {(food.calories !== undefined ||
                            food.protein !== undefined ||
                            food.carbs !== undefined ||
                            food.fat !== undefined) && (
                            <div className="flex items-center gap-1.5 text-xs mt-1 flex-wrap">
                              <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70">
                                {food.calories ?? 0} kcal
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/70 font-medium">
                                {food.protein ?? 0}g prot
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70 font-medium">
                                {food.carbs ?? 0}g carb
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/70 font-medium">
                                {food.fat ?? 0}g gordura
                              </span>
                            </div>
                          )}

                          {food.notes && (
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span>{food.notes}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Visible Edit & Delete buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          id={`edit-food-btn-${food.id}`}
                          type="button"
                          onClick={() => handleOpenEditFood(meal.id, food)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Editar alimento"
                          aria-label="Editar alimento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-food-btn-${food.id}`}
                          type="button"
                          onClick={() => handleDeleteFood(meal, food)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Excluir alimento"
                          aria-label="Excluir alimento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Meal Form */}
      <Modal
        isOpen={isMealModalOpen}
        onClose={() => setIsMealModalOpen(false)}
        title={editingMeal ? 'Editar Refeição' : 'Nova Refeição'}
      >
        <form onSubmit={handleSaveMeal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Refeição *
            </label>
            <input
              id="meal-name-input"
              type="text"
              required
              placeholder="Ex: Café da Manhã, Almoço, Pré-Treino..."
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="meal-time-input" className="block text-xs font-semibold text-slate-700">
                Horário da Refeição <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              {mealTime && (
                <button
                  type="button"
                  onClick={() => setMealTime('')}
                  className="text-[11px] font-medium text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Limpar horário
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                <Clock className="w-4 h-4" />
              </div>
              <input
                id="meal-time-input"
                type="time"
                step="60"
                value={mealTime}
                onChange={(e) => setMealTime(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-800 font-medium"
              />
              {mealTime && (
                <button
                  type="button"
                  onClick={() => setMealTime('')}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Remover horário"
                  aria-label="Remover horário"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick time suggestion chips */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] text-slate-400 font-medium mr-0.5">Sugestões:</span>
              {['07:30', '10:00', '12:30', '16:00', '19:30', '21:30'].map((timePreset) => (
                <button
                  key={timePreset}
                  type="button"
                  onClick={() => setMealTime(timePreset)}
                  className={`px-2 py-0.5 text-xs rounded-lg transition-colors cursor-pointer ${
                    mealTime === timePreset
                      ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                  }`}
                >
                  {timePreset}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Toque no campo para abrir o seletor 24h ou deixe em branco se não quiser horário definido.
            </p>
          </div>

          {!editingMeal && meals.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Posição na lista
              </label>
              <select
                id="meal-position-select"
                value={mealInsertPosition}
                onChange={(e) => setMealInsertPosition(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-700 cursor-pointer"
              >
                <option value="end">No final da lista (padrão)</option>
                <option value="start">No início da lista</option>
                {meals.map((m, idx) => (
                  <option key={m.id} value={`after:${m.id}`}>
                    Inserir depois de: {m.name} (#{idx + 1})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Você também pode usar as setas (▲ / ▼) no cabeçalho de cada refeição para reordenar a qualquer momento.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              id="cancel-meal-modal-btn"
              type="button"
              onClick={() => setIsMealModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-meal-modal-btn"
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              {editingMeal ? 'Salvar Alterações' : 'Criar Refeição'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Food Item Form */}
      <Modal
        isOpen={isFoodModalOpen}
        onClose={() => {
          if (!isEstimating) setIsFoodModalOpen(false);
        }}
        title={editingFood ? 'Editar Alimento' : 'Adicionar Alimento'}
      >
        <div className="space-y-4">
          {/* Mode Switcher when adding a new food */}
          {!editingFood && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setFoodMode('ai');
                  setEstimateError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  foodMode === 'ai'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Descrever com IA
              </button>
              <button
                type="button"
                onClick={() => {
                  setFoodMode('manual');
                  setEstimateError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  foodMode === 'manual'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                Preencher Manual
              </button>
            </div>
          )}

          {/* AI Mode Form */}
          {!editingFood && foodMode === 'ai' ? (
            aiConversation.length === 0 ? (
              /* Step 1: Initial Description Form */
              <form onSubmit={handleEstimateAndAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Descreva o que você comeu
                  </label>
                  <textarea
                    id="food-ai-description-input"
                    rows={3}
                    required
                    autoFocus
                    disabled={isEstimating}
                    placeholder='Ex: "manteiga Deline", "leite líquido Itálac", "iogurte Nestlé", "2 fatias de pão Pullman", "1 x-caboquinho"...'
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    💡 Reconhece marcas industriais (Deline, Itálac, Nestlé, Pullman, etc.) e pratos regionais. Se a quantidade consumida não for informada, a IA perguntará no chat antes de gerar os macros.
                  </p>
                </div>

                {estimateError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">{estimateError}</p>
                      <button
                        type="button"
                        onClick={() => setFoodMode('manual')}
                        className="text-amber-800 underline font-semibold cursor-pointer text-xs"
                      >
                        Prefiro preencher manualmente
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 italic">
                  * Valores são estimativas geradas por IA priorizando preparações regionais.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    id="cancel-food-ai-btn"
                    type="button"
                    disabled={isEstimating}
                    onClick={() => setIsFoodModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    id="estimate-food-submit-btn"
                    type="submit"
                    disabled={isEstimating || !aiDescription.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEstimating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Estimando macros com IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>Calcular e Adicionar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Interactive Clarification Chat */
              <div className="space-y-4">
                <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Esclarecimento Nutricional
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Informe a quantidade consumida ou detalhes dos ingredientes e da marca
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAiConversation}
                    disabled={isEstimating}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Recomeçar
                  </button>
                </div>

                {/* Conversation message stream */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {aiConversation.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-2.5 ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[85%] ${
                          msg.role === 'user'
                            ? 'bg-slate-800 text-white rounded-tr-xs'
                            : 'bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/80 font-medium'
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isEstimating && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-slate-100 text-slate-600 rounded-2xl rounded-tl-xs p-3 text-xs flex items-center gap-2 border border-slate-200/80">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Estimando macronutrientes com base nas informações...</span>
                      </div>
                    </div>
                  )}
                </div>

                {estimateError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">{estimateError}</p>
                      <button
                        type="button"
                        onClick={() => setFoodMode('manual')}
                        className="text-amber-800 underline font-semibold cursor-pointer text-xs"
                      >
                        Prefiro preencher manualmente
                      </button>
                    </div>
                  </div>
                )}

                {/* Follow-up input form */}
                <form onSubmit={handleClarificationSubmit} className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sua resposta:
                    </label>
                    <div className="relative">
                      <input
                        id="food-ai-clarification-input"
                        type="text"
                        required
                        autoFocus
                        disabled={isEstimating}
                        placeholder='Ex: "2 colheres de sopa rasas", "1 copo de 200ml", "2 fatias", "com queijo coalho"...'
                        value={aiFollowUpInput}
                        onChange={(e) => setAiFollowUpInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 pr-24 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <button
                        id="send-clarification-btn"
                        type="submit"
                        disabled={isEstimating || !aiFollowUpInput.trim()}
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleResetAiConversation}
                      disabled={isEstimating}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar para início</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFoodModalOpen(false)}
                      disabled={isEstimating}
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )
          ) : (
            /* Manual Mode Form (or edit mode) */
            <form onSubmit={handleSaveFoodManual} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Alimento ou Preparação *
                </label>
                <input
                  id="food-name-input"
                  type="text"
                  required
                  placeholder="Ex: Frango grelhado, Arroz integral, Whey..."
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantidade / Porção *
                </label>
                <input
                  id="food-quantity-input"
                  type="text"
                  required
                  placeholder="Ex: 150g, 2 colheres de sopa, 1 unidade, 1 scoop..."
                  value={foodQuantity}
                  onChange={(e) => setFoodQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Macronutrientes <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-amber-700 mb-1">Calorias (kcal)</span>
                    <input
                      id="food-calories-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={foodCalories}
                      onChange={(e) => setFoodCalories(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-blue-700 mb-1">Proteína (g)</span>
                    <input
                      id="food-protein-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={foodProtein}
                      onChange={(e) => setFoodProtein(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Carboidrato (g)</span>
                    <input
                      id="food-carbs-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={foodCarbs}
                      onChange={(e) => setFoodCarbs(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-purple-700 mb-1">Gordura (g)</span>
                    <input
                      id="food-fat-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={foodFat}
                      onChange={(e) => setFoodFat(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observação <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea
                  id="food-notes-input"
                  rows={2}
                  placeholder="Ex: Sem sal, cozinhar no vapor, beber com água gelada..."
                  value={foodNotes}
                  onChange={(e) => setFoodNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  id="cancel-food-modal-btn"
                  type="button"
                  onClick={() => setIsFoodModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="save-food-modal-btn"
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  {editingFood ? 'Salvar Alterações' : 'Adicionar Alimento'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Modal: Nutrition History */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Histórico de Nutrição"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <p className="text-xs text-slate-500">
                Registros e macronutrientes salvos automaticamente ao virar de cada dia.
              </p>
            </div>
            {totalItems > 0 && (
              <button
                type="button"
                onClick={handleArchiveTodayNow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
                title="Salva uma cópia dos alimentos de hoje no histórico agora"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Salvar cópia de hoje
              </button>
            )}
          </div>

          {historyNotification && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{historyNotification}</span>
            </div>
          )}

          {nutritionHistory.length > 1 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filtrar por data (ex: 2026-09 ou Segunda)..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}

          {nutritionHistory.length === 0 ? (
            <div className="py-8 px-4 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-bold text-slate-800">Nenhum dia arquivado ainda</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Quando a data virar, todos os alimentos registrados e macronutrientes do dia anterior serão salvos automaticamente aqui no seu histórico, e a tela de Nutrição iniciará limpa para o novo dia mantendo suas refeições cadastradas.
                </p>
              </div>
              {totalItems > 0 && (
                <button
                  type="button"
                  onClick={handleArchiveTodayNow}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Salvar cópia de hoje no histórico agora
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {nutritionHistory
                .filter((item) => {
                  if (!historySearchQuery.trim()) return true;
                  const q = historySearchQuery.toLowerCase();
                  return (
                    item.date.toLowerCase().includes(q) ||
                    (item.dateFormatted && item.dateFormatted.toLowerCase().includes(q))
                  );
                })
                .map((entry) => {
                  const isExpanded = expandedHistoryDayId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs transition-all hover:border-slate-300"
                    >
                      {/* Day Header */}
                      <div
                        className="p-3.5 sm:p-4 bg-slate-50/70 cursor-pointer select-none"
                        onClick={() => handleToggleExpandHistoryDay(entry.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-slate-900 block">
                                {entry.dateFormatted || entry.date}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {entry.date}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
                              {entry.totals.itemsCount} {entry.totals.itemsCount === 1 ? 'alimento' : 'alimentos'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteHistoryEntry(entry);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer ml-1"
                              title="Excluir histórico deste dia"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-slate-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-600" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Macros summary grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                          <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-[10px] uppercase font-bold text-amber-800 block">Calorias</span>
                            <span className="text-sm font-extrabold text-amber-950">
                              {entry.totals.calories} <span className="text-[10px] font-normal text-amber-700">kcal</span>
                            </span>
                            {entry.totals.consumedCalories > 0 && (
                              <span className="text-[10px] text-amber-700/80 block">
                                {entry.totals.consumedCalories} kcal ingeridas
                              </span>
                            )}
                          </div>
                          <div className="bg-blue-50/70 border border-blue-200/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-[10px] uppercase font-bold text-blue-800 block">Proteínas</span>
                            <span className="text-sm font-extrabold text-blue-950">
                              {entry.totals.protein} <span className="text-[10px] font-normal text-blue-700">g</span>
                            </span>
                          </div>
                          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Carboidratos</span>
                            <span className="text-sm font-extrabold text-emerald-950">
                              {entry.totals.carbs} <span className="text-[10px] font-normal text-emerald-700">g</span>
                            </span>
                          </div>
                          <div className="bg-rose-50/70 border border-rose-200/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-[10px] uppercase font-bold text-rose-800 block">Gorduras</span>
                            <span className="text-sm font-extrabold text-rose-950">
                              {entry.totals.fat} <span className="text-[10px] font-normal text-rose-700">g</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white space-y-4">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Detalhes das Refeições ({entry.meals.length})
                          </h5>
                          <div className="space-y-3">
                            {entry.meals.map((meal) => {
                              const mealCals = meal.items.reduce((s, i) => s + (i.calories || 0), 0);
                              const mealProt = meal.items.reduce((s, i) => s + (i.protein || 0), 0);
                              const mealCarbs = meal.items.reduce((s, i) => s + (i.carbs || 0), 0);
                              const mealFat = meal.items.reduce((s, i) => s + (i.fat || 0), 0);

                              return (
                                <div
                                  key={meal.id}
                                  className="border border-slate-100 rounded-xl p-3 bg-slate-50/50"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-800">
                                        {meal.name}
                                      </span>
                                      {meal.time && (
                                        <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
                                          {meal.time}
                                        </span>
                                      )}
                                    </div>
                                    {meal.items.length > 0 && (
                                      <div className="text-[10px] font-semibold text-slate-600 flex items-center gap-2">
                                        <span className="text-amber-800">{mealCals} kcal</span>
                                        <span className="hidden sm:inline text-slate-400">•</span>
                                        <span className="hidden sm:inline text-blue-700">{mealProt}g P</span>
                                        <span className="hidden sm:inline text-emerald-700">{mealCarbs}g C</span>
                                        <span className="hidden sm:inline text-rose-700">{mealFat}g G</span>
                                      </div>
                                    )}
                                  </div>

                                  {meal.items.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">
                                      Nenhum alimento registrado nesta refeição.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {meal.items.map((item) => (
                                        <div
                                          key={item.id}
                                          className="flex items-start justify-between gap-2 p-2 bg-white rounded-lg border border-slate-100 text-xs"
                                        >
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              {item.done ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                              ) : (
                                                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                              )}
                                              <span className="font-semibold text-slate-800 truncate">
                                                {item.name}
                                              </span>
                                              <span className="text-[11px] text-slate-500">
                                                ({item.quantity})
                                              </span>
                                              {item.done && (
                                                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                                  Consumido
                                                </span>
                                              )}
                                            </div>
                                            {item.notes && (
                                              <p className="text-[10px] text-slate-500 ml-5 italic mt-0.5">
                                                {item.notes}
                                              </p>
                                            )}
                                          </div>
                                          <div className="text-right text-[10px] font-medium text-slate-600 flex-shrink-0">
                                            <div>{item.calories || 0} kcal</div>
                                            <div className="text-slate-400 text-[9px]">
                                              P:{item.protein || 0}g C:{item.carbs || 0}g G:{item.fat || 0}g
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {nutritionHistory.length} {nutritionHistory.length === 1 ? 'dia salvo' : 'dias salvos'} no histórico
            </span>
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation & Alert Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        isAlertOnly={confirmModal.isAlertOnly}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
};
