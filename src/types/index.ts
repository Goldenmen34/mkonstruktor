export type PlannerMode = '3D' | '2D';
export type ActiveTool = 'select' | 'wall' | 'room' | 'measure' | 'delete';
export type FurnitureCategory = 'kitchen' | 'wardrobe';
export type ViewDisplayMode = 'clean' | 'dimensions' | 'wireframe';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Wall {
  id: string;
  start: Vector2D; // in mm
  end: Vector2D;   // in mm
  thickness: number; // default 150mm
  height: number;    // default 2700mm
}

export interface RoomConfig {
  walls: Wall[];
  width: number;  // mm (for quick rectangle mode)
  length: number; // mm
  height: number; // mm
  floorColor: string;
  wallColor: string;
}

export interface ModuleConfig {
  doors: number;
  drawers: number;
  shelves: number;
  isOpen?: boolean; // Состояние открывания фасадов/ящиков для 3D-анимации
  isOpenShelf?: boolean; // Открытая секция без фасадов (с полками)
  isMirrored?: boolean; // Горизонтальное зеркалирование (сторона петель / угол)
  hasCountertop?: boolean;
  hasPlinth?: boolean;
  hasBackWall?: boolean; // Наличие задней стенки (ХДФ 4 мм)
  handleType?: 'bar' | 'railing' | 'knob' | 'profile' | 'gola' | 'none'; // Тип ручки (включая интегрированный профиль Gola)
  handleOrientation?: 'vertical' | 'horizontal'; // Ориентация ручки (вертикально / горизонтально)
  handlePosition?: 'top' | 'center' | 'bottom';  // Положение ручки (сверху / по центру / снизу)
  handleOffset?: number; // Смещение ручки от края фасада (в мм, по умолчанию 25-35 мм)
  blindCornerWidth?: number; // Ширина глухой фальш-зоны в мм (например, 400 мм)
  blindCornerSide?: 'left' | 'right'; // Сторона глухой зоны
  drawerLayout?: 'equal' | '1small_2deep'; // Раскладка ящиков: равные или 1 малый под приборы + 2 глубоких
  golaType?: 'type1' | 'type2'; // Вариант Gola для выкатных ящиков: type1 (L сверху + C между нижним и средним) | type2 (L сверху + C между всеми фасадами)
  doorOpeningType?: 'swing' | 'lift' | 'aventos_hf' | 'double_lift'; // Тип открывания дверей (распашные / подъемник HK / складной Aventos HF / двойной подъемник)
  specialCabinetType?: 'drying' | 'hood' | 'microwave'; // Специальное внутреннее наполнение (сушка, вытяжка, ниша СВЧ)
  specialTallType?: 'oven_mw' | 'oven' | 'fridge' | 'pantry' | 'spacetower' | 'cargo'; // Специальный тип наполнения пенала (духовка/СВЧ, холодильник, припасы и т.д.)
  customParts?: CustomSectionPart[]; // Пользовательские параметрические детали секции из Редактора
  customOptions?: Record<string, any>;
}

export interface FurnitureModule {
  id: string;
  category: FurnitureCategory;
  subType: 'base' | 'wall' | 'tall' | 'corner' | 'top' | 'backsplash' | 'wardrobe_sliding' | 'wardrobe_swing';
  code?: string; // Русское унифицированное обозначение секции (НС-2Д, ВС-2С, П-Д-СВЧ-ДШ-2В и др.)
  name: string;
  dimensions: {
    width: number;  // mm
    height: number; // mm
    depth: number;  // mm
  };
  position: Vector3D; // mm
  rotation: number;   // degrees around Y
  config: ModuleConfig;
  materials: {
    carcass: string;
    facade: string;
    countertop?: string;
    handle?: string;
  };
  customHardware?: {
    hinges?: string;
    drawers?: string;
    lift?: string;
    handle?: string;
  };
  basePrice: number;
  catalogId?: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  category: 'carcass' | 'facade' | 'countertop' | 'floor' | 'wall';
  brand?: string; // Egger, Kronospan, Lamarty, RAL, NCS, AGT, Eterno, etc.
  collection?: string; // Supramat, High Gloss, Synchro Wood, Synchro Loft, Unitone, etc.
  article?: string; // W980 ST2, H1180 ST37, RAL 9003, etc.
  color: string;
  textureUrl?: string;
  roughness: number;
  metalness: number;
  priceModifier: number; // cost multiplier or per unit
}

export type LicenseTier = 'demo' | 'kitchen_pro' | 'wardrobe_pro' | 'all_inclusive';

export interface LicenseStatus {
  key: string;
  isValid: boolean;
  tier: LicenseTier;
  expiresAt: string | null;
  clientName: string;
  maxModules: number;
  issuedAt?: string;
}

export interface IssuedLicenseKey {
  id: string;
  key: string;
  clientName: string;
  tier: LicenseTier;
  durationDays: number;
  maxModules: number;
  issuedAt: string;
  expiresAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  notes?: string;
}

export interface ProjectSettings {
  // Общие настройки
  dspThickness: number; // 16, 18, 22, 25 мм

  // Нижние корпуса
  baseBodyHeight: number; // Высота корпуса (чистовая), мм
  baseBodyDepth: number; // Глубина корпуса (чистовая), мм
  plinthHeight: number; // Высота цоколя, мм
  hasPlinth: boolean; // С цоколем / Без цоколя

  // Столешница
  countertopThickness: number; // Толщина столешницы, мм
  countertopFrontOverhang: number; // Свес столешницы спереди, мм
  countertopBackOverhang: number; // Свес столешницы сзади, мм
  countertopDepth: number; // Глубина по столешнице, мм

  // Стеновая панель (фартук)
  apronHeight: number; // Высота фартука, мм
  apronStartHeight: number; // Высота начала фартука, мм

  // Верхние корпуса
  upperBodyDepth: number; // Глубина верхних модулей, мм
  upperBaseStartHeight: number; // Высота начала верхних баз, мм

  // Допуски и зазоры фасадов (Фасадная сетка)
  baseFacadeSideGap: number; // Боковой зазор фасада нижней базы (1.5 мм -> 597 мм, 2.0 мм -> 596 мм)
  baseFacadeTopGap: number; // Зазор сверху до столешницы, мм
  baseFacadeBottomGap: number; // Зазор снизу до цоколя, мм

  upperFacadeSideGap: number; // Боковой зазор фасада верхней базы, мм
  upperFacadeTopGap: number; // Зазор сверху до потолка/карниза, мм
  upperFacadeBottomOverhang: number; // Свес верхнего фасада вниз для открывания без ручек (хват снизу), мм

  interFacadeGap: number; // Зазор между фасадами (между 2 дверями или ящиками), мм

  // Базовая фурнитура проекта (по умолчанию)
  defaultHinges?: string; // ID петель (Boyard, Blum, Hettich)
  defaultDrawers?: string; // ID направляющих ящиков
  defaultLift?: string; // ID подъемников
  defaultHandle?: string; // ID ручки проекта
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  dspThickness: 16,
  baseBodyHeight: 720,
  baseBodyDepth: 510,
  plinthHeight: 120,
  hasPlinth: true,
  countertopThickness: 40,
  countertopFrontOverhang: 50,
  countertopBackOverhang: 40,
  countertopDepth: 600,
  apronHeight: 560,
  apronStartHeight: 880,
  upperBodyDepth: 320,
  upperBaseStartHeight: 1440,
  baseFacadeSideGap: 1.5,
  baseFacadeTopGap: 3,
  baseFacadeBottomGap: 2,
  upperFacadeSideGap: 1.5,
  upperFacadeTopGap: 2,
  upperFacadeBottomOverhang: 20,
  interFacadeGap: 3,
  defaultHinges: 'hw_boyard_neo_overlay_h301',
  defaultDrawers: 'hw_boyard_bslide_500',
  defaultLift: 'hw_boyard_neo_corner_h308',
  defaultHandle: 'hw_boyard_handle_123',
};

// ==========================================
// РЕДАКТОР СЕКЦИЙ (SECTION EDITOR)
// ==========================================

export type PartWidthBinding =
  | 'between_sides'    // Между внутренними гранями боковин: W - (leftThick + rightThick)
  | 'full_width'       // На всю ширину корпуса: W
  | 'left_side'        // Левая стойка
  | 'right_side'       // Правая стойка
  | 'custom';          // Фиксированная/пользовательская ширина

export type PartDepthBinding =
  | 'full_depth'       // На полную глубину каркаса: D
  | 'recessed_front'   // С отступом спереди (-20 мм под фасад / петли)
  | 'back_wall'        // Задняя стенка (в паз или внакладку)
  | 'facade'           // Фасад накладной спереди
  | 'custom';          // Фиксированная глубина

export type PartHeightBinding =
  | 'bottom_pass'      // Дно корпуса (проходное снизу или между боковинами)
  | 'top_roof'         // Верхний горизонт / крышка
  | 'shelf'            // Полка вкладная на высоте Y
  | 'full_height'      // На всю высоту секции H
  | 'between_bottom_top' // Внутренняя перегородка между дном и верхом
  | 'facade'           // Фасад на всю высоту корпуса
  | 'custom';          // Фиксированная высота

export type PartMaterialType =
  | 'ldsp'         // ЛДСП 16 / 18 мм
  | 'mdf'          // МДФ 16 / 19 мм
  | 'mdf_facade'   // МДФ фасад (ПВХ / эмаль)
  | 'hdf'          // ХДФ / ДВП 3.2-4 мм (задняя стенка)
  | 'glass'        // Закаленное стекло 4-6 мм
  | 'metal'        // Алюминий / металл
  | 'countertop';  // Столешница HPL 28-38 мм

export interface CustomSectionPart {
  id: string;
  name: string;
  category: 'carcass' | 'shelf' | 'divider' | 'back' | 'facade' | 'drawer' | 'countertop' | 'hardware' | 'custom';
  materialType: PartMaterialType;
  materialName?: string;
  color?: string;
  thickness: number; // мм

  // Параметрические привязки к граням
  widthBinding: PartWidthBinding;
  depthBinding: PartDepthBinding;
  heightBinding: PartHeightBinding;

  // Размеры (при custom или переопределении)
  customWidth?: number;  // мм
  customHeight?: number; // мм
  customDepth?: number;  // мм

  // Смещения в пространстве (мм)
  offsetX: number; // Влево (-) / Вправо (+) от точки привязки
  offsetY: number; // Вниз (-) / Вверх (+)
  offsetZ: number; // Назад (-) / Вперёд (+)

  // Видимость детали
  isVisible?: boolean;
}

