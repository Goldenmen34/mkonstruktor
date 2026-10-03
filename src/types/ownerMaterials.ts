export type MaterialSection = 'ldsp' | 'facade' | 'countertop' | 'apron' | 'hardware' | 'services' | 'glass' | 'other';

export type PriceUnit = 'm2' | 'linear_meter' | 'piece' | 'kit' | 'sheet';

export interface OwnerCategory {
  id: string;
  name: string;
  parentId?: string | null; // null для корневых категорий, id родительской для подкатегорий
  section?: MaterialSection;
  order?: number;
}

export interface OwnerMaterialItem {
  id: string;
  name: string;
  categoryId: string;      // ID категории или подкатегории
  section?: MaterialSection;
  brand: string;           // Egger, Kronospan, Blum, Boyard, GTV, Кедр, etc.
  category?: string;       // Читаемое имя категории для обратной совместимости
  article: string;         // Артикул / код товара (e.g. EGG-W980, H305A02)
  supplier?: string;       // Поставщик (e.g. "ЕвроХим / МДМ", "МДМ-Комплект")
  
  // Ценообразование
  costPrice: number;        // Закупочная цена (руб)
  markupMultiplier: number; // Коэффициент наценки (например 1.6 или 2.0)
  clientPrice: number;      // Продажа для клиента (руб) = costPrice * markupMultiplier
  unit: PriceUnit;          // Единица измерения (лист, м², пог. м, шт., комплект)
  stockQuantity?: number;   // Остаток на складе (например 100)

  // Визуал и свойства
  color: string;           // Hex-код цвета (например '#C79F70')
  imageUrl?: string;       // Ссылка на фото / текстуру или base64 data URL
  textureUrl?: string;     // URL бесшовной текстуры для 3D сцены
  roughness?: number;      // Шероховатость для Three.js PBR (0..1)
  metalness?: number;      // Металличность для Three.js PBR (0..1)

  // Статус
  isActive: boolean;       // Активен / временно отключен (дизайнер не видит)
  description?: string;    // Описание, тех. характеристики
  updatedAt: string;       // Дата последнего обновления
}

export const SECTION_LABELS: Record<MaterialSection, string> = {
  ldsp: 'ЛДСП (Корпуса)',
  facade: 'Фасады',
  countertop: 'Столешницы',
  apron: 'Фартуки (Стеновые)',
  hardware: 'Фурнитура',
  services: 'Услуги и монтаж',
  glass: 'Стекло и зеркала',
  other: 'Прочие материалы',
};

export const UNIT_LABELS: Record<PriceUnit, string> = {
  sheet: 'лист',
  m2: 'м²',
  linear_meter: 'пог. м',
  piece: 'шт.',
  kit: 'компл.',
};

export const UNIT_SHORT: Record<PriceUnit, string> = {
  sheet: 'лист',
  m2: 'м²',
  linear_meter: 'пог. м',
  piece: 'шт.',
  kit: 'компл.',
};
