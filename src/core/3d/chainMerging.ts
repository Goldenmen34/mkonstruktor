import { FurnitureModule, ProjectSettings } from '../../types';

export interface CollinearChain {
  type: 'countertop' | 'plinth';
  modules: FurnitureModule[];
  theta: number; // degrees 0..360
  tMin: number;  // mm along row line
  tMax: number;  // mm along row line
  length: number;// mm = tMax - tMin
  dLine: number; // mm depth of line
  y: number;     // mm elevation of cabinets
  height: number;// mm height of cabinets
  depth: number; // mm depth of cabinets
  material: string;
  worldCenter: { x: number; y: number; z: number }; // mm in world space
}

/**
 * Поиск неразрывных цепочек состыкованных вплотную секций (flush dock)
 * для формирования монолитной бесшовной столешницы и единого цоколя.
 *
 * Если между модулями есть зазор (> 3 мм) или модули не выровнены в одну линию,
 * цепочка разрывается, и каждый модуль отображает собственные торцы и CAD-швы,
 * давая пользователю наглядную обратную связь об ошибке стыковки.
 */
export function findCollinearChains(
  modules: FurnitureModule[],
  type: 'countertop' | 'plinth',
  settings?: ProjectSettings
): CollinearChain[] {
  const eligible = modules.filter((m) => {
    if (m.category !== 'kitchen') return false;
    if (type === 'countertop') {
      return Boolean(m.config?.hasCountertop);
    } else {
      // Плинтус / Цоколь
      return Boolean(m.config?.hasPlinth) && (settings?.hasPlinth !== false) && Math.abs(m.position?.y || 0) < 5;
    }
  });

  if (eligible.length === 0) return [];

  // Группировка по углу поворота (с шагом 1 градус)
  const groupsByAngle: { [key: number]: FurnitureModule[] } = {};
  for (const m of eligible) {
    const rawRot = ((m.rotation || 0) % 360 + 360) % 360;
    const roundedRot = Math.round(rawRot);
    if (!groupsByAngle[roundedRot]) groupsByAngle[roundedRot] = [];
    groupsByAngle[roundedRot].push(m);
  }

  const resultChains: CollinearChain[] = [];

  for (const [rotStr, groupMods] of Object.entries(groupsByAngle)) {
    const theta = Number(rotStr);
    const alpha = (theta * Math.PI) / 180;
    const cosA = Math.cos(alpha);
    const sinA = Math.sin(alpha);

    interface ModProj {
      mod: FurnitureModule;
      tCenter: number;
      dCenter: number;
      tStart: number;
      tEnd: number;
      dRef: number;
      H: number;
      D: number;
      mat: string;
      isTall: boolean;
      isBlind: boolean;
    }

    const isGlobalGola = modules.some((m) => m.config?.handleType === 'gola');
    const overhangFront = isGlobalGola ? 36 : (settings?.countertopFrontOverhang ?? 50);

    const projected: ModProj[] = groupMods.map((m) => {
      const tCenter = m.position.x * cosA - m.position.z * sinA;
      const dCenter = m.position.x * sinA + m.position.z * cosA;
      const W = m.dimensions.width;
      const H = m.dimensions.height;
      const D = m.dimensions.depth || 600;
      const isTall = m.subType === 'tall';
      const isBlind = m.subType === 'corner' || m.id.includes('corner_blind') || Boolean(m.config?.blindCornerWidth);

      let tStart = tCenter - W / 2;
      let tEnd = tCenter + W / 2;

      // Особая видимая зона цоколя у углового blind-модуля (глухая часть не имеет фасадного цоколя)
      if (type === 'plinth' && isBlind) {
        const blindW = m.config?.blindCornerWidth ?? 600;
        const isRight = m.config?.blindCornerSide === 'right' || Boolean(m.config?.isMirrored);
        if (isRight) {
          tEnd = tCenter + W / 2 - blindW;
        } else {
          tStart = tCenter - W / 2 + blindW;
        }
      }

      // Вычисление глубины линии привязки (dRef)
      let dRef = dCenter;
      if (type === 'plinth') {
        const back = dCenter - D / 2;
        const carcassFront = back + (isTall ? D : (D - overhangFront));
        dRef = carcassFront - 50; // цоколь утоплен на 50 мм от передней плоскости корпуса
      }

      const mat = type === 'countertop'
        ? (m.materials?.countertop || 'countertop_marble')
        : (m.materials?.carcass || 'carcass_white');

      return {
        mod: m,
        tCenter,
        dCenter,
        tStart,
        tEnd,
        dRef,
        H,
        D,
        mat,
        isTall,
        isBlind,
      };
    });

    // Кластеризация по линиям (коллинеарность: одинаковая глубина и высота)
    const lines: ModProj[][] = [];

    for (const p of projected) {
      let foundLine = false;
      for (const line of lines) {
        const ref = line[0];
        const sameDepth = Math.abs(p.dRef - ref.dRef) <= 4;
        const sameY = Math.abs((p.mod.position?.y || 0) - (ref.mod.position?.y || 0)) <= 3;

        let compatible = sameDepth && sameY;
        if (type === 'countertop') {
          const sameH = Math.abs(p.H - ref.H) <= 3;
          const sameD = Math.abs(p.D - ref.D) <= 4;
          const sameMat = p.mat === ref.mat;
          compatible = compatible && sameH && sameD && sameMat;
        }

        if (compatible) {
          line.push(p);
          foundLine = true;
          break;
        }
      }
      if (!foundLine) {
        lines.push([p]);
      }
    }

    // Внутри каждой линии ищем стыкующиеся вплотную цепочки (|gap| <= 3 мм)
    for (const line of lines) {
      line.sort((a, b) => a.tStart - b.tStart);

      let currentChain = [line[0]];

      for (let i = 1; i < line.length; i++) {
        const prev = currentChain[currentChain.length - 1];
        const curr = line[i];

        const gap = curr.tStart - prev.tEnd;

        if (Math.abs(gap) <= 3) {
          currentChain.push(curr);
        } else {
          // Зазор > 3 мм — цепочка обрывается
          if (currentChain.length >= 2) {
            resultChains.push(createChain(currentChain, theta, type, settings, overhangFront));
          }
          currentChain = [curr];
        }
      }

      if (currentChain.length >= 2) {
        resultChains.push(createChain(currentChain, theta, type, settings, overhangFront));
      }
    }
  }

  return resultChains;
}

function createChain(
  mods: Array<{
    mod: FurnitureModule;
    tCenter: number;
    dCenter: number;
    tStart: number;
    tEnd: number;
    dRef: number;
    H: number;
    D: number;
    mat: string;
    isTall: boolean;
  }>,
  theta: number,
  type: 'countertop' | 'plinth',
  settings?: ProjectSettings,
  overhangFront: number = 50
): CollinearChain {
  const tMin = mods[0].tStart;
  const tMax = mods[mods.length - 1].tEnd;
  const ref = mods[0];
  const alpha = (theta * Math.PI) / 180;
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);

  const tMid = (tMin + tMax) / 2;
  const length = tMax - tMin;
  const D = ref.D;
  const H = ref.H;
  const y = ref.mod.position?.y || 0;

  let dCenterLine = ref.dCenter;
  let worldY = 0;

  if (type === 'countertop') {
    const topThick = settings?.countertopThickness ?? 40;
    worldY = y + H + topThick / 2;
    dCenterLine = ref.dCenter;
  } else {
    // Plinth
    const plinthHeight = settings?.plinthHeight ?? 120;
    worldY = plinthHeight / 2;
    dCenterLine = ref.dRef; // точная координата плоскости цоколя
  }

  const worldX = tMid * cosA + dCenterLine * sinA;
  const worldZ = -tMid * sinA + dCenterLine * cosA;

  return {
    type,
    modules: mods.map((p) => p.mod),
    theta,
    tMin,
    tMax,
    length,
    dLine: dCenterLine,
    y,
    height: H,
    depth: D,
    material: ref.mat,
    worldCenter: { x: worldX, y: worldY, z: worldZ },
  };
}
