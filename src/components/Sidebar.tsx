import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Palette,
  Sliders,
  Layers,
  Home,
  Plus,
  Trash2,
  Copy,
  RotateCw,
  Check,
  Square,
  Columns,
  Split,
  Ruler,
  AppWindow,
  DoorOpen,
  Zap,
  Droplets,
  Flame,
  ArrowLeft,
  Maximize2,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Info,
  Wrench,
  Search,
  X,
  Package,
  Sparkles,
  Folder,
  FolderOpen,
  FolderTree,
  LayoutGrid,
} from 'lucide-react';
import { FurnitureModule, ProjectSettings } from '../types';
import { usePlannerStore } from '../store/usePlannerStore';
import { useLicenseStore } from '../store/useLicenseStore';
import { useRoomStore } from '../store/useRoomStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { buildVertexMap, getWallLength } from '../utils/roomGeometry';
import {
  CATALOG_ITEMS,
  CatalogItemTemplate,
  CATALOG_CATEGORIES,
  CatalogMainGroup,
  CatalogSubGroup,
  getModuleCode,
} from '../data/catalog';
import { DEFAULT_MATERIALS } from '../data/materials';
import { useMaterialsStore } from '../store/useMaterialsStore';
import { MaterialSection, SECTION_LABELS, UNIT_SHORT, OwnerMaterialItem, OwnerCategory } from '../types/ownerMaterials';
import { clearMaterialCache } from '../core/3d/materials';
import { ModuleThumbnail } from './ModuleThumbnail';

/**
 * Получение лаконичного понятного названия декора без избыточных технических префиксов,
 * артикулов поставщиков и габаритов листов.
 */
function getCleanDecorName(mat: OwnerMaterialItem): string {
  let name = mat.name;
  // Убираем размеры плит вроде (2800x2070), (3000x600), (3000х600)
  name = name.replace(/\s*\(\d+[\s\xD7\u0445xX]\d+\)/gi, '');
  // Убираем префикс "ЛДСП 16мм / 18мм"
  name = name.replace(/^ЛДСП\s+\d+мм\s+/i, '');
  // Убираем название фабрики и толщину: "Кедр 38мм Влагостойкая", "Slotex 38мм", "Egger ", "Kronospan 0101 SM "
  name = name.replace(/^(Кедр|Slotex|Egger|Kronospan|Lamarty|AGT|Eterno)\s+(\d+мм\s+)?(Влагостойкая\s+)?/i, '');
  // Если указан бренд, убираем повтор бренда в начале
  if (mat.brand) {
    const brandRegex = new RegExp(`^${mat.brand}\\s+`, 'i');
    name = name.replace(brandRegex, '');
  }
  // Убираем артикулы вроде "H434 ", "0101 SM ", "3012 " перед словом названия
  name = name.replace(/^[A-Z0-9]{3,8}(\s+[A-Z0-9]{2,6})?\s+([А-Яа-яA-Za-z])/i, '$2');
  // Убираем серии фасадов вроде "Supramat ", "Unitone ", "Synchro ", "CS "
  name = name.replace(/^(Supramat|Unitone|Synchro|High Gloss|Soft Touch)\s+/i, '');
  // Очищаем лишние дефисы и пробелы
  name = name.replace(/^\s*[-—]\s*/, '').trim();
  return name || mat.name;
}

/**
 * Расчет фактических чистовых размеров фасадов модуля с учетом зазоров фасадной сетки
 */
function getFacadeInfo(mod: FurnitureModule, settings?: ProjectSettings) {
  const W = mod.dimensions.width;
  const H = mod.dimensions.height;
  const isWallCabinet = mod.subType === 'wall';
  const isBlindCorner = mod.subType === 'corner' || mod.id.includes('corner_blind') || Boolean(mod.config.blindCornerWidth);
  const blindWidth = isBlindCorner ? (mod.config.blindCornerWidth ?? 600) : 0;

  const plinthH = (mod.config.hasPlinth && (settings?.hasPlinth !== false))
    ? (settings?.plinthHeight ?? 120)
    : 0;
  const bodyH = H - plinthH;

  const baseSideGap = settings?.baseFacadeSideGap ?? 1.5;
  const baseTopGap = settings?.baseFacadeTopGap ?? 3.0;
  const baseBottomGap = settings?.baseFacadeBottomGap ?? 2.0;

  const upperSideGap = settings?.upperFacadeSideGap ?? 1.5;
  const upperTopGap = settings?.upperFacadeTopGap ?? 2.0;
  const upperBottomOverhang = settings?.upperFacadeBottomOverhang ?? 20.0;
  const interGap = settings?.interFacadeGap ?? 3.0;

  const sideGap = isWallCabinet ? upperSideGap : baseSideGap;
  const topGap = isWallCabinet ? upperTopGap : baseTopGap;
  const bottomGap = isWallCabinet ? 0 : baseBottomGap;
  const bottomOverhang = isWallCabinet ? upperBottomOverhang : 0;

  const isBaseOrCorner = mod.subType === 'base' || mod.subType === 'corner';
  const isGola = isBaseOrCorner && mod.config.handleType === 'gola';
  const effectiveTopGap = isGola ? 30 : topGap;

  const doorH = Math.round(bodyH - effectiveTopGap - bottomGap + bottomOverhang);

  if (isBlindCorner) {
    const doorW = Math.round((W - blindWidth) - sideGap - (interGap / 2));
    const overhangF = isWallCabinet ? 50 : (settings?.countertopFrontOverhang ?? 50);
    const fillerW = isWallCabinet ? 50 : overhangF;
    const returnW = isWallCabinet ? 32 : (overhangF - 18);
    return {
      label: 'Фасад угловой:',
      value: `Фальш ${blindWidth - fillerW}×${bodyH} мм (добор ${fillerW}×${returnW} мм) | Дверь ${doorW}×${doorH} мм${isGola ? ' (Gola -30мм)' : ''}`,
    };
  }

  if (mod.config.drawers > 0) {
    const drawerW = Math.round(W - sideGap * 2);
    const drawerCount = mod.config.drawers;
    const isThreeDrawers = drawerCount === 3;
    const golaType = mod.config.golaType ?? 'type1';

    let totalInterGaps = interGap * (drawerCount - 1);
    if (isGola) {
      const golaGap = 30;
      let gapSum = 0;
      for (let k = 0; k < drawerCount - 1; k++) {
        if (drawerCount === 2 || golaType === 'type2') {
          gapSum += golaGap;
        } else {
          // type1
          gapSum += (k === 0 ? golaGap : interGap);
        }
      }
      totalInterGaps = gapSum;
    }

    const availH = bodyH - effectiveTopGap - bottomGap - totalInterGaps;
    if (isThreeDrawers) {
      const topH = 140;
      const deepH = Math.max(50, Math.round((availH - topH) / 2));
      return {
        label: 'Фасады ящиков (3 шт):',
        value: isGola
          ? `${drawerW}×${topH} мм, 2× ${drawerW}×${deepH} мм (${golaType === 'type2' ? 'Gola Тип 2: L+2C' : 'Gola Тип 1: L+1C'})`
          : `${drawerW}×${topH} мм + 2× ${drawerW}×${deepH} мм`,
      };
    } else {
      const dH = Math.round(availH / drawerCount);
      return {
        label: `Фасады ящиков (${drawerCount} шт):`,
        value: `${drawerCount}× ${drawerW}×${dH} мм${isGola ? ` (Gola ${golaType === 'type2' ? 'Тип 2' : 'Тип 1'})` : ''}`,
      };
    }
  }

  if (mod.config.doors === 1) {
    const doorW = Math.round(W - sideGap * 2);
    return {
      label: 'Дверь:',
      value: `${doorW} × ${doorH} мм${isGola ? ' (Gola -30мм)' : ''}`,
    };
  }

  if (mod.config.doors > 1) {
    const doorW = Math.round((W - sideGap * 2 - interGap) / 2);
    return {
      label: `Двери (${mod.config.doors} шт):`,
      value: `${doorW} × ${doorH} мм${isGola ? ' (Gola -30мм)' : ''}`,
    };
  }

  return {
    label: 'Фасад:',
    value: 'Открытая секция',
  };
}

/**
 * Надежный числовой ввод:
 * Сохраняет вводимый текст локально во время набора пользователем (можно стирать, вводить с нуля),
 * и фиксирует проверенное значение по Enter или потере фокуса (onBlur).
 */
const NumberInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}> = ({ value, onChange, min = 0, max = 99999, step = 10, className = '', placeholder }) => {
  const [localVal, setLocalVal] = useState<string>(String(value ?? 0));

  React.useEffect(() => {
    setLocalVal(String(value ?? 0));
  }, [value]);

  const commit = () => {
    const trimmed = localVal.trim();
    if (trimmed === '') {
      setLocalVal(String(value ?? 0));
      return;
    }
    const num = Number(trimmed);
    if (isNaN(num)) {
      setLocalVal(String(value ?? 0));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(num)));
    setLocalVal(String(clamped));
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  return (
    <input
      type="number"
      value={localVal}
      placeholder={placeholder}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      step={step}
      className={className}
    />
  );
};

export const Sidebar: React.FC = () => {
  const [elevationCategory, setElevationCategory] = useState<string | null>('windows');

  const {
    activeSidebarTab: activeTab,
    setActiveSidebarTab: setActiveTab,
    activeCategory,
    modules,
    selectedModuleId,
    selectModule,
    addModule,
    removeModule,
    duplicateModule,
    mirrorModule,
    updateModule,
    updateModuleDimensions,
    toggleModuleDoors,
    globalMaterials,
    setGlobalMaterial,
    room,
    setRoomDimensions,
    setRoomColors,
    setMode,
    projectSettings,
    updateProjectSettings,
    openProjectSettings,
    openExplodeModal,
    generateAutoBacksplash,
    customTemplates,
    openSectionEditor,
    deleteCustomSection,
    updateModuleHardware,
  } = usePlannerStore();

  const {
    room: roomData,
    wallResizeDirection,
    setWallResizeDirection,
    setTemplate,
    selectWall,
    selectColumn,
    selectOpening,
    selectUtility,
    openWallElevation,
    closeWallElevation,
    updateWallLength,
    splitWall,
    deleteWall,
    extrudeWallSegment,
    addColumn,
    updateColumn,
    removeColumn,
    addOpening,
    updateOpening,
    removeOpening,
    addUtility,
    updateUtility,
    removeUtility,
    setCeilingHeight,
    setWallThickness,
    setRoomColors: setRoomStoreColors,
  } = useRoomStore();

  const { pushSnapshot } = useHistoryStore();

  const vMap = buildVertexMap(roomData.vertices);
  const selectedWall = roomData.walls.find((w) => w.id === roomData.selectedWallId);
  const selectedWallLength = selectedWall ? getWallLength(selectedWall, vMap) : 0;
  const selectedColumn = roomData.columns?.find((c) => c.id === roomData.selectedColumnId);
  const selectedOpening = roomData.openings?.find((o) => o.id === roomData.selectedOpeningId);
  const selectedUtility = roomData.utilities?.find((u) => u.id === roomData.selectedUtilityId);

  const elevationWall = roomData.walls.find((w) => w.id === roomData.activeWallElevationId);
  const elevationWallLength = elevationWall ? getWallLength(elevationWall, vMap) : 0;

  const { isModuleLimitReached, openKeyModal } = useLicenseStore();

  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  // Если стена выбрана на плане (клик мышью по стене), автоматически переключаем на вкладку "Комната"
  useEffect(() => {
    if (roomData.selectedWallId && activeTab !== 'room' && !roomData.activeWallElevationId) {
      setActiveTab('room');
    }
  }, [roomData.selectedWallId]);

  // Каталог кухонных модулей: состояние категорий, панели и поиска
  const [catalogMainGroup, setCatalogMainGroup] = useState<CatalogMainGroup>('base');
  const [catalogSubGroup, setCatalogSubGroup] = useState<CatalogSubGroup>('all');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedWidths, setSelectedWidths] = useState<Record<string, number>>({});
  const [isSubcategoryPanelOpen, setIsSubcategoryPanelOpen] = useState<boolean>(true);
  const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({
    doors: true,
    drawers: true,
    sink: true,
    appliances: true,
    cargo: true,
    corner_blind: true,
    lift: true,
    drying: true,
    hood: true,
    fridge: true,
    oven_tall: true,
    pantry: true,
  });

  // Материалы и категории из единой базы собственника
  const {
    items: ownerMaterials,
    categories: ownerCategories,
    openOwnerCabinet,
    getAllSubcategoryIds,
    getCategoryPath,
  } = useMaterialsStore();

  // Состояние вкладки материалов (дерево категорий как в кабинете собственника)
  const [selectedMaterialCatId, setSelectedMaterialCatId] = useState<string>('all');
  const [expandedMaterialCats, setExpandedMaterialCats] = useState<Record<string, boolean>>({});
  const [materialSearch, setMaterialSearch] = useState<string>('');

  // Дерево категорий (parentId -> children)
  const categoryTree = useMemo(() => {
    const map = new Map<string | null, OwnerCategory[]>();
    ownerCategories.forEach((cat) => {
      const pId = cat.parentId || null;
      if (!map.has(pId)) {
        map.set(pId, []);
      }
      map.get(pId)!.push(cat);
    });
    map.forEach((list) => list.sort((a, b) => (a.order || 0) - (b.order || 0)));
    return map;
  }, [ownerCategories]);

  // Корневые разделы для дизайнера (Фасады, Корпус, Столешницы, Фартук)
  const designerRootCategories = useMemo(() => {
    const facadeRoot = ownerCategories.find(
      (c) => (c.id === 'cat_facades' || c.section === 'facade') && (!c.parentId || c.parentId === null)
    );
    const ldspRoot = ownerCategories.find(
      (c) => (c.id === 'cat_ldsp' || c.section === 'ldsp') && (!c.parentId || c.parentId === null)
    );
    const ctRoot = ownerCategories.find(
      (c) => (c.id === 'cat_countertops' || c.section === 'countertop') && (!c.parentId || c.parentId === null)
    );

    const facadeChildren = facadeRoot ? categoryTree.get(facadeRoot.id) || [] : (categoryTree.get('cat_facades') || []);
    const ldspChildren = ldspRoot ? categoryTree.get(ldspRoot.id) || [] : (categoryTree.get('cat_ldsp') || []);
    const countertopChildren = ctRoot ? categoryTree.get(ctRoot.id) || [] : (categoryTree.get('cat_countertops') || []);

    return [
      {
        id: facadeRoot?.id || 'cat_facades',
        name: 'Фасады',
        section: 'facade' as MaterialSection,
        children: facadeChildren,
      },
      {
        id: ldspRoot?.id || 'cat_ldsp',
        name: 'Корпус (ЛДСП)',
        section: 'ldsp' as MaterialSection,
        children: ldspChildren,
      },
      {
        id: 'virtual_countertop',
        name: 'Столешницы',
        section: 'countertop' as MaterialSection,
        children: countertopChildren.filter((c) => c.section === 'countertop'),
      },
      {
        id: 'virtual_apron',
        name: 'Фартук',
        section: 'apron' as MaterialSection,
        children: countertopChildren.filter((c) => c.section === 'apron'),
      },
    ];
  }, [categoryTree, ownerCategories]);

  // Подсчет количества активных декоров в категории
  const getDecorCount = (catId: string, section?: string) => {
    if (catId === 'virtual_countertop') {
      return ownerMaterials.filter((m) => m.section === 'countertop' && m.isActive).length;
    }
    if (catId === 'virtual_apron') {
      return ownerMaterials.filter((m) => m.section === 'apron' && m.isActive).length;
    }
    const subIds = new Set(getAllSubcategoryIds(catId));
    const cat = ownerCategories.find((c) => c.id === catId);
    return ownerMaterials.filter(
      (m) =>
        (subIds.has(m.categoryId) ||
          m.categoryId === catId ||
          (cat && !cat.parentId && m.section === cat.section)) &&
        m.isActive
    ).length;
  };

  // Финальный список декоров для отображения
  const displayedDecors = useMemo(() => {
    let list = ownerMaterials.filter(
      (m) =>
        m.isActive &&
        (m.section === 'facade' ||
          m.section === 'ldsp' ||
          m.section === 'countertop' ||
          m.section === 'apron')
    );

    if (selectedMaterialCatId !== 'all') {
      if (selectedMaterialCatId === 'virtual_countertop') {
        list = list.filter((m) => m.section === 'countertop');
      } else if (selectedMaterialCatId === 'virtual_apron') {
        list = list.filter((m) => m.section === 'apron');
      } else {
        const allowedCatIds = new Set(getAllSubcategoryIds(selectedMaterialCatId));
        const selectedCat = ownerCategories.find((c) => c.id === selectedMaterialCatId);
        list = list.filter(
          (m) =>
            allowedCatIds.has(m.categoryId) ||
            (selectedCat && !selectedCat.parentId && m.section === selectedCat.section)
        );
      }
    }

    if (materialSearch.trim()) {
      const q = materialSearch.trim().toLowerCase();
      list = list.filter((m) => {
        const clean = getCleanDecorName(m).toLowerCase();
        const raw = m.name.toLowerCase();
        const brand = (m.brand || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        const art = (m.article || '').toLowerCase();
        return (
          clean.includes(q) ||
          raw.includes(q) ||
          brand.includes(q) ||
          cat.includes(q) ||
          art.includes(q)
        );
      });
    }

    return list;
  }, [ownerMaterials, selectedMaterialCatId, materialSearch, getAllSubcategoryIds]);

  const isDecorActive = (mat: OwnerMaterialItem) => {
    if (mat.section === 'facade') return globalMaterials.facade === mat.id;
    if (mat.section === 'ldsp') return globalMaterials.carcass === mat.id;
    if (mat.section === 'countertop') return globalMaterials.countertop === mat.id;
    if (mat.section === 'apron') {
      return modules.some(
        (m) =>
          (m.subType === 'backsplash' || m.id.includes('backsplash')) &&
          (m.materials.facade === mat.id || m.materials.countertop === mat.id)
      );
    }
    return false;
  };

  const handleApplyDecor = (mat: OwnerMaterialItem) => {
    pushSnapshot();
    const sec = mat.section;
    if (sec === 'facade') {
      setGlobalMaterial('facade', mat.id);
    } else if (sec === 'ldsp') {
      setGlobalMaterial('carcass', mat.id);
    } else if (sec === 'countertop') {
      setGlobalMaterial('countertop', mat.id);
    } else if (sec === 'apron') {
      const updated = modules.map((m) => {
        if (m.subType === 'backsplash' || m.id.includes('backsplash')) {
          return {
            ...m,
            materials: { ...m.materials, facade: mat.id, countertop: mat.id },
          };
        }
        return m;
      });
      usePlannerStore.setState({ modules: updated });
    }
    clearMaterialCache();
  };

  const currentCategoryTitle = useMemo(() => {
    if (selectedMaterialCatId === 'all') return 'Все материалы';
    if (selectedMaterialCatId === 'virtual_countertop') return 'Столешницы';
    if (selectedMaterialCatId === 'virtual_apron') return 'Фартук';
    const pathNodes = getCategoryPath(selectedMaterialCatId);
    if (pathNodes && pathNodes.length > 0) {
      return pathNodes.map((c) => c.name).join(' → ');
    }
    return 'Категория';
  }, [selectedMaterialCatId, getCategoryPath]);

  // Сброс дерева при переключении с вкладки материалов
  useEffect(() => {
    if (activeTab !== 'materials') {
      setExpandedMaterialCats({});
    }
  }, [activeTab]);

  // Получение всех потомков категории для каскадного сброса при закрытии ветки
  const getAllDescendantCategoryIds = (targetId: string): string[] => {
    const ids: string[] = [];
    const collect = (id: string) => {
      let children: OwnerCategory[] = [];
      if (id === 'virtual_countertop') {
        const allCt = categoryTree.get('cat_countertops') || [];
        children = allCt.filter((c) => c.section === 'countertop');
      } else if (id === 'virtual_apron') {
        const allCt = categoryTree.get('cat_countertops') || [];
        children = allCt.filter((c) => c.section === 'apron');
      } else {
        children = categoryTree.get(id) || [];
      }
      for (const child of children) {
        ids.push(child.id);
        collect(child.id);
      }
    };
    collect(targetId);
    return ids;
  };

  // Переключение раскрытия узла: при закрытии сбрасывает все вложенные подкатегории,
  // чтобы при повторном открытии не восстанавливалось старое состояние
  const toggleCategoryExpansion = (catId: string) => {
    setExpandedMaterialCats((prev) => {
      const isCurrentlyExpanded = prev[catId] ?? false;
      if (isCurrentlyExpanded) {
        const descendants = getAllDescendantCategoryIds(catId);
        const next = { ...prev, [catId]: false };
        for (const dId of descendants) {
          next[dId] = false;
        }
        return next;
      } else {
        return {
          ...prev,
          [catId]: true,
        };
      }
    });
  };

  // Рекурсивный рендер узлов категорий в сайдбаре дизайнера
  const renderDesignerCategoryNodes = (
    nodes: OwnerCategory[],
    depth: number = 0
  ): React.ReactNode => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map((cat) => {
      const children = (cat as any).children || categoryTree.get(cat.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedMaterialCats[cat.id] ?? false;
      const isSelected = selectedMaterialCatId === cat.id;
      const count = getDecorCount(cat.id, cat.section);

      return (
        <div key={cat.id} className="select-none">
          <div
            onClick={() => {
              setSelectedMaterialCatId(cat.id);
              if (hasChildren) {
                toggleCategoryExpansion(cat.id);
              }
            }}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className={`group relative flex items-center justify-between pr-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all ${
              isSelected
                ? 'bg-blue-600/25 border border-blue-500/70 text-blue-200 font-semibold shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategoryExpansion(cat.id);
                  }}
                  className="p-0.5 hover:text-blue-400 text-slate-400 transition-colors shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
              ) : (
                <span className="w-3.5 text-center text-blue-400/80 text-[10px] leading-none shrink-0">•</span>
              )}

              {hasChildren ? (
                isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-blue-400/70 shrink-0" />
                )
              ) : null}

              <span className="truncate">{cat.name}</span>
            </div>

            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 transition-colors ${
                isSelected
                  ? 'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700/60'
              }`}
            >
              {count}
            </span>
          </div>

          {/* Дочерние узлы: раскрываются ТОЛЬКО при выборе родителя */}
          {hasChildren && isExpanded && (
            <div className="mt-0.5">{renderDesignerCategoryNodes(children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const toggleSubcategory = (subId: string) => {
    setOpenSubcategories((prev) => ({
      ...prev,
      [subId]: prev[subId] === false ? true : false,
    }));
  };

  const toggleAllSubcategories = () => {
    const currentSubs = activeCategoryDef?.subcategories || [];
    const anyOpen = currentSubs.some((s) => openSubcategories[s.id] !== false);
    const nextVal = !anyOpen;
    const updated = { ...openSubcategories };
    currentSubs.forEach((s) => {
      updated[s.id] = nextVal;
    });
    setOpenSubcategories(updated);
  };

  const handleSelectMainGroup = (group: CatalogMainGroup) => {
    setCatalogMainGroup(group);
    setCatalogSubGroup('all');
    setIsSubcategoryPanelOpen(true);
  };

  const allCatalog = [...customTemplates, ...CATALOG_ITEMS];

  const getCategoryCount = (mainGroup: CatalogMainGroup) => {
    return allCatalog.filter((item) => item.category === 'kitchen' && item.mainGroup === mainGroup).length;
  };

  const activeCategoryDef = CATALOG_CATEGORIES.find((c) => c.id === catalogMainGroup);

  const filteredCatalog = allCatalog.filter((item) => {
    if (item.category !== 'kitchen') return false;

    const query = catalogSearch.trim().toLowerCase();
    if (query) {
      const matchCode = (item.code || getModuleCode(item)).toLowerCase().includes(query);
      const matchName = item.name.toLowerCase().includes(query);
      const matchDesc = item.description?.toLowerCase().includes(query) ?? false;
      const matchTags = item.tags?.some((t) => t.toLowerCase().includes(query)) ?? false;
      const matchStandardWidth = item.standardWidths?.some((w) => w.toString().includes(query)) ?? false;
      return matchCode || matchName || matchDesc || matchTags || matchStandardWidth;
    }

    if (item.mainGroup !== catalogMainGroup) return false;
    if (catalogSubGroup !== 'all' && item.subGroup !== catalogSubGroup && !item.id.startsWith('custom_sec_')) return false;
    return true;
  });

  const handleAddModule = (template: CatalogItemTemplate, customWidth?: number) => {
    if (isModuleLimitReached(modules.length)) {
      alert('Внимание! Достигнут лимит демо-версии (максимум 8 секций на сцене). Введите лицензионный ключ для снятия ограничений.');
      openKeyModal();
      return;
    }
    pushSnapshot();
    const width = customWidth ?? selectedWidths[template.id] ?? template.defaultDimensions.width;
    addModule(template, undefined, { width });
  };

  const handleTabClick = (tab: 'catalog' | 'materials' | 'properties' | 'room') => {
    setActiveTab(tab);
    if (tab === 'room') {
      setMode('2D');
    } else {
      setMode('3D');
      selectWall(null);
      selectColumn(null);
      selectOpening(null);
      selectUtility(null);
    }
  };

  // Стандартные мебельные базы для быстрого выбора
  const standardWidths = [300, 400, 450, 500, 600, 800, 900, 1000, 1200];

  // ==========================================
  // РЕЖИМ РАЗВЁРТКИ ВЫБРАННОЙ СТЕНЫ (ВИД ПРЯМО)
  // ==========================================
  if (roomData.activeWallElevationId && elevationWall) {
    const openingsOnWall = (roomData.openings || []).filter((o) => o.wallId === elevationWall.id);
    const utilitiesOnWall = (roomData.utilities || []).filter((u) => u.wallId === elevationWall.id);

    return (
      <aside className="w-84 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 z-10 backdrop-blur-sm shadow-2xl">
        {/* Шапка режима развёртки */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/60">
          <button
            onClick={() => {
              closeWallElevation();
              setMode('3D');
            }}
            className="w-full py-2 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all group shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            ← Завершить (В 3D сцену)
          </button>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                {elevationWall.name}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Длина: <strong className="text-slate-200">{elevationWallLength}</strong> мм • Высота: <strong className="text-slate-200">{roomData.height}</strong> мм
              </div>
            </div>
            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded font-mono">
              Т: {elevationWall.thickness} мм
            </span>
          </div>
        </div>

        {/* Прокручиваемый контент развёртки */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* Информационная подсказка */}
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300/90 leading-relaxed">
            💡 <strong>Быстрый ввод:</strong> Кликайте прямо по цифрам стрелок на чертеже стены для мгновенного ввода размера с клавиатуры.
          </div>

          {/* Инспектор выбранного проёма */}
          {selectedOpening && selectedOpening.wallId === elevationWall.id && (
            <div className="p-3 rounded-xl bg-slate-800/90 border-2 border-sky-500/60 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-200">
                  {selectedOpening.type === 'window' ? <AppWindow className="w-4 h-4 text-sky-400" /> : <DoorOpen className="w-4 h-4 text-indigo-400" />}
                  <span>{selectedOpening.name}</span>
                </div>
                <button
                  onClick={() => selectOpening(null)}
                  className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-700/50"
                >
                  Снять выбор
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Ширина:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-sky-500">
                    <NumberInput
                      value={selectedOpening.width}
                      min={100}
                      max={elevationWallLength}
                      step={10}
                      onChange={(val) => {
                        pushSnapshot();
                        updateOpening(selectedOpening.id, { width: val });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Высота:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-sky-500">
                    <NumberInput
                      value={selectedOpening.height}
                      min={100}
                      max={roomData.height}
                      step={10}
                      onChange={(val) => {
                        pushSnapshot();
                        updateOpening(selectedOpening.id, { height: val });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">
                    {selectedOpening.type === 'window' ? 'Подоконник:' : 'От пола:'}
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-sky-500">
                    <NumberInput
                      value={selectedOpening.sillHeight}
                      min={0}
                      max={Math.max(0, roomData.height - selectedOpening.height)}
                      step={10}
                      onChange={(val) => {
                        pushSnapshot();
                        updateOpening(selectedOpening.id, { sillHeight: val });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-700/40 pt-1.5">
                  <span className="text-xs text-slate-300">От левого угла:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-sky-500">
                    <NumberInput
                      value={Math.round(selectedOpening.offsetFromStart - selectedOpening.width / 2)}
                      min={0}
                      max={Math.max(0, elevationWallLength - selectedOpening.width)}
                      step={10}
                      onChange={(val) => {
                        pushSnapshot();
                        updateOpening(selectedOpening.id, { offsetFromStart: Math.round(val + selectedOpening.width / 2) });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                {selectedOpening.type === 'window' && (
                  <div className="border-t border-slate-700/50 pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-medium">Подоконник:</span>
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-700">
                      <button
                        onClick={() => {
                          pushSnapshot();
                          updateOpening(selectedOpening.id, { hasSill: true });
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          selectedOpening.hasSill !== false ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Есть (выступ 50 мм)
                      </button>
                      <button
                        onClick={() => {
                          pushSnapshot();
                          updateOpening(selectedOpening.id, { hasSill: false });
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          selectedOpening.hasSill === false ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Без выступа
                      </button>
                    </div>
                  </div>
                )}

                {selectedOpening.type === 'door' && (
                  <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
                    <span className="text-[11px] text-slate-400 block font-medium">Петли / Сторона:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          pushSnapshot();
                          updateOpening(selectedOpening.id, { doorSwing: 'left' });
                        }}
                        className={`py-1 rounded text-xs font-medium transition-colors ${
                          selectedOpening.doorSwing !== 'right' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Петли слева
                      </button>
                      <button
                        onClick={() => {
                          pushSnapshot();
                          updateOpening(selectedOpening.id, { doorSwing: 'right' });
                        }}
                        className={`py-1 rounded text-xs font-medium transition-colors ${
                          selectedOpening.doorSwing === 'right' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Петли справа
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  pushSnapshot();
                  removeOpening(selectedOpening.id);
                }}
                className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Удалить со стены
              </button>
            </div>
          )}

          {/* Инспектор выбранного элемента коммуникаций */}
          {selectedUtility && selectedUtility.wallId === elevationWall.id && (
            <div className="p-3 rounded-xl bg-slate-800/90 border-2 border-amber-500/60 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                  {selectedUtility.category === 'electrical' && <Zap className="w-4 h-4 text-amber-400" />}
                  {selectedUtility.category === 'plumbing' && <Droplets className="w-4 h-4 text-cyan-400" />}
                  {selectedUtility.category === 'gas_heating' && <Flame className="w-4 h-4 text-orange-400" />}
                  <span>{selectedUtility.name}</span>
                </div>
                <button
                  onClick={() => selectUtility(null)}
                  className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-700/50"
                >
                  Снять выбор
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Ширина:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-amber-500">
                    <NumberInput
                      value={selectedUtility.width}
                      min={10}
                      max={elevationWallLength}
                      step={5}
                      onChange={(val) => {
                        pushSnapshot();
                        updateUtility(selectedUtility.id, { width: val });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Высота:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-amber-500">
                    <NumberInput
                      value={selectedUtility.height}
                      min={10}
                      max={roomData.height}
                      step={5}
                      onChange={(val) => {
                        pushSnapshot();
                        updateUtility(selectedUtility.id, { height: val });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Глубина / выступ:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-amber-500">
                    <NumberInput
                      value={selectedUtility.depth}
                      min={5}
                      max={800}
                      step={5}
                      onChange={(val) => {
                        pushSnapshot();
                        updateUtility(selectedUtility.id, { depth: val });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Высота от пола:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-amber-500">
                    <NumberInput
                      value={selectedUtility.elevationFromFloor}
                      min={0}
                      max={Math.max(0, roomData.height - selectedUtility.height)}
                      step={10}
                      onChange={(val) => {
                        pushSnapshot();
                        updateUtility(selectedUtility.id, { elevationFromFloor: val });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-700/40 pt-1.5">
                  <span className="text-xs text-slate-300">От левого угла:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded focus-within:border-amber-500">
                    <NumberInput
                      value={Math.round(selectedUtility.offsetFromStart - selectedUtility.width / 2)}
                      min={0}
                      max={Math.max(0, elevationWallLength - selectedUtility.width)}
                      step={10}
                      onChange={(val) => {
                        pushSnapshot();
                        updateUtility(selectedUtility.id, { offsetFromStart: Math.round(val + selectedUtility.width / 2) });
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">мм</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  pushSnapshot();
                  removeUtility(selectedUtility.id);
                }}
                className="w-full py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Удалить со стены
              </button>
            </div>
          )}

          {/* Каталог элементов для добавления (Выпадающий список / Аккордеон) */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Установить на стену:
            </h4>

            {/* 1. ОКНА */}
            <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
              <button
                onClick={() => setElevationCategory(elevationCategory === 'windows' ? null : 'windows')}
                className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-sky-300 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AppWindow className="w-4 h-4 text-sky-400" />
                  <span>Окна</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono">4 пресета</span>
                  {elevationCategory === 'windows' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {elevationCategory === 'windows' && (
                <div className="p-2 pt-1 space-y-1.5 border-t border-slate-700/50 bg-slate-900/40">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      const op = addOpening(elevationWall.id, 'window');
                      if (op) updateOpening(op.id, { width: 1200, height: 1400, sillHeight: 850 });
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-sky-300">Стандартное окно</div>
                    <div className="text-[10px] text-slate-400 font-mono">1200 × 1400 мм (подоконник 850 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      const op = addOpening(elevationWall.id, 'window');
                      if (op) updateOpening(op.id, { width: 1800, height: 1400, sillHeight: 850 });
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-sky-300">Широкое 3-створчатое</div>
                    <div className="text-[10px] text-slate-400 font-mono">1800 × 1400 мм (подоконник 850 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      const op = addOpening(elevationWall.id, 'window');
                      if (op) updateOpening(op.id, { width: 1800, height: 2100, sillHeight: 100 });
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-sky-300">Панорамное / в пол</div>
                    <div className="text-[10px] text-slate-400 font-mono">1800 × 2100 мм (подоконник 100 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      const op = addOpening(elevationWall.id, 'window');
                      if (op) updateOpening(op.id, { width: 800, height: 600, sillHeight: 1500 });
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-sky-300">Фрамуга / В санузел</div>
                    <div className="text-[10px] text-slate-400 font-mono">800 × 600 мм (подоконник 1500 мм)</div>
                  </button>
                </div>
              )}
            </div>

            {/* 2. ДВЕРИ */}
            <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
              <button
                onClick={() => setElevationCategory(elevationCategory === 'doors' ? null : 'doors')}
                className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-indigo-300 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-indigo-400" />
                  <span>Двери и проёмы</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">3 пресета</span>
                  {elevationCategory === 'doors' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {elevationCategory === 'doors' && (
                <div className="p-2 pt-1 space-y-1.5 border-t border-slate-700/50 bg-slate-900/40">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      const op = addOpening(elevationWall.id, 'door');
                      if (op) updateOpening(op.id, { width: 800, height: 2000, sillHeight: 0 });
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300">Межкомнатная дверь (800)</div>
                    <div className="text-[10px] text-slate-400 font-mono">800 × 2000 мм (от пола 0 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      const op = addOpening(elevationWall.id, 'door');
                      if (op) updateOpening(op.id, { width: 900, height: 2000, sillHeight: 0 });
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300">Входная / Широкая (900)</div>
                    <div className="text-[10px] text-slate-400 font-mono">900 × 2000 мм (от пола 0 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      const op = addOpening(elevationWall.id, 'door');
                      if (op) updateOpening(op.id, { width: 1200, height: 2000, sillHeight: 0 });
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300">Двупольная дверь (1200)</div>
                    <div className="text-[10px] text-slate-400 font-mono">1200 × 2000 мм</div>
                  </button>
                </div>
              )}
            </div>

            {/* 3. ЭЛЕКТРИКА */}
            <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
              <button
                onClick={() => setElevationCategory(elevationCategory === 'electrical' ? null : 'electrical')}
                className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-amber-300 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Электрика и розетки</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">5 пресетов</span>
                  {elevationCategory === 'electrical' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {elevationCategory === 'electrical' && (
                <div className="p-2 pt-1 space-y-1.5 border-t border-slate-700/50 bg-slate-900/40">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'electrical', 'socket');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300">Одинарная розетка 220В</div>
                    <div className="text-[10px] text-slate-400 font-mono">70 × 70 × 10 мм (фартук h=1050 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'electrical', 'socket_double');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300">Блок на 2 розетки</div>
                    <div className="text-[10px] text-slate-400 font-mono">140 × 70 × 10 мм (фартук h=1050 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'electrical', 'socket_triple');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300">Блок на 3 розетки</div>
                    <div className="text-[10px] text-slate-400 font-mono">210 × 70 × 10 мм (фартук h=1050 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'electrical', 'socket_power');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300">Силовая розетка 380В</div>
                    <div className="text-[10px] text-slate-400 font-mono">90 × 90 × 25 мм (цоколь h=100 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'electrical', 'hood_outlet');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300">Вывод под вытяжку</div>
                    <div className="text-[10px] text-slate-400 font-mono">70 × 70 × 10 мм (вверху h=2100 мм)</div>
                  </button>
                </div>
              )}
            </div>

            {/* 4. САНТЕХНИКА */}
            <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
              <button
                onClick={() => setElevationCategory(elevationCategory === 'plumbing' ? null : 'plumbing')}
                className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-cyan-300 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span>Сантехника (вода / слив)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">2 пресета</span>
                  {elevationCategory === 'plumbing' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {elevationCategory === 'plumbing' && (
                <div className="p-2 pt-1 space-y-1.5 border-t border-slate-700/50 bg-slate-900/40">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'plumbing', 'water_in');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300">Выводы воды (ХВС + ГВС)</div>
                    <div className="text-[10px] text-slate-400 font-mono">150 × 60 × 35 мм (h=550 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'plumbing', 'water_drain');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300">Слив канализации (Ø50 мм)</div>
                    <div className="text-[10px] text-slate-400 font-mono">60 × 60 × 35 мм (h=450 мм)</div>
                  </button>
                </div>
              )}
            </div>

            {/* 5. ОТОПЛЕНИЕ И ГАЗ */}
            <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
              <button
                onClick={() => setElevationCategory(elevationCategory === 'heating' ? null : 'heating')}
                className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-orange-300 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span>Отопление и Газ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-mono">3 пресета</span>
                  {elevationCategory === 'heating' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {elevationCategory === 'heating' && (
                <div className="p-2 pt-1 space-y-1.5 border-t border-slate-700/50 bg-slate-900/40">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'gas_heating', 'gas_boiler');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-orange-300">Газовый котёл</div>
                    <div className="text-[10px] text-slate-400 font-mono">400 × 700 × 300 мм (h=1200 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'gas_heating', 'gas_pipe');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-orange-300">Газовый ввод / кран</div>
                    <div className="text-[10px] text-slate-400 font-mono">40 × 40 × 30 мм (h=750 мм)</div>
                  </button>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addUtility(elevationWall.id, 'gas_heating', 'radiator');
                    }}
                    className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-orange-300">Радиатор отопления</div>
                    <div className="text-[10px] text-slate-400 font-mono">800 × 500 × 100 мм (h=150 мм)</div>
                  </button>
                </div>
              )}
            </div>

            {/* 6. УСТАНОВЛЕННЫЕ ЭЛЕМЕНТЫ */}
            {(openingsOnWall.length > 0 || utilitiesOnWall.length > 0) && (
              <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
                <button
                  onClick={() => setElevationCategory(elevationCategory === 'installed' ? null : 'installed')}
                  className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-blue-400" />
                    <span>Установлено на стене</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                      {openingsOnWall.length + utilitiesOnWall.length} шт.
                    </span>
                    {elevationCategory === 'installed' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>
                {elevationCategory === 'installed' && (
                  <div className="p-2 pt-1 space-y-1 border-t border-slate-700/50 bg-slate-900/40">
                    {openingsOnWall.map((op) => {
                      const isSel = op.id === roomData.selectedOpeningId;
                      return (
                        <div
                          key={op.id}
                          onClick={() => selectOpening(op.id)}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSel ? 'bg-sky-600/30 border-sky-400 text-sky-100 font-medium' : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {op.type === 'window' ? <AppWindow className="w-3.5 h-3.5 text-sky-400 shrink-0" /> : <DoorOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                            <span className="truncate">{op.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              pushSnapshot();
                              removeOpening(op.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                    {utilitiesOnWall.map((ut) => {
                      const isSel = ut.id === roomData.selectedUtilityId;
                      return (
                        <div
                          key={ut.id}
                          onClick={() => selectUtility(ut.id)}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSel ? 'bg-amber-600/30 border-amber-400 text-amber-100 font-medium' : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {ut.category === 'electrical' && <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            {ut.category === 'plumbing' && <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                            {ut.category === 'gas_heating' && <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                            <span className="truncate">{ut.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              pushSnapshot();
                              removeUtility(ut.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`h-full flex flex-row shrink-0 z-10 backdrop-blur-sm select-none transition-all duration-150 ${
        activeTab === 'catalog'
          ? isSubcategoryPanelOpen
            ? 'w-[580px]'
            : 'w-64'
          : 'w-84'
      }`}
    >
      {/* ОСНОВНАЯ ЛЕВАЯ КОЛОНКА МЕНЮ */}
      <div
        className={`${
          activeTab === 'catalog' ? 'w-64' : 'w-84'
        } bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 h-full overflow-hidden`}
      >
        {/* Навигационные вкладки */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1 shrink-0">
          <button
            onClick={() => handleTabClick('catalog')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-all ${
              activeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Модули
          </button>
          <button
            onClick={() => handleTabClick('materials')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-all ${
              activeTab === 'materials'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Palette className="w-4 h-4" />
            Декоры
          </button>
          <button
            onClick={() => handleTabClick('properties')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-all relative ${
              activeTab === 'properties'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Параметры
            {selectedModule && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => handleTabClick('room')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-all ${
              activeTab === 'room'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Home className="w-4 h-4" />
            Комната
          </button>
        </div>

        {/* Контент левой колонки */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* ВКЛАДКА 1: КАТАЛОГ МОДУЛЕЙ (ОСНОВНЫЕ КАТЕГОРИИ) */}
          {activeTab === 'catalog' && (
            <div className="space-y-3">
              {/* Поисковая строка */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => {
                    setCatalogSearch(e.target.value);
                    if (!isSubcategoryPanelOpen) setIsSubcategoryPanelOpen(true);
                  }}
                  placeholder="Поиск по каталогу..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {catalogSearch && (
                  <button
                    onClick={() => setCatalogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                    title="Очистить поиск"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Инженерные параметры кухни */}
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200">Параметры кухни</div>
                    <div className="text-[9px] text-slate-400 font-mono truncate">
                      ДСП {projectSettings.dspThickness} • База {projectSettings.baseBodyHeight} • Стол. {projectSettings.countertopThickness}
                    </div>
                  </div>
                </div>
                <button
                  onClick={openProjectSettings}
                  className="px-2 py-0.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-[11px] font-medium transition-colors shrink-0"
                >
                  Настроить
                </button>
              </div>

              {/* Заголовок КАТАЛОГ МЕБЕЛИ */}
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1 flex items-center justify-between">
                <span>Каталог мебели</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {CATALOG_CATEGORIES.length} категории
                </span>
              </div>

              {/* Вертикальный список основных категорий (в точности по скрину пользователя) */}
              <div className="space-y-1.5">
                {CATALOG_CATEGORIES.map((cat) => {
                  const isCur = catalogMainGroup === cat.id && isSubcategoryPanelOpen;
                  const count = getCategoryCount(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setCatalogMainGroup(cat.id);
                        setIsSubcategoryPanelOpen(true);
                      }}
                      className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all group ${
                        isCur
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-400/40'
                          : 'text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600'
                      }`}
                      title={cat.description}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isCur
                              ? 'bg-blue-500/30 text-white'
                              : 'bg-slate-700/50 text-slate-400 group-hover:text-blue-400'
                          }`}
                        >
                          {cat.id === 'base' && <Package className="w-3.5 h-3.5" />}
                          {cat.id === 'wall' && <Layers className="w-3.5 h-3.5" />}
                          {cat.id === 'tall' && <Columns className="w-3.5 h-3.5" />}
                          {cat.id === 'top' && <Boxes className="w-3.5 h-3.5" />}
                          {cat.id === 'backsplash' && <Square className="w-3.5 h-3.5" />}
                        </div>
                        <span className="truncate uppercase text-[11px] tracking-tight">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isCur ? 'bg-blue-700 text-white' : 'bg-slate-900/80 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isCur ? 'text-white translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {/* ВКЛАДКА 2: МАТЕРИАЛЫ И ДЕКОРЫ (ИЕРАРХИЧЕСКОЕ ДЕРЕВО КАТЕГОРИЙ + СПИСОК ДЕКОРОВ) */}
        {activeTab === 'materials' && (
          <div className="space-y-3 pb-6">
            {/* Статус синхронизации и кнопка быстрого перехода в кабинет */}
            <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-blue-950/70 via-slate-900 to-slate-900 rounded-xl border border-blue-500/30 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30 animate-pulse shrink-0" />
                <div>
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    База декоров
                  </div>
                  <div className="text-[10px] text-blue-300/80">
                    {ownerMaterials.filter((m) => m.isActive && (m.section === 'facade' || m.section === 'ldsp' || m.section === 'countertop' || m.section === 'apron')).length} активных декоров
                  </div>
                </div>
              </div>
              <button
                onClick={openOwnerCabinet}
                className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                title="Открыть веб-кабинет для настройки материалов, наценок и категорий"
              >
                <Sliders className="w-3.5 h-3.5" />
                Кабинет
              </button>
            </div>

            {/* Быстрый поиск декора */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по названию декора..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              />
              {materialSearch && (
                <button
                  onClick={() => setMaterialSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* ДЕРЕВО КАТЕГОРИЙ (РАСКРЫВАЕТСЯ ТОЛЬКО ПРИ ВЫБОРЕ) */}
            <div className="bg-[#0E131F]/90 border border-slate-800 rounded-xl p-2 space-y-1 shadow-sm">
              <div className="flex items-center justify-between px-1.5 pb-1 border-b border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-blue-400" />
                  Категории материалов
                </span>
                {Object.values(expandedMaterialCats).some(Boolean) && (
                  <button
                    onClick={() => setExpandedMaterialCats({})}
                    className="text-[10px] text-slate-400 hover:text-blue-300 transition-colors"
                    title="Свернуть все открытые ветки дерева"
                  >
                    Свернуть всё
                  </button>
                )}
              </div>

              {/* Пункт: "Все материалы" */}
              <div
                onClick={() => setSelectedMaterialCatId('all')}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all ${
                  selectedMaterialCatId === 'all'
                    ? 'bg-blue-600/25 border border-blue-500/70 text-blue-200 font-semibold shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                  Все материалы
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full font-mono border border-slate-700/60">
                  {ownerMaterials.filter((m) => m.isActive && (m.section === 'facade' || m.section === 'ldsp' || m.section === 'countertop' || m.section === 'apron')).length}
                </span>
              </div>

              {/* Иерархическое дерево: Корпус, Фасады, Столешницы, Фартук */}
              <div className="space-y-0.5 pt-0.5">
                {renderDesignerCategoryNodes(designerRootCategories as any, 0)}
              </div>
            </div>

            {/* ЗАГОЛОВОК ВЫБРАННОЙ КАТЕГОРИИ И СПИСОК ДЕКОРОВ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="min-w-0 flex-1 mr-2">
                  <div className="text-[11px] font-bold text-slate-200 truncate" title={currentCategoryTitle}>
                    {currentCategoryTitle}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Показано: <span className="font-semibold text-blue-300">{displayedDecors.length}</span> декоров
                  </div>
                </div>
                {selectedMaterialCatId !== 'all' && (
                  <button
                    onClick={() => setSelectedMaterialCatId('all')}
                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-colors shrink-0"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {/* СПИСОК ЧИСТЫХ ПЛАШЕК ДЕКОРОВ */}
              <div className="space-y-1.5 max-h-[calc(100vh-440px)] overflow-y-auto pr-1 custom-scrollbar">
                {displayedDecors.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                    В этой категории декоры не найдены
                  </div>
                ) : (
                  displayedDecors.map((mat) => {
                    const isCur = isDecorActive(mat);
                    const bgImg = mat.imageUrl || mat.textureUrl;
                    const cleanName = getCleanDecorName(mat);

                    return (
                      <button
                        key={mat.id}
                        onClick={() => handleApplyDecor(mat)}
                        className={`w-full p-2 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          isCur
                            ? 'border-blue-500 bg-blue-500/20 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40'
                            : 'border-slate-700/70 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {/* Плашка цвета / текстуры */}
                        <span
                          className="w-11 h-11 rounded-lg border border-slate-700 shrink-0 shadow-sm relative overflow-hidden bg-cover bg-center flex items-center justify-center"
                          style={{
                            backgroundColor: mat.color || '#334155',
                            backgroundImage: bgImg ? `url("${encodeURI(decodeURI(bgImg))}")` : undefined,
                          }}
                        >
                          {(mat.roughness ?? 0.7) <= 0.2 && (
                            <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-white/60 pointer-events-none" />
                          )}
                        </span>

                        {/* Чистое название декора (без цены) */}
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                          <span className="text-xs font-medium text-slate-100 truncate" title={cleanName}>
                            {cleanName}
                          </span>
                          {isCur && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 3: ПАРАМЕТРЫ ВЫБРАННОГО МОДУЛЯ (С ПРЯМЫМ ВВОДОМ С КЛАВИАТУРЫ) */}
        {activeTab === 'properties' && (
          <div>
            {selectedModule ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      {selectedModule.category === 'kitchen' ? 'Кухонный модуль' : 'Шкаф'}
                    </div>
                    {getModuleCode(selectedModule) && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono font-bold text-xs border border-blue-500/40">
                        {getModuleCode(selectedModule)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-white mt-1">
                    {selectedModule.name}
                  </div>
                </div>

                {/* Параметрические размеры (Ширина, Высота, Глубина с ручным числовым вводом) */}
                <div className="space-y-4 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Точные размеры (в мм)
                  </h4>

                  {/* ШИРИНА */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-300 font-medium">Ширина:</label>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg focus-within:border-blue-500">
                        <NumberInput
                          value={selectedModule.dimensions.width}
                          min={100}
                          max={3000}
                          step={10}
                          onChange={(val) => {
                            pushSnapshot();
                            updateModuleDimensions(
                              selectedModule.id,
                              val,
                              selectedModule.dimensions.height,
                              selectedModule.dimensions.depth
                            );
                          }}
                          className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-400 font-mono">мм</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={300}
                      max={1200}
                      step={50}
                      value={selectedModule.dimensions.width}
                      onChange={(e) => {
                        pushSnapshot();
                        updateModuleDimensions(
                          selectedModule.id,
                          Number(e.target.value),
                          selectedModule.dimensions.height,
                          selectedModule.dimensions.depth
                        );
                      }}
                      className="w-full accent-blue-500 cursor-pointer"
                    />

                    {/* Быстрые стандарты ширины для кухонщиков */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {standardWidths.map((w) => (
                        <button
                          key={w}
                          onClick={() => {
                            pushSnapshot();
                            updateModuleDimensions(
                              selectedModule.id,
                              w,
                              selectedModule.dimensions.height,
                              selectedModule.dimensions.depth
                            );
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                            selectedModule.dimensions.width === w
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ВЫСОТА */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-300 font-medium">Высота:</label>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg focus-within:border-blue-500">
                        <NumberInput
                          value={selectedModule.dimensions.height}
                          min={100}
                          max={3000}
                          step={10}
                          onChange={(val) => {
                            pushSnapshot();
                            updateModuleDimensions(
                              selectedModule.id,
                              selectedModule.dimensions.width,
                              val,
                              selectedModule.dimensions.depth
                            );
                          }}
                          className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-400 font-mono">мм</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={300}
                      max={2400}
                      step={10}
                      value={selectedModule.dimensions.height}
                      onChange={(e) => {
                        pushSnapshot();
                        updateModuleDimensions(
                          selectedModule.id,
                          selectedModule.dimensions.width,
                          Number(e.target.value),
                          selectedModule.dimensions.depth
                        );
                      }}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* ГЛУБИНА */}
                  {/* ГЛУБИНА */}
                  {(() => {
                    const isBacksplashMod = selectedModule.subType === 'backsplash';
                    const isBaseMod = selectedModule.subType === 'base' || selectedModule.subType === 'corner';
                    const backOverhang = projectSettings.countertopBackOverhang ?? (projectSettings.countertopFrontOverhang === 36 ? 54 : 40);
                    const maxBaseDepth = 510 + backOverhang;
                    const minDepth = isBacksplashMod ? 4 : (isBaseMod ? 300 : (selectedModule.subType === 'wall' ? 200 : 300));
                    const maxDepth = isBacksplashMod ? 20 : (isBaseMod ? maxBaseDepth : (selectedModule.subType === 'wall' ? 600 : 900));

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-300 font-medium">Глубина:</label>
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg focus-within:border-blue-500">
                            <NumberInput
                              value={selectedModule.dimensions.depth}
                              min={minDepth}
                              max={maxDepth}
                              step={10}
                              onChange={(val) => {
                                pushSnapshot();
                                updateModuleDimensions(
                                  selectedModule.id,
                                  selectedModule.dimensions.width,
                                  selectedModule.dimensions.height,
                                  Math.max(minDepth, Math.min(maxDepth, val))
                                );
                              }}
                              className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-400 font-mono">мм</span>
                          </div>
                        </div>

                        
                        {isBacksplashMod && (
                          <div className="pt-1.5 space-y-1">
                            <div className="text-[10px] text-slate-400 font-medium">Стандартные толщины фартука:</div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { val: 4, label: '4 мм', sub: 'ХДФ / Стекло' },
                                { val: 6, label: '6 мм', sub: 'МДФ / Плитка' },
                                { val: 8, label: '8 мм', sub: 'Камень / ДСП' },
                              ].map((th) => (
                                <button
                                  key={th.val}
                                  onClick={() => {
                                    pushSnapshot();
                                    updateModuleDimensions(
                                      selectedModule.id,
                                      selectedModule.dimensions.width,
                                      selectedModule.dimensions.height,
                                      th.val
                                    );
                                  }}
                                  className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                                    selectedModule.dimensions.depth === th.val
                                      ? 'bg-blue-600 text-white font-bold ring-1 ring-blue-400 shadow-sm'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                                  }`}
                                >
                                  <div className="text-xs font-mono font-bold">{th.label}</div>
                                  <div className="text-[9px] opacity-75">{th.sub}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {isBaseMod && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                            <span>База: 510 мм</span>
                            <span>Макс. в сантех-зазор: <strong className="text-amber-300">{maxBaseDepth} мм</strong></span>
                          </div>
                        )}

                        <input
                          type="range"
                          min={minDepth}
                          max={maxDepth}
                          step={10}
                          value={Math.min(maxDepth, Math.max(minDepth, selectedModule.dimensions.depth))}
                          onChange={(e) => {
                            pushSnapshot();
                            updateModuleDimensions(
                              selectedModule.id,
                              selectedModule.dimensions.width,
                              selectedModule.dimensions.height,
                              Number(e.target.value)
                            );
                          }}
                          className="w-full accent-blue-500 cursor-pointer"
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* БЛОК ФУРНИТУРЫ И РУЧЕК ФАСАДА (КАК В BROSKO PLANNER) */}
                <div className="space-y-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-blue-400" />
                      Фурнитура и ручки фасада
                    </h4>
                  </div>

                  {/* Чекбокс: Задняя стенка */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedModule.config.hasBackWall !== false}
                      onChange={(e) => {
                        pushSnapshot();
                        updateModule(selectedModule.id, {
                          config: {
                            ...selectedModule.config,
                            hasBackWall: e.target.checked,
                          },
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-xs text-slate-200 font-medium">Задняя стенка (ХДФ 4 мм)</span>
                  </label>

                  {/* Отображение точных чистовых размеров фасадов модуля */}
                  {(() => {
                    const facadeInfo = getFacadeInfo(selectedModule, projectSettings);
                    return (
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">{facadeInfo.label}</span>
                        <span className="text-blue-300 font-mono font-bold">{facadeInfo.value}</span>
                      </div>
                    );
                  })()}

                  {/* Чекбокс: Без ручек */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1 border-t border-slate-700/40">
                    <input
                      type="checkbox"
                      checked={selectedModule.config.handleType === 'none'}
                      onChange={(e) => {
                        pushSnapshot();
                        updateModule(selectedModule.id, {
                          config: {
                            ...selectedModule.config,
                            handleType: e.target.checked ? 'none' : 'bar',
                          },
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-xs text-slate-200 font-medium">Без ручек</span>
                  </label>

                  {/* Если ручки включены: тип, ориентация, положение, смещение */}
                  {selectedModule.config.handleType !== 'none' && (
                    <div className="space-y-3 pt-1">
                      {/* Выбор модели ручки: Скоба, Рейлинг, Кнопка, Профиль накладной, Профиль Gola */}
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                          Модель ручки:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              id: 'bar',
                              name: 'Ручка-скоба',
                              colSpan: 'col-span-1',
                              svg: (
                                <svg className="w-10 h-5 mx-auto stroke-current" viewBox="0 0 44 20" fill="none">
                                  <path d="M 6 16 L 6 8 C 6 6 8 4 10 4 L 34 4 C 36 4 38 6 38 8 L 38 16" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                              ),
                            },
                            {
                              id: 'railing',
                              name: 'Рейлинг',
                              colSpan: 'col-span-1',
                              svg: (
                                <svg className="w-10 h-5 mx-auto stroke-current" viewBox="0 0 44 20" fill="none">
                                  <line x1="3" y1="6" x2="41" y2="6" strokeWidth="2.5" strokeLinecap="round" />
                                  <line x1="11" y1="6" x2="11" y2="16" strokeWidth="2" strokeLinecap="round" />
                                  <line x1="33" y1="6" x2="33" y2="16" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              ),
                            },
                            {
                              id: 'knob',
                              name: 'Кнопка',
                              colSpan: 'col-span-1',
                              svg: (
                                <svg className="w-10 h-5 mx-auto fill-current" viewBox="0 0 44 20">
                                  <circle cx="22" cy="7" r="5" />
                                  <rect x="20.5" y="11" width="3" height="6" rx="1" />
                                </svg>
                              ),
                            },
                            {
                              id: 'profile',
                              name: 'Профиль торцевой',
                              colSpan: 'col-span-1',
                              svg: (
                                <svg className="w-10 h-5 mx-auto stroke-current" viewBox="0 0 44 20" fill="none">
                                  <path d="M 6 15 L 6 6 L 38 6 L 38 10" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ),
                            },
                            {
                              id: 'gola',
                              name: 'Профиль Gola (интегрированный)',
                              colSpan: 'col-span-2',
                              svg: (
                                <svg className="w-16 h-5 mx-auto stroke-current" viewBox="0 0 60 20" fill="none">
                                  <rect x="4" y="2" width="52" height="3" rx="0.5" fill="currentColor" fillOpacity="0.35" stroke="none" />
                                  <path d="M 10 5 L 10 13 L 26 13 L 26 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <rect x="29" y="11" width="27" height="7" rx="0.5" fill="currentColor" fillOpacity="0.45" stroke="none" />
                                </svg>
                              ),
                            },
                          ].map((item) => {
                            const isCur = (selectedModule.config.handleType || 'bar') === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  pushSnapshot();
                                  const newHandleType = item.id as any;
                                  updateModule(selectedModule.id, {
                                    config: {
                                      ...selectedModule.config,
                                      handleType: newHandleType,
                                    },
                                  });

                                  // Автоматическое переключение фабричных стандартов свесов
                                  const isBaseMod = selectedModule.subType === 'base' || selectedModule.subType === 'corner' || selectedModule.subType === 'tall' || selectedModule.subType === 'top';
                                  if (isBaseMod) {
                                    if (newHandleType === 'gola') {
                                      updateProjectSettings({
                                        ...projectSettings,
                                        baseBodyDepth: 510,
                                        countertopFrontOverhang: 36,
                                        countertopBackOverhang: 54,
                                        countertopDepth: 600,
                                      }, true);
                                    } else if (projectSettings.countertopFrontOverhang === 36) {
                                      updateProjectSettings({
                                        ...projectSettings,
                                        baseBodyDepth: 510,
                                        countertopFrontOverhang: 50,
                                        countertopBackOverhang: 40,
                                        countertopDepth: 600,
                                      }, true);
                                    }
                                  }
                                }}
                                className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-between gap-1 group ${item.colSpan} ${
                                  isCur
                                    ? 'border-blue-500 bg-blue-600/20 text-blue-300 shadow-sm'
                                    : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <div className={`${isCur ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                  {item.svg}
                                </div>
                                <span className="text-[11px] font-medium leading-tight">
                                  {item.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Если выбран Gola: информационная плашка о скрытом профиле и выпиле */}
                      {selectedModule.config.handleType === 'gola' ? (
                        <div className="space-y-2.5">
                          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                              <Check className="w-3.5 h-3.5 text-blue-400" />
                              Интегрированная система Gola
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              Под столешницу врезается L-образный профиль (выпил в боковинах 55×26 мм) с зазором 30 мм. Фасады открываются без накладных ручек.
                            </p>
                            {(projectSettings.countertopFrontOverhang !== 36 || projectSettings.baseBodyDepth !== 510) && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateProjectSettings({
                                    ...projectSettings,
                                    baseBodyDepth: 510,
                                    countertopFrontOverhang: 36,
                                    countertopBackOverhang: 54,
                                    countertopDepth: 600,
                                  }, true);
                                }}
                                className="mt-1.5 w-full py-1 px-2 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 hover:text-white text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Sparkles className="w-3 h-3 text-blue-300" />
                                Применить свесы Gola (каркас 510, спереди 36, сзади 54)
                              </button>
                            )}
                          </div>

                          {/* Если у модуля есть выкатные ящики (от 2 ящиков): выбор Тип 1 / Тип 2 */}
                          {selectedModule.config.drawers > 1 && (
                            <div className="space-y-2 pt-1 border-t border-slate-700/60">
                              <label className="text-[11px] text-slate-300 font-semibold flex items-center justify-between">
                                <span>Вариант установки с ящиками:</span>
                                <span className="text-[10px] text-blue-400 font-mono font-normal">L + C профили</span>
                              </label>

                              <div className="grid grid-cols-2 gap-2">
                                {/* Тип 1 */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    pushSnapshot();
                                    updateModule(selectedModule.id, {
                                      config: {
                                        ...selectedModule.config,
                                        golaType: 'type1',
                                      },
                                    });
                                  }}
                                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                    (selectedModule.config.golaType ?? 'type1') === 'type1'
                                      ? 'border-blue-500 bg-blue-600/25 text-white shadow-sm ring-1 ring-blue-500/50'
                                      : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-xs">Тип 1</span>
                                    {(selectedModule.config.golaType ?? 'type1') === 'type1' && (
                                      <Check className="w-3.5 h-3.5 text-blue-400" />
                                    )}
                                  </div>
                                  <span className="text-[10.5px] text-blue-300 font-medium leading-tight mb-1">
                                    L сверху + 1 С-профиль
                                  </span>
                                  <span className="text-[9.5px] text-slate-400 leading-tight">
                                    С-профиль между нижним и средним ящиками (хват за низ среднего и верх нижнего). Между верхними зазор 3 мм.
                                  </span>
                                </button>

                                {/* Тип 2 */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    pushSnapshot();
                                    updateModule(selectedModule.id, {
                                      config: {
                                        ...selectedModule.config,
                                        golaType: 'type2',
                                      },
                                    });
                                  }}
                                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                    selectedModule.config.golaType === 'type2'
                                      ? 'border-blue-500 bg-blue-600/25 text-white shadow-sm ring-1 ring-blue-500/50'
                                      : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-xs">Тип 2</span>
                                    {selectedModule.config.golaType === 'type2' && (
                                      <Check className="w-3.5 h-3.5 text-blue-400" />
                                    )}
                                  </div>
                                  <span className="text-[10.5px] text-blue-300 font-medium leading-tight mb-1">
                                    L сверху + C между всеми
                                  </span>
                                  <span className="text-[9.5px] text-slate-400 leading-tight">
                                    С-профиль врезается в каждый стык ящиков (зазоры по 30 мм между всеми фасадами).
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Ориентация: Вертикально / Горизонтально */}
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-300 font-medium">Ориентация:</label>
                            <select
                              value={selectedModule.config.handleOrientation || (selectedModule.config.drawers > 0 ? 'horizontal' : 'vertical')}
                              onChange={(e) => {
                                pushSnapshot();
                                updateModule(selectedModule.id, {
                                  config: {
                                    ...selectedModule.config,
                                    handleOrientation: e.target.value as any,
                                  },
                                });
                              }}
                              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 font-medium rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="vertical">Вертикально</option>
                              <option value="horizontal">Горизонтально</option>
                            </select>
                          </div>

                          {/* Индикатор центрирования при горизонтальной ориентации */}
                          {(selectedModule.config.handleOrientation || (selectedModule.config.drawers > 0 ? 'horizontal' : 'vertical')) === 'horizontal' && (
                            <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-[11px] text-amber-300/90 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                              <span>По горизонтали: ручка автоматически по центру фасада</span>
                            </div>
                          )}

                          {/* Положение: Сверху / По центру / Снизу */}
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-300 font-medium">Положение:</label>
                            <select
                              value={selectedModule.config.handlePosition || (selectedModule.subType === 'wall' ? 'bottom' : 'top')}
                              onChange={(e) => {
                                pushSnapshot();
                                updateModule(selectedModule.id, {
                                  config: {
                                    ...selectedModule.config,
                                    handlePosition: e.target.value as any,
                                  },
                                });
                              }}
                              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 font-medium rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="top">Сверху</option>
                              <option value="center">По центру</option>
                              <option value="bottom">Снизу</option>
                            </select>
                          </div>

                          {/* Смещение (мм) */}
                          {(() => {
                            const isHoriz = (selectedModule.config.handleOrientation || (selectedModule.config.drawers > 0 ? 'horizontal' : 'vertical')) === 'horizontal';
                            const pos = selectedModule.config.handlePosition || (selectedModule.subType === 'wall' ? 'bottom' : 'top');
                            let labelText = 'Смещение сбоку от края:';
                            if (isHoriz) {
                              labelText = pos === 'bottom' ? 'Смещение снизу:' : 'Смещение сверху:';
                            }

                            return (
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs text-slate-300 font-medium">{labelText}</label>
                                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg focus-within:border-blue-500">
                                    <NumberInput
                                      value={selectedModule.config.handleOffset ?? 25}
                                      min={5}
                                      max={150}
                                      step={5}
                                      onChange={(val) => {
                                        pushSnapshot();
                                        updateModule(selectedModule.id, {
                                          config: {
                                            ...selectedModule.config,
                                            handleOffset: val,
                                          },
                                        });
                                      }}
                                      className="w-14 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                    />
                                    <span className="text-[11px] text-slate-400 font-mono">мм</span>
                                  </div>
                                </div>

                                {/* Пресеты 25, 35, 50 мм */}
                                <div className="flex gap-1.5 justify-end">
                                  {[25, 35, 50].map((preset) => (
                                    <button
                                      key={preset}
                                      onClick={() => {
                                        pushSnapshot();
                                        updateModule(selectedModule.id, {
                                          config: {
                                            ...selectedModule.config,
                                            handleOffset: preset,
                                          },
                                        });
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                        (selectedModule.config.handleOffset ?? 25) === preset
                                          ? 'bg-blue-600 text-white font-bold'
                                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-700'
                                      }`}
                                    >
                                      {preset} мм
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Действия с модулем */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      updateModule(selectedModule.id, {
                        rotation: (selectedModule.rotation + 90) % 360,
                      });
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-colors"
                    title="Повернуть модуль на 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px]">Поворот 90°</span>
                  </button>

                  <button
                    onClick={() => {
                      pushSnapshot();
                      mirrorModule(selectedModule.id);
                    }}
                    className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition-colors ${
                      selectedModule.config.isMirrored
                        ? 'bg-blue-600/20 border-blue-500/60 text-blue-300 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                    title="Отразить зеркально (сторона петель / угол)"
                  >
                    <ArrowLeftRight className={`w-3.5 h-3.5 ${selectedModule.config.isMirrored ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="text-[11px]">Зеркально</span>
                  </button>

                  <button
                    onClick={() => {
                      pushSnapshot();
                      duplicateModule(selectedModule.id);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex flex-col items-center justify-center gap-1.5 transition-colors"
                    title="Дублировать выбранный модуль"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px]">Копия</span>
                  </button>
                </div>

                {/* НАСТРОЙКИ ФУРНИТУРЫ ВЫБРАННОГО МОДУЛЯ (ПРИОРИТЕТ НАД ПРОЕКТОМ) */}
                <div className="space-y-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                        Фурнитура модуля
                      </h4>
                    </div>
                    {selectedModule.customHardware && Object.keys(selectedModule.customHardware).length > 0 && (
                      <button
                        onClick={() => {
                          pushSnapshot();
                          updateModule(selectedModule.id, { customHardware: undefined });
                        }}
                        className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                        title="Сбросить индивидуальные настройки модуля и использовать базовые из проекта"
                      >
                        Сбросить к проекту
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Индивидуальная фурнитура для этой секции. Имеет приоритет над общими настройками проекта.
                  </p>

                  {/* ПЕТЛИ (если у модуля есть распашные двери) */}
                  {(selectedModule.config.doors > 0 || selectedModule.subType === 'corner') && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                        <span>Петли фасада:</span>
                        {selectedModule.customHardware?.hinges ? (
                          <span className="text-[10px] text-amber-400 font-medium">Индивидуально</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">По умолчанию проекта</span>
                        )}
                      </label>
                      <select
                        value={selectedModule.customHardware?.hinges || ''}
                        onChange={(e) => {
                          pushSnapshot();
                          const val = e.target.value;
                          updateModuleHardware(selectedModule.id, { hinges: val ? val : undefined });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">По умолчанию из проекта ({projectSettings.defaultHinges?.includes('blum') ? 'Blum' : projectSettings.defaultHinges?.includes('hettich') ? 'Hettich' : 'Boyard'})</option>
                        <option value="hw_boyard_neo_overlay_h301">Boyard Neo с доводчиком (142 ₽)</option>
                        <option value="hw_blum_clip_top_110">Blum Clip Top Blumotion 110° (558 ₽)</option>
                        <option value="hw_hettich_sensys_8645">Hettich Sensys 8645i Silent (612 ₽)</option>
                      </select>
                    </div>
                  )}

                  {/* НАПРАВЛЯЮЩИЕ (если у модуля есть выкатные ящики) */}
                  {selectedModule.config.drawers > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                        <span>Направляющие ({selectedModule.config.drawers} ящ.):</span>
                        {selectedModule.customHardware?.drawers ? (
                          <span className="text-[10px] text-amber-400 font-medium">Индивидуально</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">По умолчанию проекта</span>
                        )}
                      </label>
                      <select
                        value={selectedModule.customHardware?.drawers || ''}
                        onChange={(e) => {
                          pushSnapshot();
                          const val = e.target.value;
                          updateModuleHardware(selectedModule.id, { drawers: val ? val : undefined });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">По умолчанию из проекта ({projectSettings.defaultDrawers?.includes('blum') ? 'Blum' : projectSettings.defaultDrawers?.includes('hettich') ? 'Hettich' : 'Boyard'})</option>
                        <option value="hw_boyard_bslide_500">Boyard B-Slide скрытого монтажа (1 700 ₽)</option>
                        <option value="hw_blum_tandembox_500">Blum Tandembox Antaro 500мм (5 760 ₽)</option>
                        <option value="hw_hettich_innotech_470">Hettich InnoTech Atira 470мм (5 100 ₽)</option>
                      </select>
                    </div>
                  )}

                  {/* ПОДЪЕМНЫЕ МЕХАНИЗМЫ (если модуль верхний или антресоль) */}
                  {(selectedModule.subType === 'wall' || selectedModule.subType === 'top' || selectedModule.id.includes('lift') || selectedModule.id.includes('antresol')) && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                        <span>Подъемный механизм:</span>
                        {selectedModule.customHardware?.lift ? (
                          <span className="text-[10px] text-amber-400 font-medium">Индивидуально</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">По умолчанию проекта</span>
                        )}
                      </label>
                      <select
                        value={selectedModule.customHardware?.lift || ''}
                        onChange={(e) => {
                          pushSnapshot();
                          const val = e.target.value;
                          updateModuleHardware(selectedModule.id, { lift: val ? val : undefined });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">По умолчанию из проекта ({projectSettings.defaultLift?.includes('blum') ? 'Blum' : projectSettings.defaultLift?.includes('hettich') ? 'Hettich' : 'Boyard'})</option>
                        <option value="hw_boyard_gaslift_80">Газлифт Boyard автоматический 80N (210 ₽)</option>
                        <option value="hw_blum_aventos_hf">Blum Aventos HF складной (16 100 ₽)</option>
                        <option value="hw_hettich_kinvaro">Hettich Kinvaro поворотный (4 800 ₽)</option>
                      </select>
                    </div>
                  )}

                  {/* РУЧКА МОДУЛЯ */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                      <span>Ручка секции:</span>
                      {selectedModule.customHardware?.handle ? (
                        <span className="text-[10px] text-amber-400 font-medium">Индивидуально</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">По умолчанию проекта</span>
                      )}
                    </label>
                    <select
                      value={selectedModule.customHardware?.handle || ''}
                      onChange={(e) => {
                        pushSnapshot();
                        const val = e.target.value;
                        updateModuleHardware(selectedModule.id, { handle: val ? val : undefined });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">По умолчанию из проекта</option>
                      <option value="hw_boyard_handle_123">Ручка-скоба черный мат 160мм (396 ₽)</option>
                      <option value="hw_handle_gola">Интегрированный Gola-профиль (1 250 ₽)</option>
                      <option value="hw_handle_pushtoopen">Push-to-Open (Tip-On) без ручек (480 ₽)</option>
                    </select>
                  </div>
                </div>

                {/* Разложить модуль на детали (Взрыв-схема + спецификация + кромка) */}
                <button
                  onClick={() => {
                    openExplodeModal(selectedModule.id);
                  }}
                  className="w-full p-2.5 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                  title="Открыть 3D взрыв-схему модуля, список деталей, кромку и расчет расхода"
                >
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>Разложить на детали (Взрыв-схема)</span>
                </button>

                {/* Открытие / закрытие фасадов и ящиков выбранного модуля */}
                <button
                  onClick={() => {
                    toggleModuleDoors(selectedModule.id);
                  }}
                  className={`w-full p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    selectedModule.config.isOpen
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold shadow-sm shadow-amber-900/20'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                >
                  <DoorOpen className="w-4 h-4 text-amber-400" />
                  {selectedModule.config.isOpen ? 'Закрыть фасады и ящики' : 'Открыть фасады и ящики'}
                </button>

                <button
                  onClick={() => {
                    pushSnapshot();
                    removeModule(selectedModule.id);
                  }}
                  className="w-full p-2.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить со сцены
                </button>
              </div>
            ) : (
              <div className="text-center py-10 px-4 text-slate-500 text-xs">
                Кликните на любой модуль на сцене, чтобы настроить его точные размеры с клавиатуры, сменить декор или повернуть.
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 4: НАСТРОЙКИ ПОМЕЩЕНИЯ (СТРОГО 2D ПЛАН) */}
        {activeTab === 'room' && (
          <div className="space-y-4">
            {/* 1. Пресеты конфигурации помещения */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Форма помещения
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    pushSnapshot();
                    setTemplate('rectangular');
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    roomData.template === 'rectangular'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Square className="w-3.5 h-3.5 text-blue-400" />
                    Прямоугольная
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">4 стены, базовая комната</span>
                </button>

                <button
                  onClick={() => {
                    pushSnapshot();
                    setTemplate('l_shaped');
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    roomData.template === 'l_shaped'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Columns className="w-3.5 h-3.5 text-blue-400" />
                    Г-образная
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">6 стен, угловая форма</span>
                </button>

                <button
                  onClick={() => {
                    pushSnapshot();
                    setTemplate('u_shaped');
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    roomData.template === 'u_shaped'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Columns className="w-3.5 h-3.5 text-blue-400 rotate-90" />
                    П-образная
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">8 стен, 3 зоны</span>
                </button>

                <button
                  onClick={() => {
                    pushSnapshot();
                    setTemplate('with_duct');
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    roomData.template === 'with_duct'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Split className="w-3.5 h-3.5 text-blue-400" />
                    С венткоробом
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Выступ в углу</span>
                </button>
              </div>
            </div>

            {/* Подсказка если стена не выбрана */}
            {!selectedWall && (
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>Кликните на любую стену на 2D-плане для её настройки или добавления окон и дверей.</span>
              </div>
            )}

            {/* 2. Инспектор выбранной стены */}
            {selectedWall && (
              <div className="p-3.5 bg-slate-800/70 rounded-xl border border-blue-500/50 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white">{selectedWall.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Выбрана
                  </span>
                </div>

                {/* КНОПКА РАЗВЁРТКИ СТЕНЫ ДЛЯ УСТАНОВКИ ЭЛЕМЕНТОВ (ВЫШЕ НАД ДЛИНОЙ СТЕНЫ) */}
                <button
                  onClick={() => openWallElevation(selectedWall.id)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all border border-blue-400/40"
                  title="Открыть вид прямо на стену (Развёртка) для точной расстановки окон, дверей, розеток и коммуникаций"
                >
                  <Maximize2 className="w-4 h-4 text-blue-200" />
                  Установить элементы (Развёртка стены)
                </button>

                {/* Длина стены */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-medium">
                    Длина стены (в мм):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <NumberInput
                      value={selectedWallLength}
                      min={300}
                      max={20000}
                      step={50}
                      onChange={(val) => {
                        pushSnapshot();
                        updateWallLength(selectedWall.id, val);
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg text-xs text-white font-mono font-bold"
                    />
                    <button
                      onClick={() => {
                        pushSnapshot();
                        updateWallLength(selectedWall.id, selectedWallLength - 100);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 font-mono font-bold"
                    >
                      -100
                    </button>
                    <button
                      onClick={() => {
                        pushSnapshot();
                        updateWallLength(selectedWall.id, selectedWallLength + 100);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 font-mono font-bold"
                    >
                      +100
                    </button>
                  </div>
                </div>

                {/* Направление удлинения стены (выбор торца) */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Удлинять в сторону:
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setWallResizeDirection('endA')}
                      className={`py-1.5 px-1 rounded text-[11px] font-medium transition-colors text-center ${
                        wallResizeDirection === 'endA'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="Удлинять стену в сторону начального угла (Торец А)"
                    >
                      Торец А
                    </button>
                    <button
                      onClick={() => setWallResizeDirection('both')}
                      className={`py-1.5 px-1 rounded text-[11px] font-medium transition-colors text-center ${
                        wallResizeDirection === 'both'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="Удлинять равномерно в обе стороны"
                    >
                      Симметрично
                    </button>
                    <button
                      onClick={() => setWallResizeDirection('endB')}
                      className={`py-1.5 px-1 rounded text-[11px] font-medium transition-colors text-center ${
                        wallResizeDirection === 'endB'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="Удлинять стену в сторону конечного угла (Торец Б)"
                    >
                      Торец Б
                    </button>
                  </div>
                </div>

                {/* Толщина перегородки (стандарт 100 мм) */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Толщина перегородки:
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[100, 150, 200].map((th) => (
                      <button
                        key={th}
                        onClick={() => {
                          pushSnapshot();
                          setWallThickness(selectedWall.id, th);
                        }}
                        className={`py-1 rounded text-[11px] font-medium transition-colors ${
                          selectedWall.thickness === th
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {th} мм {th === 100 ? '★' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Операции со стеной */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      splitWall(selectedWall.id);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-slate-700/80 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    title="Разбивает стену ровно на 2 части по одной линии с сохранением формы"
                  >
                    <Split className="w-3.5 h-3.5 text-blue-400" />
                    Разбить стену на 2 части
                  </button>

                  <button
                    onClick={() => {
                      pushSnapshot();
                      extrudeWallSegment(selectedWall.id, 350);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-medium text-blue-300 flex items-center justify-center gap-1.5 transition-colors"
                    title="Выдвинуть строгий прямоугольный уступ 90° (ниша/выступ)"
                  >
                    <Square className="w-3.5 h-3.5 text-blue-400" />
                    Выдвинуть уступ 90° (Ниша 350 мм)
                  </button>

                  {/* КНОПКА УДАЛЕНИЯ СТЕНЫ / СЕГМЕНТА */}
                  <button
                    onClick={() => {
                      pushSnapshot();
                      deleteWall(selectedWall.id);
                    }}
                    disabled={roomData.walls.length <= 3}
                    className={`w-full py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      roomData.walls.length <= 3
                        ? 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed opacity-50'
                        : 'bg-rose-600/10 hover:bg-rose-600/20 border-rose-500/30 text-rose-400'
                    }`}
                    title={
                      roomData.walls.length <= 3
                        ? 'Нельзя удалить: минимум 3 стены для контура помещения'
                        : 'Удаляет этот отрезок стены и автоматически замыкает периметр по соседним точкам'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить этот отрезок стены
                  </button>
                </div>
              </div>
            )}

            {/* 2.5. Инспектор выбранного проёма (Окно или Дверь) */}
            {selectedOpening && (
              <div className="p-3.5 bg-slate-800/80 rounded-xl border border-sky-500/60 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    {selectedOpening.type === 'window' ? (
                      <AppWindow className="w-4 h-4 text-sky-400" />
                    ) : (
                      <DoorOpen className="w-4 h-4 text-indigo-400" />
                    )}
                    <span className="text-xs font-semibold text-white">
                      {selectedOpening.type === 'window' ? 'Окно' : 'Межкомнатная дверь'}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Выбран
                  </span>
                </div>

                {/* Габариты проема */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Ширина (мм):</label>
                    <NumberInput
                      value={selectedOpening.width}
                      min={200}
                      max={4000}
                      step={50}
                      onChange={(val) => {
                        pushSnapshot();
                        updateOpening(selectedOpening.id, {
                          width: val,
                          name: `${selectedOpening.type === 'window' ? 'Окно' : 'Дверь'} ${val}×${selectedOpening.height}`,
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Высота (мм):</label>
                    <NumberInput
                      value={selectedOpening.height}
                      min={200}
                      max={3500}
                      step={50}
                      onChange={(val) => {
                        pushSnapshot();
                        updateOpening(selectedOpening.id, {
                          height: val,
                          name: `${selectedOpening.type === 'window' ? 'Окно' : 'Дверь'} ${selectedOpening.width}×${val}`,
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Подоконник (для окон) */}
                {selectedOpening.type === 'window' ? (
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Высота подоконника от пола (мм):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <NumberInput
                        value={selectedOpening.sillHeight}
                        min={0}
                        max={1800}
                        step={20}
                        onChange={(val) => {
                          pushSnapshot();
                          updateOpening(selectedOpening.id, { sillHeight: val });
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-500"
                      />
                      {[750, 850, 900].map((h) => (
                        <button
                          key={h}
                          onClick={() => {
                            pushSnapshot();
                            updateOpening(selectedOpening.id, { sillHeight: h });
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                            selectedOpening.sillHeight === h
                              ? 'bg-sky-600 text-white font-bold'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>

                    {/* Наличие подоконника */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-300 font-medium">Подоконник:</span>
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-700">
                        <button
                          onClick={() => {
                            pushSnapshot();
                            updateOpening(selectedOpening.id, { hasSill: true });
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            selectedOpening.hasSill !== false ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Есть (выступ 50 мм)
                        </button>
                        <button
                          onClick={() => {
                            pushSnapshot();
                            updateOpening(selectedOpening.id, { hasSill: false });
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            selectedOpening.hasSill === false ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Без выступа
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Направление открывания (для дверей) */
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Направление открывания:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          pushSnapshot();
                          updateOpening(selectedOpening.id, { doorSwing: 'left' });
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                          selectedOpening.doorSwing !== 'right'
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Петли слева
                      </button>
                      <button
                        onClick={() => {
                          pushSnapshot();
                          updateOpening(selectedOpening.id, { doorSwing: 'right' });
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                          selectedOpening.doorSwing === 'right'
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Петли справа
                      </button>
                    </div>
                  </div>
                )}

                {/* Положение вдоль стены (Слайдер + Привязка к углам) */}
                {(() => {
                  const wall = roomData.walls.find((w) => w.id === selectedOpening.wallId);
                  const wallLen = wall ? getWallLength(wall, vMap) : 3000;
                  const minOffset = Math.round(selectedOpening.width / 2 + 50);
                  const maxOffset = Math.max(minOffset, Math.round(wallLen - selectedOpening.width / 2 - 50));
                  const distFromA = Math.max(0, Math.round(selectedOpening.offsetFromStart - selectedOpening.width / 2));
                  const distToB = Math.max(0, Math.round(wallLen - (selectedOpening.offsetFromStart + selectedOpening.width / 2)));

                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">Положение вдоль стены:</span>
                        <span className="text-sky-300 font-mono font-bold">
                          {selectedOpening.offsetFromStart} мм
                        </span>
                      </div>

                      <input
                        type="range"
                        min={minOffset}
                        max={maxOffset}
                        step={10}
                        value={selectedOpening.offsetFromStart}
                        onChange={(e) => {
                          updateOpening(selectedOpening.id, { offsetFromStart: Number(e.target.value) });
                        }}
                        onMouseUp={() => pushSnapshot()}
                        className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
                      />

                      {/* Точные привязки к углам */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                        <span>До угла А: <strong className="text-slate-200">{distFromA} мм</strong></span>
                        <span>До угла Б: <strong className="text-slate-200">{distToB} мм</strong></span>
                      </div>
                    </div>
                  );
                })()}

                {/* Кнопка удаления проёма */}
                <button
                  onClick={() => {
                    pushSnapshot();
                    removeOpening(selectedOpening.id);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-xs font-medium text-rose-400 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Удалить этот проём
                </button>
              </div>
            )}

            {/* 3. Инспектор выбранного венткороба / колонны */}
            {selectedColumn && (
              <div className="p-3.5 bg-slate-800/70 rounded-xl border border-sky-500/50 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Columns className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-semibold text-white">{selectedColumn.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    Венткороб
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Ширина (мм):</label>
                    <NumberInput
                      value={selectedColumn.width}
                      min={100}
                      max={2000}
                      step={50}
                      onChange={(val) => {
                        pushSnapshot();
                        updateColumn(selectedColumn.id, { width: val });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Глубина (мм):</label>
                    <NumberInput
                      value={selectedColumn.depth}
                      min={100}
                      max={2000}
                      step={50}
                      onChange={(val) => {
                        pushSnapshot();
                        updateColumn(selectedColumn.id, { depth: val });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      pushSnapshot();
                      updateColumn(selectedColumn.id, { rotation: (selectedColumn.rotation + 90) % 360 });
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Поворот 90°
                  </button>

                  <button
                    onClick={() => {
                      pushSnapshot();
                      removeColumn(selectedColumn.id);
                    }}
                    className="py-1.5 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-1 transition-colors"
                    title="Удалить короб"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {!selectedWall && !selectedColumn && !selectedOpening && (
              <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/40 text-center py-4 text-xs text-slate-400">
                Кликните на любую стену, проём или перетаскивайте венткороб мышью на 2D-плане.
              </div>
            )}

            {/* 4. Архитектурные элементы (Венткоробы, Окна, Двери) */}
            <div className="space-y-3">
              {/* Окна и двери */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Окна и двери ({roomData.openings?.length || 0} шт.)
                  </h4>
                </div>

                {roomData.openings && roomData.openings.length > 0 ? (
                  <div className="space-y-1.5">
                    {roomData.openings.map((op) => {
                      const isOpSelected = op.id === roomData.selectedOpeningId;
                      return (
                        <button
                          key={op.id}
                          onClick={() => {
                            selectOpening(op.id);
                            selectWall(op.wallId);
                          }}
                          className={`w-full px-3 py-2 rounded-lg border text-left text-xs flex items-center justify-between transition-all ${
                            isOpSelected
                              ? 'bg-sky-600/20 border-sky-500 text-sky-200 font-semibold'
                              : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {op.type === 'window' ? (
                              <AppWindow className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            ) : (
                              <DoorOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            )}
                            <span className="truncate">{op.name}</span>
                          </div>
                          <span className="font-mono text-slate-400 shrink-0">
                            {op.width}×{op.height} мм
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 bg-slate-800/30 p-2.5 rounded-lg border border-slate-800/60 text-center">
                    Нет проёмов. Выберите стену и нажмите «+ Окно» или «+ Дверь».
                  </div>
                )}
              </div>

              {/* Венткоробы и колонны */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Венткоробы и колонны
                  </h4>
                  <button
                    onClick={() => {
                      pushSnapshot();
                      addColumn(400, 400);
                    }}
                    className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Добавить короб
                  </button>
                </div>

                {roomData.columns && roomData.columns.length > 0 ? (
                  <div className="space-y-1.5">
                    {roomData.columns.map((col) => {
                      const isColSelected = col.id === roomData.selectedColumnId;
                      return (
                        <button
                          key={col.id}
                          onClick={() => selectColumn(col.id)}
                          className={`w-full px-3 py-2 rounded-lg border text-left text-xs flex items-center justify-between transition-all ${
                            isColSelected
                              ? 'bg-sky-600/20 border-sky-500 text-sky-200 font-semibold'
                              : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Columns className="w-3.5 h-3.5 text-sky-400" />
                            <span>{col.name}</span>
                          </div>
                          <span className="font-mono text-slate-400">
                            {col.width}×{col.depth} мм
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 bg-slate-800/30 p-2.5 rounded-lg border border-slate-800/60 text-center">
                    Нет венткоробов. Нажмите «Добавить короб», чтобы установить вентиляционный короб или колонну.
                  </div>
                )}
              </div>
            </div>

            {/* Общая высота потолка */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 space-y-2">
              <label className="text-xs text-slate-400 block font-medium">Высота потолков (в мм):</label>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={roomData.height}
                  min={1800}
                  max={5000}
                  step={50}
                  onChange={(val) => {
                    pushSnapshot();
                    setCeilingHeight(val);
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold"
                />
                <span className="text-xs text-slate-500 font-mono">мм</span>
              </div>
            </div>

            {/* 7. Отделка помещения */}
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Отделка помещения
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  pushSnapshot();
                  setRoomStoreColors('#C2A17E', '#E2E8F0');
                }}
                className="p-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-left hover:bg-slate-700/80 transition-colors"
              >
                <span className="block font-medium text-slate-200">Дуб + Светлый</span>
                <span className="text-[10px] text-slate-400">Скандинавский</span>
              </button>
              <button
                onClick={() => {
                  pushSnapshot();
                  setRoomStoreColors('#64748B', '#334155');
                }}
                className="p-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-left hover:bg-slate-700/80 transition-colors"
              >
                <span className="block font-medium text-slate-200">Бетон + Графит</span>
                <span className="text-[10px] text-slate-400">Стиль Лофт</span>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ПРАВАЯ КОЛОНКА ПОДКАТЕГОРИЙ И КАРТОЧЕК МОДЕЛЕЙ (ОТКРЫВАЕТСЯ СПРАВА, С КРАСНОЙ ПОЛОСОЙ) */}
      {activeTab === 'catalog' && isSubcategoryPanelOpen && (
        <div className="w-80 md:w-[324px] bg-slate-950/95 border-r border-slate-800 flex flex-col shrink-0 h-full border-l-2 border-rose-500 shadow-2xl relative">
          {/* Шапка второй колонки */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">Категория</div>
              <div className="text-xs font-bold text-slate-100 truncate">
                {activeCategoryDef?.name}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleAllSubcategories}
                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Свернуть / Развернуть все подкатегории"
              >
                {activeCategoryDef?.subcategories.some((s) => openSubcategories[s.id] !== false)
                  ? 'Свернуть все'
                  : 'Развернуть все'}
              </button>
              <button
                onClick={() => setIsSubcategoryPanelOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Закрыть панель моделей"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Список подкатегорий (аккордеон) и карточек моделей */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Быстрый доступ к Редактору мебельных секций */}
            <div className="p-2.5 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 rounded-xl flex items-center justify-between gap-2 shadow-xs">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                  <Wrench className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Редактор секций</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Полки, стойки, наполнение, детали
                </div>
              </div>
              <button
                onClick={() => openSectionEditor()}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 shadow-sm transition-all"
              >
                + Создать
              </button>
            </div>

            {/* Пользовательские секции, созданные в редакторе для этой категории */}
            {customTemplates.filter((t) => t.mainGroup === catalogMainGroup).length > 0 && !catalogSearch && (
              <div className="rounded-xl border border-purple-500/40 bg-purple-950/20 overflow-hidden shadow-xs">
                <div className="py-2.5 px-3 flex items-center justify-between text-left bg-purple-900/30 border-b border-purple-500/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-bold text-purple-200">Мои сборки (Кастом)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-700">
                      {customTemplates.filter((t) => t.mainGroup === catalogMainGroup).length}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 grid grid-cols-2 gap-2">
                  {customTemplates
                    .filter((t) => t.mainGroup === catalogMainGroup)
                    .map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/json',
                            JSON.stringify({ templateId: item.id, width: item.defaultDimensions.width })
                          );
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="flex flex-col items-center bg-slate-900/90 hover:bg-slate-850 p-2.5 rounded-xl border border-purple-500/40 hover:border-purple-400 shadow-sm transition-all cursor-grab active:cursor-grabbing group relative"
                        onClick={() => handleAddModule(item)}
                      >
                        <div className="w-full relative">
                          <ModuleThumbnail template={item} width={item.defaultDimensions.width} />
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-purple-600 text-white rounded-md shadow">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        {/* Узкая строчка под превью с обозначением секции */}
                        <div className="w-full mt-1.5 px-1 py-0.5 rounded-md bg-purple-950/80 border border-purple-500/40 text-center shadow-xs flex items-center justify-center">
                          <span className="text-[11px] font-mono font-bold text-purple-300 tracking-wider truncate" title={item.name}>
                            {item.code || getModuleCode(item) || item.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-300 font-medium truncate w-full text-center mt-0.5 px-0.5" title={item.name}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {item.defaultDimensions.width}×{item.defaultDimensions.height}×{item.defaultDimensions.depth} мм
                        </div>
                        <div className="flex items-center justify-between w-full mt-2 pt-1 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openSectionEditor(item.id)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                            title="Открыть и изменить в 3D редакторе"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Изменить</span>
                          </button>
                          <button
                            onClick={() => deleteCustomSection(item.id)}
                            className="text-[10px] text-slate-500 hover:text-rose-400"
                            title="Удалить из библиотеки"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {catalogSearch ? (
              /* РЕЖИМ ПОИСКА */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
                  <span>Результаты поиска: {filteredCatalog.length}</span>
                  <button
                    onClick={() => setCatalogSearch('')}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Сбросить
                  </button>
                </div>


                {/* Авто-построение фартука вдоль всего ряда */}
                {catalogMainGroup === 'backsplash' && (
                  <div className="p-3 mb-3 bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/40 rounded-xl space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Авто-построение фартука
                      </span>
                      <span className="text-[10px] text-blue-300 font-mono">H 600 мм (860..1460)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      Автоматически строит стеновую панель фартука строго вдоль установленного ряда нижних секций.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">Толщина:</span>
                      {[4, 6, 8].map((th) => (
                        <button
                          key={th}
                          onClick={() => {
                            pushSnapshot();
                            generateAutoBacksplash(th);
                          }}
                          className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm transition-all text-center"
                        >
                          {th} мм
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filteredCatalog.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredCatalog.map((item) => {
                      const activeWidth = selectedWidths[item.id] ?? item.defaultDimensions.width;
                      const stdWidths = item.standardWidths ?? [item.defaultDimensions.width];
                      return (
                        <div
                          key={item.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/json',
                              JSON.stringify({ templateId: item.id, width: activeWidth })
                            );
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => handleAddModule(item, activeWidth)}
                          className="flex flex-col items-center bg-slate-900/90 hover:bg-slate-800/90 p-2 rounded-xl border border-slate-800 hover:border-blue-500/70 shadow-sm transition-all cursor-grab active:cursor-grabbing group select-none relative"
                          title={`${item.name} (${activeWidth} мм) — ${item.basePrice.toLocaleString('ru-RU')} ₽`}
                        >
                          <div className="w-full relative">
                            <ModuleThumbnail template={item} width={activeWidth} />
                            {item.mainGroup === 'tall' && (
                              <div
                                className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shadow-xs z-10 pointer-events-none ${
                                  item.defaultDimensions.height === 2180
                                    ? 'bg-blue-900/90 text-blue-200 border border-blue-700/70'
                                    : 'bg-indigo-900/90 text-indigo-200 border border-indigo-700/70'
                                }`}
                              >
                                H {item.defaultDimensions.height}
                              </div>
                            )}
                            {item.mainGroup === 'top' && (
                              <div
                                className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shadow-xs z-10 pointer-events-none ${
                                  item.defaultDimensions.height === 360
                                    ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-700/70'
                                    : 'bg-teal-900/90 text-teal-200 border border-teal-700/70'
                                }`}
                              >
                                H {item.defaultDimensions.height}
                              </div>
                            )}
                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-blue-600 text-white rounded-md shadow">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          {/* Узкая строчка под превью с названием секции */}
                          <div className="w-full mt-1.5 px-1 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-center shadow-xs flex items-center justify-center">
                            <span className="text-[11px] font-mono font-bold text-blue-400 tracking-wider truncate" title={item.name}>
                              {item.code || getModuleCode(item) || item.name}
                            </span>
                          </div>

                          <div
                            className="text-[10px] text-slate-400 font-medium truncate w-full text-center mt-0.5 px-0.5"
                            title={item.name}
                          >
                            {item.name.includes('·') ? item.name.split('·')[1].trim() : item.name.replace(/^[А-ЯЁ0-9-]+(\s*\(|\s*·\s*)/, '').replace(/\)$/, '')}
                          </div>

                          <div className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={activeWidth}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSelectedWidths((prev) => ({ ...prev, [item.id]: val }));
                              }}
                              className="w-full py-1 px-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs transition-colors"
                            >
                              {stdWidths.map((w) => (
                                <option key={w} value={w}>
                                  {w} мм
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400">
                    По запросу «{catalogSearch}» ничего не найдено
                  </div>
                )}
              </div>
            ) : (
              /* РЕЖИМ АККОРДЕОНА ПОДКАТЕГОРИЙ */
              activeCategoryDef?.subcategories.map((sub) => {
                const isOpen = openSubcategories[sub.id] !== false;
                const subItems = CATALOG_ITEMS.filter(
                  (i) => i.category === 'kitchen' && i.mainGroup === catalogMainGroup && i.subGroup === sub.id
                );

                return (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/50 overflow-hidden shadow-xs"
                  >
                    {/* Заголовок аккордеона подкатегории */}
                    <button
                      onClick={() => toggleSubcategory(sub.id)}
                      className="w-full py-2.5 px-3 flex items-center justify-between text-left hover:bg-slate-850 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-200 truncate">{sub.name}</span>
                        {subItems.length > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-blue-300 border border-slate-700">
                            {subItems.length}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Выпадающий контент подкатегории (открывается вниз) */}
                    {isOpen && (
                      <div className="p-2.5 pt-1 space-y-2 border-t border-slate-800/50">
                        {/* Сетка превьюшек моделей в 2 колонки (в точности как на скриншоте) */}
                        {subItems.length > 0 ? (
                          <div>
                            {catalogMainGroup === 'tall' && (
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-blue-950/60 border border-blue-800/70 text-center shadow-xs">
                                  <span className="text-[11px] font-bold text-blue-300 leading-tight">H 2180 мм</span>
                                  <span className="text-[9px] text-slate-400 leading-tight">под навесные 720</span>
                                </div>
                                <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-indigo-950/60 border border-indigo-800/70 text-center shadow-xs">
                                  <span className="text-[11px] font-bold text-indigo-300 leading-tight">H 2380 мм</span>
                                  <span className="text-[9px] text-slate-400 leading-tight">под навесные 920</span>
                                </div>
                              </div>
                            )}

                            {catalogMainGroup === 'top' && (
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-center shadow-xs">
                                  <span className="text-[11px] font-bold text-emerald-300 leading-tight">H 360 мм</span>
                                  <span className="text-[9px] text-slate-400 leading-tight">под потолок ~2.55 м</span>
                                </div>
                                <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-teal-950/60 border border-teal-800/70 text-center shadow-xs">
                                  <span className="text-[11px] font-bold text-teal-300 leading-tight">H 460 мм</span>
                                  <span className="text-[9px] text-slate-400 leading-tight">под высокий потолок</span>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              {subItems.map((item) => {
                                const activeWidth = selectedWidths[item.id] ?? item.defaultDimensions.width;
                                const stdWidths = item.standardWidths ?? [item.defaultDimensions.width];

                                return (
                                  <div
                                    key={item.id}
                                    draggable={true}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData(
                                        'application/json',
                                        JSON.stringify({ templateId: item.id, width: activeWidth })
                                      );
                                      e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onClick={() => handleAddModule(item, activeWidth)}
                                    className="flex flex-col items-center bg-slate-900/90 hover:bg-slate-850 p-2 rounded-xl border border-slate-800 hover:border-blue-500/70 shadow-sm transition-all cursor-grab active:cursor-grabbing group select-none relative"
                                    title={`${item.name} (${activeWidth} мм) — ${item.basePrice.toLocaleString('ru-RU')} ₽`}
                                  >
                                    {/* 3D Изометрическая миниатюра (крупная) */}
                                    <div className="w-full relative">
                                      <ModuleThumbnail template={item} width={activeWidth} />
                                      {item.mainGroup === 'tall' && (
                                        <div
                                          className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shadow-xs z-10 pointer-events-none ${
                                            item.defaultDimensions.height === 2180
                                              ? 'bg-blue-900/90 text-blue-200 border border-blue-700/70'
                                              : 'bg-indigo-900/90 text-indigo-200 border border-indigo-700/70'
                                          }`}
                                        >
                                          H {item.defaultDimensions.height}
                                        </div>
                                      )}
                                      {item.mainGroup === 'top' && (
                                        <div
                                          className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shadow-xs z-10 pointer-events-none ${
                                            item.defaultDimensions.height === 360
                                              ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-700/70'
                                              : 'bg-teal-900/90 text-teal-200 border border-teal-700/70'
                                          }`}
                                        >
                                          H {item.defaultDimensions.height}
                                        </div>
                                      )}
                                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-blue-600 text-white rounded-md shadow">
                                        <Plus className="w-3.5 h-3.5" />
                                      </div>
                                    </div>

                                    {/* Узкая строчка под превью с названием секции */}
                                    <div className="w-full mt-1.5 px-1 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-center shadow-xs flex items-center justify-center">
                                      <span className="text-[11px] font-mono font-bold text-blue-400 tracking-wider truncate" title={item.name}>
                                        {item.code || getModuleCode(item) || item.name}
                                      </span>
                                    </div>

                                    <div
                                      className="text-[10px] text-slate-400 font-medium truncate w-full text-center mt-0.5 px-0.5"
                                      title={item.name}
                                    >
                                      {item.name.includes('·') ? item.name.split('·')[1].trim() : item.name.replace(/^[А-ЯЁ0-9-]+(\s*\(|\s*·\s*)/, '').replace(/\)$/, '')}
                                    </div>

                                    {/* Выпадающий список типоразмеров строго под превью */}
                                    <div className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
                                      <select
                                        value={activeWidth}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          setSelectedWidths((prev) => ({ ...prev, [item.id]: val }));
                                        }}
                                        className="w-full py-1 px-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs transition-colors"
                                      >
                                        {stdWidths.map((w) => (
                                          <option key={w} value={w}>
                                            {w} мм
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 text-center rounded-lg bg-slate-950/40 border border-slate-800/40 text-[10px] text-slate-500">
                            Модули этой подкатегории будут добавлены на следующих этапах разработки.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
