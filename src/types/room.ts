export interface WallVertex {
  id: string;
  x: number; // Координата X в миллиметрах
  z: number; // Координата Z в миллиметрах
}

export interface WallSegment {
  id: string;
  startVertexId: string;
  endVertexId: string;
  thickness: number; // Толщина стены в мм (по стандарту 100 мм)
  height: number;    // Высота стены в мм (по умолчанию 2700 мм)
  color?: string;    // Цвет отделки
  name: string;      // Название, напр. "Стена 1 (Задняя)"
}

export interface ArchitecturalColumn {
  id: string;
  name: string;
  x: number;        // Координата X центра в миллиметрах
  z: number;        // Координата Z центра в миллиметрах
  width: number;    // Ширина в мм (по умолчанию 400)
  depth: number;    // Глубина в мм (по умолчанию 400)
  rotation: number; // Поворот в градусах (0, 90, 180, 270)
  color?: string;
}

export interface WallOpening {
  id: string;
  wallId: string;
  type: 'window' | 'door';
  name: string;
  width: number;           // Ширина в мм (по умолчанию: 1200 для окна, 800 для двери)
  height: number;          // Высота в мм (по умолчанию: 1400 для окна, 2100 для двери)
  sillHeight: number;      // Высота подоконника/порога от пола в мм (по умолчанию: 850 для окна, 0 для двери)
  offsetFromStart: number; // Отступ центра проема от начала стены вдоль стены в мм
  doorSwing?: 'left' | 'right'; // Направление открывания двери
  hasSill?: boolean;           // Наличие выступающего подоконника (по умолчанию true)
}

export type UtilityCategory = 'electrical' | 'plumbing' | 'gas_heating';

export type UtilityType =
  | 'socket'
  | 'socket_double'
  | 'socket_triple'
  | 'socket_power'
  | 'hood_outlet'
  | 'water_in'
  | 'water_drain'
  | 'gas_pipe'
  | 'gas_boiler'
  | 'radiator';

export interface WallUtility {
  id: string;
  wallId: string;
  category: UtilityCategory;
  subType: UtilityType;
  name: string;
  width: number;              // Ширина в мм
  height: number;             // Высота в мм
  depth: number;              // Глубина в мм (выступ от стены)
  offsetFromStart: number;    // Отступ центра элемента от начала стены (мм)
  elevationFromFloor: number; // Высота низа элемента от чистового пола (мм)
}

export type RoomTemplate = 'rectangular' | 'l_shaped' | 'u_shaped' | 'with_duct' | 'custom';

export type WallResizeDirection = 'endA' | 'endB' | 'both';

export interface RoomData {
  vertices: WallVertex[];
  walls: WallSegment[];
  columns: ArchitecturalColumn[];
  openings: WallOpening[];
  utilities: WallUtility[];
  height: number;       // Базовая высота потолка в мм
  floorColor: string;
  wallColor: string;
  template: RoomTemplate;
  selectedWallId: string | null;
  selectedVertexId: string | null;
  selectedColumnId: string | null;
  selectedOpeningId: string | null;
  selectedUtilityId: string | null;
  activeWallElevationId: string | null; // ID стены, открытой в режиме прямого вида/развертки
}
