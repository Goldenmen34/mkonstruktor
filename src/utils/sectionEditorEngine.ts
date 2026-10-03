import {
  CustomSectionPart,
  PartWidthBinding,
  PartDepthBinding,
  PartHeightBinding,
  PartMaterialType,
  ProjectSettings,
  ModuleConfig,
} from '../types';
import { CatalogItemTemplate } from '../data/catalog';

export interface EvaluatedPartGeometry {
  width: number;       // мм
  height: number;      // мм
  depth: number;       // мм
  posX: number;        // мм (от центра секции)
  posY: number;        // мм (от центра секции)
  posZ: number;        // мм (от центра секции)
  cutLength: number;   // мм (размер 1 для раскроя)
  cutWidth: number;    // мм (размер 2 для раскроя)
  thickness: number;   // мм
  areaM2: number;      // м²
}

export interface MaterialPreset {
  type: PartMaterialType;
  name: string;
  defaultThickness: number;
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  transparent?: boolean;
}

export const MATERIAL_PRESETS: Record<PartMaterialType, MaterialPreset> = {
  ldsp: {
    type: 'ldsp',
    name: 'ЛДСП 16 мм (Базовый)',
    defaultThickness: 16,
    color: '#DFD5C6',
    roughness: 0.65,
    metalness: 0.05,
  },
  mdf: {
    type: 'mdf',
    name: 'МДФ 16 мм',
    defaultThickness: 16,
    color: '#E2E8F0',
    roughness: 0.5,
    metalness: 0.05,
  },
  mdf_facade: {
    type: 'mdf_facade',
    name: 'МДФ фасад 18 мм (Пленка ПВХ)',
    defaultThickness: 18,
    color: '#D29B5D',
    roughness: 0.45,
    metalness: 0.05,
  },
  hdf: {
    type: 'hdf',
    name: 'ХДФ 4 мм (Белый лак)',
    defaultThickness: 4,
    color: '#F8FAFC',
    roughness: 0.7,
    metalness: 0.0,
  },
  glass: {
    type: 'glass',
    name: 'Стекло закаленное 6 мм',
    defaultThickness: 6,
    color: '#93C5FD',
    roughness: 0.1,
    metalness: 0.9,
    opacity: 0.5,
    transparent: true,
  },
  metal: {
    type: 'metal',
    name: 'Алюминий / Металл',
    defaultThickness: 20,
    color: '#94A3B8',
    roughness: 0.25,
    metalness: 0.85,
  },
  countertop: {
    type: 'countertop',
    name: 'Столешница HPL 38 мм',
    defaultThickness: 38,
    color: '#334155',
    roughness: 0.4,
    metalness: 0.1,
  },
};

/**
 * Конвертирует любой готовый шаблон из каталога в набор параметрических деталей
 */
export function convertTemplateToCustomParts(
  template: CatalogItemTemplate,
  settings: ProjectSettings,
  currentDim?: { width: number; height: number; depth: number },
  configOverride?: Partial<ModuleConfig>
): CustomSectionPart[] {
  const parts: CustomSectionPart[] = [];
  const W = currentDim?.width ?? template.defaultDimensions.width;
  const D = currentDim?.depth ?? template.defaultDimensions.depth;
  const dspThick = settings.dspThickness ?? 16;

  const cfg: ModuleConfig = { ...template.defaultConfig, ...configOverride };

  const isTall = template.subType === 'tall' || template.mainGroup === 'tall' || template.id.startsWith('k_tall_');
  const isTop = template.subType === 'top' || template.mainGroup === 'top' || template.id.startsWith('k_top_');
  const isWall = !isTall && !isTop && (template.subType === 'wall' || template.mainGroup === 'wall' || template.id.startsWith('k_wall_'));
  const isBase = !isWall && !isTall && !isTop;
  const isUpper = isWall || isTop;

  const shouldHavePlinth = cfg.hasPlinth ?? (isBase || isTall);
  const plinthH = (shouldHavePlinth && (settings?.hasPlinth !== false))
    ? (settings?.plinthHeight ?? 120)
    : 0;
  const hasTop = Boolean(cfg.hasCountertop ?? isBase);
  const topH = hasTop ? (settings?.countertopThickness ?? 40) : 0;

  let H = currentDim?.height ?? template.defaultDimensions.height;
  if (!currentDim && (plinthH > 0 || topH > 0)) {
    H = Math.max(100, H - plinthH - topH);
  }

  const specialTall = cfg.specialTallType ||
    (template.id.includes('oven_mw') ? 'oven_mw' :
     template.id.includes('oven') ? 'oven' :
     template.id.includes('fridge') ? 'fridge' :
     template.id.includes('pantry') ? 'pantry' :
     template.id.includes('spacetower') ? 'spacetower' :
     template.id.includes('cargo') ? 'cargo' : undefined);

  // 1. Левая стойка
  parts.push({
    id: `part_side_left_${Date.now()}_1`,
    name: 'Левая стойка (боковина)',
    category: 'carcass',
    materialType: 'ldsp',
    materialName: `ЛДСП ${dspThick} мм`,
    color: MATERIAL_PRESETS.ldsp.color,
    thickness: dspThick,
    widthBinding: 'left_side',
    depthBinding: 'full_depth',
    heightBinding: 'full_height',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    isVisible: true,
  });

  // 2. Правая стойка
  parts.push({
    id: `part_side_right_${Date.now()}_2`,
    name: 'Правая стойка (боковина)',
    category: 'carcass',
    materialType: 'ldsp',
    materialName: `ЛДСП ${dspThick} мм`,
    color: MATERIAL_PRESETS.ldsp.color,
    thickness: dspThick,
    widthBinding: 'right_side',
    depthBinding: 'full_depth',
    heightBinding: 'full_height',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    isVisible: true,
  });

  // 3. Дно корпуса
  parts.push({
    id: `part_bottom_${Date.now()}_3`,
    name: isBase ? 'Дно корпуса (проходное)' : 'Дно корпуса (горизонт нижний)',
    category: 'carcass',
    materialType: 'ldsp',
    materialName: `ЛДСП ${dspThick} мм`,
    color: MATERIAL_PRESETS.ldsp.color,
    thickness: dspThick,
    widthBinding: isBase ? 'full_width' : 'between_sides',
    depthBinding: 'full_depth',
    heightBinding: 'bottom_pass',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    isVisible: true,
  });

  // 4. Верх / Крышка (для навесных и антресолей) или Царга (для нижних)
  if (isUpper || isTall) {
    parts.push({
      id: `part_top_${Date.now()}_4`,
      name: 'Верхний горизонт (крышка)',
      category: 'carcass',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'full_depth',
      heightBinding: 'top_roof',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    });
  } else {
    parts.push({
      id: `part_tsarga_front_${Date.now()}_4a`,
      name: 'Царга верхняя передняя',
      category: 'carcass',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'custom',
      customDepth: 100,
      heightBinding: 'top_roof',
      offsetX: 0,
      offsetY: 0,
      offsetZ: D / 2 - 50,
      isVisible: true,
    });
    parts.push({
      id: `part_tsarga_back_${Date.now()}_4b`,
      name: 'Царга верхняя задняя',
      category: 'carcass',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'custom',
      customDepth: 100,
      heightBinding: 'top_roof',
      offsetX: 0,
      offsetY: 0,
      offsetZ: -D / 2 + 50,
      isVisible: true,
    });
  }

  // 5. Задняя стенка (ХДФ 4 мм)
  if (cfg.hasBackWall !== false && !template.id.includes('sink')) {
    parts.push({
      id: `part_back_${Date.now()}_5`,
      name: 'Задняя стенка (ХДФ 4 мм)',
      category: 'back',
      materialType: 'hdf',
      materialName: 'ХДФ 4 мм (Белый)',
      color: MATERIAL_PRESETS.hdf.color,
      thickness: 4,
      widthBinding: 'full_width',
      depthBinding: 'back_wall',
      heightBinding: 'full_height',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    });
  }

  // ==========================================
  // ВНУТРЕННЕЕ НАПОЛНЕНИЕ, ПОЛКИ, ЯЩИКИ И ФАСАДЫ
  // ==========================================

  // --- ВАРИАНТ 1: ПЕНАЛ ДУХОВКА + СВЧ (П-Д-СВЧ-ДШ-2В) ---
  if (isTall && specialTall === 'oven_mw') {
    const lowerH = 720;
    const dH = Math.round((lowerH - 4 - 3) / 2); // ~356 мм

    // 1. Выкатной ящик №1 (нижний)
    parts.push({
      id: `part_drawer_front_${Date.now()}_1`,
      name: 'Фасад ящика нижний №1 (МДФ)',
      category: 'drawer',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: dH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + 2 + dH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // 2. Выкатной ящик №2 (средний)
    parts.push({
      id: `part_drawer_front_${Date.now()}_2`,
      name: 'Фасад ящика нижний №2 (МДФ)',
      category: 'drawer',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: dH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + 2 + dH + 3 + dH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // 3. Горизонт под духовой шкаф
    parts.push({
      id: `part_shelf_oven_${Date.now()}_3`,
      name: 'Горизонт под духовой шкаф (ЛДСП)',
      category: 'shelf',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'full_depth',
      heightBinding: 'shelf',
      offsetX: 0,
      offsetY: Math.round(-H / 2 + lowerH + dspThick / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // 4. Горизонт под СВЧ (ниша духовки 595 мм)
    const ovenNicheH = 595;
    const shelf2Y = lowerH + dspThick + ovenNicheH;
    parts.push({
      id: `part_shelf_mw_${Date.now()}_4`,
      name: 'Горизонт под СВЧ (ЛДСП)',
      category: 'shelf',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'full_depth',
      heightBinding: 'shelf',
      offsetX: 0,
      offsetY: Math.round(-H / 2 + shelf2Y + dspThick / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // 5. Горизонт над СВЧ / дно антресоли (ниша СВЧ 380 мм)
    const mwNicheH = 380;
    const shelf3Y = shelf2Y + dspThick + mwNicheH;
    parts.push({
      id: `part_shelf_top_${Date.now()}_5`,
      name: 'Горизонт над СВЧ / дно антресоли (ЛДСП)',
      category: 'shelf',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'full_depth',
      heightBinding: 'shelf',
      offsetX: 0,
      offsetY: Math.round(-H / 2 + shelf3Y + dspThick / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // 6. Верхний фасад антресоли
    const shelf3TopDist = shelf3Y + dspThick;
    const topDoorH = Math.max(100, Math.round(H - shelf3TopDist - dspThick - 4));
    parts.push({
      id: `part_facade_top_${Date.now()}_6`,
      name: 'Фасад антресоли распашной (МДФ)',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: topDoorH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + shelf3TopDist + 2 + topDoorH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // 7. Полка внутри высокой антресоли (при H >= 2380)
    if (H >= 2380 || topDoorH > 500) {
      parts.push({
        id: `part_shelf_antresole_${Date.now()}_7`,
        name: 'Полка вкладная антресоли (ЛДСП)',
        category: 'shelf',
        materialType: 'ldsp',
        materialName: `ЛДСП ${dspThick} мм`,
        color: MATERIAL_PRESETS.ldsp.color,
        thickness: dspThick,
        widthBinding: 'between_sides',
        depthBinding: 'recessed_front',
        heightBinding: 'shelf',
        offsetX: 0,
        offsetY: Math.round(-H / 2 + shelf3TopDist + dspThick + (topDoorH - dspThick) / 2),
        offsetZ: 0,
        isVisible: true,
      });
    }

    return parts;
  }

  // --- ВАРИАНТ 2: ПЕНАЛ ДУХОВОЙ ШКАФ НА КОМФОРТНОЙ ВЫСОТЕ (П-Д-ДШ-2В) ---
  if (isTall && specialTall === 'oven') {
    const lowerH = 720;
    const dH = Math.round((lowerH - 4 - 3) / 2);

    // 2 ящика снизу
    parts.push({
      id: `part_drawer_front_${Date.now()}_1`,
      name: 'Фасад ящика нижний №1 (МДФ)',
      category: 'drawer',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: dH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + 2 + dH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    parts.push({
      id: `part_drawer_front_${Date.now()}_2`,
      name: 'Фасад ящика нижний №2 (МДФ)',
      category: 'drawer',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: dH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + 2 + dH + 3 + dH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // Горизонт под духовой шкаф
    parts.push({
      id: `part_shelf_oven_${Date.now()}_3`,
      name: 'Горизонт под духовой шкаф (ЛДСП)',
      category: 'shelf',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'full_depth',
      heightBinding: 'shelf',
      offsetX: 0,
      offsetY: Math.round(-H / 2 + lowerH + dspThick / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // Горизонт над духовкой (ниша 595 мм)
    const ovenNicheH = 595;
    const shelf2Y = lowerH + dspThick + ovenNicheH;
    parts.push({
      id: `part_shelf_top_${Date.now()}_4`,
      name: 'Горизонт над духовкой (дно верхнего шкафа)',
      category: 'shelf',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'full_depth',
      heightBinding: 'shelf',
      offsetX: 0,
      offsetY: Math.round(-H / 2 + shelf2Y + dspThick / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // Верхняя распашная дверь
    const shelf2TopDist = shelf2Y + dspThick;
    const topDoorH = Math.max(100, Math.round(H - shelf2TopDist - dspThick - 4));
    parts.push({
      id: `part_facade_top_${Date.now()}_5`,
      name: 'Фасад распашной верхний (МДФ)',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: topDoorH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + shelf2TopDist + 2 + topDoorH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // Полки внутри верхнего шкафа
    const upperShelfCount = H >= 2380 ? 2 : 1;
    const step = (topDoorH - dspThick) / (upperShelfCount + 1);
    for (let s = 1; s <= upperShelfCount; s++) {
      parts.push({
        id: `part_shelf_upper_${Date.now()}_${s}`,
        name: `Полка верхнего шкафа №${s} (ЛДСП)`,
        category: 'shelf',
        materialType: 'ldsp',
        materialName: `ЛДСП ${dspThick} мм`,
        color: MATERIAL_PRESETS.ldsp.color,
        thickness: dspThick,
        widthBinding: 'between_sides',
        depthBinding: 'recessed_front',
        heightBinding: 'shelf',
        offsetX: 0,
        offsetY: Math.round(-H / 2 + shelf2TopDist + dspThick + step * s),
        offsetZ: 0,
        isVisible: true,
      });
    }

    return parts;
  }

  // --- ВАРИАНТ 3: ПЕНАЛ ДВУХДВЕРНЫЙ / ХОЛОДИЛЬНИК (П-2Д, П-ХОЛ) ---
  if (isTall && (specialTall === 'fridge' || specialTall === 'pantry' || cfg.doors === 2)) {
    const lowerH = 720;
    const lowerDoorH = lowerH - 4;

    // Нижняя распашная дверь
    parts.push({
      id: `part_facade_lower_${Date.now()}_1`,
      name: 'Фасад нижний распашной (МДФ)',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: lowerDoorH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + 2 + lowerDoorH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // Межсекционный горизонт
    parts.push({
      id: `part_shelf_mid_${Date.now()}_2`,
      name: 'Горизонт межсекционный (ЛДСП)',
      category: 'shelf',
      materialType: 'ldsp',
      materialName: `ЛДСП ${dspThick} мм`,
      color: MATERIAL_PRESETS.ldsp.color,
      thickness: dspThick,
      widthBinding: 'between_sides',
      depthBinding: 'full_depth',
      heightBinding: 'shelf',
      offsetX: 0,
      offsetY: Math.round(-H / 2 + lowerH + dspThick / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // Верхняя распашная дверь
    const upperDoorH = Math.max(100, Math.round(H - lowerH - dspThick - 6));
    parts.push({
      id: `part_facade_upper_${Date.now()}_3`,
      name: 'Фасад верхний распашной (МДФ)',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: W - 4,
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: upperDoorH,
      offsetX: 0,
      offsetY: Math.round(-H / 2 + lowerH + dspThick + 2 + upperDoorH / 2),
      offsetZ: 0,
      isVisible: true,
    });

    // Полки внутри отделений
    const totalShelves = cfg.shelves ?? 4;
    const lowerShelves = Math.min(2, Math.floor(totalShelves / 2));
    const upperShelves = totalShelves - lowerShelves;

    for (let s = 1; s <= lowerShelves; s++) {
      const step = lowerH / (lowerShelves + 1);
      parts.push({
        id: `part_shelf_low_${Date.now()}_${s}`,
        name: `Полка нижняя №${s} (ЛДСП)`,
        category: 'shelf',
        materialType: 'ldsp',
        materialName: `ЛДСП ${dspThick} мм`,
        color: MATERIAL_PRESETS.ldsp.color,
        thickness: dspThick,
        widthBinding: 'between_sides',
        depthBinding: 'recessed_front',
        heightBinding: 'shelf',
        offsetX: 0,
        offsetY: Math.round(-H / 2 + step * s),
        offsetZ: 0,
        isVisible: true,
      });
    }

    for (let s = 1; s <= upperShelves; s++) {
      const step = upperDoorH / (upperShelves + 1);
      parts.push({
        id: `part_shelf_up_${Date.now()}_${s}`,
        name: `Полка верхняя №${s} (ЛДСП)`,
        category: 'shelf',
        materialType: 'ldsp',
        materialName: `ЛДСП ${dspThick} мм`,
        color: MATERIAL_PRESETS.ldsp.color,
        thickness: dspThick,
        widthBinding: 'between_sides',
        depthBinding: 'recessed_front',
        heightBinding: 'shelf',
        offsetX: 0,
        offsetY: Math.round(-H / 2 + lowerH + dspThick + step * s),
        offsetZ: 0,
        isVisible: true,
      });
    }

    return parts;
  }

  // --- ВАРИАНТ 4: НИЖНИЕ БАЗЫ С ВЫКАТНЫМИ ЯЩИКАМИ (НС-3Я, НС-2Я, НС-1Я, НС-1Я-1Д) ---
  const drawersCount = cfg.drawers || 0;
  if (isBase && drawersCount > 0) {
    if (cfg.doors === 1 && drawersCount === 1) {
      // 1 ящик сверху + 1 распашная дверь снизу (НС-1Я-1Д)
      const hDrawer = 140;
      const yDrawer = Math.round(H / 2 - 2 - hDrawer / 2);
      parts.push({
        id: `part_drawer_front_${Date.now()}_1`,
        name: 'Фасад ящика верхний (МДФ)',
        category: 'drawer',
        materialType: 'mdf_facade',
        materialName: 'МДФ фасад 18 мм',
        color: MATERIAL_PRESETS.mdf_facade.color,
        thickness: 18,
        widthBinding: 'custom',
        customWidth: W - 4,
        depthBinding: 'facade',
        heightBinding: 'custom',
        customHeight: hDrawer,
        offsetX: 0,
        offsetY: yDrawer,
        offsetZ: 0,
        isVisible: true,
      });

      // Разделительная полка
      parts.push({
        id: `part_shelf_mid_${Date.now()}_div`,
        name: 'Полка разделительная (ЛДСП)',
        category: 'shelf',
        materialType: 'ldsp',
        materialName: `ЛДСП ${dspThick} мм`,
        color: MATERIAL_PRESETS.ldsp.color,
        thickness: dspThick,
        widthBinding: 'between_sides',
        depthBinding: 'full_depth',
        heightBinding: 'shelf',
        offsetX: 0,
        offsetY: Math.round(H / 2 - hDrawer - 4 - dspThick / 2),
        offsetZ: 0,
        isVisible: true,
      });

      // Нижняя распашная дверь
      const hDoor = Math.max(100, Math.round(H - hDrawer - dspThick - 10));
      parts.push({
        id: `part_facade_bottom_${Date.now()}_2`,
        name: 'Фасад распашной нижний (МДФ)',
        category: 'facade',
        materialType: 'mdf_facade',
        materialName: 'МДФ фасад 18 мм',
        color: MATERIAL_PRESETS.mdf_facade.color,
        thickness: 18,
        widthBinding: 'custom',
        customWidth: W - 4,
        depthBinding: 'facade',
        heightBinding: 'custom',
        customHeight: hDoor,
        offsetX: 0,
        offsetY: Math.round(-H / 2 + 2 + hDoor / 2),
        offsetZ: 0,
        isVisible: true,
      });

      return parts;
    }

    if (drawersCount === 2) {
      // 2 равных глубоких ящика (НС-2Я)
      const dH = Math.round((H - 8) / 2);
      for (let i = 0; i < 2; i++) {
        const yD = Math.round(-H / 2 + 2 + dH / 2 + i * (dH + 4));
        parts.push({
          id: `part_drawer_front_${Date.now()}_${i + 1}`,
          name: i === 0 ? 'Фасад ящика нижний (МДФ)' : 'Фасад ящика верхний (МДФ)',
          category: 'drawer',
          materialType: 'mdf_facade',
          materialName: 'МДФ фасад 18 мм',
          color: MATERIAL_PRESETS.mdf_facade.color,
          thickness: 18,
          widthBinding: 'custom',
          customWidth: W - 4,
          depthBinding: 'facade',
          heightBinding: 'custom',
          customHeight: dH,
          offsetX: 0,
          offsetY: yD,
          offsetZ: 0,
          isVisible: true,
        });
      }
      return parts;
    }

    if (drawersCount === 3) {
      // 3 ящика: 1 малый сверху под приборы + 2 глубоких снизу (НС-3Я)
      const h1 = Math.min(160, Math.round(H * 0.2));
      const remH = H - h1 - 10;
      const h2 = Math.round(remH / 2);
      const h3 = remH - h2;

      const heights = [h3, h2, h1];
      const names = [
        'Фасад ящика нижний глубокий (МДФ)',
        'Фасад ящика средний глубокий (МДФ)',
        'Фасад ящика верхний малый (МДФ)',
      ];

      let currentBottom = -H / 2 + 2;
      for (let i = 0; i < 3; i++) {
        const currH = heights[i];
        const yD = Math.round(currentBottom + currH / 2);
        currentBottom += currH + 3;
        parts.push({
          id: `part_drawer_front_${Date.now()}_${i + 1}`,
          name: names[i],
          category: 'drawer',
          materialType: 'mdf_facade',
          materialName: 'МДФ фасад 18 мм',
          color: MATERIAL_PRESETS.mdf_facade.color,
          thickness: 18,
          widthBinding: 'custom',
          customWidth: W - 4,
          depthBinding: 'facade',
          heightBinding: 'custom',
          customHeight: currH,
          offsetX: 0,
          offsetY: yD,
          offsetZ: 0,
          isVisible: true,
        });
      }
      return parts;
    }

    if (drawersCount >= 4) {
      // 4+ ящика
      const dH = Math.round((H - (drawersCount - 1) * 3 - 4) / drawersCount);
      for (let i = 0; i < drawersCount; i++) {
        const yD = Math.round(-H / 2 + 2 + dH / 2 + i * (dH + 3));
        parts.push({
          id: `part_drawer_front_${Date.now()}_${i + 1}`,
          name: `Фасад ящика №${i + 1} (МДФ)`,
          category: 'drawer',
          materialType: 'mdf_facade',
          materialName: 'МДФ фасад 18 мм',
          color: MATERIAL_PRESETS.mdf_facade.color,
          thickness: 18,
          widthBinding: 'custom',
          customWidth: W - 4,
          depthBinding: 'facade',
          heightBinding: 'custom',
          customHeight: dH,
          offsetX: 0,
          offsetY: yD,
          offsetZ: 0,
          isVisible: true,
        });
      }
      return parts;
    }
  }

  // --- ВАРИАНТ 5: ОБЫЧНЫЕ ШКАФЫ С ПОЛКАМИ И РАСПАШНЫМИ ФАСАДАМИ ---
  const shelfCount = cfg.shelves ?? (isWall ? 1 : isTall ? 3 : isTop ? 0 : 1);
  if (shelfCount > 0) {
    const step = H / (shelfCount + 1);
    for (let s = 1; s <= shelfCount; s++) {
      const yPos = -H / 2 + step * s;
      parts.push({
        id: `part_shelf_${Date.now()}_${s}`,
        name: shelfCount === 1 ? 'Полка вкладная' : `Полка вкладная №${s}`,
        category: 'shelf',
        materialType: 'ldsp',
        materialName: `ЛДСП ${dspThick} мм`,
        color: MATERIAL_PRESETS.ldsp.color,
        thickness: dspThick,
        widthBinding: 'between_sides',
        depthBinding: 'recessed_front',
        heightBinding: 'shelf',
        offsetX: 0,
        offsetY: Math.round(yPos),
        offsetZ: 0,
        isVisible: true,
      });
    }
  }

  const doors = cfg.doors ?? 0;
  if (doors === 1) {
    parts.push({
      id: `part_facade_${Date.now()}_7`,
      name: 'Фасад распашной (МДФ)',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'full_width',
      depthBinding: 'facade',
      heightBinding: 'facade',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    });
  } else if (doors === 2) {
    const doorW = Math.round((W - 6) / 2);
    parts.push({
      id: `part_facade_left_${Date.now()}_7a`,
      name: 'Фасад левый (МДФ)',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: doorW,
      depthBinding: 'facade',
      heightBinding: 'facade',
      offsetX: -Math.round(W / 4),
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    });
    parts.push({
      id: `part_facade_right_${Date.now()}_7b`,
      name: 'Фасад правый (МДФ)',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: 'МДФ фасад 18 мм',
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: doorW,
      depthBinding: 'facade',
      heightBinding: 'facade',
      offsetX: Math.round(W / 4),
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    });
  }

  return parts;
}

/**
 * Рассчитывает точную 3D-геометрию и раскройные размеры детали на основе ее параметрических привязок
 */
export function evaluatePartGeometry(
  part: CustomSectionPart,
  sectionDim: { width: number; height: number; depth: number },
  settings: ProjectSettings,
  allParts?: CustomSectionPart[]
): EvaluatedPartGeometry {
  const W = sectionDim.width;
  const H = sectionDim.height;
  const D = sectionDim.depth;
  const dspThick = settings.dspThickness ?? 16;
  const t = part.thickness || dspThick;

  // 1. ШИРИНА И ПОЛОЖЕНИЕ X
  let width = W;
  let posX = part.offsetX;

  switch (part.widthBinding) {
    case 'between_sides':
      // Между внутренними гранями двух боковин (с технологическим зазором 2 мм под полкодержатели)
      width = Math.max(10, W - 2 * dspThick - (part.category === 'shelf' ? 4 : 0));
      posX = part.offsetX;
      break;

    case 'full_width':
      width = W;
      posX = part.offsetX;
      break;

    case 'left_side':
      width = t;
      posX = -W / 2 + t / 2 + part.offsetX;
      break;

    case 'right_side':
      width = t;
      posX = W / 2 - t / 2 + part.offsetX;
      break;

    case 'custom':
      width = part.customWidth ?? 300;
      posX = part.offsetX;
      break;
  }

  // 2. ВЫСОТА И ПОЛОЖЕНИЕ Y
  let height = H;
  let posY = part.offsetY;

  switch (part.heightBinding) {
    case 'full_height':
      height = H;
      posY = part.offsetY;
      break;

    case 'bottom_pass':
      height = t;
      posY = -H / 2 + t / 2 + part.offsetY;
      break;

    case 'top_roof':
      height = t;
      posY = H / 2 - t / 2 + part.offsetY;
      break;

    case 'shelf':
      height = t;
      posY = part.offsetY;
      break;

    case 'between_bottom_top':
      height = Math.max(10, H - 2 * dspThick);
      posY = part.offsetY;
      break;

    case 'facade':
      height = Math.max(10, H - 4);
      posY = part.offsetY;
      break;

    case 'custom':
      height = part.customHeight ?? 100;
      posY = part.offsetY;
      break;
  }

  // 3. ГЛУБИНА И ПОЛОЖЕНИЕ Z
  let depth = D;
  let posZ = part.offsetZ;

  switch (part.depthBinding) {
    case 'full_depth':
      depth = D;
      posZ = part.offsetZ;
      break;

    case 'recessed_front':
      // С отступом 20 мм от лицевого края под фасад / петли
      depth = Math.max(10, D - 20);
      posZ = -10 + part.offsetZ;
      break;

    case 'back_wall':
      depth = t;
      posZ = -D / 2 + t / 2 + part.offsetZ;
      break;

    case 'facade':
      depth = t;
      posZ = D / 2 + t / 2 + part.offsetZ;
      break;

    case 'custom':
      depth = part.customDepth ?? D;
      posZ = part.offsetZ;
      break;
  }

  // 4. ОПРЕДЕЛЕНИЕ 2D РАЗМЕРОВ ДЛЯ РАСКРОЯ (Cut dimensions)
  // Для горизонтальных деталей: Длина = width, Ширина = depth
  // Для вертикальных боковин: Длина = height, Ширина = depth
  // Для фасадов и задних стенок: Длина = height, Ширина = width
  let cutLength = width;
  let cutWidth = depth;

  if (part.category === 'carcass') {
    if (part.widthBinding === 'left_side' || part.widthBinding === 'right_side') {
      cutLength = height;
      cutWidth = depth;
    } else {
      cutLength = width;
      cutWidth = depth;
    }
  } else if (part.category === 'shelf') {
    cutLength = width;
    cutWidth = depth;
  } else if (part.category === 'facade' || part.category === 'back' || part.category === 'drawer') {
    cutLength = Math.max(height, width);
    cutWidth = Math.min(height, width);
  } else if (part.category === 'divider') {
    cutLength = height;
    cutWidth = depth;
  } else {
    // Общий случай: больший размер как длина, меньший как ширина
    const dims = [width, height, depth].filter((d) => d > t);
    if (dims.length >= 2) {
      cutLength = Math.max(dims[0], dims[1]);
      cutWidth = Math.min(dims[0], dims[1]);
    }
  }

  cutLength = Math.round(cutLength);
  cutWidth = Math.round(cutWidth);
  const areaM2 = Number(((cutLength * cutWidth) / 1_000_000).toFixed(3));

  return {
    width: Math.round(width),
    height: Math.round(height),
    depth: Math.round(depth),
    posX: Math.round(posX),
    posY: Math.round(posY),
    posZ: Math.round(posZ),
    cutLength,
    cutWidth,
    thickness: t,
    areaM2,
  };
}

/**
 * Фабрика создания новой детали секции с автоматическими привязками
 */
export function createNewCustomPart(
  type: 'shelf' | 'divider' | 'facade' | 'panel' | 'tsarga' | 'drawer' | 'custom',
  materialType: PartMaterialType,
  sectionDim: { width: number; height: number; depth: number },
  settings: ProjectSettings,
  existingParts: CustomSectionPart[]
): CustomSectionPart {
  const dspThick = settings.dspThickness ?? 16;
  const preset = MATERIAL_PRESETS[materialType] ?? MATERIAL_PRESETS.ldsp;
  const t = preset.defaultThickness;
  const id = `part_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (type === 'shelf') {
    const existingShelves = existingParts.filter((p) => p.category === 'shelf');
    const shelfNum = existingShelves.length + 1;
    // Размещаем новую полку на удобной высоте
    const step = sectionDim.height / (shelfNum + 1);
    const offsetY = Math.round(-sectionDim.height / 2 + step * shelfNum);

    return {
      id,
      name: `Полка вкладная №${shelfNum}`,
      category: 'shelf',
      materialType,
      materialName: preset.name,
      color: preset.color,
      thickness: t,
      widthBinding: 'between_sides',
      depthBinding: 'recessed_front',
      heightBinding: 'shelf',
      offsetX: 0,
      offsetY,
      offsetZ: 0,
      isVisible: true,
    };
  }

  if (type === 'divider') {
    return {
      id,
      name: 'Стойка внутренняя (перегородка)',
      category: 'divider',
      materialType,
      materialName: preset.name,
      color: preset.color,
      thickness: t,
      widthBinding: 'custom',
      customWidth: t,
      depthBinding: 'recessed_front',
      heightBinding: 'between_bottom_top',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    };
  }

  if (type === 'drawer') {
    const existingDrawers = existingParts.filter((p) => p.category === 'drawer');
    const drawerNum = existingDrawers.length + 1;
    return {
      id,
      name: `Фасад ящика №${drawerNum} (МДФ)`,
      category: 'drawer',
      materialType: 'mdf_facade',
      materialName: MATERIAL_PRESETS.mdf_facade.name,
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'custom',
      customWidth: Math.max(100, sectionDim.width - 4),
      depthBinding: 'facade',
      heightBinding: 'custom',
      customHeight: 180,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    };
  }

  if (type === 'facade') {
    return {
      id,
      name: 'Фасад накладной',
      category: 'facade',
      materialType: 'mdf_facade',
      materialName: MATERIAL_PRESETS.mdf_facade.name,
      color: MATERIAL_PRESETS.mdf_facade.color,
      thickness: 18,
      widthBinding: 'full_width',
      depthBinding: 'facade',
      heightBinding: 'facade',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    };
  }

  if (type === 'tsarga') {
    return {
      id,
      name: 'Царга / планка жесткости',
      category: 'carcass',
      materialType,
      materialName: preset.name,
      color: preset.color,
      thickness: t,
      widthBinding: 'between_sides',
      depthBinding: 'custom',
      customDepth: 100,
      heightBinding: 'top_roof',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    };
  }

  if (type === 'panel') {
    return {
      id,
      name: 'Декоративная панель',
      category: 'custom',
      materialType,
      materialName: preset.name,
      color: preset.color,
      thickness: t,
      widthBinding: 'custom',
      customWidth: sectionDim.width,
      depthBinding: 'custom',
      customDepth: sectionDim.depth,
      heightBinding: 'custom',
      customHeight: t,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      isVisible: true,
    };
  }

  // type === 'custom'
  return {
    id,
    name: 'Произвольная деталь',
    category: 'custom',
    materialType,
    materialName: preset.name,
    color: preset.color,
    thickness: t,
    widthBinding: 'between_sides',
    depthBinding: 'full_depth',
    heightBinding: 'shelf',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    isVisible: true,
  };
}
