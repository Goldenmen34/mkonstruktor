import { MaterialItem } from '../types';
import { INITIAL_OWNER_MATERIALS } from './initialOwnerMaterials';

// Специальные материалы для стен и пола помещения
const ROOM_SURFACE_MATERIALS: MaterialItem[] = [
  {
    id: 'floor_wood',
    name: 'Паркетная доска',
    category: 'floor',
    color: '#C2A17E',
    textureUrl: '/textures/wood_halifax.jpg',
    roughness: 0.6,
    metalness: 0.05,
    priceModifier: 1.0,
  },
  {
    id: 'floor_tile',
    name: 'Керамогранит Серый',
    category: 'floor',
    color: '#CBD5E1',
    roughness: 0.4,
    metalness: 0.1,
    priceModifier: 1.0,
  },
  {
    id: 'wall_light',
    name: 'Светлая штукатурка',
    category: 'wall',
    color: '#E2E8F0',
    roughness: 0.9,
    metalness: 0.0,
    priceModifier: 1.0,
  },
];

// Единая база материалов: формируется напрямую из единой базы собственника
export const DEFAULT_MATERIALS: MaterialItem[] = [
  ...INITIAL_OWNER_MATERIALS.map((item) => ({
    id: item.id,
    name: item.name,
    category: (item.section === 'ldsp' ? 'carcass' : item.section) as any,
    brand: item.brand,
    collection: item.category || '',
    article: item.article,
    color: item.color,
    textureUrl: item.textureUrl,
    roughness: item.roughness ?? 0.7,
    metalness: item.metalness ?? 0.05,
    priceModifier: item.markupMultiplier,
  })),
  ...ROOM_SURFACE_MATERIALS,
];
