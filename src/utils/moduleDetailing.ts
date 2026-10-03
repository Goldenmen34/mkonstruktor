import { FurnitureModule, ProjectSettings } from '../types';

export interface EdgeSpec {
  thickness: number; // in mm: 0 (no edge), 0.4, 1.0, 2.0
  length: number;    // in mm
  label: string;     // e.g. "ПВХ 2.0" or "ПВХ 0.4" or "—"
  color: string;     // hex color for 3D visualization
}

export interface ModulePart {
  id: string;
  number: number;
  name: string;
  category: 'carcass' | 'facade' | 'back' | 'shelf' | 'drawer' | 'countertop' | 'plinth' | 'hardware';
  length: number;    // mm (направление текстуры / больший размер)
  width: number;     // mm (поперек текстуры)
  thickness: number; // mm (16, 18, 19, 4, 40)
  quantity: number;
  materialName: string;
  materialType: 'ldsp' | 'mdf' | 'hdf' | 'countertop' | 'plastic' | 'metal';
  // 4 стороны кромки (L1, L2, W1, W2)
  edges: {
    l1: EdgeSpec; // Лицевой торец (Front / Top)
    l2: EdgeSpec; // Задний торец (Back / Bottom)
    w1: EdgeSpec; // Боковой торец 1 (Left / Side)
    w2: EdgeSpec; // Боковой торец 2 (Right / Side)
  };
  // 3D данные для интерактивной взрыв-схемы (в метрах)
  pos: [number, number, number];       // Собранное положение [x, y, z]
  size: [number, number, number];      // Размеры бокса [dx, dy, dz]
  explodeDir: [number, number, number];// Вектор разлета детали при взрыве
  color: string;                       // Основной цвет детали в 3D
}

export interface ModuleHardware {
  id: string;
  name: string;
  article?: string;
  count: number;
  unit: string; // 'шт.', 'компл.', 'п.м.'
  note?: string;
}

export interface ModuleDetailingSummary {
  module: FurnitureModule;
  parts: ModulePart[];
  hardware: ModuleHardware[];
  edgeTotals: { [thickness: string]: { lengthMeters: number; color: string; label: string } };
  areaTotals: { [material: string]: number }; // Material name -> area in m²
  totalPartsCount: number;
}

const EDGE_COLORS: Record<number, string> = {
  0: '#334155',    // Без кромки (Slate 700)
  0.4: '#06B6D4',  // ПВХ 0.4 мм (Cyan 500)
  1.0: '#3B82F6',  // ПВХ 1.0 мм (Blue 500)
  2.0: '#F59E0B',  // ПВХ 2.0 мм (Amber 500)
};

function createEdge(thickness: number, length: number): EdgeSpec {
  const t = thickness;
  return {
    thickness: t,
    length,
    label: t > 0 ? `ПВХ ${t.toFixed(1)} мм` : '—',
    color: EDGE_COLORS[t] ?? '#06B6D4',
  };
}

/**
 * Параметрический генератор деталировки и взрыв-схемы модуля
 */
export function extractModuleDetailing(
  mod: FurnitureModule,
  settings: ProjectSettings
): ModuleDetailingSummary {
  const W = mod.dimensions.width;
  const H = mod.dimensions.height;
  const D = mod.dimensions.depth;

  const dspThick = settings.dspThickness ?? 16;
  const isTallCabinet = mod.subType === 'tall' || (mod as any).mainGroup === 'tall' || mod.id.startsWith('k_tall_');
  const isTopCabinet = mod.subType === 'top' || (mod as any).mainGroup === 'top' || mod.id.startsWith('k_top_');
  const isWallCabinet = !isTallCabinet && !isTopCabinet && (mod.subType === 'wall' || (mod as any).mainGroup === 'wall' || mod.id.startsWith('k_wall_'));
  const isBaseOrCorner = !isWallCabinet && !isTallCabinet && !isTopCabinet && (mod.subType === 'base' || mod.subType === 'corner');
  const isUpperCabinet = isWallCabinet || isTopCabinet;

  const plinthH = !isUpperCabinet && mod.config.hasPlinth !== false && settings.hasPlinth !== false
    ? (settings.plinthHeight ?? 120)
    : 0;
  const bodyH = H - plinthH;

  const carcassD = isUpperCabinet
    ? D
    : (isTallCabinet
        ? Math.min(D, 560)
        : (isBaseOrCorner
            ? Math.min(D - 20, settings.baseBodyDepth ?? 560)
            : D));

  const overhangFront = isTallCabinet
    ? 0
    : (isBaseOrCorner ? (settings.countertopFrontOverhang ?? 40) : 0);
  const overhangBack = isTallCabinet
    ? Math.max(0, D - carcassD)
    : (isBaseOrCorner ? Math.max(0, D - carcassD - overhangFront) : 0);

  // Координаты Z в мм (относительно центра модуля)
  const Z_frontCarcass = D / 2 - overhangFront;
  const Z_backCarcass = -D / 2 + overhangBack;
  const Z_carcassCenter = (Z_frontCarcass + Z_backCarcass) / 2;

  const defaultBlindWidth = isUpperCabinet ? (mod.dimensions.depth || 320) : 600;
  const isBlindCorner = mod.subType === 'corner' || mod.id.includes('corner_blind') || Boolean(mod.config.blindCornerWidth);
  const blindWidth = isBlindCorner ? (mod.config.blindCornerWidth ?? defaultBlindWidth) : 0;
  const isRightCorner = isBlindCorner && (mod.config.blindCornerSide === 'right' || Boolean(mod.config.isMirrored));
  const isMirrored = Boolean(mod.config.isMirrored);

  const isOven = mod.id.includes('oven') || mod.name.toLowerCase().includes('духов');
  const isCargo = mod.id.includes('cargo') || mod.name.toLowerCase().includes('бутылоч') || mod.name.toLowerCase().includes('карго');
  const isDishwasher = mod.id.includes('dishwasher') || mod.name.toLowerCase().includes('посудомоеч');
  const isDrying = mod.config.specialCabinetType === 'drying' || mod.id.includes('drying') || mod.name.toLowerCase().includes('сушк');
  const isHood = mod.config.specialCabinetType === 'hood' || mod.id.includes('hood') || mod.name.toLowerCase().includes('вытяжк');
  const isMicrowave = mod.config.specialCabinetType === 'microwave' || mod.id.includes('microwave') || mod.name.toLowerCase().includes('свч') || mod.name.toLowerCase().includes('микроволн');

  const isOpenCabinet = Boolean(mod.config.isOpenShelf) || (mod.config.doors === 0 && mod.config.drawers === 0 && !isOven && !isDishwasher && !isCargo && !isMicrowave && !isDrying && !isHood);
  const isCombined = mod.config.drawers > 0 && mod.config.doors > 0 && !isOven;

  const doorOpeningType = mod.config.doorOpeningType ?? 'swing';
  const isLift = doorOpeningType === 'lift';
  const isAventosHF = doorOpeningType === 'aventos_hf';
  const isDoubleLift = doorOpeningType === 'double_lift';

  const parts: ModulePart[] = [];
  const hardware: ModuleHardware[] = [];
  let partCounter = 1;

  const innerW = W - dspThick * 2;
  const facadeThick = 18;

  // Параметрические зазоры и допуски фасадов по настройкам проекта
  const baseSideGap = settings.baseFacadeSideGap ?? 1.5;
  const baseTopGap = settings.baseFacadeTopGap ?? 3.0;
  const baseBottomGap = settings.baseFacadeBottomGap ?? 2.0;

  const upperSideGap = settings.upperFacadeSideGap ?? 1.5;
  const upperTopGap = settings.upperFacadeTopGap ?? 2.0;
  const upperBottomOverhang = settings.upperFacadeBottomOverhang ?? 20.0;

  const interGap = settings.interFacadeGap ?? 3.0;

  const sideGap = isUpperCabinet ? upperSideGap : baseSideGap;
  const topGap = isUpperCabinet ? upperTopGap : baseTopGap;
  const bottomGap = isUpperCabinet ? 0 : baseBottomGap;
  const bottomOverhang = isWallCabinet ? upperBottomOverhang : 0;

  // Интегрированная система профилей Gola
  const isGola = isBaseOrCorner && mod.config.handleType === 'gola';
  const golaType = mod.config.golaType ?? 'type1';
  const golaTopGap = 30; // 30 мм чистовой зазор под столешницей для скрытого хвата рукой
  const effectiveTopGap = isGola ? golaTopGap : topGap;
  const golaGap = 30; // 30 мм зазор Gola между фасадами под захват рукой

  // Расчет выкатных ящиков и позиций C-профилей Gola
  const hasDrawers = mod.config.drawers > 0;
  const drawerCount = mod.config.drawers;
  const isThreeDrawers = drawerCount === 3;

  const drawerGapSizes: number[] = [];
  const hasCProfileList: boolean[] = [];
  const cProfileWorldYs: number[] = [];
  let dHeights: number[] = [];
  const drawerBottomYs: number[] = [];

  if (hasDrawers) {
    for (let k = 0; k < drawerCount - 1; k++) {
      if (!isGola) {
        hasCProfileList.push(false);
        drawerGapSizes.push(interGap);
      } else if (drawerCount === 2) {
        hasCProfileList.push(true);
        drawerGapSizes.push(golaGap);
      } else if (golaType === 'type2') {
        hasCProfileList.push(true);
        drawerGapSizes.push(golaGap);
      } else {
        // type1: C-профиль только между нижним (k=0) и средним (k=1)
        const hasC = k === 0;
        hasCProfileList.push(hasC);
        drawerGapSizes.push(hasC ? golaGap : interGap);
      }
    }

    const totalInterGaps = drawerGapSizes.reduce((sum, g) => sum + g, 0);
    const availH = bodyH - effectiveTopGap - bottomGap - totalInterGaps;

    if (isThreeDrawers) {
      const topH = 140;
      const deepH = Math.max(50, Math.round((availH - topH) / 2));
      dHeights = [deepH, deepH, topH];
    } else {
      const dH = Math.round(availH / drawerCount);
      dHeights = Array(drawerCount).fill(dH);
    }

    let curBtm = (isUpperCabinet ? 0 : plinthH) + bottomGap;
    for (let d = 0; d < drawerCount; d++) {
      drawerBottomYs.push(curBtm);
      const h = dHeights[d];
      curBtm += h;
      if (d < drawerCount - 1) {
        const gapSize = drawerGapSizes[d];
        if (hasCProfileList[d]) {
          cProfileWorldYs.push(curBtm + gapSize / 2);
        }
        curBtm += gapSize;
      }
    }
  }

  // --- МАТЕРИАЛЫ ---
  const carcassMatName = `ЛДСП ${dspThick} мм (Белый базовый / Свисспан)`;
  const facadeMatName = `МДФ ${facadeThick} мм в пленке ПВХ`;
  const backMatName = 'ХДФ 4 мм (Белый лакированный)';
  const countertopMatName = `Влагостойкая столешница HPL ${settings.countertopThickness ?? 40} мм`;
  const plinthMatName = `Цокольная планка ПВХ ${plinthH} мм`;

  // 1. БОКОВИНЫ КАРКАСА (ДЛЯ НИЖНИХ ТУМБ БОКОВИНЫ СТАВЯТСЯ НА ДНО: ВЫСОТА = bodyH - dspThick)
  const sideH = isBaseOrCorner ? bodyH - dspThick : bodyH;
  const sidePosY = isBaseOrCorner
    ? plinthH + dspThick + sideH / 2
    : plinthH + bodyH / 2;

  const sideLeftName = isBaseOrCorner
    ? (isGola
        ? (cProfileWorldYs.length > 0
            ? `Боковина левая (выпилы под профили Gola L и C, ${cProfileWorldYs.length + 1} паза)`
            : 'Боковина левая (выпил под профиль Gola L 55×26 мм)')
        : 'Боковина левая (ставится на дно)')
    : 'Боковина левая';

  const sideRightName = isBaseOrCorner
    ? (isGola
        ? (cProfileWorldYs.length > 0
            ? `Боковина правая (выпилы под профили Gola L и C, ${cProfileWorldYs.length + 1} паза)`
            : 'Боковина правая (выпил под профиль Gola L 55×26 мм)')
        : 'Боковина правая (ставится на дно)')
    : 'Боковина правая';

  parts.push({
    id: 'part_side_left',
    number: partCounter++,
    name: sideLeftName,
    category: 'carcass',
    length: sideH,
    width: carcassD,
    thickness: dspThick,
    quantity: 1,
    materialName: carcassMatName,
    materialType: 'ldsp',
    edges: {
      l1: createEdge(0.4, sideH),    // Лицевой торец
      l2: createEdge(0.4, sideH),    // Задний торец к стене (стойки кромим по двум длинным)
      w1: createEdge(0.4, carcassD), // Верхний торец под столешницу
      w2: createEdge(isBaseOrCorner ? 0 : 0.4, carcassD), // Нижний торец (на дно - без кромки)
    },
    pos: [(-W / 2 + dspThick / 2) / 1000, sidePosY / 1000, Z_carcassCenter / 1000],
    size: [dspThick / 1000, sideH / 1000, carcassD / 1000],
    explodeDir: [-1.2, 0, 0],
    color: '#E2E8F0',
  });

  // 2. БОКОВИНА ПРАВАЯ
  parts.push({
    id: 'part_side_right',
    number: partCounter++,
    name: sideRightName,
    category: 'carcass',
    length: sideH,
    width: carcassD,
    thickness: dspThick,
    quantity: 1,
    materialName: carcassMatName,
    materialType: 'ldsp',
    edges: {
      l1: createEdge(0.4, sideH),
      l2: createEdge(0.4, sideH), // Задний торец к стене (стойки кромим по двум длинным)
      w1: createEdge(0.4, carcassD),
      w2: createEdge(isBaseOrCorner ? 0 : 0.4, carcassD),
    },
    pos: [(W / 2 - dspThick / 2) / 1000, sidePosY / 1000, Z_carcassCenter / 1000],
    size: [dspThick / 1000, sideH / 1000, carcassD / 1000],
    explodeDir: [1.2, 0, 0],
    color: '#E2E8F0',
  });

  // 3. ДНО КОРПУСА (ПРОХОДНОЕ ДНО ПОД ОПОРЫ ДЛЯ НИЖНИХ ТУМБ: ШИРИНА = W)
  const bottomW = isBaseOrCorner ? W : innerW;
  parts.push({
    id: 'part_bottom',
    number: partCounter++,
    name: isBaseOrCorner ? 'Дно корпуса (проходное дно под опоры)' : 'Дно корпуса (горизонт нижний)',
    category: 'carcass',
    length: bottomW,
    width: carcassD,
    thickness: dspThick,
    quantity: 1,
    materialName: carcassMatName,
    materialType: 'ldsp',
    edges: {
      l1: createEdge(0.4, bottomW),    // Передний торец
      l2: createEdge(0.4, bottomW),    // Задний торец к стене
      w1: createEdge(isBaseOrCorner ? 0.4 : 0, carcassD), // Левый торец (кромка 0.4 для нижних)
      w2: createEdge(isBaseOrCorner ? 0.4 : 0, carcassD), // Правый торец (кромка 0.4 для нижних)
    },
    pos: [0, (plinthH + dspThick / 2) / 1000, Z_carcassCenter / 1000],
    size: [bottomW / 1000, dspThick / 1000, carcassD / 1000],
    explodeDir: [0, -1.2, 0],
    color: '#CBD5E1',
  });

  // 4. КРЫШКА (ДЛЯ ВЕРХНИХ, АНТРЕСОЛЕЙ И ПЕНАЛОВ) ИЛИ ЦАРГИ (ДЛЯ НИЖНИХ)
  if (isUpperCabinet || isTallCabinet || mod.category === 'wardrobe') {
    parts.push({
      id: 'part_top',
      number: partCounter++,
      name: 'Крышка корпуса (горизонт верхний)',
      category: 'carcass',
      length: innerW,
      width: carcassD,
      thickness: dspThick,
      quantity: 1,
      materialName: carcassMatName,
      materialType: 'ldsp',
      edges: {
        l1: createEdge(0.4, innerW),
        l2: createEdge(0, innerW),
        w1: createEdge(0, carcassD),
        w2: createEdge(0, carcassD),
      },
      pos: [0, (H - dspThick / 2) / 1000, Z_carcassCenter / 1000],
      size: [innerW / 1000, dspThick / 1000, carcassD / 1000],
      explodeDir: [0, 1.2, 0],
      color: '#CBD5E1',
    });
  } else {
    const tsargW = 100; // 100 мм ширина верхней царги
    parts.push({
      id: 'part_tsarga_front',
      number: partCounter++,
      name: isGola ? 'Царга верхняя передняя (вертикальная под профиль Gola)' : 'Царга верхняя передняя',
      category: 'carcass',
      length: innerW,
      width: tsargW,
      thickness: dspThick,
      quantity: 1,
      materialName: carcassMatName,
      materialType: 'ldsp',
      edges: {
        l1: createEdge(0.4, innerW),
        l2: createEdge(0.4, innerW), // Кромим по двум длинным сторонам
        w1: createEdge(0, tsargW),
        w2: createEdge(0, tsargW),
      },
      pos: [0, (H - (isGola ? tsargW / 2 : dspThick / 2)) / 1000, (Z_frontCarcass - (isGola ? 26 + dspThick / 2 : tsargW / 2)) / 1000],
      size: [innerW / 1000, (isGola ? tsargW : dspThick) / 1000, (isGola ? dspThick : tsargW) / 1000],
      explodeDir: [0, 0.8, 0.8],
      color: '#94A3B8',
    });

    parts.push({
      id: 'part_tsarga_back',
      number: partCounter++,
      name: 'Царга верхняя задняя',
      category: 'carcass',
      length: innerW,
      width: tsargW,
      thickness: dspThick,
      quantity: 1,
      materialName: carcassMatName,
      materialType: 'ldsp',
      edges: {
        l1: createEdge(0.4, innerW),
        l2: createEdge(0.4, innerW), // Кромим по двум длинным сторонам
        w1: createEdge(0, tsargW),
        w2: createEdge(0, tsargW),
      },
      pos: [0, (H - dspThick / 2) / 1000, (Z_backCarcass + tsargW / 2) / 1000],
      size: [innerW / 1000, dspThick / 1000, tsargW / 1000],
      explodeDir: [0, 0.8, -0.8],
      color: '#94A3B8',
    });
  }

  // 4.B. ПРОФИЛИ GOLA (ДЛЯ НИЖНИХ ТУМБ С СИСТЕМОЙ GOLA)
  if (isGola) {
    // 1) Верхний L-профиль под столешницу
    parts.push({
      id: 'part_gola_profile_l',
      number: partCounter++,
      name: 'Профиль алюминиевый Gola L-образный (верхний горизонт под столешницу)',
      category: 'hardware',
      length: W,
      width: 55,
      thickness: 26,
      quantity: 1,
      materialName: 'Алюминий анодированный матовый',
      materialType: 'metal',
      edges: {
        l1: createEdge(0, W),
        l2: createEdge(0, W),
        w1: createEdge(0, 55),
        w2: createEdge(0, 55),
      },
      pos: [0, (H - 0.055 / 2 * 1000) / 1000, (Z_frontCarcass - 0.026 / 2 * 1000) / 1000],
      size: [W / 1000, 0.055, 0.026],
      explodeDir: [0, 0.6, 1.4],
      color: '#CBD5E1',
    });

    // 2) Промежуточные C-профили между ящиками
    cProfileWorldYs.forEach((cY, idx) => {
      parts.push({
        id: `part_gola_profile_c_${idx}`,
        number: partCounter++,
        name: `Профиль алюминиевый Gola C-образный межуровневый ${cProfileWorldYs.length > 1 ? `№${idx + 1}` : ''} (между ящиками)`,
        category: 'hardware',
        length: W,
        width: 55,
        thickness: 26,
        quantity: 1,
        materialName: 'Алюминий анодированный матовый',
        materialType: 'metal',
        edges: {
          l1: createEdge(0, W),
          l2: createEdge(0, W),
          w1: createEdge(0, 55),
          w2: createEdge(0, 55),
        },
        pos: [0, cY / 1000, (Z_frontCarcass - 0.026 / 2 * 1000) / 1000],
        size: [W / 1000, 0.055, 0.026],
        explodeDir: [0, 0.3 * (idx + 1), 1.6 + 0.3 * idx],
        color: '#94A3B8',
      });
    });
  }

  // 5. ОПОРНАЯ ПЛАНКА / ПИЛЛЕР (ДЛЯ УГЛОВОГО МОДУЛЯ — ОПИРАЕТСЯ НА ДНО)
  if (isBlindCorner) {
    const pillarThick = dspThick;
    const pillarDepth = 80;
    const pillarH = isBaseOrCorner ? bodyH - dspThick : bodyH - dspThick * 2;
    const pillarPosY = plinthH + dspThick + pillarH / 2;
    const dockX = isRightCorner ? (W / 2 - blindWidth) : (-W / 2 + blindWidth);
    const pillarX = isRightCorner
      ? (isUpperCabinet ? dockX - 50 + pillarThick / 2 : W / 2 - blindWidth + pillarThick / 2)
      : (isUpperCabinet ? dockX + 50 - pillarThick / 2 : -W / 2 + blindWidth - pillarThick / 2);

    parts.push({
      id: 'part_pillar',
      number: partCounter++,
      name: 'Стойка вертикальная опорная (под петли фальш-панели)',
      category: 'carcass',
      length: pillarH,
      width: pillarDepth,
      thickness: pillarThick,
      quantity: 1,
      materialName: carcassMatName,
      materialType: 'ldsp',
      edges: {
        l1: createEdge(0.4, pillarH),
        l2: createEdge(0.4, pillarH), // Стойки кромим по двум длинным сторонам
        w1: createEdge(0, pillarDepth),
        w2: createEdge(0, pillarDepth),
      },
      pos: [pillarX / 1000, pillarPosY / 1000, (Z_frontCarcass - pillarDepth / 2) / 1000],
      size: [pillarThick / 1000, pillarH / 1000, pillarDepth / 1000],
      explodeDir: [isRightCorner ? 0.4 : -0.4, 0, 0.6],
      color: '#94A3B8',
    });
  }

  // 6. ЗАДНЯЯ СТЕНКА (ХДФ 4 мм)
  if (!mod.id.includes('sink') && !isOven && mod.config.hasBackWall !== false) {
    const hdfW = W - 8;
    const hdfH = bodyH - 8;
    parts.push({
      id: 'part_back_wall',
      number: partCounter++,
      name: 'Задняя стенка (в паз или внакладку)',
      category: 'back',
      length: hdfW,
      width: hdfH,
      thickness: 4,
      quantity: 1,
      materialName: backMatName,
      materialType: 'hdf',
      edges: {
        l1: createEdge(0, hdfW),
        l2: createEdge(0, hdfW),
        w1: createEdge(0, hdfH),
        w2: createEdge(0, hdfH),
      },
      pos: [0, (plinthH + bodyH / 2) / 1000, (Z_backCarcass + 2) / 1000],
      size: [hdfW / 1000, hdfH / 1000, 0.004],
      explodeDir: [0, 0, -1.6],
      color: '#F1F5F9',
    });
  }

  // 7. ПОЛКИ
  if (mod.config.shelves > 0) {
    const shelfCount = mod.config.shelves;
    const shelfW = innerW - 4; // 2 мм зазор с каждой стороны под полкодержатели
    const isBlind = isBlindCorner;
    const pillarDepth = 80;
    const shelfD = isBlind ? carcassD - pillarDepth - 15 : carcassD - 20;
    const shelfPosZ = isBlind ? Z_backCarcass + 5 + shelfD / 2 : Z_carcassCenter - 10;
    const shelfStep = bodyH / (shelfCount + 1);

    for (let s = 1; s <= shelfCount; s++) {
      parts.push({
        id: `part_shelf_${s}`,
        number: partCounter++,
        name: shelfCount === 1 ? 'Полка съемная (вкладная)' : `Полка съемная №${s}`,
        category: 'shelf',
        length: shelfW,
        width: shelfD,
        thickness: dspThick,
        quantity: 1,
        materialName: carcassMatName,
        materialType: 'ldsp',
        edges: {
          l1: createEdge(0.4, shelfW), // Передний видимый торец
          l2: createEdge(0, shelfW),
          w1: createEdge(0, shelfD),
          w2: createEdge(0, shelfD),
        },
        pos: [0, (plinthH + shelfStep * s) / 1000, shelfPosZ / 1000],
        size: [shelfW / 1000, dspThick / 1000, shelfD / 1000],
        explodeDir: [0, 0, 0.4 * s],
        color: '#CBD5E1',
      });
    }
  }

  // 8. ФАСАДЫ И ДЕКОРАТИВНЫЕ ПАНЕЛИ
  if (isOpenCabinet) {
    // Открытая секция — фасады отсутствуют
  } else if (isOven) {
    // 8.OVEN: Встроенный духовой шкаф + ящик под противни
    const ovenDrawerH = 130;
    const ovenDrawerW = W - sideGap * 2;
    const fPosZ = Z_frontCarcass + facadeThick / 2;
    const fPosY = plinthH + bottomGap + ovenDrawerH / 2;

    parts.push({
      id: 'part_oven_shelf',
      number: partCounter++,
      name: 'Полка опорная под духовой шкаф (горизонт)',
      category: 'carcass',
      length: innerW,
      width: carcassD - 20,
      thickness: dspThick,
      quantity: 1,
      materialName: carcassMatName,
      materialType: 'ldsp',
      edges: {
        l1: createEdge(0.4, innerW),
        l2: createEdge(0, innerW),
        w1: createEdge(0, carcassD - 20),
        w2: createEdge(0, carcassD - 20),
      },
      pos: [0, (plinthH + bottomGap + ovenDrawerH + dspThick / 2) / 1000, (Z_carcassCenter - 10) / 1000],
      size: [innerW / 1000, dspThick / 1000, (carcassD - 20) / 1000],
      explodeDir: [0, -0.4, 0.4],
      color: '#CBD5E1',
    });

    parts.push({
      id: 'part_oven_drawer_facade',
      number: partCounter++,
      name: 'Фасад ящика под противни (нижний)',
      category: 'facade',
      length: ovenDrawerW,
      width: ovenDrawerH,
      thickness: facadeThick,
      quantity: 1,
      materialName: facadeMatName,
      materialType: 'mdf',
      edges: {
        l1: createEdge(2.0, ovenDrawerW),
        l2: createEdge(2.0, ovenDrawerW),
        w1: createEdge(2.0, ovenDrawerH),
        w2: createEdge(2.0, ovenDrawerH),
      },
      pos: [0, fPosY / 1000, fPosZ / 1000],
      size: [ovenDrawerW / 1000, ovenDrawerH / 1000, facadeThick / 1000],
      explodeDir: [0, -0.2, 1.4],
      color: '#2563EB',
    });

    const boxW = innerW - 75;
    const boxD = carcassD - 50;
    parts.push({
      id: 'part_oven_drawer_bottom',
      number: partCounter++,
      name: 'Дно ящика под противни (ЛДСП)',
      category: 'drawer',
      length: boxW,
      width: boxD,
      thickness: dspThick,
      quantity: 1,
      materialName: carcassMatName,
      materialType: 'ldsp',
      edges: {
        l1: createEdge(0, boxW),
        l2: createEdge(0, boxW),
        w1: createEdge(0, boxD),
        w2: createEdge(0, boxD),
      },
      pos: [0, (plinthH + bottomGap + 16) / 1000, (Z_carcassCenter - 10) / 1000],
      size: [boxW / 1000, dspThick / 1000, boxD / 1000],
      explodeDir: [0, -0.3, 1.2],
      color: '#94A3B8',
    });

  } else if (isCargo) {
    // 8.CARGO: Бутылочница с 2-уровневой корзиной
    const cargoH = bodyH - effectiveTopGap - bottomGap;
    const cargoW = W - sideGap * 2;
    parts.push({
      id: 'part_cargo_facade',
      number: partCounter++,
      name: 'Фасад бутылочницы карго (выкатной)',
      category: 'facade',
      length: cargoW,
      width: cargoH,
      thickness: facadeThick,
      quantity: 1,
      materialName: facadeMatName,
      materialType: 'mdf',
      edges: {
        l1: createEdge(2.0, cargoW),
        l2: createEdge(2.0, cargoW),
        w1: createEdge(2.0, cargoH),
        w2: createEdge(2.0, cargoH),
      },
      pos: [0, (plinthH + bottomGap + cargoH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
      size: [cargoW / 1000, cargoH / 1000, facadeThick / 1000],
      explodeDir: [0, 0, 1.6],
      color: '#2563EB',
    });

  } else if (isDishwasher) {
    // 8.DISHWASHER: Фасад для встраиваемой ПММ
    const pmmDoorH = bodyH - effectiveTopGap - bottomGap;
    const pmmDoorW = W - sideGap * 2;
    parts.push({
      id: 'part_dishwasher_facade',
      number: partCounter++,
      name: `Фасад для посудомоечной машины ${W} мм`,
      category: 'facade',
      length: pmmDoorW,
      width: pmmDoorH,
      thickness: facadeThick,
      quantity: 1,
      materialName: facadeMatName,
      materialType: 'mdf',
      edges: {
        l1: createEdge(2.0, pmmDoorW),
        l2: createEdge(2.0, pmmDoorW),
        w1: createEdge(2.0, pmmDoorH),
        w2: createEdge(2.0, pmmDoorH),
      },
      pos: [0, (plinthH + bottomGap + pmmDoorH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
      size: [pmmDoorW / 1000, pmmDoorH / 1000, facadeThick / 1000],
      explodeDir: [0, 0, 1.6],
      color: '#2563EB',
    });

  } else if (isCombined) {
    // 8.COMBINED: 1 верхний ящик под столовые приборы + нижняя распашная дверь
    const topDrawerH = 140;
    const drawerW = W - sideGap * 2;
    const topDrawerPosY = plinthH + bodyH - effectiveTopGap - topDrawerH / 2;

    parts.push({
      id: 'part_combined_drawer_facade',
      number: partCounter++,
      name: 'Фасад малого верхнего ящика (под приборы)',
      category: 'facade',
      length: drawerW,
      width: topDrawerH,
      thickness: facadeThick,
      quantity: 1,
      materialName: facadeMatName,
      materialType: 'mdf',
      edges: {
        l1: createEdge(2.0, drawerW),
        l2: createEdge(2.0, drawerW),
        w1: createEdge(2.0, topDrawerH),
        w2: createEdge(2.0, topDrawerH),
      },
      pos: [0, topDrawerPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
      size: [drawerW / 1000, topDrawerH / 1000, facadeThick / 1000],
      explodeDir: [0, 0.4, 1.5],
      color: '#2563EB',
    });

    const boxW = innerW - 75;
    const boxD = carcassD - 50;
    parts.push({
      id: 'part_combined_drawer_bottom',
      number: partCounter++,
      name: 'Дно верхнего ящика (ЛДСП)',
      category: 'drawer',
      length: boxW,
      width: boxD,
      thickness: dspThick,
      quantity: 1,
      materialName: carcassMatName,
      materialType: 'ldsp',
      edges: {
        l1: createEdge(0, boxW),
        l2: createEdge(0, boxW),
        w1: createEdge(0, boxD),
        w2: createEdge(0, boxD),
      },
      pos: [0, (topDrawerPosY - topDrawerH / 2 + 16) / 1000, (Z_carcassCenter - 10) / 1000],
      size: [boxW / 1000, dspThick / 1000, boxD / 1000],
      explodeDir: [0, 0.2, 1.3],
      color: '#94A3B8',
    });

    const doorH = bodyH - effectiveTopGap - bottomGap - interGap - topDrawerH;
    const doorCount = mod.config.doors;
    if (doorCount === 1) {
      const doorW = W - sideGap * 2;
      parts.push({
        id: 'part_combined_door_facade',
        number: partCounter++,
        name: 'Фасад нижний распашной',
        category: 'facade',
        length: doorW,
        width: doorH,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorW),
          l2: createEdge(2.0, doorW),
          w1: createEdge(2.0, doorH),
          w2: createEdge(2.0, doorH),
        },
        pos: [0, (plinthH + bottomGap + doorH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [0, -0.3, 1.6],
        color: '#2563EB',
      });
    } else {
      const doorW = (W - sideGap * 2 - interGap) / 2;
      parts.push({
        id: 'part_combined_door_l',
        number: partCounter++,
        name: 'Фасад нижний распашной левый',
        category: 'facade',
        length: doorW,
        width: doorH,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorW),
          l2: createEdge(2.0, doorW),
          w1: createEdge(2.0, doorH),
          w2: createEdge(2.0, doorH),
        },
        pos: [(-W / 4) / 1000, (plinthH + bottomGap + doorH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [-0.6, -0.3, 1.6],
        color: '#2563EB',
      });
      parts.push({
        id: 'part_combined_door_r',
        number: partCounter++,
        name: 'Фасад нижний распашной правый',
        category: 'facade',
        length: doorW,
        width: doorH,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorW),
          l2: createEdge(2.0, doorW),
          w1: createEdge(2.0, doorH),
          w2: createEdge(2.0, doorH),
        },
        pos: [(W / 4) / 1000, (plinthH + bottomGap + doorH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [0.6, -0.3, 1.6],
        color: '#2563EB',
      });
    }

  } else if (isMicrowave) {
    const mwNicheH = 380;
    const topDoorH = bodyH - effectiveTopGap - (mwNicheH + dspThick);
    if (topDoorH > 120) {
      const topDoorW = W - sideGap * 2;
      parts.push({
        id: 'part_mw_door',
        number: partCounter++,
        name: 'Фасад верхний настенный (над нишей СВЧ)',
        category: 'facade',
        length: topDoorW,
        width: topDoorH,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, topDoorW),
          l2: createEdge(2.0, topDoorW),
          w1: createEdge(2.0, topDoorH),
          w2: createEdge(2.0, topDoorH),
        },
        pos: [0, (H - effectiveTopGap - topDoorH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [topDoorW / 1000, topDoorH / 1000, facadeThick / 1000],
        explodeDir: [0, 0.4, 1.6],
        color: '#2563EB',
      });
    }

  } else if (isAventosHF || isDoubleLift) {
    const totalDoorH = bodyH - effectiveTopGap - bottomGap + bottomOverhang;
    const panelH = Math.round((totalDoorH - interGap) / 2);
    const doorW = W - sideGap * 2;

    parts.push({
      id: 'part_lift_door_top',
      number: partCounter++,
      name: isAventosHF ? 'Фасад верхний Aventos HF' : 'Фасад подъемный верхний',
      category: 'facade',
      length: doorW,
      width: panelH,
      thickness: facadeThick,
      quantity: 1,
      materialName: facadeMatName,
      materialType: 'mdf',
      edges: {
        l1: createEdge(2.0, doorW),
        l2: createEdge(2.0, doorW),
        w1: createEdge(2.0, panelH),
        w2: createEdge(2.0, panelH),
      },
      pos: [0, (H - effectiveTopGap - panelH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
      size: [doorW / 1000, panelH / 1000, facadeThick / 1000],
      explodeDir: [0, 0.5, 1.6],
      color: '#2563EB',
    });

    parts.push({
      id: 'part_lift_door_btm',
      number: partCounter++,
      name: isAventosHF ? 'Фасад нижний Aventos HF' : 'Фасад подъемный нижний',
      category: 'facade',
      length: doorW,
      width: panelH,
      thickness: facadeThick,
      quantity: 1,
      materialName: facadeMatName,
      materialType: 'mdf',
      edges: {
        l1: createEdge(2.0, doorW),
        l2: createEdge(2.0, doorW),
        w1: createEdge(2.0, panelH),
        w2: createEdge(2.0, panelH),
      },
      pos: [0, ((isUpperCabinet ? 0 : plinthH) + bottomGap - bottomOverhang + panelH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
      size: [doorW / 1000, panelH / 1000, facadeThick / 1000],
      explodeDir: [0, -0.3, 1.6],
      color: '#2563EB',
    });

  } else if (isLift) {
    const doorH = bodyH - effectiveTopGap - bottomGap + bottomOverhang;
    const doorW = W - sideGap * 2;
    parts.push({
      id: 'part_lift_door_single',
      number: partCounter++,
      name: 'Фасад подъемный горизонтальный (Aventos HK / газлифт)',
      category: 'facade',
      length: doorW,
      width: doorH,
      thickness: facadeThick,
      quantity: 1,
      materialName: facadeMatName,
      materialType: 'mdf',
      edges: {
        l1: createEdge(2.0, doorW),
        l2: createEdge(2.0, doorW),
        w1: createEdge(2.0, doorH),
        w2: createEdge(2.0, doorH),
      },
      pos: [0, ((isUpperCabinet ? 0 : plinthH) + bottomGap - bottomOverhang + doorH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
      size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
      explodeDir: [0, 0.4, 1.6],
      color: '#2563EB',
    });

  } else if (isBlindCorner) {
    // Внимание: фальш-панель и угловой добор строго позиционируются по каркасу
    const cornerFillerW = 50; // 50 мм лицевая декоративная планка
    const returnPlankW = isUpperCabinet ? 32 : 50; // 32 мм возвратная планка для навесных
    const unifiedPanelW = blindWidth + cornerFillerW; // 370 мм единая панель для навесных
    const cornerAssemblyW = isUpperCabinet ? unifiedPanelW : blindWidth;
    const blindPanelW = isUpperCabinet ? blindWidth : (blindWidth - cornerFillerW);

    const doorH = bodyH - effectiveTopGap - bottomGap + bottomOverhang;
    const doorW = (W - cornerAssemblyW) - sideGap - (interGap / 2);
    const doorPosY = (isUpperCabinet ? 0 : plinthH) + bottomGap - bottomOverhang + doorH / 2;

    const hasBottomOverhang = isUpperCabinet && bottomOverhang > 5;
    const fillerH = hasBottomOverhang ? doorH : bodyH;
    const fillerPosY = hasBottomOverhang ? doorPosY : ((isUpperCabinet ? 0 : plinthH) + bodyH / 2);

    if (!isRightCorner) {
      const dockX = -W / 2 + blindWidth;

      if (isUpperCabinet) {
        // Единая фальш-панель 370 мм (МДФ)
        const uniX = -W / 2 + unifiedPanelW / 2;
        parts.push({
          id: 'part_unified_blind_panel',
          number: partCounter++,
          name: `Единая фальш-панель глухая с угловым добором (${Math.round(unifiedPanelW)} мм)`,
          category: 'facade',
          length: fillerH,
          width: unifiedPanelW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(2.0, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, unifiedPanelW),
            w2: createEdge(0.4, unifiedPanelW),
          },
          pos: [uniX / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
          size: [unifiedPanelW / 1000, fillerH / 1000, facadeThick / 1000],
          explodeDir: [-0.6, 0, 1.3],
          color: '#3B82F6',
        });

        // Возвратная планка 32 мм торцом наружу
        const retX = dockX + facadeThick / 2;
        parts.push({
          id: 'part_corner_return',
          number: partCounter++,
          name: 'Угловой добор торцевой (возвратная планка 32 мм под стык 90°)',
          category: 'facade',
          length: fillerH,
          width: returnPlankW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(2.0, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, returnPlankW),
            w2: createEdge(0.4, returnPlankW),
          },
          pos: [retX / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick + returnPlankW / 2) / 1000],
          size: [facadeThick / 1000, fillerH / 1000, returnPlankW / 1000],
          explodeDir: [-0.4, 0, 1.8],
          color: '#93C5FD',
        });

        // Две наружные упорные планки из ЛДСП (толщина 16 мм, глубина 32 мм):
        // Планка 1: прямо за возвратной МДФ-планкой (встык к ней в глухой зоне)
        const stop1X = dockX - dspThick / 2;
        parts.push({
          id: 'part_ldsp_stop_1',
          number: partCounter++,
          name: 'Планка-упор наружная ЛДСП (упор 32 мм стык с каркасом 90°)',
          category: 'carcass',
          length: fillerH,
          width: returnPlankW,
          thickness: dspThick,
          quantity: 1,
          materialName: carcassMatName,
          materialType: 'ldsp',
          edges: {
            l1: createEdge(0.4, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, returnPlankW),
            w2: createEdge(0.4, returnPlankW),
          },
          pos: [stop1X / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick + returnPlankW / 2) / 1000],
          size: [dspThick / 1000, fillerH / 1000, returnPlankW / 1000],
          explodeDir: [-0.3, 0, 1.6],
          color: '#94A3B8',
        });

        // Планка 2: на расстоянии 50 мм от края глухой зоны (от боковины у стены)
        const stop2X = -W / 2 + 50 + dspThick / 2;
        parts.push({
          id: 'part_ldsp_stop_2',
          number: partCounter++,
          name: 'Планка-упор наружная ЛДСП (упор 32 мм на 50 мм от стены)',
          category: 'carcass',
          length: fillerH,
          width: returnPlankW,
          thickness: dspThick,
          quantity: 1,
          materialName: carcassMatName,
          materialType: 'ldsp',
          edges: {
            l1: createEdge(0.4, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, returnPlankW),
            w2: createEdge(0.4, returnPlankW),
          },
          pos: [stop2X / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick + returnPlankW / 2) / 1000],
          size: [dspThick / 1000, fillerH / 1000, returnPlankW / 1000],
          explodeDir: [-0.6, 0, 1.4],
          color: '#94A3B8',
        });

      } else {
        const bpX = -W / 2 + blindPanelW / 2;
        parts.push({
          id: 'part_blind_panel',
          number: partCounter++,
          name: `Фальш-панель глухая угловая (Blind Panel ${Math.round(blindPanelW)} мм)`,
          category: 'facade',
          length: bodyH,
          width: blindPanelW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(0.4, bodyH),
            l2: createEdge(0.4, bodyH),
            w1: createEdge(0.4, blindPanelW),
            w2: createEdge(0.4, blindPanelW),
          },
          pos: [bpX / 1000, (plinthH + bodyH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
          size: [blindPanelW / 1000, bodyH / 1000, facadeThick / 1000],
          explodeDir: [-0.8, 0, 1.2],
          color: '#3B82F6',
        });

        const spX = -W / 2 + blindPanelW + cornerFillerW / 2;
        parts.push({
          id: 'part_corner_filler',
          number: partCounter++,
          name: 'Угловой добор лицевой (стыковочная планка 50 мм)',
          category: 'facade',
          length: bodyH,
          width: cornerFillerW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(2.0, bodyH),
            l2: createEdge(0.4, bodyH),
            w1: createEdge(0.4, cornerFillerW),
            w2: createEdge(0.4, cornerFillerW),
          },
          pos: [spX / 1000, (plinthH + bodyH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
          size: [cornerFillerW / 1000, bodyH / 1000, facadeThick / 1000],
          explodeDir: [-0.2, 0, 1.5],
          color: '#60A5FA',
        });

        const retDepth = overhangFront + facadeThick / 2;
        if (retDepth > 5) {
          const retX = -W / 2 + blindWidth - cornerFillerW + facadeThick / 2;
          parts.push({
            id: 'part_corner_return',
            number: partCounter++,
            name: 'Боковой возвратный добор (компенсатор свеса столешницы)',
            category: 'facade',
            length: bodyH,
            width: retDepth,
            thickness: facadeThick,
            quantity: 1,
            materialName: facadeMatName,
            materialType: 'mdf',
            edges: {
              l1: createEdge(2.0, bodyH),
              l2: createEdge(0, bodyH),
              w1: createEdge(0.4, retDepth),
              w2: createEdge(0.4, retDepth),
            },
            pos: [retX / 1000, (plinthH + bodyH / 2) / 1000, (Z_frontCarcass + retDepth / 2) / 1000],
            size: [facadeThick / 1000, bodyH / 1000, retDepth / 1000],
            explodeDir: [-0.1, 0, 1.4],
            color: '#93C5FD',
          });
        }
      }

      const doorCenterX = isUpperCabinet
        ? (dockX + cornerFillerW + (interGap / 2) + doorW / 2)
        : (-W / 2 + blindWidth + (interGap / 2) + doorW / 2);
      parts.push({
        id: 'part_facade_door',
        number: partCounter++,
        name: `Фасад распашной угловой (${Math.round(doorW)} мм)`,
        category: 'facade',
        length: doorH,
        width: doorW,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorH),
          l2: createEdge(2.0, doorH),
          w1: createEdge(2.0, doorW),
          w2: createEdge(2.0, doorW),
        },
        pos: [doorCenterX / 1000, doorPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [0.8, 0, 1.8],
        color: '#2563EB',
      });
    } else {
      // Правый угол (зеркальный)
      const dockX = W / 2 - blindWidth;

      const doorCenterX = isUpperCabinet
        ? (dockX - cornerFillerW - (interGap / 2) - doorW / 2)
        : (-W / 2 + sideGap + doorW / 2);
      parts.push({
        id: 'part_facade_door',
        number: partCounter++,
        name: `Фасад распашной угловой (${Math.round(doorW)} мм)`,
        category: 'facade',
        length: doorH,
        width: doorW,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorH),
          l2: createEdge(2.0, doorH),
          w1: createEdge(2.0, doorW),
          w2: createEdge(2.0, doorW),
        },
        pos: [doorCenterX / 1000, doorPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [-0.8, 0, 1.8],
        color: '#2563EB',
      });

      if (isUpperCabinet) {
        // Единая фальш-панель 370 мм (МДФ)
        const uniX = W / 2 - unifiedPanelW / 2;
        parts.push({
          id: 'part_unified_blind_panel',
          number: partCounter++,
          name: `Единая фальш-панель глухая с угловым добором (${Math.round(unifiedPanelW)} мм)`,
          category: 'facade',
          length: fillerH,
          width: unifiedPanelW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(2.0, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, unifiedPanelW),
            w2: createEdge(0.4, unifiedPanelW),
          },
          pos: [uniX / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
          size: [unifiedPanelW / 1000, fillerH / 1000, facadeThick / 1000],
          explodeDir: [0.6, 0, 1.3],
          color: '#3B82F6',
        });

        // Возвратная планка 32 мм торцом наружу
        const retX = dockX - facadeThick / 2;
        parts.push({
          id: 'part_corner_return',
          number: partCounter++,
          name: 'Угловой добор торцевой (возвратная планка 32 мм под стык 90°)',
          category: 'facade',
          length: fillerH,
          width: returnPlankW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(2.0, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, returnPlankW),
            w2: createEdge(0.4, returnPlankW),
          },
          pos: [retX / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick + returnPlankW / 2) / 1000],
          size: [facadeThick / 1000, fillerH / 1000, returnPlankW / 1000],
          explodeDir: [0.4, 0, 1.8],
          color: '#93C5FD',
        });

        // Две наружные упорные планки из ЛДСП (толщина 16 мм, глубина 32 мм):
        // Планка 1: прямо за возвратной МДФ-планкой (встык к ней в глухой зоне)
        const stop1X = dockX + dspThick / 2;
        parts.push({
          id: 'part_ldsp_stop_1',
          number: partCounter++,
          name: 'Планка-упор наружная ЛДСП (упор 32 мм стык с каркасом 90°)',
          category: 'carcass',
          length: fillerH,
          width: returnPlankW,
          thickness: dspThick,
          quantity: 1,
          materialName: carcassMatName,
          materialType: 'ldsp',
          edges: {
            l1: createEdge(0.4, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, returnPlankW),
            w2: createEdge(0.4, returnPlankW),
          },
          pos: [stop1X / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick + returnPlankW / 2) / 1000],
          size: [dspThick / 1000, fillerH / 1000, returnPlankW / 1000],
          explodeDir: [0.3, 0, 1.6],
          color: '#94A3B8',
        });

        // Планка 2: на расстоянии 50 мм от правого края глухой зоны (от боковины у стены)
        const stop2X = W / 2 - 50 - dspThick / 2;
        parts.push({
          id: 'part_ldsp_stop_2',
          number: partCounter++,
          name: 'Планка-упор наружная ЛДСП (упор 32 мм на 50 мм от стены)',
          category: 'carcass',
          length: fillerH,
          width: returnPlankW,
          thickness: dspThick,
          quantity: 1,
          materialName: carcassMatName,
          materialType: 'ldsp',
          edges: {
            l1: createEdge(0.4, fillerH),
            l2: createEdge(0.4, fillerH),
            w1: createEdge(0.4, returnPlankW),
            w2: createEdge(0.4, returnPlankW),
          },
          pos: [stop2X / 1000, fillerPosY / 1000, (Z_frontCarcass + facadeThick + returnPlankW / 2) / 1000],
          size: [dspThick / 1000, fillerH / 1000, returnPlankW / 1000],
          explodeDir: [0.6, 0, 1.4],
          color: '#94A3B8',
        });

      } else {
        const spX = W / 2 - blindWidth + cornerFillerW / 2;
        parts.push({
          id: 'part_corner_filler',
          number: partCounter++,
          name: 'Угловой добор лицевой (стыковочная планка 50 мм)',
          category: 'facade',
          length: bodyH,
          width: cornerFillerW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(2.0, bodyH),
            l2: createEdge(0.4, bodyH),
            w1: createEdge(0.4, cornerFillerW),
            w2: createEdge(0.4, cornerFillerW),
          },
          pos: [spX / 1000, (plinthH + bodyH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
          size: [cornerFillerW / 1000, bodyH / 1000, facadeThick / 1000],
          explodeDir: [0.2, 0, 1.5],
          color: '#60A5FA',
        });

        const retDepth = overhangFront + facadeThick / 2;
        if (retDepth > 5) {
          const retX = W / 2 - blindWidth + cornerFillerW - facadeThick / 2;
          parts.push({
            id: 'part_corner_return',
            number: partCounter++,
            name: 'Боковой возвратный добор (компенсатор свеса столешницы)',
            category: 'facade',
            length: bodyH,
            width: retDepth,
            thickness: facadeThick,
            quantity: 1,
            materialName: facadeMatName,
            materialType: 'mdf',
            edges: {
              l1: createEdge(2.0, bodyH),
              l2: createEdge(0, bodyH),
              w1: createEdge(0.4, retDepth),
              w2: createEdge(0.4, retDepth),
            },
            pos: [retX / 1000, (plinthH + bodyH / 2) / 1000, (Z_frontCarcass + retDepth / 2) / 1000],
            size: [facadeThick / 1000, bodyH / 1000, retDepth / 1000],
            explodeDir: [0.1, 0, 1.4],
            color: '#93C5FD',
          });
        }

        const bpX = W / 2 - blindPanelW / 2;
        parts.push({
          id: 'part_blind_panel',
          number: partCounter++,
          name: `Фальш-панель глухая угловая (Blind Panel ${Math.round(blindPanelW)} мм)`,
          category: 'facade',
          length: bodyH,
          width: blindPanelW,
          thickness: facadeThick,
          quantity: 1,
          materialName: facadeMatName,
          materialType: 'mdf',
          edges: {
            l1: createEdge(0.4, bodyH),
            l2: createEdge(0.4, bodyH),
            w1: createEdge(0.4, blindPanelW),
            w2: createEdge(0.4, blindPanelW),
          },
          pos: [bpX / 1000, (plinthH + bodyH / 2) / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
          size: [blindPanelW / 1000, bodyH / 1000, facadeThick / 1000],
          explodeDir: [0.8, 0, 1.2],
          color: '#3B82F6',
        });
      }
    }
  } else if (mod.config.drawers > 0) {
    const facadeW = W - sideGap * 2;

    for (let d = 0; d < drawerCount; d++) {
      const h = dHeights[d];
      const isTopCutlery = isThreeDrawers && d === drawerCount - 1;
      const name = isTopCutlery
        ? 'Фасад малого ящика (под столовые приборы)'
        : `Фасад выдвижного ящика №${d + 1}`;

      const fPosZ = Z_frontCarcass + facadeThick / 2;
      const curBottom = drawerBottomYs[d] ?? ((isUpperCabinet ? 0 : plinthH) + bottomGap);
      const fPosY = curBottom + h / 2;

      parts.push({
        id: `part_drawer_facade_${d}`,
        number: partCounter++,
        name,
        category: 'facade',
        length: facadeW,
        width: h,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, facadeW),
          l2: createEdge(2.0, facadeW),
          w1: createEdge(2.0, h),
          w2: createEdge(2.0, h),
        },
        pos: [0, fPosY / 1000, fPosZ / 1000],
        size: [facadeW / 1000, h / 1000, facadeThick / 1000],
        explodeDir: [0, (d - 1) * 0.2, 1.4 + d * 0.3],
        color: '#2563EB',
      });

      // Дно ящика ЛДСП 16 мм под Tandembox
      const boxW = innerW - 75;
      const boxD = carcassD - 50;
      parts.push({
        id: `part_drawer_bottom_${d}`,
        number: partCounter++,
        name: `Дно выдвижного ящика №${d + 1} (ЛДСП)`,
        category: 'drawer',
        length: boxW,
        width: boxD,
        thickness: dspThick,
        quantity: 1,
        materialName: carcassMatName,
        materialType: 'ldsp',
        edges: {
          l1: createEdge(0, boxW),
          l2: createEdge(0, boxW),
          w1: createEdge(0, boxD),
          w2: createEdge(0, boxD),
        },
        pos: [0, (curBottom + 16) / 1000, (Z_frontCarcass - boxD / 2) / 1000],
        size: [boxW / 1000, dspThick / 1000, boxD / 1000],
        explodeDir: [0, (d - 1) * 0.2, 1.0 + d * 0.3],
        color: '#94A3B8',
      });
    }
  } else if (mod.config.doors > 0) {
    const doorCount = mod.config.doors;
    const doorH = bodyH - effectiveTopGap - bottomGap + bottomOverhang;
    const doorPosY = (isUpperCabinet ? 0 : plinthH) + bottomGap - bottomOverhang + doorH / 2;

    if (doorCount === 1) {
      const doorW = W - sideGap * 2;
      parts.push({
        id: 'part_facade_door',
        number: partCounter++,
        name: `Фасад распашной (${isMirrored ? 'правые петли' : 'левые петли'})${bottomOverhang > 0 ? ` [свес ${bottomOverhang} мм]` : ''}`,
        category: 'facade',
        length: doorH,
        width: doorW,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorH),
          l2: createEdge(2.0, doorH),
          w1: createEdge(2.0, doorW),
          w2: createEdge(2.0, doorW),
        },
        pos: [0, doorPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [0, 0, 1.8],
        color: '#2563EB',
      });
    } else {
      // 2 двери: ширина каждой = (W - sideGap*2 - interGap) / 2
      const doorW = Math.round((W - sideGap * 2 - interGap) / 2);
      const leftCenterX = -doorW / 2 - interGap / 2;
      const rightCenterX = doorW / 2 + interGap / 2;

      parts.push({
        id: 'part_facade_door_l',
        number: partCounter++,
        name: `Фасад распашной левый${bottomOverhang > 0 ? ` [свес ${bottomOverhang} мм]` : ''}`,
        category: 'facade',
        length: doorH,
        width: doorW,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorH),
          l2: createEdge(2.0, doorH),
          w1: createEdge(2.0, doorW),
          w2: createEdge(2.0, doorW),
        },
        pos: [leftCenterX / 1000, doorPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [-0.6, 0, 1.8],
        color: '#2563EB',
      });

      parts.push({
        id: 'part_facade_door_r',
        number: partCounter++,
        name: `Фасад распашной правый${bottomOverhang > 0 ? ` [свес ${bottomOverhang} мм]` : ''}`,
        category: 'facade',
        length: doorH,
        width: doorW,
        thickness: facadeThick,
        quantity: 1,
        materialName: facadeMatName,
        materialType: 'mdf',
        edges: {
          l1: createEdge(2.0, doorH),
          l2: createEdge(2.0, doorH),
          w1: createEdge(2.0, doorW),
          w2: createEdge(2.0, doorW),
        },
        pos: [rightCenterX / 1000, doorPosY / 1000, (Z_frontCarcass + facadeThick / 2) / 1000],
        size: [doorW / 1000, doorH / 1000, facadeThick / 1000],
        explodeDir: [0.6, 0, 1.8],
        color: '#2563EB',
      });
    }
  }

  // 9. ЦОКОЛЬ
  if (mod.config.hasPlinth !== false && settings.hasPlinth !== false && plinthH > 0) {
    const plinthW = isBlindCorner ? (W - blindWidth) : W;
    const plinthX = isBlindCorner
      ? (isRightCorner ? -W / 2 + plinthW / 2 : -W / 2 + blindWidth + plinthW / 2)
      : 0;

    parts.push({
      id: 'part_plinth',
      number: partCounter++,
      name: isBlindCorner ? 'Цокольная планка (под видимую часть)' : 'Цокольная планка прямая',
      category: 'plinth',
      length: plinthW,
      width: plinthH,
      thickness: 16,
      quantity: 1,
      materialName: plinthMatName,
      materialType: 'plastic',
      edges: {
        l1: createEdge(0, plinthW), // Цоколь ПВХ не кромится
        l2: createEdge(0, plinthW), // Цоколь ПВХ не кромится
        w1: createEdge(0, plinthH), // Цоколь ПВХ не кромится
        w2: createEdge(0, plinthH), // Цоколь ПВХ не кромится
      },
      pos: [plinthX / 1000, (plinthH / 2) / 1000, (Z_frontCarcass - 50) / 1000],
      size: [plinthW / 1000, plinthH / 1000, 0.016],
      explodeDir: [isBlindCorner ? (isRightCorner ? -0.4 : 0.4) : 0, -0.6, 1.2],
      color: '#475569',
    });
  }

  // 10. СТОЛЕШНИЦА
  if (mod.config.hasCountertop) {
    const topThick = settings.countertopThickness ?? 40;
    parts.push({
      id: 'part_countertop',
      number: partCounter++,
      name: 'Столешница кухонная (влагостойкая)',
      category: 'countertop',
      length: W,
      width: D,
      thickness: topThick,
      quantity: 1,
      materialName: countertopMatName,
      materialType: 'countertop',
      edges: {
        l1: createEdge(2.0, W), // Передний каплесборник / кромка
        l2: createEdge(0, W),   // Задний торец к плинтусу
        w1: createEdge(2.0, D), // Боковой торец
        w2: createEdge(2.0, D), // Боковой торец
      },
      pos: [0, (H + topThick / 2) / 1000, 0],
      size: [W / 1000, topThick / 1000, D / 1000],
      explodeDir: [0, 1.8, 0],
      color: '#78716C',
    });
  }

  // --- ФУРНИТУРА И КРЕПЁЖ ---
  // Конфирматы / стяжки
  const confirmatsCount = parts.filter((p) => p.category === 'carcass').length * 4;
  hardware.push({
    id: 'hw_confirmat',
    name: 'Евровинт (конфирмат) 7×50 мм + заглушка',
    count: Math.max(16, confirmatsCount),
    unit: 'шт.',
  });

  hardware.push({
    id: 'hw_dowel',
    name: 'Шкант деревянный 8×30 мм',
    count: Math.max(8, confirmatsCount / 2),
    unit: 'шт.',
  });

  // Опоры (ножки)
  if (isBaseOrCorner && plinthH > 0) {
    const legsCount = isBlindCorner ? 6 : 4;
    hardware.push({
      id: 'hw_legs',
      name: `Опора регулируемая H${plinthH} мм с клипсой цоколя`,
      count: legsCount,
      unit: 'шт.',
    });
  }

  // Навесы для верхних шкафов и антресолей
  if (isUpperCabinet) {
    hardware.push({
      id: 'hw_wall_suspension',
      name: 'Навес кухонный регулируемый скрытый (Camar / Blum) с шиной навески',
      count: 2,
      unit: 'шт.',
    });
  }

  // Петли и подъемные механизмы
  if (isAventosHF) {
    hardware.push({
      id: 'hw_aventos_hf',
      name: 'Подъемный механизм складной Blum Aventos HF (силовой механизм + телескопические рычаги + петли)',
      count: 1,
      unit: 'компл.',
    });
  } else if (isDoubleLift) {
    hardware.push({
      id: 'hw_double_lift',
      name: 'Подъемный механизм поворотный Blum Aventos HK-S / газлифты (2 яруса)',
      count: 2,
      unit: 'компл.',
    });
  } else if (isLift) {
    hardware.push({
      id: 'hw_aventos_hk',
      name: 'Подъемный механизм поворотный Blum Aventos HK-S / газлифты с доводчиком',
      count: 1,
      unit: 'компл.',
    });
  } else if (isBlindCorner) {
    hardware.push({
      id: 'hw_corner_hinges',
      name: 'Петля для фальш-панели 90° Clip Top с доводчиком (Blum/Hettich)',
      count: 2,
      unit: 'шт.',
    });
  } else if (mod.config.doors > 0) {
    hardware.push({
      id: 'hw_hinges',
      name: 'Петля накладная 110° Clip Top с доводчиком (Blum/Hettich)',
      count: mod.config.doors * 2,
      unit: 'шт.',
    });
  }

  // Сушка для посуды
  if (isDrying) {
    hardware.push({
      id: 'hw_dish_rack',
      name: `Сушка для посуды 2-уровневая ${W} мм (сетка под чашки + поддон + стойка под тарелки, нержавеющая сталь)`,
      count: 1,
      unit: 'компл.',
    });
  }

  // Механизмы карго и ПММ
  if (isCargo) {
    hardware.push({
      id: 'hw_cargo_basket',
      name: 'Бутылочница Cargo 2-уровневая с доводчиком и направляющими скрытого монтажа',
      count: 1,
      unit: 'компл.',
    });
  }
  if (isDishwasher) {
    hardware.push({
      id: 'hw_dishwasher_kit',
      name: 'Комплект крепежей и навески фасада на посудомоечную машину',
      count: 1,
      unit: 'компл.',
    });
  }

  // Направляющие для ящиков
  if (mod.config.drawers > 0) {
    hardware.push({
      id: 'hw_slides',
      name: 'Система выдвижения Tandembox / Boyard скрытого монтажа 500 мм',
      count: mod.config.drawers,
      unit: 'компл.',
    });
    if (mod.config.drawers === 3) {
      hardware.push({
        id: 'hw_cutlery',
        name: 'Лоток-органайзер для столовых приборов пластиковый',
        count: 1,
        unit: 'шт.',
      });
    }
  }

  // Полкодержатели
  if (mod.config.shelves > 0) {
    hardware.push({
      id: 'hw_shelf_pins',
      name: 'Полкодержатель металлический с силиконовой втулкой D5',
      count: mod.config.shelves * 4,
      unit: 'шт.',
    });
  }

  // Профиль Gola в спецификации фурнитуры
  if (isGola) {
    hardware.push({
      id: 'hw_gola_profile_l',
      name: `Профиль Gola L-образный верхний под столешницу (L=${W} мм, анодированный алюминий)`,
      count: 1,
      unit: 'шт.',
    });
    hardware.push({
      id: 'hw_gola_brackets_l',
      name: 'Комплект крепежных уголков и фиксаторов L-профиля Gola к боковинам',
      count: 1,
      unit: 'компл.',
    });
    if (cProfileWorldYs.length > 0) {
      hardware.push({
        id: 'hw_gola_profile_c',
        name: `Профиль Gola C-образный межуровневый (L=${W} мм, анодированный алюминий, ${golaType === 'type2' ? 'Тип 2: между всеми ящиками' : 'Тип 1: между нижним и средним'})`,
        count: cProfileWorldYs.length,
        unit: 'шт.',
      });
      hardware.push({
        id: 'hw_gola_brackets_c',
        name: `Комплект фиксаторов и заглушек для C-профилей Gola (${cProfileWorldYs.length} шт.)`,
        count: cProfileWorldYs.length,
        unit: 'компл.',
      });
    }
  }

  // Ручки (для накладных моделей ручек)
  const handlesCount = isBlindCorner ? 1 : (mod.config.doors + mod.config.drawers);
  if (handlesCount > 0 && mod.config.handleType !== 'none' && !isGola) {
    const handleLabels: Record<string, string> = {
      bar: 'Ручка-скоба мебельная 160 мм',
      railing: 'Ручка-рейлинг мебельная 160 мм',
      knob: 'Ручка-кнопка мебельная (точечная)',
      profile: 'Ручка профильная торцевая накладная',
    };
    const handleName = handleLabels[mod.config.handleType || 'bar'] || 'Ручка-скоба мебельная 160 мм';
    hardware.push({
      id: 'hw_handles',
      name: `${handleName} (хром / черная матовая)`,
      count: handlesCount,
      unit: 'шт.',
    });
  }

  // --- СВОДНЫЕ ИТОГИ (КРОМКА И ПЛОЩАДЬ) ---
  const edgeTotals: { [thickness: string]: { lengthMeters: number; color: string; label: string } } = {
    '2.0': { lengthMeters: 0, color: EDGE_COLORS[2.0], label: 'Кромка ПВХ 2.0 мм' },
    '0.4': { lengthMeters: 0, color: EDGE_COLORS[0.4], label: 'Кромка ПВХ 0.4 мм' },
  };

  const areaTotals: { [material: string]: number } = {};

  parts.forEach((p) => {
    // Площадь (в м²)
    const area = (p.length * p.width * p.quantity) / 1_000_000;
    areaTotals[p.materialName] = (areaTotals[p.materialName] ?? 0) + area;

    // Кромка (сумма длин сторон в п.м.)
    Object.values(p.edges).forEach((e) => {
      if (e.thickness === 2.0) {
        edgeTotals['2.0'].lengthMeters += (e.length * p.quantity) / 1000;
      } else if (e.thickness === 0.4 || e.thickness === 1.0) {
        edgeTotals['0.4'].lengthMeters += (e.length * p.quantity) / 1000;
      }
    });
  });

  return {
    module: mod,
    parts,
    hardware,
    edgeTotals,
    areaTotals,
    totalPartsCount: parts.reduce((acc, p) => acc + p.quantity, 0),
  };
}
