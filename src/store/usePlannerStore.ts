import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  FurnitureModule,
  RoomConfig,
  PlannerMode,
  ActiveTool,
  FurnitureCategory,
  Vector3D,
  ProjectSettings,
  DEFAULT_PROJECT_SETTINGS,
  ViewDisplayMode,
} from '../types';
import { CatalogItemTemplate, CATALOG_ITEMS } from '../data/catalog';
import { DEFAULT_MATERIALS } from '../data/materials';
import { useRoomStore } from './useRoomStore';
import { useMaterialsStore } from './useMaterialsStore';
import { buildVertexMap, getInwardWallNormal, isBoxInsideRoom } from '../utils/roomGeometry';
import { findCollinearChains } from '../core/3d/chainMerging';

interface PlannerState {
  // Параметры проекта (кухни)
  projectSettings: ProjectSettings;
  isProjectSettingsOpen: boolean;
  openProjectSettings: () => void;
  closeProjectSettings: () => void;
  updateProjectSettings: (updates: Partial<ProjectSettings>, applyToExistingModules?: boolean) => void;
  resetProjectSettings: () => void;
  resetToNewProject: (newSettings?: ProjectSettings) => void;

  // Помещение
  room: RoomConfig;
  setRoomDimensions: (width: number, length: number, height: number) => void;
  setRoomColors: (floorColor?: string, wallColor?: string) => void;

  // Модули мебели
  modules: FurnitureModule[];
  selectedModuleId: string | null;
  selectModule: (id: string | null) => void;
  addModule: (template: CatalogItemTemplate, customPos?: Vector3D, customDimensions?: { width?: number; height?: number; depth?: number }) => FurnitureModule | null;
  updateModule: (id: string, updates: Partial<FurnitureModule>) => void;
  updateModuleDimensions: (id: string, width: number, height: number, depth: number) => void;
  removeModule: (id: string) => void;
  clearAllModules: () => void;
  generateAutoBacksplash: (thickness?: number) => void;
  duplicateModule: (id: string) => void;
  mirrorModule: (id: string) => void;

  // Деталировка модуля (Взрыв-схема)
  isExplodeModalOpen: boolean;
  explodeModuleId: string | null;
  openExplodeModal: (id?: string) => void;
  closeExplodeModal: () => void;

  // Редактор мебельных секций (Section Editor)
  customTemplates: CatalogItemTemplate[];
  isSectionEditorOpen: boolean;
  sectionEditorTemplateId: string | null;
  sectionEditorModuleId: string | null;
  openSectionEditor: (templateId?: string, fromModuleId?: string) => void;
  closeSectionEditor: () => void;
  saveCustomSection: (template: CatalogItemTemplate) => void;
  deleteCustomSection: (id: string) => void;
  getAllCatalogItems: () => CatalogItemTemplate[];

  // Интеграция с Базис-Мебельщик
  isBazisModalOpen: boolean;
  openBazisModal: () => void;
  closeBazisModal: () => void;

  // Интерактив (двери/ящики)
  areDoorsOpen: boolean;
  toggleDoors: () => void;
  toggleModuleDoors: (id: string) => void;

  // Режимы отображения сцены (Вид: Без размеров / С размерами / Контуры)
  viewDisplayMode: ViewDisplayMode;
  showDimensions: boolean;
  setViewDisplayMode: (mode: ViewDisplayMode) => void;
  setShowDimensions: (show: boolean) => void;

  // Режим контуров мебели (Рентген / X-Ray) для просмотра розеток и коммуникаций за мебелью
  isWireframeMode: boolean;
  toggleWireframeMode: () => void;
  setWireframeMode: (val: boolean) => void;

  // Режимы и инструменты
  mode: PlannerMode;
  setMode: (mode: PlannerMode) => void;
  activeSidebarTab: 'catalog' | 'materials' | 'properties' | 'room';
  setActiveSidebarTab: (tab: 'catalog' | 'materials' | 'properties' | 'room') => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  activeCategory: FurnitureCategory;
  setActiveCategory: (category: FurnitureCategory) => void;

  // Глобальные материалы
  globalMaterials: {
    carcass: string;
    facade: string;
    countertop: string;
    handle?: string;
  };
  setGlobalMaterial: (type: 'carcass' | 'facade' | 'countertop' | 'handle', materialId: string) => void;

  // Окно сметы и услуги
  isSmetaOpen: boolean;
  openSmeta: () => void;
  closeSmeta: () => void;
  smetaServices: {
    assembly: boolean;
    install: boolean;
    delivery: boolean;
    deliveryType: 'city' | 'suburb' | 'pickup';
    floorLift: boolean;
    floorNumber: number;
    hasFreightElevator: boolean;
    sinkCutout: boolean;
    hobCutout: boolean;
  };
  updateSmetaServices: (services: Partial<PlannerState['smetaServices']>) => void;
  updateModuleHardware: (moduleId: string, hardware: Partial<NonNullable<FurnitureModule['customHardware']>>) => void;

  // Расчёт стоимости (Смета)
  calculateTotalPrice: () => {
    modulesTotal: number;
    countertopTotal: number;
    apronTotal: number;
    hardwareTotal: number;
    servicesTotal: number;
    assemblyTotal: number;
    installTotal: number;
    deliveryTotal: number;
    floorLiftTotal: number;
    cutoutsTotal: number;
    grandTotal: number;
    hardwareBreakdown: {
      hingesCount: number;
      hingesTotal: number;
      drawersCount: number;
      drawersTotal: number;
      liftsCount: number;
      liftsTotal: number;
      handlesCount: number;
      handlesTotal: number;
    };
  };

  // Экспорт / Импорт проекта
  exportProjectJson: () => string;
  importProjectJson: (jsonStr: string) => boolean;
}

const DEFAULT_ROOM: RoomConfig = {
  walls: [],
  width: 4000,   // 4 метра
  length: 3000,  // 3 метра
  height: 2700,  // 2.7 метра
  floorColor: '#C2A17E',
  wallColor: '#E2E8F0',
};

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
  projectSettings: DEFAULT_PROJECT_SETTINGS,
  isProjectSettingsOpen: false,
  openProjectSettings: () => set({ isProjectSettingsOpen: true }),
  closeProjectSettings: () => set({ isProjectSettingsOpen: false }),
  updateProjectSettings: (updates, applyToExistingModules = false) =>
    set((state) => {
      const nextSettings = { ...state.projectSettings, ...updates };
      let nextModules = state.modules;

      if (applyToExistingModules) {
        nextModules = state.modules.map((m) => {
          if (m.subType === 'base' || m.subType === 'corner') {
            const newH = nextSettings.baseBodyHeight + (nextSettings.hasPlinth ? nextSettings.plinthHeight : 0);
            return {
              ...m,
              dimensions: {
                ...m.dimensions,
                height: newH,
                depth: nextSettings.countertopDepth,
              },
            };
          } else if (m.subType === 'wall') {
            return {
              ...m,
              position: {
                ...m.position,
                y: nextSettings.upperBaseStartHeight,
              },
              dimensions: {
                ...m.dimensions,
                depth: nextSettings.upperBodyDepth,
              },
            };
          } else if (m.subType === 'tall' || (m as any).mainGroup === 'tall' || m.id.startsWith('k_tall_')) {
            const isGola = nextSettings.countertopFrontOverhang === 36;
            const targetD = isGola ? 564 : 550;
            return {
              ...m,
              dimensions: {
                ...m.dimensions,
                depth: targetD,
              },
            };
          } else if (m.subType === 'top' || (m as any).mainGroup === 'top' || m.id.startsWith('k_top_')) {
            if (m.dimensions.depth > 400) {
              const isGola = nextSettings.countertopFrontOverhang === 36;
              const targetD = isGola ? 564 : 550;
              return {
                ...m,
                dimensions: {
                  ...m.dimensions,
                  depth: targetD,
                },
              };
            }
          }
          return m;
        });
      }

      return {
        projectSettings: nextSettings,
        modules: nextModules,
      };
    }),
  resetProjectSettings: () => set({ projectSettings: DEFAULT_PROJECT_SETTINGS }),
  resetToNewProject: (newSettings) =>
    set((state) => ({
      modules: [],
      selectedModuleId: null,
      areDoorsOpen: false,
      isWireframeMode: false,
      viewDisplayMode: 'dimensions',
      showDimensions: true,
      mode: '3D',
      projectSettings: newSettings ? { ...newSettings } : state.projectSettings,
      isProjectSettingsOpen: false,
    })),

  room: DEFAULT_ROOM,

  setRoomDimensions: (width, length, height) =>
    set((state) => ({
      room: { ...state.room, width, length, height },
    })),

  setRoomColors: (floorColor, wallColor) =>
    set((state) => ({
      room: {
        ...state.room,
        floorColor: floorColor ?? state.room.floorColor,
        wallColor: wallColor ?? state.room.wallColor,
      },
    })),

  modules: [],
  selectedModuleId: null,

  selectModule: (id) => set({ selectedModuleId: id }),

  addModule: (template, customPos, customDimensions) => {
    const { modules, room, globalMaterials, projectSettings } = get();

    const isWall = template.mainGroup === 'wall' || template.subType === 'wall' || template.id.startsWith('k_wall_');
    const isTop = template.mainGroup === 'top' || template.subType === 'top' || template.id.startsWith('k_top_');
    const isTall = template.mainGroup === 'tall' || template.subType === 'tall' || template.id.startsWith('k_tall_');
    const isBacksplash = template.mainGroup === 'backsplash' || template.subType === 'backsplash' || template.id.startsWith('k_backsplash_');
    const isGola = projectSettings.countertopFrontOverhang === 36;

    // Расчет высоты установки 3-го яруса антресолей
    let topElevation = 2180;
    const hasTall2380 = modules.some((m) => m.dimensions.height === 2380 || m.id.includes('2380'));
    const hasWall920 = modules.some((m) => (m.subType === 'wall' || m.id.startsWith('k_wall_')) && m.dimensions.height === 920);
    if (hasTall2380 || hasWall920) {
      topElevation = 2380;
    }

    // Размеры с учетом настроек проекта и переданных пользовательских размеров
    let dimWidth = customDimensions?.width ?? template.defaultDimensions.width;
    let dimHeight = customDimensions?.height ?? template.defaultDimensions.height;
    let dimDepth = customDimensions?.depth ?? template.defaultDimensions.depth;

    if (isTop) {
      if (!customDimensions?.depth) {
        // Глубокие антресоли (глубина > 400 мм) адаптируются под Gola (564 мм) или накладные ручки (550 мм)
        dimDepth = template.defaultDimensions.depth > 400 ? (isGola ? 564 : 550) : 320;
      }
    } else if (isTall) {
      if (!customDimensions?.depth) {
        // Пеналы строго равняются по переднему краю с базами: 564 мм под Gola, 550 мм под накладные ручки
        dimDepth = isGola ? 564 : 550;
      }
    } else if (isWall) {
      if (!customDimensions?.height) {
        dimHeight = template.defaultDimensions.height;
      }
      if (!customDimensions?.depth) {
        dimDepth = projectSettings.upperBodyDepth ?? template.defaultDimensions.depth ?? 320;
      }
    } else {
      const isCustomOrBazis = Boolean(template.id?.startsWith('bazis_')) || Boolean(template.defaultConfig?.customParts?.length);
      if (!customDimensions?.height) {
        if (!isCustomOrBazis && (template.subType === 'base' || template.subType === 'corner')) {
          dimHeight = projectSettings.baseBodyHeight + (projectSettings.hasPlinth ? projectSettings.plinthHeight : 0);
        }
      }
      if (!customDimensions?.depth) {
        if (!isCustomOrBazis && (template.subType === 'base' || template.subType === 'corner')) {
          dimDepth = projectSettings.countertopDepth;
        }
      }
    }

    // Получаем реальную геометрию помещения из useRoomStore
    const roomData = useRoomStore.getState().room;
    const vertices = roomData?.vertices || [];
    const walls = roomData?.walls || [];
    const vMap = buildVertexMap(vertices);

    let posX = 0;
    const baseElevation = projectSettings.baseBodyHeight + (projectSettings.hasPlinth ? projectSettings.plinthHeight : 0);
    let posY = isTop ? topElevation : (isWall ? projectSettings.upperBaseStartHeight : (isBacksplash ? baseElevation : 0));
    let posZ = 0;
    let rotation = 0;

    const WALL_GAP = 2;

    if (customPos) {
      posX = customPos.x;
      posY = isTop ? (customPos.y ?? topElevation) : (isWall ? projectSettings.upperBaseStartHeight : (isBacksplash ? (customPos.y ?? baseElevation) : (customPos.y ?? 0)));
      posZ = customPos.z;

      // Если в помещении есть стены, привязываем модуль к ближайшей стене с правильным разворотом
      if (walls.length > 0) {
        let closestWall = null;
        let minSurfaceDist = Infinity;
        let bestInwardNormal = { nx: 0, nz: 1 };
        let bestWallProj = { px: 0, pz: 0, t: 0, wallLen: 0, ux: 0, uz: 0 };

        for (const wall of walls) {
          const v1 = vMap[wall.startVertexId];
          const v2 = vMap[wall.endVertexId];
          if (!v1 || !v2) continue;

          const dx = v2.x - v1.x;
          const dz = v2.z - v1.z;
          const wallLen = Math.hypot(dx, dz);
          if (wallLen < 5) continue;

          const ux = dx / wallLen;
          const uz = dz / wallLen;
          const t = (posX - v1.x) * ux + (posZ - v1.z) * uz;
          const tClamped = Math.max(0, Math.min(wallLen, t));
          const px = v1.x + ux * tClamped;
          const pz = v1.z + uz * tClamped;

          const dist = Math.hypot(posX - px, posZ - pz);
          if (dist < minSurfaceDist) {
            minSurfaceDist = dist;
            closestWall = wall;
            bestInwardNormal = getInwardWallNormal(wall, vMap, vertices);
            bestWallProj = { px, pz, t, wallLen, ux, uz };
          }
        }

        // Для верхних навесных шкафов ВСЕГДА монтируем к ближайшей стене, для баз — если рядом со стене (< 700 мм)
        if (closestWall && (isWall || isTop || isBacksplash || minSurfaceDist < 700)) {
          const rawAngleRad = Math.atan2(bestInwardNormal.nx, bestInwardNormal.nz);
          let deg = Math.round(((rawAngleRad * 180) / Math.PI + 360) % 360);
          if (Math.abs(deg - 0) < 5 || Math.abs(deg - 360) < 5) deg = 0;
          else if (Math.abs(deg - 90) < 5) deg = 90;
          else if (Math.abs(deg - 180) < 5) deg = 180;
          else if (Math.abs(deg - 270) < 5) deg = 270;
          rotation = deg;

          const distCenter = dimDepth / 2 + WALL_GAP;
          const clampWallMin = dimWidth / 2 + WALL_GAP;
          const clampWallMax = bestWallProj.wallLen - dimWidth / 2 - WALL_GAP;
          const tFinal = Math.max(clampWallMin, Math.min(clampWallMax, bestWallProj.t));

          const v1 = vMap[closestWall.startVertexId];
          posX = Math.round(v1.x + bestWallProj.ux * tFinal + bestInwardNormal.nx * distCenter);
          posZ = Math.round(v1.z + bestWallProj.uz * tFinal + bestInwardNormal.nz * distCenter);
        }
      }
    } else {
      // Добавление по клику из каталога
      const sameTierModules = modules.filter((m) => {
        if (isTop) {
          return m.subType === 'top' || m.id.startsWith('k_top_') || (m as any).mainGroup === 'top';
        }
        if (isWall) {
          return m.subType === 'wall' || m.id.startsWith('k_wall_') || (m as any).mainGroup === 'wall';
        }
        return m.subType !== 'wall' && m.subType !== 'top' && !m.id.startsWith('k_wall_') && !m.id.startsWith('k_top_');
      });

      if (sameTierModules.length > 0) {
        const lastMod = sameTierModules[sameTierModules.length - 1];
        const lastRot = (lastMod.rotation || 0) % 360;
        const lastRotRad = (lastRot * Math.PI) / 180;
        const shiftDist = (lastMod.dimensions.width + dimWidth) / 2;

        const candidateX = Math.round(lastMod.position.x + Math.cos(lastRotRad) * shiftDist);
        const candidateZ = Math.round(lastMod.position.z - Math.sin(lastRotRad) * shiftDist);

        const isRot90 = lastRot === 90 || lastRot === 270;
        const effW = isRot90 ? dimDepth : dimWidth;
        const effD = isRot90 ? dimWidth : dimDepth;

        if (vertices.length >= 3 && isBoxInsideRoom(candidateX, candidateZ, effW, effD, vertices)) {
          posX = candidateX;
          posZ = candidateZ;
          rotation = lastRot;
        } else {
          // Если ряд уперся в стену/угол, начинаем от угла ближайшей свободной стены
          posX = candidateX;
          posZ = candidateZ;
          rotation = lastRot;
        }
      } else if (isTop && modules.length > 0) {
        // Первый антресольный шкаф: равняем по первому навесному или пеналу
        const refMod = modules.find((m) => m.subType === 'wall' || m.id.startsWith('k_wall_') || m.subType === 'tall') || modules[0];
        posX = refMod.position.x;
        posZ = refMod.position.z;
        rotation = refMod.rotation || 0;
        if (walls.length > 0) {
          const vMap = buildVertexMap(vertices);
          const wall0 = walls[0];
          const v1 = vMap[wall0.startVertexId];
          if (v1) {
            const inNorm = getInwardWallNormal(wall0, vMap, vertices);
            const distCenter = dimDepth / 2 + WALL_GAP;
            posZ = Math.round(v1.z + inNorm.nz * distCenter);
          }
        }
      } else if (isWall && modules.length > 0) {
        // Первый навесной шкаф: равняем по первому установленному нижнему модулю
        const firstMod = modules[0];
        posX = firstMod.position.x;
        posZ = firstMod.position.z;
        rotation = firstMod.rotation || 0;

        // Корректируем дистанцию от стены под глубину навесного каркаса (320 мм вместо 600 мм)
        if (walls.length > 0) {
          const vMap = buildVertexMap(vertices);
          const wall0 = walls[0];
          const v1 = vMap[wall0.startVertexId];
          if (v1) {
            const inNorm = getInwardWallNormal(wall0, vMap, vertices);
            const distCenter = dimDepth / 2 + WALL_GAP;
            posZ = Math.round(v1.z + inNorm.nz * distCenter);
          }
        }
      } else if (walls.length > 0) {
        // Чистая комната: ставим в левый угол задней стены
        const wall0 = walls[0];
        const v1 = vMap[wall0.startVertexId];
        const v2 = vMap[wall0.endVertexId];
        if (v1 && v2) {
          const dx = v2.x - v1.x;
          const dz = v2.z - v1.z;
          const wallLen = Math.hypot(dx, dz);
          const ux = dx / wallLen;
          const uz = dz / wallLen;
          const inNorm = getInwardWallNormal(wall0, vMap, vertices);
          const distCenter = dimDepth / 2 + WALL_GAP;
          const tStart = dimWidth / 2 + 50;

          posX = Math.round(v1.x + ux * tStart + inNorm.nx * distCenter);
          posZ = Math.round(v1.z + uz * tStart + inNorm.nz * distCenter);
          rotation = 0;
        }
      } else {
        posX = -room.width / 2 + dimWidth / 2 + 100;
        posZ = -room.length / 2 + dimDepth / 2 + 2;
        rotation = 0;
      }

      posY = isTop ? topElevation : (isWall ? projectSettings.upperBaseStartHeight : 0);
    }

    const isBase = !isWall && !isTall && !isTop && (template.mainGroup === 'base' || template.subType === 'base' || template.subType === 'corner');
    const plinthActive = template.defaultConfig.hasPlinth !== undefined
      ? template.defaultConfig.hasPlinth
      : ((isTall || isBase) ? true : false);
    const countertopActive = template.defaultConfig.hasCountertop !== undefined
      ? template.defaultConfig.hasCountertop
      : (isBase ? true : false);

    const newModule: FurnitureModule = {
      id: 'mod_' + Math.random().toString(36).substring(2, 9),
      category: template.category,
      subType: isTop ? 'top' : (isWall ? 'wall' : (isTall ? 'tall' : (template.subType || 'base'))),
      code: template.code,
      name: template.name,
      dimensions: { width: dimWidth, height: dimHeight, depth: dimDepth },
      position: { x: posX, y: posY, z: posZ },
      rotation,
      config: {
        ...template.defaultConfig,
        hasPlinth: plinthActive,
        hasCountertop: countertopActive,
        isOpen: false,
        handleType: template.defaultConfig.handleType ?? (isWall ? 'none' : 'bar'),
        golaType: template.defaultConfig.golaType ?? 'type1',
      },
      materials: {
        carcass: globalMaterials.carcass,
        facade: globalMaterials.facade,
        countertop: countertopActive ? globalMaterials.countertop : undefined,
        handle: '#94A3B8',
      },
      basePrice: template.basePrice,
      catalogId: template.id,
    };

    set({
      modules: [...modules, newModule],
      selectedModuleId: newModule.id,
    });

    return newModule;
  },

  updateModule: (id, updates) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  updateModuleDimensions: (id, width, height, depth) =>
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id
          ? {
              ...m,
              dimensions: { width, height, depth },
            }
          : m
      ),
    })),

  removeModule: (id) =>
    set((state) => ({
      modules: state.modules.filter((m) => m.id !== id),
      selectedModuleId: state.selectedModuleId === id ? null : state.selectedModuleId,
    })),

  clearAllModules: () => set({ modules: [], selectedModuleId: null }),

  generateAutoBacksplash: (thickness: number = 4) => {
    const { modules, projectSettings } = get();
    // Находим непрерывные цепочки нижних баз
    const chains = findCollinearChains(modules, 'countertop', projectSettings);
    if (chains.length === 0) return;

    const baseElevation = projectSettings.baseBodyHeight + (projectSettings.hasPlinth ? projectSettings.plinthHeight : 0);
    const newBacksplashes: FurnitureModule[] = [];
    const timestamp = Date.now();

    chains.forEach((chain, idx) => {
      const alpha = (chain.theta * Math.PI) / 180;
      const cosA = Math.cos(alpha);
      const sinA = Math.sin(alpha);

      // Глубина стены: задняя плоскость нижних тумб находится на dLine - chain.depth / 2
      const dWall = chain.dLine - chain.depth / 2;
      const WALL_GAP = 2;
      const dBacksplash = dWall + thickness / 2 + WALL_GAP;
      const tMid = (chain.tMin + chain.tMax) / 2;

      const posX = Math.round(tMid * cosA + dBacksplash * sinA);
      const posZ = Math.round(-tMid * sinA + dBacksplash * cosA);

      const panelModule: FurnitureModule = {
        id: `backsplash_auto_${timestamp}_${idx}`,
        category: 'kitchen',
        subType: 'backsplash',
        name: `Фартук ${Math.round(chain.length)} мм (авто)`,
        dimensions: {
          width: Math.round(chain.length),
          height: 600,
          depth: thickness,
        },
        position: {
          x: posX,
          y: baseElevation,
          z: posZ,
        },
        rotation: chain.theta,
        config: {
          doors: 0,
          drawers: 0,
          shelves: 0,
          hasCountertop: false,
          hasPlinth: false,
        },
        materials: {
          carcass: 'carcass_white',
          facade: chain.material || 'countertop_marble',
          countertop: chain.material || 'countertop_marble',
        },
        basePrice: Math.round((chain.length / 1000) * 3000),
      };

      newBacksplashes.push(panelModule);
    });

    if (newBacksplashes.length > 0) {
      set((state) => ({
        modules: [...state.modules, ...newBacksplashes],
        selectedModuleId: newBacksplashes[0].id,
      }));
    }
  },


  duplicateModule: (id) => {
    const { modules } = get();
    const target = modules.find((m) => m.id === id);
    if (!target) return;

    const clone: FurnitureModule = {
      ...target,
      id: 'mod_' + Math.random().toString(36).substring(2, 9),
      position: {
        x: target.position.x + target.dimensions.width + 20,
        y: target.position.y,
        z: target.position.z,
      },
    };

    set({
      modules: [...modules, clone],
      selectedModuleId: clone.id,
    });
  },

  mirrorModule: (id) =>
    set((state) => ({
      modules: state.modules.map((m) => {
        if (m.id !== id) return m;
        const nextMirrored = !m.config.isMirrored;
        // Для угловых секций синхронно меняем сторону глухой зоны 'left' <-> 'right'
        let nextSide = m.config.blindCornerSide;
        if (nextSide) {
          nextSide = nextSide === 'left' ? 'right' : 'left';
        } else if (m.subType === 'corner' || m.id.includes('corner_blind') || m.config.blindCornerWidth) {
          nextSide = nextMirrored ? 'right' : 'left';
        }

        return {
          ...m,
          config: {
            ...m.config,
            isMirrored: nextMirrored,
            blindCornerSide: nextSide,
          },
        };
      }),
    })),

  isExplodeModalOpen: false,
  explodeModuleId: null,
  openExplodeModal: (id) => {
    const targetId = id ?? get().selectedModuleId;
    if (targetId) {
      set({ isExplodeModalOpen: true, explodeModuleId: targetId });
    }
  },
  closeExplodeModal: () => set({ isExplodeModalOpen: false, explodeModuleId: null }),

  // Редактор мебельных секций (Section Editor)
  customTemplates: [],
  isSectionEditorOpen: false,
  sectionEditorTemplateId: null,
  sectionEditorModuleId: null,
  openSectionEditor: (templateId, fromModuleId) => {
    set({
      isSectionEditorOpen: true,
      sectionEditorTemplateId: templateId ?? null,
      sectionEditorModuleId: fromModuleId ?? null,
    });
  },
  closeSectionEditor: () => {
    set({
      isSectionEditorOpen: false,
      sectionEditorTemplateId: null,
      sectionEditorModuleId: null,
    });
  },
  saveCustomSection: (newTemplate) => {
    const isBase = newTemplate.mainGroup === 'base' || newTemplate.subType === 'base';
    const isTall = newTemplate.mainGroup === 'tall' || newTemplate.subType === 'tall';
    const sanitizedTemplate: CatalogItemTemplate = {
      ...newTemplate,
      defaultConfig: {
        ...newTemplate.defaultConfig,
        hasCountertop: newTemplate.defaultConfig?.hasCountertop ?? isBase,
        hasPlinth: newTemplate.defaultConfig?.hasPlinth ?? (isBase || isTall),
      },
    };
    set((state) => {
      const existingIdx = state.customTemplates.findIndex((t) => t.id === sanitizedTemplate.id);
      let updated: CatalogItemTemplate[];
      if (existingIdx >= 0) {
        updated = [...state.customTemplates];
        updated[existingIdx] = sanitizedTemplate;
      } else {
        updated = [sanitizedTemplate, ...state.customTemplates];
      }
      return { customTemplates: updated };
    });
  },
  deleteCustomSection: (id) => {
    set((state) => ({
      customTemplates: state.customTemplates.filter((t) => t.id !== id),
    }));
  },
  getAllCatalogItems: () => {
    return [...CATALOG_ITEMS, ...get().customTemplates];
  },

  // Интеграция с Базис-Мебельщик
  isBazisModalOpen: false,
  openBazisModal: () => set({ isBazisModalOpen: true }),
  closeBazisModal: () => set({ isBazisModalOpen: false }),

  areDoorsOpen: false,
  toggleDoors: () =>
    set((state) => {
      const nextOpen = !state.areDoorsOpen;
      return {
        areDoorsOpen: nextOpen,
        modules: state.modules.map((m) => ({
          ...m,
          config: { ...m.config, isOpen: nextOpen },
        })),
      };
    }),
  toggleModuleDoors: (id: string) =>
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id
          ? { ...m, config: { ...m.config, isOpen: !m.config.isOpen } }
          : m
      ),
    })),

  viewDisplayMode: 'dimensions',
  showDimensions: true,
  setViewDisplayMode: (mode: ViewDisplayMode) => {
    if (mode === 'clean') {
      set({ viewDisplayMode: 'clean', showDimensions: false, isWireframeMode: false });
    } else if (mode === 'dimensions') {
      set({ viewDisplayMode: 'dimensions', showDimensions: true, isWireframeMode: false });
    } else if (mode === 'wireframe') {
      set({ viewDisplayMode: 'wireframe', showDimensions: false, isWireframeMode: true });
    }
  },
  setShowDimensions: (showDimensions: boolean) =>
    set((state) => ({
      showDimensions,
      viewDisplayMode: state.isWireframeMode
        ? 'wireframe'
        : showDimensions
        ? 'dimensions'
        : 'clean',
    })),

  isWireframeMode: false,
  toggleWireframeMode: () =>
    set((state) => {
      const next = !state.isWireframeMode;
      return {
        isWireframeMode: next,
        viewDisplayMode: next ? 'wireframe' : (state.showDimensions ? 'dimensions' : 'clean'),
      };
    }),
  setWireframeMode: (isWireframeMode) =>
    set((state) => ({
      isWireframeMode,
      viewDisplayMode: isWireframeMode ? 'wireframe' : (state.showDimensions ? 'dimensions' : 'clean'),
    })),

  mode: '3D',
  setMode: (mode) => set({ mode }),

  activeSidebarTab: 'catalog',
  setActiveSidebarTab: (activeSidebarTab) => set({ activeSidebarTab }),

  activeTool: 'select',
  setActiveTool: (activeTool) => set({ activeTool }),

  activeCategory: 'kitchen',
  setActiveCategory: (activeCategory) => set({ activeCategory }),

  globalMaterials: {
    carcass: 'carcass_white',
    facade: 'agt_3012',
    countertop: 'countertop_marble',
    handle: 'hw_boyard_handle_123',
  },

  setGlobalMaterial: (type, materialId) =>
    set((state) => {
      const newGlobal = { ...state.globalMaterials, [type]: materialId };
      // Обновляем все модули, где выбран глобальный материал
      const updatedModules = state.modules.map((m) => {
        const mats = { ...m.materials };
        if (type === 'facade') mats.facade = materialId;
        if (type === 'carcass') mats.carcass = materialId;
        if (type === 'countertop' && m.config.hasCountertop) mats.countertop = materialId;
        if (type === 'handle') mats.handle = materialId;
        return { ...m, materials: mats };
      });
      return {
        globalMaterials: newGlobal,
        projectSettings:
          type === 'handle'
            ? { ...state.projectSettings, defaultHandle: materialId }
            : state.projectSettings,
        modules: updatedModules,
      };
    }),

  // Окно сметы
  isSmetaOpen: false,
  openSmeta: () => set({ isSmetaOpen: true }),
  closeSmeta: () => set({ isSmetaOpen: false }),

  smetaServices: {
    assembly: true,
    install: true,
    delivery: true,
    deliveryType: 'city',
    floorLift: false,
    floorNumber: 3,
    hasFreightElevator: true,
    sinkCutout: false,
    hobCutout: false,
  },

  updateSmetaServices: (services) =>
    set((state) => ({
      smetaServices: { ...state.smetaServices, ...services },
    })),

  updateModuleHardware: (moduleId, hardware) =>
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              customHardware: {
                ...(m.customHardware || {}),
                ...hardware,
              },
            }
          : m
      ),
    })),

  calculateTotalPrice: () => {
    const { modules, globalMaterials, projectSettings, smetaServices } = get();
    const materialsStore = useMaterialsStore.getState();

    let modulesTotal = 0;
    let countertopLinearMeters = 0;
    let apronLinearMeters = 0;

    // Розничные цены материалов из базы собственника
    const ctItem = materialsStore.getItemById(globalMaterials.countertop);
    const ctPricePerMeter = ctItem ? ctItem.clientPrice : 4500;

    const facadeItem = materialsStore.getItemById(globalMaterials.facade);
    const facadeMultiplier = facadeItem ? facadeItem.clientPrice / 4800 : 1.0;

    // Подсчет базовой фурнитуры проекта
    let hingesCount = 0;
    let hingesTotal = 0;
    let drawersCount = 0;
    let drawersTotal = 0;
    let liftsCount = 0;
    let liftsTotal = 0;
    let handlesCount = 0;
    let handlesTotal = 0;

    const defaultHingesItem = materialsStore.getItemById(projectSettings.defaultHinges || 'hw_boyard_neo_overlay_h301');
    const defaultDrawersItem = materialsStore.getItemById(projectSettings.defaultDrawers || 'hw_boyard_bslide_500');
    const defaultLiftItem = materialsStore.getItemById(projectSettings.defaultLift || 'hw_boyard_neo_corner_h308');
    const defaultHandleItem = materialsStore.getItemById(globalMaterials.handle || projectSettings.defaultHandle || 'hw_boyard_handle_123');

    const defaultHingePrice = defaultHingesItem ? defaultHingesItem.clientPrice : 190;
    const defaultDrawerPrice = defaultDrawersItem ? defaultDrawersItem.clientPrice : 1450;
    const defaultLiftPrice = defaultLiftItem ? defaultLiftItem.clientPrice : 850;
    const defaultHandlePrice = defaultHandleItem ? defaultHandleItem.clientPrice : 320;

    modules.forEach((mod) => {
      if (mod.subType === 'backsplash' || mod.id.includes('backsplash')) {
        apronLinearMeters += mod.dimensions.width / 1000;
        return;
      }

      // Базовая цена модуля с поправкой на ширину и категорию фасада
      const widthFactor = mod.dimensions.width / 600;
      modulesTotal += Math.round(mod.basePrice * widthFactor * facadeMultiplier);

      if (mod.config.hasCountertop) {
        countertopLinearMeters += mod.dimensions.width / 1000;
      }

      // Цены фурнитуры для этого конкретного модуля (с учетом переопределений)
      const mHingePrice = mod.customHardware?.hinges
        ? materialsStore.getItemById(mod.customHardware.hinges)?.clientPrice ?? defaultHingePrice
        : defaultHingePrice;

      const mDrawerPrice = mod.customHardware?.drawers
        ? materialsStore.getItemById(mod.customHardware.drawers)?.clientPrice ?? defaultDrawerPrice
        : defaultDrawerPrice;

      const mLiftPrice = mod.customHardware?.lift
        ? materialsStore.getItemById(mod.customHardware.lift)?.clientPrice ?? defaultLiftPrice
        : defaultLiftPrice;

      const mHandlePrice = mod.customHardware?.handle
        ? materialsStore.getItemById(mod.customHardware.handle)?.clientPrice ?? defaultHandlePrice
        : defaultHandlePrice;

      const numDoors = mod.config.doors || 0;
      const numDrawers = mod.config.drawers || 0;
      const isLift =
        mod.config.doorOpeningType === 'lift' ||
        mod.config.doorOpeningType === 'aventos_hf' ||
        mod.config.doorOpeningType === 'double_lift' ||
        mod.name.toLowerCase().includes('подъем') ||
        (mod.code ? mod.code.includes('П') : false);

      if (isLift) {
        liftsCount += 1;
        liftsTotal += mLiftPrice;
        handlesCount += 1;
        handlesTotal += mHandlePrice;
      } else if (numDrawers > 0) {
        drawersCount += numDrawers;
        drawersTotal += numDrawers * mDrawerPrice;
        handlesCount += numDrawers;
        handlesTotal += numDrawers * mHandlePrice;
        if (numDoors > 0) {
          const hPerDoor = mod.dimensions.height > 1600 ? 4 : (mod.dimensions.height > 900 ? 3 : 2);
          hingesCount += numDoors * hPerDoor;
          hingesTotal += numDoors * hPerDoor * mHingePrice;
          handlesCount += numDoors;
          handlesTotal += numDoors * mHandlePrice;
        }
      } else if (numDoors > 0) {
        const hPerDoor = mod.dimensions.height > 1600 ? 4 : (mod.dimensions.height > 900 ? 3 : 2);
        hingesCount += numDoors * hPerDoor;
        hingesTotal += numDoors * hPerDoor * mHingePrice;
        handlesCount += numDoors;
        handlesTotal += numDoors * mHandlePrice;
      }
    });

    const countertopTotal = Math.round(countertopLinearMeters * ctPricePerMeter);
    const apronItem = materialsStore.items.find((i) => i.section === 'apron' && i.isActive);
    const apronPricePerMeter = apronItem ? apronItem.clientPrice : 3500;
    const apronTotal = Math.round(apronLinearMeters * apronPricePerMeter);

    const hardwareTotal = hingesTotal + drawersTotal + liftsTotal + handlesTotal;

    // Услуги (только выбранные дизайнером в смете)
    const kitchenCost = modulesTotal + countertopTotal + apronTotal;
    const assemblyTotal = smetaServices.assembly ? modules.length * 1500 : 0;
    const installTotal = smetaServices.install ? Math.round(kitchenCost * 0.10) : 0;
    const deliveryTotal = smetaServices.delivery
      ? smetaServices.deliveryType === 'suburb'
        ? 4500
        : smetaServices.deliveryType === 'pickup'
        ? 0
        : 2500
      : 0;
    const floorLiftTotal = smetaServices.floorLift
      ? smetaServices.hasFreightElevator
        ? 1200
        : Math.max(1, smetaServices.floorNumber) * 350 * Math.ceil(modules.length / 4)
      : 0;
    const cutoutsTotal = (smetaServices.sinkCutout ? 1500 : 0) + (smetaServices.hobCutout ? 1500 : 0);

    const servicesTotal = assemblyTotal + installTotal + deliveryTotal + floorLiftTotal + cutoutsTotal;
    const grandTotal = kitchenCost + hardwareTotal + servicesTotal;

    return {
      modulesTotal,
      countertopTotal,
      apronTotal,
      hardwareTotal,
      servicesTotal,
      assemblyTotal,
      installTotal,
      deliveryTotal,
      floorLiftTotal,
      cutoutsTotal,
      grandTotal,
      hardwareBreakdown: {
        hingesCount,
        hingesTotal,
        drawersCount,
        drawersTotal,
        liftsCount,
        liftsTotal,
        handlesCount,
        handlesTotal,
      },
    };
  },

  exportProjectJson: () => {
    const { room, modules, globalMaterials, projectSettings } = get();
    return JSON.stringify(
      {
        version: '1.1',
        date: new Date().toISOString(),
        room,
        globalMaterials,
        projectSettings,
        modules,
      },
      null,
      2
    );
  },

  importProjectJson: (jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data && data.room && Array.isArray(data.modules)) {
        set({
          room: data.room,
          modules: data.modules,
          globalMaterials: data.globalMaterials ?? get().globalMaterials,
          projectSettings: data.projectSettings
            ? { ...DEFAULT_PROJECT_SETTINGS, ...data.projectSettings }
            : get().projectSettings,
          selectedModuleId: null,
        });
        return true;
      }
    } catch (err) {
      console.error('Ошибка импорта проекта:', err);
    }
    return false;
  },
    }),
    {
      name: 'biplaner_project_storage',
      partialize: (state) => ({
        modules: state.modules,
        projectSettings: state.projectSettings,
        globalMaterials: state.globalMaterials,
        room: state.room,
        customTemplates: state.customTemplates,
      }),
    }
  )
);
