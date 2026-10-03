import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  RoomData,
  RoomTemplate,
  WallVertex,
  WallSegment,
  ArchitecturalColumn,
  WallResizeDirection,
  WallOpening,
  WallUtility,
  UtilityCategory,
  UtilityType,
} from '../types/room';
import {
  createRectangularRoom,
  createLShapedRoom,
  createUShapedRoom,
  createWithDuctRoom,
  buildVertexMap,
  getWallLength,
  getInwardWallNormal,
  isBoxInsideRoom,
} from '../utils/roomGeometry';

interface RoomStoreState {
  room: RoomData;
  wallResizeDirection: WallResizeDirection;
  setWallResizeDirection: (dir: WallResizeDirection) => void;
  setTemplate: (template: RoomTemplate) => void;
  selectWall: (id: string | null) => void;
  selectVertex: (id: string | null) => void;
  selectColumn: (id: string | null) => void;
  selectOpening: (id: string | null) => void;
  selectUtility: (id: string | null) => void;
  openWallElevation: (wallId: string) => void;
  closeWallElevation: () => void;
  updateWallLength: (wallId: string, newLength: number, direction?: WallResizeDirection) => void;
  updateVertexPosition: (vertexId: string, x: number, z: number) => void;
  splitWall: (wallId: string) => void;
  deleteWall: (wallId: string) => void;
  extrudeWallSegment: (wallId: string, depth?: number) => void;
  addColumn: (width?: number, depth?: number) => void;
  updateColumn: (id: string, updates: Partial<ArchitecturalColumn>) => void;
  updateColumnPosition: (id: string, x: number, z: number) => void;
  removeColumn: (id: string) => void;
  addOpening: (wallId: string, type: 'window' | 'door') => WallOpening | null;
  updateOpening: (id: string, updates: Partial<WallOpening>) => void;
  removeOpening: (id: string) => void;
  addUtility: (wallId: string, category: UtilityCategory, subType: UtilityType) => WallUtility | null;
  updateUtility: (id: string, updates: Partial<WallUtility>) => void;
  removeUtility: (id: string) => void;
  setCeilingHeight: (height: number) => void;
  setWallThickness: (wallId: string, thickness: number) => void;
  setRoomColors: (floorColor?: string, wallColor?: string) => void;
  resetRoom: () => void;
}

const INITIAL_ROOM = createRectangularRoom(4000, 3000, 2700, '#C2A17E', '#E2E8F0');

export const useRoomStore = create<RoomStoreState>()(
  persist(
    (set, get) => ({
  room: INITIAL_ROOM,
  wallResizeDirection: 'endB',

  setWallResizeDirection: (dir: WallResizeDirection) => set({ wallResizeDirection: dir }),

  setTemplate: (template: RoomTemplate) => {
    const { room } = get();
    let newRoom: RoomData;

    switch (template) {
      case 'l_shaped':
        newRoom = createLShapedRoom(4500, 3500, 1800, 1500, room.height, room.floorColor, room.wallColor);
        break;
      case 'u_shaped':
        newRoom = createUShapedRoom(4200, 3200, 2000, 1600, room.height, room.floorColor, room.wallColor);
        break;
      case 'with_duct':
        newRoom = createWithDuctRoom(4000, 3000, 450, 450, room.height, room.floorColor, room.wallColor);
        break;
      case 'rectangular':
      default:
        newRoom = createRectangularRoom(4000, 3000, room.height, room.floorColor, room.wallColor);
        break;
    }

    set({ room: newRoom });
  },

  selectWall: (id: string | null) =>
    set((state) => ({
      room: {
        ...state.room,
        selectedWallId: id,
        selectedVertexId: null,
        selectedColumnId: null,
        selectedOpeningId: null,
        selectedUtilityId: null,
      },
    })),

  selectVertex: (id: string | null) =>
    set((state) => ({
      room: {
        ...state.room,
        selectedVertexId: id,
        selectedWallId: id ? null : state.room.selectedWallId,
        selectedColumnId: id ? null : state.room.selectedColumnId,
        selectedOpeningId: id ? null : state.room.selectedOpeningId,
        selectedUtilityId: id ? null : state.room.selectedUtilityId,
      },
    })),

  selectColumn: (id: string | null) =>
    set((state) => ({
      room: {
        ...state.room,
        selectedColumnId: id,
        selectedWallId: id ? null : state.room.selectedWallId,
        selectedVertexId: id ? null : state.room.selectedVertexId,
        selectedOpeningId: id ? null : state.room.selectedOpeningId,
        selectedUtilityId: id ? null : state.room.selectedUtilityId,
      },
    })),

  selectOpening: (id: string | null) =>
    set((state) => ({
      room: {
        ...state.room,
        selectedOpeningId: id,
        selectedUtilityId: null,
        selectedColumnId: null,
        selectedVertexId: null,
        selectedWallId: id ? (state.room.openings?.find((o) => o.id === id)?.wallId || state.room.selectedWallId) : state.room.selectedWallId,
      },
    })),

  selectUtility: (id: string | null) =>
    set((state) => ({
      room: {
        ...state.room,
        selectedUtilityId: id,
        selectedOpeningId: null,
        selectedColumnId: null,
        selectedVertexId: null,
        selectedWallId: id ? (state.room.utilities?.find((u) => u.id === id)?.wallId || state.room.selectedWallId) : state.room.selectedWallId,
      },
    })),

  openWallElevation: (wallId: string) =>
    set((state) => ({
      room: {
        ...state.room,
        activeWallElevationId: wallId,
        selectedWallId: wallId,
        selectedOpeningId: null,
        selectedUtilityId: null,
      },
    })),

  closeWallElevation: () =>
    set((state) => ({
      room: {
        ...state.room,
        activeWallElevationId: null,
        selectedOpeningId: null,
        selectedUtilityId: null,
      },
    })),

  /**
   * Параметрическое изменение длины стены с выбором торца (А / Б / Симметрично)
   * и гарантированным сохранением ортогональности 90° (без образования ромбов)
   */
  updateWallLength: (wallId: string, newLength: number, customDir?: WallResizeDirection) => {
    if (newLength < 300) return;
    const { room, wallResizeDirection } = get();
    const direction = customDir || wallResizeDirection;

    const wall = room.walls.find((w) => w.id === wallId);
    if (!wall) return;

    const vMap = buildVertexMap(room.vertices);
    const startV = vMap[wall.startVertexId];
    const endV = vMap[wall.endVertexId];
    if (!startV || !endV) return;

    const currentLen = getWallLength(wall, vMap);
    if (currentLen === 0) return;
    const delta = newLength - currentLen;
    if (Math.abs(delta) < 1) return;

    const isHorizontal = Math.abs(startV.z - endV.z) < 10;
    const isVertical = Math.abs(startV.x - endV.x) < 10;

    let updatedVertices = [...room.vertices];

    if (isHorizontal) {
      if (direction === 'endB') {
        const shiftX = endV.x > startV.x ? delta : -delta;
        const targetOldX = endV.x;
        updatedVertices = updatedVertices.map((v) =>
          Math.abs(v.x - targetOldX) < 10 ? { ...v, x: Math.round(v.x + shiftX) } : v
        );
      } else if (direction === 'endA') {
        const shiftX = startV.x > endV.x ? delta : -delta;
        const targetOldX = startV.x;
        updatedVertices = updatedVertices.map((v) =>
          Math.abs(v.x - targetOldX) < 10 ? { ...v, x: Math.round(v.x + shiftX) } : v
        );
      } else {
        const halfDelta = delta / 2;
        const shiftEndX = endV.x > startV.x ? halfDelta : -halfDelta;
        const shiftStartX = startV.x > endV.x ? halfDelta : -halfDelta;
        const oldStartX = startV.x;
        const oldEndX = endV.x;
        updatedVertices = updatedVertices.map((v) => {
          if (Math.abs(v.x - oldEndX) < 10) return { ...v, x: Math.round(v.x + shiftEndX) };
          if (Math.abs(v.x - oldStartX) < 10) return { ...v, x: Math.round(v.x + shiftStartX) };
          return v;
        });
      }
    } else if (isVertical) {
      if (direction === 'endB') {
        const shiftZ = endV.z > startV.z ? delta : -delta;
        const targetOldZ = endV.z;
        updatedVertices = updatedVertices.map((v) =>
          Math.abs(v.z - targetOldZ) < 10 ? { ...v, z: Math.round(v.z + shiftZ) } : v
        );
      } else if (direction === 'endA') {
        const shiftZ = startV.z > endV.z ? delta : -delta;
        const targetOldZ = startV.z;
        updatedVertices = updatedVertices.map((v) =>
          Math.abs(v.z - targetOldZ) < 10 ? { ...v, z: Math.round(v.z + shiftZ) } : v
        );
      } else {
        const halfDelta = delta / 2;
        const shiftEndZ = endV.z > startV.z ? halfDelta : -halfDelta;
        const shiftStartZ = startV.z > endV.z ? halfDelta : -halfDelta;
        const oldStartZ = startV.z;
        const oldEndZ = endV.z;
        updatedVertices = updatedVertices.map((v) => {
          if (Math.abs(v.z - oldEndZ) < 10) return { ...v, z: Math.round(v.z + shiftEndZ) };
          if (Math.abs(v.z - oldStartZ) < 10) return { ...v, z: Math.round(v.z + shiftStartZ) };
          return v;
        });
      }
    } else {
      const dirX = (endV.x - startV.x) / currentLen;
      const dirZ = (endV.z - startV.z) / currentLen;
      if (direction === 'endB') {
        const newEndX = Math.round(startV.x + dirX * newLength);
        const newEndZ = Math.round(startV.z + dirZ * newLength);
        updatedVertices = updatedVertices.map((v) =>
          v.id === endV.id ? { ...v, x: newEndX, z: newEndZ } : v
        );
      } else if (direction === 'endA') {
        const newStartX = Math.round(endV.x - dirX * newLength);
        const newStartZ = Math.round(endV.z - dirZ * newLength);
        updatedVertices = updatedVertices.map((v) =>
          v.id === startV.id ? { ...v, x: newStartX, z: newStartZ } : v
        );
      }
    }

    set({
      room: {
        ...room,
        vertices: updatedVertices,
      },
    });
  },

  updateVertexPosition: (vertexId: string, x: number, z: number) => {
    const { room } = get();
    const updatedVertices = room.vertices.map((v) =>
      v.id === vertexId ? { ...v, x: Math.round(x), z: Math.round(z) } : v
    );
    set({
      room: {
        ...room,
        vertices: updatedVertices,
      },
    });
  },

  /**
   * Разбить стену на 2 части по одной линии (in-line):
   * Вершина создается СТРОГО на линии стены без самопроизвольного смещения в сторону!
   */
  splitWall: (wallId: string) => {
    const { room } = get();
    const wallIdx = room.walls.findIndex((w) => w.id === wallId);
    if (wallIdx === -1) return;

    const targetWall = room.walls[wallIdx];
    const vMap = buildVertexMap(room.vertices);
    const startV = vMap[targetWall.startVertexId];
    const endV = vMap[targetWall.endVertexId];
    if (!startV || !endV) return;

    const midX = Math.round((startV.x + endV.x) / 2);
    const midZ = Math.round((startV.z + endV.z) / 2);

    const newVertexId = `v_${Date.now().toString().slice(-4)}`;
    const newVertex: WallVertex = { id: newVertexId, x: midX, z: midZ };

    const wall1: WallSegment = {
      ...targetWall,
      id: targetWall.id,
      endVertexId: newVertexId,
      name: `${targetWall.name} (часть 1)`,
    };
    const wall2: WallSegment = {
      ...targetWall,
      id: `w_${Date.now().toString().slice(-4)}`,
      startVertexId: newVertexId,
      endVertexId: targetWall.endVertexId,
      name: `${targetWall.name} (часть 2)`,
    };

    const newWalls = [...room.walls];
    newWalls.splice(wallIdx, 1, wall1, wall2);

    const startVIdx = room.vertices.findIndex((v) => v.id === startV.id);
    const newVertices = [...room.vertices];
    newVertices.splice(startVIdx + 1, 0, newVertex);

    set({
      room: {
        ...room,
        template: 'custom',
        vertices: newVertices,
        walls: newWalls,
        selectedWallId: wall1.id,
      },
    });
  },

  /**
   * Удалить стену / сегмент стены с автоматическим замыканием контура помещения:
   * Отрезок удаляется, а предшествующая стена соединяется напрямую со следующей точкой.
   */
  deleteWall: (wallId: string) => {
    const { room } = get();
    if (room.walls.length <= 3) {
      alert('Минимум 3 стены для замкнутого контура помещения!');
      return;
    }

    const wallIdx = room.walls.findIndex((w) => w.id === wallId);
    if (wallIdx === -1) return;

    const targetWall = room.walls[wallIdx];
    const vStartId = targetWall.startVertexId;
    const vEndId = targetWall.endVertexId;

    // Находим стену, которая входила в начальную точку удаляемой стены
    const prevWall = room.walls.find((w) => w.endVertexId === vStartId);
    if (!prevWall) return;

    // Предыдущая стена теперь замыкается напрямую на конечную точку удаляемой стены
    const updatedPrevWall: WallSegment = {
      ...prevWall,
      endVertexId: vEndId,
    };

    const newWalls = room.walls
      .filter((w) => w.id !== wallId)
      .map((w) => (w.id === prevWall.id ? updatedPrevWall : w));

    // Если вершина vStartId больше не используется другими стенами, удаляем её из массива вершин
    const isVStartUsed = newWalls.some(
      (w) => w.startVertexId === vStartId || w.endVertexId === vStartId
    );

    const newVertices = isVStartUsed
      ? room.vertices
      : room.vertices.filter((v) => v.id !== vStartId);

    set({
      room: {
        ...room,
        template: 'custom',
        walls: newWalls,
        vertices: newVertices,
        openings: (room.openings || []).filter((o) => o.wallId !== wallId),
        utilities: (room.utilities || []).filter((u) => u.wallId !== wallId),
        selectedWallId: updatedPrevWall.id,
      },
    });
  },

  /**
   * Выдавить выбранный сегмент стены внутрь или наружу с образованием строгого прямого уступа 90°
   */
  extrudeWallSegment: (wallId: string, depth = 350) => {
    const { room } = get();
    const wallIdx = room.walls.findIndex((w) => w.id === wallId);
    if (wallIdx === -1) return;

    const targetWall = room.walls[wallIdx];
    const vMap = buildVertexMap(room.vertices);
    const startV = vMap[targetWall.startVertexId];
    const endV = vMap[targetWall.endVertexId];
    if (!startV || !endV) return;

    const normal = getInwardWallNormal(targetWall, vMap, room.vertices);

    const ts = Date.now().toString().slice(-4);
    const vExtrudeStart: WallVertex = {
      id: `v_ext1_${ts}`,
      x: Math.round(startV.x + normal.nx * depth),
      z: Math.round(startV.z + normal.nz * depth),
    };
    const vExtrudeEnd: WallVertex = {
      id: `v_ext2_${ts}`,
      x: Math.round(endV.x + normal.nx * depth),
      z: Math.round(endV.z + normal.nz * depth),
    };

    const wSide1: WallSegment = {
      id: `w_s1_${ts}`,
      startVertexId: startV.id,
      endVertexId: vExtrudeStart.id,
      thickness: targetWall.thickness,
      height: targetWall.height,
      name: 'Уступ (бок 1)',
    };
    const wFace: WallSegment = {
      id: targetWall.id,
      startVertexId: vExtrudeStart.id,
      endVertexId: vExtrudeEnd.id,
      thickness: targetWall.thickness,
      height: targetWall.height,
      name: 'Уступ (фасад 90°)',
    };
    const wSide2: WallSegment = {
      id: `w_s2_${ts}`,
      startVertexId: vExtrudeEnd.id,
      endVertexId: endV.id,
      thickness: targetWall.thickness,
      height: targetWall.height,
      name: 'Уступ (бок 2)',
    };

    const newWalls = [...room.walls];
    newWalls.splice(wallIdx, 1, wSide1, wFace, wSide2);

    const startVIdx = room.vertices.findIndex((v) => v.id === startV.id);
    const newVertices = [...room.vertices];
    newVertices.splice(startVIdx + 1, 0, vExtrudeStart, vExtrudeEnd);

    set({
      room: {
        ...room,
        template: 'custom',
        vertices: newVertices,
        walls: newWalls,
        selectedWallId: wFace.id,
      },
    });
  },

  addColumn: (width = 400, depth = 400) => {
    const { room } = get();
    const minZ = Math.min(...room.vertices.map((v) => v.z));
    let posX = 0;
    let posZ = minZ + depth / 2;

    if (!isBoxInsideRoom(posX, posZ, width, depth, room.vertices) && room.vertices.length >= 3) {
      const v0 = room.vertices[0];
      const testX = v0.x + width / 2;
      const testZ = v0.z + depth / 2;
      if (isBoxInsideRoom(testX, testZ, width, depth, room.vertices)) {
        posX = testX;
        posZ = testZ;
      } else {
        const sumX = room.vertices.reduce((s, v) => s + v.x, 0);
        const sumZ = room.vertices.reduce((s, v) => s + v.z, 0);
        posX = Math.round(sumX / room.vertices.length);
        posZ = Math.round(sumZ / room.vertices.length);
      }
    }

    const newCol: ArchitecturalColumn = {
      id: `col_${Date.now().toString().slice(-4)}`,
      name: `Венткороб ${width}×${depth}`,
      x: posX,
      z: posZ,
      width,
      depth,
      rotation: 0,
    };

    set({
      room: {
        ...room,
        columns: [...room.columns, newCol],
        selectedColumnId: newCol.id,
        selectedWallId: null,
      },
    });
  },

  updateColumn: (id: string, updates: Partial<ArchitecturalColumn>) => {
    const { room } = get();
    const updatedCols = room.columns.map((col) =>
      col.id === id ? { ...col, ...updates } : col
    );
    set({
      room: {
        ...room,
        columns: updatedCols,
      },
    });
  },

  updateColumnPosition: (id: string, x: number, z: number) => {
    const { room } = get();
    const updatedCols = room.columns.map((c) =>
      c.id === id ? { ...c, x: Math.round(x), z: Math.round(z) } : c
    );
    set({
      room: {
        ...room,
        columns: updatedCols,
      },
    });
  },

  removeColumn: (id: string) => {
    const { room } = get();
    set({
      room: {
        ...room,
        columns: room.columns.filter((c) => c.id !== id),
        selectedColumnId: room.selectedColumnId === id ? null : room.selectedColumnId,
      },
    });
  },

  addOpening: (wallId: string, type: 'window' | 'door') => {
    const { room } = get();
    const wall = room.walls.find((w) => w.id === wallId);
    if (!wall) return null;

    const vMap = buildVertexMap(room.vertices);
    const wallLen = getWallLength(wall, vMap);
    if (wallLen < 600) {
      alert('Стена слишком короткая для установки проёма (минимум 600 мм)!');
      return null;
    }

    const isWindow = type === 'window';
    const width = isWindow ? Math.min(1200, Math.round(wallLen * 0.6)) : Math.min(800, Math.round(wallLen * 0.45));
    const height = isWindow ? 1400 : 2100;
    const sillHeight = isWindow ? 850 : 0;
    const offsetFromStart = Math.round(wallLen / 2);

    const ts = Date.now().toString().slice(-4);
    const newOpening: WallOpening = {
      id: `open_${type}_${ts}`,
      wallId,
      type,
      name: isWindow ? `Окно ${width}×${height}` : `Дверь ${width}×${height}`,
      width,
      height,
      sillHeight,
      offsetFromStart,
      doorSwing: isWindow ? undefined : 'left',
    };

    set({
      room: {
        ...room,
        openings: [...(room.openings || []), newOpening],
        selectedOpeningId: newOpening.id,
        selectedWallId: wallId,
        selectedColumnId: null,
        selectedVertexId: null,
      },
    });

    return newOpening;
  },

  updateOpening: (id: string, updates: Partial<WallOpening>) => {
    const { room } = get();
    const updated = (room.openings || []).map((o) => {
      if (o.id !== id) return o;
      const merged = { ...o, ...updates };

      const wall = room.walls.find((w) => w.id === merged.wallId);
      if (wall) {
        const vMap = buildVertexMap(room.vertices);
        const wallLen = getWallLength(wall, vMap);
        const minOffset = Math.round(merged.width / 2);
        const maxOffset = Math.max(minOffset, Math.round(wallLen - merged.width / 2));
        merged.offsetFromStart = Math.max(minOffset, Math.min(maxOffset, merged.offsetFromStart));

        if (updates.width !== undefined || updates.height !== undefined) {
          if (!updates.name) {
            const prefix = merged.type === 'window' ? 'Окно' : 'Дверь';
            merged.name = `${prefix} ${merged.width}×${merged.height}`;
          }
        }
      }
      return merged;
    });

    set({
      room: {
        ...room,
        openings: updated,
      },
    });
  },

  removeOpening: (id: string) => {
    const { room } = get();
    set({
      room: {
        ...room,
        openings: (room.openings || []).filter((o) => o.id !== id),
        selectedOpeningId: room.selectedOpeningId === id ? null : room.selectedOpeningId,
      },
    });
  },

  addUtility: (wallId: string, category: UtilityCategory, subType: UtilityType) => {
    const { room } = get();
    const wall = room.walls.find((w) => w.id === wallId);
    if (!wall) return null;

    const vMap = buildVertexMap(room.vertices);
    const wallLen = getWallLength(wall, vMap);

    let width = 70;
    let height = 70;
    let depth = 10;
    let elevationFromFloor = 1050; // фартук 1050 мм по умолчанию
    let name = 'Розетка 220В';

    if (subType === 'socket') {
      width = 70; height = 70; depth = 10; elevationFromFloor = 1050; name = 'Розетка 220В';
    } else if (subType === 'socket_double') {
      width = 140; height = 70; depth = 10; elevationFromFloor = 1050; name = 'Блок 2 розетки';
    } else if (subType === 'socket_triple') {
      width = 210; height = 70; depth = 10; elevationFromFloor = 1050; name = 'Блок 3 розетки';
    } else if (subType === 'socket_power') {
      width = 90; height = 90; depth = 25; elevationFromFloor = 100; name = 'Силовая розетка 380В';
    } else if (subType === 'hood_outlet') {
      width = 70; height = 70; depth = 10; elevationFromFloor = 2100; name = 'Розетка вытяжки';
    } else if (subType === 'water_in') {
      width = 150; height = 60; depth = 35; elevationFromFloor = 550; name = 'Выводы ХВС/ГВС';
    } else if (subType === 'water_drain') {
      width = 60; height = 60; depth = 35; elevationFromFloor = 450; name = 'Слив канализации';
    } else if (subType === 'gas_pipe') {
      width = 40; height = 40; depth = 30; elevationFromFloor = 750; name = 'Газовый кран/вывод';
    } else if (subType === 'gas_boiler') {
      width = 400; height = 700; depth = 300; elevationFromFloor = 1200; name = 'Газовый котёл';
    } else if (subType === 'radiator') {
      width = 800; height = 500; depth = 100; elevationFromFloor = 150; name = 'Радиатор отопления';
    }

    const ts = Date.now().toString().slice(-4);
    const newUtility: WallUtility = {
      id: `util_${subType}_${ts}`,
      wallId,
      category,
      subType,
      name,
      width,
      height,
      depth,
      offsetFromStart: Math.round(wallLen / 2),
      elevationFromFloor,
    };

    set({
      room: {
        ...room,
        utilities: [...(room.utilities || []), newUtility],
        selectedUtilityId: newUtility.id,
        selectedOpeningId: null,
      },
    });

    return newUtility;
  },

  updateUtility: (id: string, updates: Partial<WallUtility>) => {
    const { room } = get();
    const updated = (room.utilities || []).map((u) => {
      if (u.id !== id) return u;
      const merged = { ...u, ...updates };

      const wall = room.walls.find((w) => w.id === merged.wallId);
      if (wall) {
        const vMap = buildVertexMap(room.vertices);
        const wallLen = getWallLength(wall, vMap);
        const minOffset = Math.round(merged.width / 2);
        const maxOffset = Math.max(minOffset, Math.round(wallLen - merged.width / 2));
        merged.offsetFromStart = Math.max(minOffset, Math.min(maxOffset, merged.offsetFromStart));

        const maxElev = Math.max(0, room.height - merged.height);
        merged.elevationFromFloor = Math.max(0, Math.min(maxElev, merged.elevationFromFloor));
      }
      return merged;
    });

    set({
      room: {
        ...room,
        utilities: updated,
      },
    });
  },

  removeUtility: (id: string) => {
    const { room } = get();
    set({
      room: {
        ...room,
        utilities: (room.utilities || []).filter((u) => u.id !== id),
        selectedUtilityId: room.selectedUtilityId === id ? null : room.selectedUtilityId,
      },
    });
  },

  setCeilingHeight: (height: number) => {
    const { room } = get();
    const updatedWalls = room.walls.map((w) => ({ ...w, height }));
    set({
      room: {
        ...room,
        height,
        walls: updatedWalls,
      },
    });
  },

  setWallThickness: (wallId: string, thickness: number) => {
    const { room } = get();
    const updatedWalls = room.walls.map((w) =>
      w.id === wallId ? { ...w, thickness } : w
    );
    set({
      room: {
        ...room,
        walls: updatedWalls,
      },
    });
  },

  setRoomColors: (floorColor?: string, wallColor?: string) => {
    const { room } = get();
    set({
      room: {
        ...room,
        floorColor: floorColor ?? room.floorColor,
        wallColor: wallColor ?? room.wallColor,
      },
    });
  },

  resetRoom: () => {
    set({ room: createRectangularRoom() });
  },
    }),
    {
      name: 'biplaner_room_storage',
      partialize: (state) => ({
        room: state.room,
      }),
    }
  )
);
