import React, { useState } from 'react';
import { FilePlus, X, Sliders, ArrowRight, RotateCcw, AlertTriangle, Sparkles } from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { useRoomStore } from '../store/useRoomStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { CATALOG_ITEMS } from '../data/catalog';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose }) => {
  const { resetToNewProject, openProjectSettings, modules, addModule } = usePlannerStore();
  const { resetRoom } = useRoomStore();
  const { clearHistory } = useHistoryStore();
  const { createNewProject } = useProjectsStore();

  const [resetRoomWalls, setResetRoomWalls] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleStartWithCustomSettings = () => {
    if (resetRoomWalls) {
      resetRoom();
    }
    resetToNewProject();
    clearHistory();
    createNewProject();
    onClose();
    // Открываем модальное окно настроек проекта для кастомизации
    openProjectSettings();
  };

  const handleStartWithDefaults = () => {
    if (resetRoomWalls) {
      resetRoom();
    }
    resetToNewProject();
    clearHistory();
    createNewProject();
    onClose();
  };

  const handleLoadDemoKitchen = () => {
    if (resetRoomWalls) {
      resetRoom();
    }
    resetToNewProject();
    clearHistory();
    const cornerUnit = CATALOG_ITEMS.find((c) => c.id === 'k_base_corner_blind');
    const drawerUnit = CATALOG_ITEMS.find((c) => c.id === 'k_base_3drawers');
    const doorUnit = CATALOG_ITEMS.find((c) => c.id === 'k_base_1door');

    if (cornerUnit) addModule(cornerUnit);
    if (drawerUnit) addModule(drawerUnit);
    if (doorUnit) addModule(doorUnit);
    createNewProject('Базовая кухня (Пример)');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Новый проект кухни
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Начать проектирование кухни с чистого листа
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Контент */}
        <div className="p-6 space-y-4">
          {modules.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                Внимание: на сцене уже размещено <strong>{modules.length} шт.</strong> модулей. При создании нового проекта мебель будет очищена.
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Вариант 1: Настроить параметры перед стартом */}
            <button
              onClick={handleStartWithCustomSettings}
              className="w-full p-4 rounded-xl border border-blue-500/50 hover:border-blue-400 bg-gradient-to-r from-blue-900/30 to-slate-800 hover:from-blue-900/50 text-left transition-all group shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-blue-300 font-bold text-sm group-hover:text-blue-200">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <span>Настроить инженерные параметры</span>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed pl-6.5">
                Задать толщину ДСП, высоту и глубину баз, цоколь, свесы столешницы и фартук перед началом расстановки.
              </p>
            </button>

            {/* Вариант 2: Быстрый старт по умолчанию */}
            <button
              onClick={handleStartWithDefaults}
              className="w-full p-4 rounded-xl border border-slate-700/80 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-slate-200 font-semibold text-sm group-hover:text-white">
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span>Быстрый старт со стандартными параметрами</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed pl-6.5">
                ДСП 16 мм • База 720 мм • Цоколь 120 мм • Столешница 40 мм (глубина 600 мм).
              </p>
            </button>
          </div>

          {/* Опция сброса стен помещения */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={resetRoomWalls}
                onChange={(e) => setResetRoomWalls(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <span>Сбросить стены помещения к стандартному прямоугольнику 4.0 × 3.0 м</span>
            </label>
          </div>
        </div>

        {/* Подвал */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLoadDemoKitchen}
            className="text-xs text-slate-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 group"
            title="Загрузить готовую демонстрационную кухню с 5 модулями"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span>Загрузить пример кухни</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};
