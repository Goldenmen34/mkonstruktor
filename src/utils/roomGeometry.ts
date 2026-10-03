import { WallVertex, WallSegment, ArchitecturalColumn, RoomData } from '../types/room';

/**
 * Вычисляет Евклидову длину стены в миллиметрах
 */
export function getWallLength(
  wall: WallSegment,
  verticesMap: Record<string, WallVertex>
): number {
  const v1 = verticesMap[wall.startVertexId];
  const v2 = verticesMap[wall.endVertexId];
  if (!v1 || !v2) return 0;
  const dx = v2.x - v1.x;
  const dz = v2.z - v1.z;
  return Math.round(Math.sqrt(dx * dx + dz * dz));
}

/**
 * Вычисляет угол стены в радианах на плоскости XZ
 */
export function getWallAngle(
  wall: WallSegment,
  verticesMap: Record<string, WallVertex>
): number {
  const v1 = verticesMap[wall.startVertexId];
  const v2 = verticesMap[wall.endVertexId];
  if (!v1 || !v2) return 0;
  return Math.atan2(v2.z - v1.z, v2.x - v1.x);
}

/**
 * Вычисляет координаты центра стены в миллиметрах
 */
export function getWallMidpoint(
  wall: WallSegment,
  verticesMap: Record<string, WallVertex>
): { x: number; z: number } {
  const v1 = verticesMap[wall.startVertexId];
  const v2 = verticesMap[wall.endVertexId];
  if (!v1 || !v2) return { x: 0, z: 0 };
  return {
    x: (v1.x + v2.x) / 2,
    z: (v1.z + v2.z) / 2,
  };
}

/**
 * Проверяет, находится ли точка (px, pz) строго внутри замкнутого контура комнаты
 */
export function isPointInsidePolygon(px: number, pz: number, polygon: WallVertex[]): boolean {
  if (polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect =
      zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Вычисляет единичный нормальный вектор, направленный ВНУТРЬ помещения.
 * Для сложных форм (Г-образные, П-образные, ниши, уступы) проверяет тестовую точку внутри полигона.
 */
export function getInwardWallNormal(
  wall: WallSegment,
  verticesMap: Record<string, WallVertex>,
  allVertices: WallVertex[]
): { nx: number; nz: number } {
  const v1 = verticesMap[wall.startVertexId];
  const v2 = verticesMap[wall.endVertexId];
  if (!v1 || !v2) return { nx: 0, nz: 0 };

  const dx = v2.x - v1.x;
  const dz = v2.z - v1.z;
  const len = Math.hypot(dx, dz);
  if (len === 0) return { nx: 0, nz: 0 };

  const n1x = dz / len;
  const n1z = -dx / len;

  const midX = (v1.x + v2.x) / 2;
  const midZ = (v1.z + v2.z) / 2;

  // Проверяем тестовую точку со смещением 8 мм внутрь по направлению n1
  let inside = false;
  if (allVertices && allVertices.length >= 3) {
    inside = isPointInsidePolygon(midX + n1x * 8, midZ + n1z * 8, allVertices);
  } else {
    // Резервный метод по центроиду, если полигон еще не замкнут
    let sumX = 0;
    let sumZ = 0;
    for (const v of allVertices) {
      sumX += v.x;
      sumZ += v.z;
    }
    const centroidX = allVertices.length > 0 ? sumX / allVertices.length : 0;
    const centroidZ = allVertices.length > 0 ? sumZ / allVertices.length : 0;
    inside = n1x * (centroidX - midX) + n1z * (centroidZ - midZ) > 0;
  }

  let finalNx = inside ? n1x : -n1x;
  let finalNz = inside ? n1z : -n1z;

  // Округляем практически строго ортогональные нормали для предотвращения микропогрешностей
  if (Math.abs(finalNx) > 0.98) {
    finalNx = Math.sign(finalNx);
    finalNz = 0;
  } else if (Math.abs(finalNz) > 0.98) {
    finalNz = Math.sign(finalNz);
    finalNx = 0;
  }

  return { nx: finalNx, nz: finalNz };
}

/**
 * Вычисляет единичный нормальный вектор, направленный НАРУЖУ помещения
 * (для выноса физической толщины стены наружу, чтобы внутренняя грань была строго встык)
 */
export function getOutwardWallNormal(
  wall: WallSegment,
  verticesMap: Record<string, WallVertex>,
  allVertices: WallVertex[]
): { nx: number; nz: number } {
  const inNorm = getInwardWallNormal(wall, verticesMap, allVertices);
  return { nx: -inNorm.nx, nz: -inNorm.nz };
}

/**
 * Вычисляет расстояние от точки до отрезка на плоскости XZ (в миллиметрах)
 */
export function distancePointToSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): { distance: number; closestX: number; closestZ: number; t: number } {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;

  if (lenSq === 0) {
    const d = Math.hypot(px - x1, pz - z1);
    return { distance: d, closestX: x1, closestZ: z1, t: 0 };
  }

  let t = ((px - x1) * dx + (pz - z1) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestZ = z1 + t * dz;
  const distance = Math.hypot(px - closestX, pz - closestZ);

  return { distance, closestX, closestZ, t };
}

/**
 * Преобразует массив вершин в быстрый словарь Record<id, WallVertex>
 */
export function buildVertexMap(vertices: WallVertex[]): Record<string, WallVertex> {
  const map: Record<string, WallVertex> = {};
  for (const v of vertices) {
    map[v.id] = v;
  }
  return map;
}

/**
 * Пресет 1: Прямоугольное помещение (4 стены, толщина 100 мм)
 */
export function createRectangularRoom(
  width = 4000,
  length = 3000,
  height = 2700,
  floorColor = '#C2A17E',
  wallColor = '#E2E8F0'
): RoomData {
  const halfW = width / 2;
  const halfL = length / 2;

  const vertices: WallVertex[] = [
    { id: 'v0', x: -halfW, z: -halfL }, // Задний левый угол
    { id: 'v1', x: halfW, z: -halfL },  // Задний правый угол
    { id: 'v2', x: halfW, z: halfL },   // Передний правый угол
    { id: 'v3', x: -halfW, z: halfL },  // Передний левый угол
  ];

  const walls: WallSegment[] = [
    { id: 'w0', startVertexId: 'v0', endVertexId: 'v1', thickness: 100, height, name: 'Стена 1 (Задняя)' },
    { id: 'w1', startVertexId: 'v1', endVertexId: 'v2', thickness: 100, height, name: 'Стена 2 (Правая)' },
    { id: 'w2', startVertexId: 'v2', endVertexId: 'v3', thickness: 100, height, name: 'Стена 3 (Передняя)' },
    { id: 'w3', startVertexId: 'v3', endVertexId: 'v0', thickness: 100, height, name: 'Стена 4 (Левая)' },
  ];

  return {
    vertices,
    walls,
    columns: [],
    openings: [],
    utilities: [],
    height,
    floorColor,
    wallColor,
    template: 'rectangular',
    selectedWallId: 'w0',
    selectedVertexId: null,
    selectedColumnId: null,
    selectedOpeningId: null,
    selectedUtilityId: null,
    activeWallElevationId: null,
  };
}

/**
 * Пресет 2: Угловое Г-образное помещение (6 стен, толщина 100 мм)
 */
export function createLShapedRoom(
  wMain = 4500,
  lMain = 3500,
  cutW = 1800,
  cutL = 1500,
  height = 2700,
  floorColor = '#C2A17E',
  wallColor = '#E2E8F0'
): RoomData {
  const halfW = wMain / 2;
  const halfL = lMain / 2;

  const vertices: WallVertex[] = [
    { id: 'v0', x: -halfW, z: -halfL },
    { id: 'v1', x: halfW, z: -halfL },
    { id: 'v2', x: halfW, z: halfL - cutL },
    { id: 'v3', x: halfW - cutW, z: halfL - cutL },
    { id: 'v4', x: halfW - cutW, z: halfL },
    { id: 'v5', x: -halfW, z: halfL },
  ];

  const walls: WallSegment[] = [
    { id: 'w0', startVertexId: 'v0', endVertexId: 'v1', thickness: 100, height, name: 'Стена 1 (Задняя)' },
    { id: 'w1', startVertexId: 'v1', endVertexId: 'v2', thickness: 100, height, name: 'Стена 2 (Правая верх)' },
    { id: 'w2', startVertexId: 'v2', endVertexId: 'v3', thickness: 100, height, name: 'Стена 3 (Внутр. угол)' },
    { id: 'w3', startVertexId: 'v3', endVertexId: 'v4', thickness: 100, height, name: 'Стена 4 (Внутр. ниша)' },
    { id: 'w4', startVertexId: 'v4', endVertexId: 'v5', thickness: 100, height, name: 'Стена 5 (Передняя)' },
    { id: 'w5', startVertexId: 'v5', endVertexId: 'v0', thickness: 100, height, name: 'Стена 6 (Левая)' },
  ];

  return {
    vertices,
    walls,
    columns: [],
    openings: [],
    utilities: [],
    height,
    floorColor,
    wallColor,
    template: 'l_shaped',
    selectedWallId: 'w0',
    selectedVertexId: null,
    selectedColumnId: null,
    selectedOpeningId: null,
    selectedUtilityId: null,
    activeWallElevationId: null,
  };
}

/**
 * Пресет 3: П-образное помещение (8 стен, толщина 100 мм)
 */
export function createUShapedRoom(
  wMain = 4200,
  lMain = 3200,
  cutW = 2000,
  cutL = 1600,
  height = 2700,
  floorColor = '#C2A17E',
  wallColor = '#E2E8F0'
): RoomData {
  const halfW = wMain / 2;
  const halfL = lMain / 2;
  const sideW = (wMain - cutW) / 2;

  const vertices: WallVertex[] = [
    { id: 'v0', x: -halfW, z: -halfL },
    { id: 'v1', x: halfW, z: -halfL },
    { id: 'v2', x: halfW, z: halfL },
    { id: 'v3', x: halfW - sideW, z: halfL },
    { id: 'v4', x: halfW - sideW, z: halfL - cutL },
    { id: 'v5', x: -halfW + sideW, z: halfL - cutL },
    { id: 'v6', x: -halfW + sideW, z: halfL },
    { id: 'v7', x: -halfW, z: halfL },
  ];

  const walls: WallSegment[] = [
    { id: 'w0', startVertexId: 'v0', endVertexId: 'v1', thickness: 100, height, name: 'Стена 1 (Задняя)' },
    { id: 'w1', startVertexId: 'v1', endVertexId: 'v2', thickness: 100, height, name: 'Стена 2 (Правая)' },
    { id: 'w2', startVertexId: 'v2', endVertexId: 'v3', thickness: 100, height, name: 'Стена 3 (Правое крыло)' },
    { id: 'w3', startVertexId: 'v3', endVertexId: 'v4', thickness: 100, height, name: 'Стена 4 (Правый вход)' },
    { id: 'w4', startVertexId: 'v4', endVertexId: 'v5', thickness: 100, height, name: 'Стена 5 (Внутренник)' },
    { id: 'w5', startVertexId: 'v5', endVertexId: 'v6', thickness: 100, height, name: 'Стена 6 (Левый вход)' },
    { id: 'w6', startVertexId: 'v6', endVertexId: 'v7', thickness: 100, height, name: 'Стена 7 (Левое крыло)' },
    { id: 'w7', startVertexId: 'v7', endVertexId: 'v0', thickness: 100, height, name: 'Стена 8 (Левая)' },
  ];

  return {
    vertices,
    walls,
    columns: [],
    openings: [],
    utilities: [],
    height,
    floorColor,
    wallColor,
    template: 'u_shaped',
    selectedWallId: 'w0',
    selectedVertexId: null,
    selectedColumnId: null,
    selectedOpeningId: null,
    selectedUtilityId: null,
    activeWallElevationId: null,
  };
}

/**
 * Пресет 4: Кухня с венткоробом (прямоугольное помещение + архитектурный элемент Венткороб в углу)
 */
export function createWithDuctRoom(
  width = 4000,
  length = 3000,
  ductW = 450,
  ductD = 450,
  height = 2700,
  floorColor = '#C2A17E',
  wallColor = '#E2E8F0'
): RoomData {
  const room = createRectangularRoom(width, length, height, floorColor, wallColor);
  room.template = 'with_duct';

  // Размещаем венткороб в правом заднем углу встык к стенам
  const ductX = width / 2 - ductW / 2;
  const ductZ = -length / 2 + ductD / 2;

  const defaultDuct: ArchitecturalColumn = {
    id: `col_duct_${Date.now().toString().slice(-4)}`,
    name: 'Венткороб (450×450)',
    x: ductX,
    z: ductZ,
    width: ductW,
    depth: ductD,
    rotation: 0,
  };

  room.columns = [defaultDuct];
  room.selectedColumnId = defaultDuct.id;
  return room;
}

/**
 * Проверяет, находится ли прямоугольник мебели или колонны габаритами w x d с центром в (cx, cz)
 * полностью внутри периметра помещения.
 */
export function isBoxInsideRoom(
  cx: number,
  cz: number,
  w: number,
  d: number,
  vertices: WallVertex[]
): boolean {
  if (vertices.length < 3) return true;
  // Слегка стягиваем тестовые точки внутрь на 1.5 мм,
  // чтобы объекты, прижатые встык к стене (gap=0 или gap=2), не отклонялись из-за погрешностей на ребрах
  const hw = Math.max(1, w / 2 - 1.5);
  const hd = Math.max(1, d / 2 - 1.5);
  const points = [
    { x: cx - hw, z: cz - hd },
    { x: cx + hw, z: cz - hd },
    { x: cx + hw, z: cz + hd },
    { x: cx - hw, z: cz + hd },
    { x: cx, z: cz - hd },
    { x: cx, z: cz + hd },
    { x: cx - hw, z: cz },
    { x: cx + hw, z: cz },
  ];
  for (const pt of points) {
    if (!isPointInsidePolygon(pt.x, pt.z, vertices)) {
      return false;
    }
  }
  return true;
}

export interface SnapAndClampResult {
  x: number;
  z: number;
  snappedWallId?: string;
  snappedAxis?: 'X' | 'Z' | 'both';
}

/**
 * Вычисляет привязку (магнетизм) и физическое ограничение (clamping) ко ВСЕМ стенам помещения:
 * - Внешним стенам контура
 * - Внутренним граням стен (уступы, ниши, перегородки, L/U-образные углы)
 * - Гарантирует, что мебель или венткороб не проникают сквозь стены и не покидают пределы комнаты
 */
export function snapAndClampToWalls(
  targetX: number,
  targetZ: number,
  width: number,
  depth: number,
  walls: WallSegment[],
  verticesMap: Record<string, WallVertex>,
  allVertices: WallVertex[],
  gap = 0,
  snapThreshold = 80,
  currentX?: number,
  currentZ?: number
): SnapAndClampResult {
  let resultX = targetX;
  let resultZ = targetZ;

  const curX = currentX !== undefined ? currentX : targetX;
  const curZ = currentZ !== undefined ? currentZ : targetZ;

  const hw = width / 2;
  const hd = depth / 2;

  let bestSnapZ: number | null = null;
  let minSnapDistZ = snapThreshold;
  let snappedWallIdZ: string | undefined;

  let bestSnapX: number | null = null;
  let minSnapDistX = snapThreshold;
  let snappedWallIdX: string | undefined;

  let limitZMin = -Infinity;
  let limitZMax = Infinity;
  let limitXMin = -Infinity;
  let limitXMax = Infinity;

  for (const wall of walls) {
    const v1 = verticesMap[wall.startVertexId];
    const v2 = verticesMap[wall.endVertexId];
    if (!v1 || !v2) continue;

    const dx = v2.x - v1.x;
    const dz = v2.z - v1.z;
    const len = Math.hypot(dx, dz);
    if (len < 5) continue;

    const norm = getInwardWallNormal(wall, verticesMap, allVertices);
    const isHoriz = Math.abs(dz) <= 15 || Math.abs(dz) / len < 0.15;
    const isVert = Math.abs(dx) <= 15 || Math.abs(dx) / len < 0.15;

    // 1. ГОРИЗОНТАЛЬНАЯ СТЕНА (Задняя, Передняя, горизонтальные грани уступов/ниш)
    if (isHoriz) {
      const zWall = (v1.z + v2.z) / 2;
      const xMin = Math.min(v1.x, v2.x);
      const xMax = Math.max(v1.x, v2.x);

      // Проверяем перекрытие по оси X (с запасом 15 мм для угловых стыков)
      const objMinX = targetX - hw;
      const objMaxX = targetX + hw;
      const overlapX = Math.min(objMaxX, xMax) - Math.max(objMinX, xMin);

      if (overlapX > -15) {
        if (norm.nz > 0.5) {
          // Внутренняя грань стены смотрит в сторону +Z (например, задняя стена или уступ)
          // Помещение находится при Z > zWall
          const zFlush = zWall + hd + gap;
          limitZMin = Math.max(limitZMin, zFlush);

          const dist = Math.abs(targetZ - zFlush);
          if (dist < minSnapDistZ) {
            minSnapDistZ = dist;
            bestSnapZ = zFlush;
            snappedWallIdZ = wall.id;
          }
        } else if (norm.nz < -0.5) {
          // Внутренняя грань стены смотрит в сторону -Z (например, передняя стена или нижний край уступа)
          // Помещение находится при Z < zWall
          const zFlush = zWall - hd - gap;
          limitZMax = Math.min(limitZMax, zFlush);

          const dist = Math.abs(targetZ - zFlush);
          if (dist < minSnapDistZ) {
            minSnapDistZ = dist;
            bestSnapZ = zFlush;
            snappedWallIdZ = wall.id;
          }
        }
      }
    }

    // 2. ВЕРТИКАЛЬНАЯ СТЕНА (Левая, Правая, боковые грани уступов/ниш)
    if (isVert) {
      const xWall = (v1.x + v2.x) / 2;
      const zMin = Math.min(v1.z, v2.z);
      const zMax = Math.max(v1.z, v2.z);

      // Проверяем перекрытие по оси Z (с запасом 15 мм для угловых стыков)
      const objMinZ = targetZ - hd;
      const objMaxZ = targetZ + hd;
      const overlapZ = Math.min(objMaxZ, zMax) - Math.max(objMinZ, zMin);

      if (overlapZ > -15) {
        if (norm.nx > 0.5) {
          // Внутренняя грань смотрит в сторону +X (например, левая стена)
          // Помещение находится при X > xWall
          const xFlush = xWall + hw + gap;
          limitXMin = Math.max(limitXMin, xFlush);

          const dist = Math.abs(targetX - xFlush);
          if (dist < minSnapDistX) {
            minSnapDistX = dist;
            bestSnapX = xFlush;
            snappedWallIdX = wall.id;
          }
        } else if (norm.nx < -0.5) {
          // Внутренняя грань смотрит в сторону -X (например, правая стена)
          // Помещение находится при X < xWall
          const xFlush = xWall - hw - gap;
          limitXMax = Math.min(limitXMax, xFlush);

          const dist = Math.abs(targetX - xFlush);
          if (dist < minSnapDistX) {
            minSnapDistX = dist;
            bestSnapX = xFlush;
            snappedWallIdX = wall.id;
          }
        }
      }
    }
  }

  // Применяем примагничивание к стенам
  if (bestSnapZ !== null) {
    resultZ = bestSnapZ;
  }
  if (bestSnapX !== null) {
    resultX = bestSnapX;
  }

  // Применяем физический барьер (clamping)
  if (limitZMin !== -Infinity && limitZMax !== Infinity && limitZMin > limitZMax) {
    resultZ = (limitZMin + limitZMax) / 2;
  } else {
    if (limitZMin !== -Infinity) resultZ = Math.max(resultZ, limitZMin);
    if (limitZMax !== Infinity) resultZ = Math.min(resultZ, limitZMax);
  }

  if (limitXMin !== -Infinity && limitXMax !== Infinity && limitXMin > limitXMax) {
    resultX = (limitXMin + limitXMax) / 2;
  } else {
    if (limitXMin !== -Infinity) resultX = Math.max(resultX, limitXMin);
    if (limitXMax !== Infinity) resultX = Math.min(resultX, limitXMax);
  }

  return {
    x: resultX,
    z: resultZ,
    snappedWallId: snappedWallIdZ || snappedWallIdX,
    snappedAxis:
      bestSnapX !== null && bestSnapZ !== null
        ? 'both'
        : bestSnapX !== null
        ? 'X'
        : bestSnapZ !== null
        ? 'Z'
        : undefined,
  };
}

