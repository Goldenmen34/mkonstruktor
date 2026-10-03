import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Trash2,
  Maximize2,
  Check,
  Zap,
  Droplets,
  Flame,
  AppWindow,
  DoorOpen,
  ArrowLeftRight,
  Info,
} from 'lucide-react';
import { useRoomStore } from '../store/useRoomStore';
import { usePlannerStore } from '../store/usePlannerStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { buildVertexMap, getWallLength } from '../utils/roomGeometry';
import { WallOpening, WallUtility } from '../types/room';

interface WallElevationViewProps {
  wallId: string;
}

export const WallElevationView: React.FC<WallElevationViewProps> = ({ wallId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  const {
    room: roomData,
    closeWallElevation,
    selectOpening,
    selectUtility,
    updateOpening,
    removeOpening,
    updateUtility,
    removeUtility,
  } = useRoomStore();

  const { setMode } = usePlannerStore();
  const { pushSnapshot } = useHistoryStore();

  // Отслеживаем размеры контейнера
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const vMap = buildVertexMap(roomData.vertices);
  const wall = roomData.walls.find((w) => w.id === wallId);
  if (!wall) return null;

  const wallLength = getWallLength(wall, vMap);
  const wallHeight = roomData.height || 2700;

  // Элементы на этой стене
  const wallOpenings = (roomData.openings || []).filter((o) => o.wallId === wallId);
  const wallUtilities = (roomData.utilities || []).filter((u) => u.wallId === wallId);

  const selectedOpening = wallOpenings.find((o) => o.id === roomData.selectedOpeningId);
  const selectedUtility = wallUtilities.find((u) => u.id === roomData.selectedUtilityId);

  // Выбранный активный элемент
  const activeElement = selectedOpening
    ? {
        type: 'opening' as const,
        id: selectedOpening.id,
        name: selectedOpening.name,
        width: selectedOpening.width,
        height: selectedOpening.height,
        left: Math.round(selectedOpening.offsetFromStart - selectedOpening.width / 2),
        right: Math.round(wallLength - (selectedOpening.offsetFromStart + selectedOpening.width / 2)),
        bottom: Math.round(selectedOpening.sillHeight),
        top: Math.round(wallHeight - (selectedOpening.sillHeight + selectedOpening.height)),
        rawOpening: selectedOpening,
        rawUtility: undefined,
      }
    : selectedUtility
    ? {
        type: 'utility' as const,
        id: selectedUtility.id,
        name: selectedUtility.name,
        width: selectedUtility.width,
        height: selectedUtility.height,
        left: Math.round(selectedUtility.offsetFromStart - selectedUtility.width / 2),
        right: Math.round(wallLength - (selectedUtility.offsetFromStart + selectedUtility.width / 2)),
        bottom: Math.round(selectedUtility.elevationFromFloor),
        top: Math.round(wallHeight - (selectedUtility.elevationFromFloor + selectedUtility.height)),
        rawOpening: undefined,
        rawUtility: selectedUtility,
      }
    : null;

  // Редактирование размера по прямому клику на цифру
  const [editingDim, setEditingDim] = useState<
    'left' | 'right' | 'bottom' | 'top' | 'width' | 'height' | null
  >(null);
  const [dimInputVal, setDimInputVal] = useState<string>('');

  const startEditDim = (
    dim: 'left' | 'right' | 'bottom' | 'top' | 'width' | 'height',
    currentVal: number
  ) => {
    setEditingDim(dim);
    setDimInputVal(String(currentVal));
  };

  const applyEditDim = () => {
    if (!editingDim || !activeElement) {
      setEditingDim(null);
      return;
    }

    const val = Number(dimInputVal);
    if (isNaN(val) || val < 0) {
      setEditingDim(null);
      return;
    }

    pushSnapshot();

    const w = activeElement.width;
    const h = activeElement.height;

    let newOffset = (activeElement.rawOpening?.offsetFromStart || activeElement.rawUtility?.offsetFromStart) ?? wallLength / 2;
    let newBottom = (activeElement.rawOpening?.sillHeight || activeElement.rawUtility?.elevationFromFloor) ?? 0;

    if (editingDim === 'left') {
      newOffset = Math.round(val + w / 2);
    } else if (editingDim === 'right') {
      newOffset = Math.round(wallLength - val - w / 2);
    } else if (editingDim === 'bottom') {
      newBottom = Math.round(val);
    } else if (editingDim === 'top') {
      newBottom = Math.round(wallHeight - val - h);
    } else if (editingDim === 'width') {
      const newW = Math.max(50, Math.min(wallLength, val));
      if (activeElement.type === 'opening') {
        updateOpening(activeElement.id, { width: newW });
      } else {
        updateUtility(activeElement.id, { width: newW });
      }
      setEditingDim(null);
      return;
    } else if (editingDim === 'height') {
      const newH = Math.max(50, Math.min(wallHeight, val));
      if (activeElement.type === 'opening') {
        updateOpening(activeElement.id, { height: newH });
      } else {
        updateUtility(activeElement.id, { height: newH });
      }
      setEditingDim(null);
      return;
    }

    newOffset = Math.max(Math.round(w / 2), Math.min(Math.round(wallLength - w / 2), newOffset));
    newBottom = Math.max(0, Math.min(Math.round(wallHeight - h), newBottom));

    if (activeElement.type === 'opening') {
      updateOpening(activeElement.id, {
        offsetFromStart: newOffset,
        sillHeight: activeElement.rawOpening?.type === 'door' ? 0 : newBottom,
      });
    } else {
      updateUtility(activeElement.id, {
        offsetFromStart: newOffset,
        elevationFromFloor: newBottom,
      });
    }

    setEditingDim(null);
  };

  // Перетаскивание элемента мышью по развертке
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initOffset: number; initBottom: number } | null>(null);

  // Масштабирование стены под размеры области просмотра
  const paddingX = 140;
  const paddingY = 120;
  const availW = Math.max(400, containerSize.width - paddingX * 2);
  const availH = Math.max(300, containerSize.height - paddingY * 2);

  const scale = Math.min(availW / wallLength, availH / wallHeight);
  const wallPixelW = wallLength * scale;
  const wallPixelH = wallHeight * scale;

  const originX = (containerSize.width - wallPixelW) / 2;
  const originY = (containerSize.height - wallPixelH) / 2 + 10;

  // Преобразование мм стены в экранные пиксели (Y=0 снизу, пол)
  const toScreenX = (mmX: number) => originX + mmX * scale;
  const toScreenY = (mmY: number) => originY + (wallHeight - mmY) * scale;
  const toScreenW = (mmW: number) => mmW * scale;
  const toScreenH = (mmH: number) => mmH * scale;

  // Обработка мыши для перетаскивания
  const handleMouseDownOnElement = (
    e: React.MouseEvent,
    type: 'opening' | 'utility',
    id: string,
    curOffset: number,
    curBottom: number
  ) => {
    e.stopPropagation();
    if (type === 'opening') {
      selectOpening(id);
    } else {
      selectUtility(id);
    }

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initOffset: curOffset,
      initBottom: curBottom,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !activeElement) return;

      const deltaScreenX = e.clientX - dragStartRef.current.mouseX;
      const deltaScreenY = e.clientY - dragStartRef.current.mouseY;

      const deltaMmX = deltaScreenX / scale;
      const deltaMmY = -deltaScreenY / scale; // экранная ось Y вниз, поэтому инвертируем

      let newOffset = Math.round((dragStartRef.current.initOffset + deltaMmX) / 10) * 10;
      let newBottom = Math.round((dragStartRef.current.initBottom + deltaMmY) / 10) * 10;

      const w = activeElement.width;
      const h = activeElement.height;

      newOffset = Math.max(Math.round(w / 2), Math.min(Math.round(wallLength - w / 2), newOffset));
      newBottom = Math.max(0, Math.min(Math.round(wallHeight - h), newBottom));

      if (activeElement.type === 'opening') {
        updateOpening(activeElement.id, {
          offsetFromStart: newOffset,
          sillHeight: activeElement.rawOpening?.type === 'door' ? 0 : newBottom,
        });
      } else {
        updateUtility(activeElement.id, {
          offsetFromStart: newOffset,
          elevationFromFloor: newBottom,
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dragStartRef.current = null;
        pushSnapshot();
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, activeElement, scale, wallLength, wallHeight]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full bg-slate-950 overflow-hidden select-none flex flex-col"
      onClick={() => {
        selectOpening(null);
        selectUtility(null);
        setEditingDim(null);
      }}
    >
      {/* 1. Верхняя панель управления Развёрткой стены */}
      <div className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              closeWallElevation();
              setMode('3D');
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-900/40"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Завершить редактирование стены (В 3D)</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide">{wall.name}</span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-mono">
              Длина {wallLength} мм × Высота {wallHeight} мм
            </span>
          </div>
        </div>

        {/* Подсказка для пользователя */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Info className="w-4 h-4 text-sky-400" />
          <span>Кликните по цифре размера для точного ввода • Перетаскивайте элемент мышью</span>
        </div>
      </div>

      {/* 2. Основная рабочая область чертежа стены (Развёртка) */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Индикатор пола (Чистовой пол 0 мм) */}
        <div
          className="absolute border-b-2 border-amber-600/70 pointer-events-none z-10"
          style={{
            left: 0,
            right: 0,
            top: toScreenY(0),
          }}
        >
          <div className="absolute left-6 -top-5 text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            0.000 Чистовой пол
          </div>
        </div>

        {/* Индикатор потолка */}
        <div
          className="absolute border-b border-dashed border-slate-700 pointer-events-none z-10"
          style={{
            left: 0,
            right: 0,
            top: toScreenY(wallHeight),
          }}
        >
          <div className="absolute left-6 -top-5 text-[11px] font-mono text-slate-400">
            {wallHeight} мм (Потолок)
          </div>
        </div>

        {/* Сама стена (Прямоугольник) */}
        <div
          className="absolute bg-slate-800/80 rounded-sm border-2 border-slate-600 shadow-2xl transition-all"
          style={{
            left: originX,
            top: originY,
            width: wallPixelW,
            height: wallPixelH,
          }}
        >
          {/* Сетка стены 100 мм */}
          <div
            className="w-full h-full opacity-15 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`,
              backgroundSize: `${100 * scale}px ${100 * scale}px`,
            }}
          />

          {/* Метка Угла А (слева) */}
          <div className="absolute -left-2 -top-6 text-[10px] font-mono text-slate-400 uppercase font-semibold">
            ◀ Угол А
          </div>
          {/* Метка Угла Б (справа) */}
          <div className="absolute -right-2 -top-6 text-[10px] font-mono text-slate-400 uppercase font-semibold">
            Угол Б ▶
          </div>
        </div>

        {/* 3. Рендер установленных Окон и Дверей на стене */}
        {wallOpenings.map((op) => {
          const isSelected = selectedOpening?.id === op.id;
          const leftMm = op.offsetFromStart - op.width / 2;
          const bottomMm = op.sillHeight;

          const screenLeft = toScreenX(leftMm);
          const screenTop = toScreenY(bottomMm + op.height);
          const screenW = toScreenW(op.width);
          const screenH = toScreenH(op.height);

          return (
            <div
              key={op.id}
              onClick={(e) => {
                e.stopPropagation();
                selectOpening(op.id);
              }}
              onMouseDown={(e) =>
                handleMouseDownOnElement(e, 'opening', op.id, op.offsetFromStart, op.sillHeight)
              }
              className={`absolute cursor-move group transition-shadow ${
                isSelected
                  ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950 shadow-xl shadow-sky-500/20 z-20'
                  : 'hover:ring-1 hover:ring-sky-300 z-10'
              }`}
              style={{
                left: screenLeft,
                top: screenTop,
                width: screenW,
                height: screenH,
              }}
            >
              {op.type === 'window' ? (
                /* 2D Модель окна: ПВХ профиль + стекло + подоконник */
                <div className="w-full h-full bg-sky-950/60 border-4 border-slate-100 flex flex-col justify-between shadow-inner relative">
                  {/* Стеклопакет */}
                  <div className="absolute inset-1 bg-sky-400/20 backdrop-blur-[1px] flex items-center justify-center">
                    {op.width >= 900 && <div className="w-1.5 h-full bg-slate-100 shadow-sm" />}
                  </div>

                  {/* Подоконник снизу */}
                  <div className="absolute -bottom-1.5 -left-1 -right-1 h-2 bg-white rounded-sm shadow-md" />

                  {/* Бейдж с размерами по центру окна */}
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-auto">
                    {isSelected ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/95 border border-sky-400 shadow-xl text-[11px] font-mono font-bold">
                        {editingDim === 'width' ? (
                          <form onSubmit={(e) => { e.preventDefault(); applyEditDim(); }}>
                            <input
                              autoFocus
                              type="number"
                              value={dimInputVal}
                              onChange={(e) => setDimInputVal(e.target.value)}
                              onBlur={applyEditDim}
                              className="w-16 px-1 py-0.5 rounded bg-slate-950 border border-sky-400 text-xs font-mono font-bold text-white text-center focus:outline-none"
                            />
                          </form>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditDim('width', op.width);
                            }}
                            title="Ширина окна — кликните для изменения"
                            className="text-white hover:text-sky-300 hover:underline cursor-pointer"
                          >
                            {op.width}
                          </button>
                        )}
                        <span className="text-slate-400">×</span>
                        {editingDim === 'height' ? (
                          <form onSubmit={(e) => { e.preventDefault(); applyEditDim(); }}>
                            <input
                              autoFocus
                              type="number"
                              value={dimInputVal}
                              onChange={(e) => setDimInputVal(e.target.value)}
                              onBlur={applyEditDim}
                              className="w-16 px-1 py-0.5 rounded bg-slate-950 border border-sky-400 text-xs font-mono font-bold text-white text-center focus:outline-none"
                            />
                          </form>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditDim('height', op.height);
                            }}
                            title="Высота окна — кликните для изменения"
                            className="text-white hover:text-sky-300 hover:underline cursor-pointer"
                          >
                            {op.height}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[11px] font-mono text-white font-bold shadow-md pointer-events-none">
                        {op.width} × {op.height}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* 2D Модель двери: Коробка + приоткрытое полотно + ручка */
                <div className="w-full h-full bg-slate-900 border-x-4 border-t-4 border-slate-300 flex flex-col justify-end relative shadow-lg">
                  {/* Полотно */}
                  <div className="absolute inset-x-1.5 top-1.5 bottom-0 bg-slate-200 border border-slate-400 flex items-center justify-between px-2">
                    {isSelected ? (
                      <div className="flex items-center gap-1 px-1 py-0.5 rounded bg-slate-900/95 border border-sky-400 shadow-xl text-[10px] font-mono font-bold z-20 pointer-events-auto">
                        {editingDim === 'width' ? (
                          <form onSubmit={(e) => { e.preventDefault(); applyEditDim(); }}>
                            <input
                              autoFocus
                              type="number"
                              value={dimInputVal}
                              onChange={(e) => setDimInputVal(e.target.value)}
                              onBlur={applyEditDim}
                              className="w-14 px-1 py-0.5 rounded bg-slate-950 border border-sky-400 text-xs font-mono font-bold text-white text-center focus:outline-none"
                            />
                          </form>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditDim('width', op.width);
                            }}
                            title="Ширина двери — кликните для изменения"
                            className="text-white hover:text-sky-300 hover:underline cursor-pointer"
                          >
                            {op.width}
                          </button>
                        )}
                        <span className="text-slate-400">×</span>
                        {editingDim === 'height' ? (
                          <form onSubmit={(e) => { e.preventDefault(); applyEditDim(); }}>
                            <input
                              autoFocus
                              type="number"
                              value={dimInputVal}
                              onChange={(e) => setDimInputVal(e.target.value)}
                              onBlur={applyEditDim}
                              className="w-14 px-1 py-0.5 rounded bg-slate-950 border border-sky-400 text-xs font-mono font-bold text-white text-center focus:outline-none"
                            />
                          </form>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditDim('height', op.height);
                            }}
                            title="Высота двери — кликните для изменения"
                            className="text-white hover:text-sky-300 hover:underline cursor-pointer"
                          >
                            {op.height}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-700 font-bold rotate-90 pointer-events-none">
                        {op.width}×{op.height}
                      </div>
                    )}
                    {/* Ручка */}
                    <div className="w-1.5 h-4 bg-slate-600 rounded-sm shadow-sm" />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 4. Рендер установленных Технических зон (Розетки, Вода, Газ, Радиатор) */}
        {wallUtilities.map((util) => {
          const isSelected = selectedUtility?.id === util.id;
          const leftMm = util.offsetFromStart - util.width / 2;
          const bottomMm = util.elevationFromFloor;

          const screenLeft = toScreenX(leftMm);
          const screenTop = toScreenY(bottomMm + util.height);
          const screenW = toScreenW(util.width);
          const screenH = toScreenH(util.height);

          let bgStyle = 'bg-amber-500/20 border-amber-400 text-amber-300';
          let icon = <Zap className="w-3 h-3" />;

          if (util.category === 'plumbing') {
            bgStyle = 'bg-blue-500/20 border-blue-400 text-blue-300';
            icon = <Droplets className="w-3 h-3" />;
          } else if (util.category === 'gas_heating') {
            bgStyle = 'bg-rose-500/20 border-rose-400 text-rose-300';
            icon = <Flame className="w-3 h-3" />;
          }

          return (
            <div
              key={util.id}
              onClick={(e) => {
                e.stopPropagation();
                selectUtility(util.id);
              }}
              onMouseDown={(e) =>
                handleMouseDownOnElement(e, 'utility', util.id, util.offsetFromStart, util.elevationFromFloor)
              }
              className={`absolute cursor-move rounded border flex items-center justify-center transition-all ${bgStyle} ${
                isSelected
                  ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-amber-500/30 z-20'
                  : 'hover:opacity-100 opacity-90 z-10'
              }`}
              style={{
                left: screenLeft,
                top: screenTop,
                width: Math.max(20, screenW),
                height: Math.max(20, screenH),
              }}
              title={`${util.name}: ${util.width}×${util.height} мм`}
            >
              {icon}
              {screenW > 45 && (
                <span className="text-[10px] font-mono font-bold ml-1 truncate">{util.name}</span>
              )}
            </div>
          );
        })}

        {/* 5. ИНТЕРАКТИВНЫЕ РАЗМЕРНЫЕ СТРЕЛКИ ДЛЯ ВЫБРАННОГО ЭЛЕМЕНТА (TOPMOST Z-50 СЛОЙ) */}
        {activeElement && (
          <div className="absolute inset-0 pointer-events-none z-50">
            {/* Координаты активного элемента на экране */}
            {(() => {
              const elemScreenLeft = toScreenX(activeElement.left);
              const elemScreenRight = toScreenX(activeElement.left + activeElement.width);
              const elemScreenBottom = toScreenY(activeElement.bottom);
              const elemScreenTop = toScreenY(activeElement.bottom + activeElement.height);

              const wallScreenLeft = toScreenX(0);
              const wallScreenRight = toScreenX(wallLength);
              const floorScreenY = toScreenY(0);
              const ceilingScreenY = toScreenY(wallHeight);

              const midY = (elemScreenTop + elemScreenBottom) / 2;
              const midX = (elemScreenLeft + elemScreenRight) / 2;

              // Координаты стрелки слева: строго от левого угла А (0 мм) до левого края элемента
              const arrowLeftStartX = wallScreenLeft;
              const arrowLeftEndX = elemScreenLeft;
              const arrowLeftW = Math.max(0, arrowLeftEndX - arrowLeftStartX);
              const distLeft = Math.round(activeElement.left);

              // Координаты стрелки справа: строго от правого края элемента до правого угла Б (wallLength)
              const arrowRightStartX = elemScreenRight;
              const arrowRightEndX = wallScreenRight;
              const arrowRightW = Math.max(0, arrowRightEndX - arrowRightStartX);
              const distRight = Math.round(wallLength - (activeElement.left + activeElement.width));

              // Координаты стрелки снизу: строго от низа элемента до чистового пола (0 мм)
              const arrowBottomStartY = elemScreenBottom;
              const arrowBottomEndY = floorScreenY;
              const arrowBottomH = Math.max(0, arrowBottomEndY - arrowBottomStartY);
              const distBottom = Math.round(activeElement.bottom);

              // Координаты стрелки сверху: строго от потолка (wallHeight) до верха элемента
              const arrowTopStartY = ceilingScreenY;
              const arrowTopEndY = elemScreenTop;
              const arrowTopH = Math.max(0, arrowTopEndY - arrowTopStartY);
              const distTop = Math.round(wallHeight - (activeElement.bottom + activeElement.height));

              return (
                <>
                  {/* А. СТРЕЛКА СЛЕВА: соединяет левый край элемента с левым углом А */}
                  {arrowLeftW > 10 && (
                    <div
                      className="absolute pointer-events-auto z-50"
                      style={{
                        left: arrowLeftStartX,
                        top: midY,
                        width: arrowLeftW,
                      }}
                    >
                      <div className="relative w-full flex items-center">
                        <div className="w-full h-0.5 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] relative">
                          <span className="absolute -left-1 -top-1 border-t-4 border-r-4 border-b-4 border-l-0 border-transparent border-r-sky-400" />
                          <span className="absolute -right-1 -top-1 border-t-4 border-l-4 border-b-4 border-r-0 border-transparent border-l-sky-400" />
                        </div>

                        {/* Интерактивный бейдж с цифрой */}
                        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                          {editingDim === 'left' ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                applyEditDim();
                              }}
                              className="flex items-center"
                            >
                              <input
                                autoFocus
                                type="number"
                                value={dimInputVal}
                                onChange={(e) => setDimInputVal(e.target.value)}
                                onBlur={applyEditDim}
                                className="w-20 px-2 py-0.5 rounded bg-slate-900 border-2 border-sky-400 text-xs font-mono font-bold text-white text-center focus:outline-none shadow-2xl z-50"
                              />
                            </form>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditDim('left', distLeft);
                              }}
                              title="Расстояние от левого угла стены (Угол А) — нажмите для ввода"
                              className="px-2.5 py-0.5 rounded-full bg-slate-900 border-2 border-sky-400 text-sky-200 hover:text-white hover:bg-sky-600 text-xs font-mono font-bold shadow-2xl cursor-pointer transition-all z-50 flex items-center gap-1 hover:scale-105"
                            >
                              <span>{distLeft}</span>
                              <span className="text-[9px] text-sky-300 font-normal font-sans">мм</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Б. СТРЕЛКА СПРАВА: соединяет правый край элемента с правым углом Б */}
                  {arrowRightW > 10 && (
                    <div
                      className="absolute pointer-events-auto z-50"
                      style={{
                        left: arrowRightStartX,
                        top: midY,
                        width: arrowRightW,
                      }}
                    >
                      <div className="relative w-full flex items-center">
                        <div className="w-full h-0.5 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] relative">
                          <span className="absolute -left-1 -top-1 border-t-4 border-r-4 border-b-4 border-l-0 border-transparent border-r-sky-400" />
                          <span className="absolute -right-1 -top-1 border-t-4 border-l-4 border-b-4 border-r-0 border-transparent border-l-sky-400" />
                        </div>

                        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                          {editingDim === 'right' ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                applyEditDim();
                              }}
                              className="flex items-center"
                            >
                              <input
                                autoFocus
                                type="number"
                                value={dimInputVal}
                                onChange={(e) => setDimInputVal(e.target.value)}
                                onBlur={applyEditDim}
                                className="w-20 px-2 py-0.5 rounded bg-slate-900 border-2 border-sky-400 text-xs font-mono font-bold text-white text-center focus:outline-none shadow-2xl z-50"
                              />
                            </form>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditDim('right', distRight);
                              }}
                              title="Расстояние до правого угла стены (Угол Б) — нажмите для ввода"
                              className="px-2.5 py-0.5 rounded-full bg-slate-900 border-2 border-sky-400 text-sky-200 hover:text-white hover:bg-sky-600 text-xs font-mono font-bold shadow-2xl cursor-pointer transition-all z-50 flex items-center gap-1 hover:scale-105"
                            >
                              <span>{distRight}</span>
                              <span className="text-[9px] text-sky-300 font-normal font-sans">мм</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* В. СТРЕЛКА СНИЗУ: от чистового пола (0 мм) до низа элемента */}
                  {arrowBottomH > 10 && (
                    <div
                      className="absolute pointer-events-auto z-50"
                      style={{
                        left: midX,
                        top: arrowBottomStartY,
                        height: arrowBottomH,
                      }}
                    >
                      <div className="relative h-full flex justify-center">
                        <div className="h-full w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] relative">
                          <span className="absolute -top-1 -left-1 border-l-4 border-b-4 border-r-4 border-t-0 border-transparent border-b-amber-400" />
                          <span className="absolute -bottom-1 -left-1 border-l-4 border-t-4 border-r-4 border-b-0 border-transparent border-t-amber-400" />
                        </div>

                        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
                          {editingDim === 'bottom' ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                applyEditDim();
                              }}
                            >
                              <input
                                autoFocus
                                type="number"
                                value={dimInputVal}
                                onChange={(e) => setDimInputVal(e.target.value)}
                                onBlur={applyEditDim}
                                className="w-20 px-2 py-0.5 rounded bg-slate-900 border-2 border-amber-400 text-xs font-mono font-bold text-white text-center focus:outline-none shadow-2xl z-50"
                              />
                            </form>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditDim('bottom', distBottom);
                              }}
                              title={
                                activeElement.rawOpening?.type === 'window'
                                  ? 'Высота подоконника от чистового пола (0.000) — нажмите для ввода'
                                  : 'Высота от чистового пола (0.000) — нажмите для ввода'
                              }
                              className="px-2.5 py-0.5 rounded-full bg-slate-900 border-2 border-amber-400 text-amber-200 hover:text-white hover:bg-amber-600 text-xs font-mono font-bold shadow-2xl cursor-pointer transition-all z-50 flex items-center gap-1 hover:scale-105"
                            >
                              <span>{distBottom}</span>
                              <span className="text-[9px] text-amber-300 font-normal font-sans">мм</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Г. СТРЕЛКА СВЕРХУ: от верха элемента до потолка (wallHeight) */}
                  {arrowTopH > 10 && (
                    <div
                      className="absolute pointer-events-auto z-50"
                      style={{
                        left: midX,
                        top: arrowTopStartY,
                        height: arrowTopH,
                      }}
                    >
                      <div className="relative h-full flex justify-center">
                        <div className="h-full w-0.5 bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.9)] relative">
                          <span className="absolute -top-1 -left-1 border-l-4 border-b-4 border-r-4 border-t-0 border-transparent border-b-slate-400" />
                          <span className="absolute -bottom-1 -left-1 border-l-4 border-t-4 border-r-4 border-b-0 border-transparent border-t-slate-400" />
                        </div>

                        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
                          {editingDim === 'top' ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                applyEditDim();
                              }}
                            >
                              <input
                                autoFocus
                                type="number"
                                value={dimInputVal}
                                onChange={(e) => setDimInputVal(e.target.value)}
                                onBlur={applyEditDim}
                                className="w-20 px-2 py-0.5 rounded bg-slate-900 border-2 border-slate-400 text-xs font-mono font-bold text-white text-center focus:outline-none shadow-2xl z-50"
                              />
                            </form>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditDim('top', distTop);
                              }}
                              title="Расстояние до потолка — нажмите для ввода"
                              className="px-2.5 py-0.5 rounded-full bg-slate-900 border-2 border-slate-500 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-mono font-bold shadow-2xl cursor-pointer transition-all z-50 flex items-center gap-1 hover:scale-105"
                            >
                              <span>{distTop}</span>
                              <span className="text-[9px] text-slate-400 font-normal font-sans">мм</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
