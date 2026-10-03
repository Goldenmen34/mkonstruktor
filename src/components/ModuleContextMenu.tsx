import React, { useEffect, useRef } from 'react';
import { Trash2, DoorOpen, Palette, SlidersHorizontal, X, Wrench, ChevronRight } from 'lucide-react';
import { FurnitureModule } from '../types';
import { usePlannerStore } from '../store/usePlannerStore';
import { getModuleCode } from '../data/catalog';

interface ModuleContextMenuProps {
  module: FurnitureModule;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: () => void;
  onToggleDoors: () => void;
}

export const ModuleContextMenu: React.FC<ModuleContextMenuProps> = ({
  module,
  position,
  onClose,
  onDelete,
  onToggleDoors,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { openSectionEditor, selectModule, setActiveSidebarTab } = usePlannerStore();

  // Закрытие по клавише Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        onDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onDelete]);

  // Расчет экранных координат (чтобы меню не вылезало за края экрана)
  const menuWidth = 260;
  const menuHeight = 240;
  const left = Math.max(12, Math.min(position.x, window.innerWidth - menuWidth - 16));
  const top = Math.max(12, Math.min(position.y, window.innerHeight - menuHeight - 16));

  return (
    <>
      {/* Прозрачный оверлей клика вне контекстного меню */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Всплывающее меню действий */}
      <div
        ref={menuRef}
        style={{ left: `${left}px`, top: `${top}px` }}
        className="fixed z-50 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 p-2 flex flex-col gap-1 select-none animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Шапка с названием модуля */}
        <div className="flex items-start justify-between gap-2 px-2.5 py-2 border-b border-slate-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(module.code || getModuleCode(module)) && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-500/40 shrink-0">
                  {module.code || getModuleCode(module)}
                </span>
              )}
              <h4 className="text-xs font-bold text-slate-100 truncate" title={module.name}>
                {module.name}
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {module.dimensions.width} × {module.dimensions.height} × {module.dimensions.depth} мм
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Список действий */}
        <div className="flex flex-col gap-1 pt-1">
          {/* Главное действие: Знак ведерка / Удалить модуль */}
          <button
            onClick={onDelete}
            className="group flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/40 transition-all text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold leading-tight">Удалить модуль</div>
                <div className="text-[10px] text-rose-400/70 font-normal">Убрать со сцены</div>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-rose-300">
              Del
            </span>
          </button>

          {/* Открыть/закрыть фасады */}
          <button
            onClick={() => {
              onToggleDoors();
              onClose();
            }}
            className="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/90 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <DoorOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="leading-tight">{module.config.isOpen ? 'Закрыть фасады' : 'Открыть фасады'}</div>
              <div className="text-[10px] text-slate-400 font-normal">Анимация ящиков и дверей</div>
            </div>
          </button>

          {/* Настройки фурнитуры конкретного модуля (петли, направляющие, подъемники) */}
          <button
            onClick={() => {
              selectModule(module.id);
              setActiveSidebarTab('properties');
              onClose();
            }}
            className="group flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/90 transition-all text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="leading-tight font-medium text-slate-200 group-hover:text-white">Фурнитура модуля</div>
                <div className="text-[10px] text-slate-400 font-normal">Петли, направляющие, ручки</div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
          </button>

          {/* Разделитель */}
          <div className="h-px bg-slate-800 my-0.5" />

          {/* Плацехолдер: Изменить цвета (скоро) */}
          <div
            className="flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 bg-slate-800/30 border border-dashed border-slate-700/50 cursor-not-allowed opacity-80"
            title="Будет добавлено на следующем этапе"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <div className="leading-tight text-slate-300">Изменить цвета</div>
                <div className="text-[10px] text-slate-400">Фасад, корпус, столешница</div>
              </div>
            </div>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Скоро
            </span>
          </div>

          {/* Редактировать секцию в Конструкторе / Редакторе секций */}
          <button
            onClick={() => {
              openSectionEditor(undefined, module.id);
              onClose();
            }}
            className="group flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-blue-600/20 border border-transparent hover:border-blue-500/30 transition-all text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="leading-tight text-slate-200 group-hover:text-blue-300 font-semibold">
                  Редактор секции {(module.code || getModuleCode(module)) ? `(${module.code || getModuleCode(module)})` : ''}
                </div>
                <div className="text-[10px] text-slate-400">Полки, стойки, наполнение</div>
              </div>
            </div>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              3D
            </span>
          </button>
        </div>
      </div>
    </>
  );
};
