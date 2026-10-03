import React, { useEffect, useRef, useState } from 'react';
import { Scan } from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { useRoomStore } from '../store/useRoomStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { SceneManager } from '../core/3d/SceneManager';
import { WallElevationView } from './WallElevationView';
import { ModuleContextMenu } from './ModuleContextMenu';
import { CATALOG_ITEMS } from '../data/catalog';
import { useMaterialsStore } from '../store/useMaterialsStore';
import { clearMaterialCache } from '../core/3d/materials';
interface ViewportProps {
  sceneManagerRef: React.MutableRefObject<SceneManager | null>;
}

export const Viewport: React.FC<ViewportProps> = ({ sceneManagerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    moduleId: string;
    x: number;
    y: number;
  } | null>(null);

  const {
    room,
    modules,
    selectedModuleId,
    selectModule,
    updateModule,
    removeModule,
    toggleModuleDoors,
    addModule,
    mode,
    setMode,
    isWireframeMode,
    toggleWireframeMode,
    showDimensions,
    calculateTotalPrice,
    projectSettings,
  } = usePlannerStore();

  const {
    room: roomData,
    selectWall,
    selectColumn,
    updateColumnPosition,
    selectOpening,
    updateOpening,
    openWallElevation,
  } = useRoomStore();

  const { pushSnapshot } = useHistoryStore();

  const pricing = calculateTotalPrice();

  useEffect(() => {
    if (!canvasRef.current) return;

    const sm = new SceneManager(canvasRef.current, {
      onSelectModule: (id) => selectModule(id),
      onUpdatePosition: (id, newPos, newRot) => {
        if (newRot !== undefined) {
          updateModule(id, { position: newPos, rotation: newRot });
        } else {
          updateModule(id, { position: newPos });
        }
      },
      onSelectWall: (wallId) => useRoomStore.getState().selectWall(wallId),
      onSelectColumn: (colId) => useRoomStore.getState().selectColumn(colId),
      onUpdateColumnPosition: (colId, x, z) => {
        updateColumnPosition(colId, x, z);
      },
      onSelectOpening: (openingId) => useRoomStore.getState().selectOpening(openingId),
      onUpdateOpeningOffset: (openingId, offset) => {
        updateOpening(openingId, { offsetFromStart: offset });
      },
      onDragEnd: () => {
        pushSnapshot();
      },
      onToggleModuleDoors: (id) => {
        usePlannerStore.getState().toggleModuleDoors(id);
      },
      onOpenModuleMenu: (id, screenPos) => {
        setContextMenuState({ moduleId: id, x: screenPos.x, y: screenPos.y });
      },
    });

    sceneManagerRef.current = sm;
    (window as any).__sceneManager = sm;
    (window as any).__useRoomStore = useRoomStore;

    sm.setProjectSettings(projectSettings);
    sm.updateRoomData(roomData);
    sm.updateModules(modules, selectedModuleId);

    const handleResize = () => {};
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      sm.dispose();
      sceneManagerRef.current = null;
      delete (window as any).__sceneManager;
    };
  }, []);

  // Синхронизация геометрии стен и помещения
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateRoomData(roomData);
    }
  }, [roomData]);

  // Синхронизация параметров проекта (толщина ДСП, цоколь, свесы)
  useEffect(() => {
    if (sceneManagerRef.current && projectSettings) {
      sceneManagerRef.current.setProjectSettings(projectSettings);
    }
  }, [projectSettings]);

  // Синхронизация модулей и выделения
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateModules(modules, selectedModuleId);
    }
  }, [modules, selectedModuleId]);

  // Мгновенная синхронизация 3D сцены при любых изменениях в веб-кабинете собственника
  const materialItems = useMaterialsStore((state) => state.items);
  useEffect(() => {
    if (sceneManagerRef.current) {
      clearMaterialCache();
      sceneManagerRef.current.updateModules(modules, selectedModuleId);
    }
  }, [materialItems, modules, selectedModuleId]);

  useEffect(() => {
    const handleMaterialsUpdate = () => {
      clearMaterialCache();
      if (sceneManagerRef.current) {
        sceneManagerRef.current.updateModules(modules, selectedModuleId);
      }
    };
    window.addEventListener('biplaner:materials-updated', handleMaterialsUpdate);
    return () => {
      window.removeEventListener('biplaner:materials-updated', handleMaterialsUpdate);
    };
  }, [modules, selectedModuleId]);

  // Синхронизация 2D / 3D
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setMode(mode);
    }
  }, [mode]);

  // Синхронизация режима "Рентген" (контуры мебели)
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setWireframeMode(isWireframeMode);
    }
  }, [isWireframeMode]);

  // Синхронизация видимости размерных плашек над модулями
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setShowDimensions(showDimensions);
    }
  }, [showDimensions]);

  // При выходе из развёртки стены гарантированно обновляем геометрию и размер 3D сцены
  useEffect(() => {
    if (!roomData.activeWallElevationId && sceneManagerRef.current) {
      sceneManagerRef.current.updateRoomData(roomData);
      sceneManagerRef.current.resize();
    }
  }, [roomData.activeWallElevationId, roomData]);

  // Удаление выбранного модуля по клавишам Delete / Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedModuleId) {
          pushSnapshot();
          removeModule(selectedModuleId);
          setContextMenuState(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedModuleId, removeModule, pushSnapshot]);

  const contextMenuModule = contextMenuState
    ? modules.find((m) => m.id === contextMenuState.moduleId)
    : null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;
    try {
      const data = JSON.parse(rawData);
      const allTemplates = [...CATALOG_ITEMS, ...usePlannerStore.getState().customTemplates];
      const template = allTemplates.find((c) => c.id === data.templateId);
      if (!template) return;

      const isWall = template.mainGroup === 'wall' || template.subType === 'wall' || template.id.startsWith('k_wall_');
      const isTop = template.mainGroup === 'top' || template.subType === 'top' || template.id.startsWith('k_top_');
      const baseUpper = projectSettings?.upperBaseStartHeight ?? 1440;
      let elevation = 0;
      if (isWall) {
        elevation = baseUpper;
      } else if (isTop) {
        const upperTops = modules
          .filter((m) => m.subType === 'wall' || m.subType === 'tall' || m.id.startsWith('k_wall_'))
          .map((m) => (m.position.y || 0) + m.dimensions.height);
        elevation = upperTops.length > 0 ? Math.max(...upperTops) : baseUpper + 700;
      }
      const dropPt = sceneManagerRef.current?.getFloorPointFromClient(e.clientX, e.clientY, elevation);

      pushSnapshot();
      if (dropPt) {
        addModule(template, { x: dropPt.x, y: elevation, z: dropPt.z }, { width: data.width });
      } else {
        addModule(template, undefined, { width: data.width });
      }
    } catch (err) {
      console.error('Failed to drop module:', err);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex-1 h-full bg-slate-950 overflow-hidden select-none"
    >
      {/* 3D Canvas - ВСЕГДА смонтирован в DOM, WebGL контекст никогда не уничтожается */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        className={`w-full h-full block cursor-grab active:cursor-grabbing outline-none ${
          roomData.activeWallElevationId ? 'invisible pointer-events-none' : ''
        }`}
      />

      {/* Оверлей развёртки выбранной стены (Вид прямо) */}
      {roomData.activeWallElevationId && (
        <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col">
          <WallElevationView wallId={roomData.activeWallElevationId} />
        </div>
      )}


      {/* Индикатор активного режима 2D План */}
      {mode === '2D' && !roomData.selectedWallId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-950/85 backdrop-blur-md border border-blue-500/50 text-blue-200 px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2.5 shadow-xl shadow-blue-950/60 z-10">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span>Режим 2D План (Кликните на стену или венткороб для настройки)</span>
          <button
            onClick={() => setMode('3D')}
            className="ml-2 px-2.5 py-0.5 rounded-md bg-blue-600 hover:bg-blue-500 text-[11px] font-bold text-white transition-colors"
          >
            В 3D ➔
          </button>
        </div>
      )}

      {/* Индикатор активного режима "Рентген / Контуры мебели" */}
      {isWireframeMode && !roomData.activeWallElevationId && (
        <div className="absolute top-4 left-4 bg-sky-950/90 backdrop-blur-md border border-sky-400/60 text-sky-200 px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 shadow-2xl shadow-sky-950/70 z-10">
          <Scan className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span>Рентген: контуры мебели (розетки и коммуникации видны сквозь шкафы)</span>
          <button
            onClick={toggleWireframeMode}
            className="ml-1 px-1.5 py-0.5 rounded bg-sky-900/60 hover:bg-sky-800 text-[10px] text-sky-300 hover:text-white transition-colors"
          >
            Выключить
          </button>
        </div>
      )}


      {/* Подсказка по управлению (слева снизу) */}
      <div className="absolute bottom-14 left-4 bg-slate-900/70 backdrop-blur-sm border border-slate-800/80 px-3 py-2 rounded-xl text-[11px] text-slate-400 space-y-0.5 pointer-events-none z-10">
        {mode === '2D' ? (
          <>
            <div><strong className="text-sky-300">ПКМ (зажать и тянуть):</strong> Захват сцены и панорамирование</div>
            <div><strong className="text-slate-300">ЛКМ + перетаскивание:</strong> Перемещение модуля/короба или панорамирование по полу</div>
            <div><strong className="text-blue-300">Клик по стене / проёму:</strong> Выбор стены/проёма и привязка</div>
            <div><strong className="text-amber-300">Клик колесиком / ПКМ на модуль:</strong> Меню действий (удалить и др.)</div>
            <div><strong className="text-slate-300">Колесико:</strong> Масштабирование (Zoom)</div>
          </>
        ) : (
          <>
            <div><strong className="text-slate-300">ЛКМ + Движение:</strong> Перемещение мебели / Вращение камеры (по фону)</div>
            <div><strong className="text-sky-300">ПКМ (зажать и тянуть):</strong> Захват сцены и перемещение (панорамирование)</div>
            <div><strong className="text-amber-300">Клик колесиком / ПКМ на модуль:</strong> Меню действий (удалить и др.)</div>
            <div><strong className="text-slate-300">Колесико:</strong> Масштабирование (Zoom)</div>
          </>
        )}
      </div>

      {/* Контекстное меню действий модуля (при клике на колесико мыши или ПКМ) */}
      {contextMenuModule && contextMenuState && (
        <ModuleContextMenu
          module={contextMenuModule}
          position={{ x: contextMenuState.x, y: contextMenuState.y }}
          onClose={() => setContextMenuState(null)}
          onDelete={() => {
            pushSnapshot();
            removeModule(contextMenuModule.id);
            setContextMenuState(null);
          }}
          onToggleDoors={() => {
            toggleModuleDoors(contextMenuModule.id);
          }}
        />
      )}

      {/* Нижняя статус-панель со сметой в реальном времени */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 px-6 flex items-center justify-between text-xs text-slate-400 z-10">
        <div className="flex items-center gap-4">
          <span>Секций на сцене: <strong className="text-slate-200">{modules.length}</strong></span>
          <span className="text-slate-700">|</span>
          <span>Габариты помещения: <strong className="text-slate-200">{room.width} × {room.length} мм</strong></span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-slate-300">
            Стоимость модулей: <strong className="text-white">{pricing.modulesTotal.toLocaleString('ru-RU')} ₽</strong>
          </div>
          <span className="text-slate-700">|</span>
          <div className="text-sm font-bold text-emerald-400">
            ИТОГО: {pricing.grandTotal.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>
    </div>
  );
};
