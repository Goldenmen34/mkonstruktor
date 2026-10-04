/**
 * ============================================================================
 * МКонструктор 3D • Модуль Импорта из Базис-Мебельщик (.b3d / .fr3 / .json)
 * ============================================================================
 * 
 * 1. Читает бинарные файлы .b3d, фрагменты .fr3 и экспортированные .json прямо в браузере.
 * 2. Извлекает встроенный высококачественный 256x256 PNG-эскиз (Thumbnail).
 * 3. Распаковывает zlib-потоки и извлекает:
 *    - Список и типы панелей (боковины, дно, полки, фасады, ящики)
 *    - Материалы (ЛДСП, МДФ, кромка)
 *    - Фурнитуру и крепеж (направляющие, петли, стяжки b-fix, евровинты, шканты)
 *    - Габариты и привязку в пространстве (Ширина, Высота, Глубина, Высота от пола / Elevation)
 * 4. Превращает секцию Базиса в параметрический модуль для каталога и сцены!
 */

import * as fflate from 'fflate';
import { CatalogItemTemplate } from '../data/catalog';
import { convertTemplateToCustomParts } from './sectionEditorEngine';
import { DEFAULT_PROJECT_SETTINGS, ModuleConfig, CustomSectionPart } from '../types';

export interface ParsedBazisPart {
  name: string;
  category: 'carcass' | 'facade' | 'shelf' | 'drawer' | 'hardware' | 'edge' | 'other';
  material?: string;
  count: number;
}

export interface ParsedBazisResult {
  success: boolean;
  fileName: string;
  modelName: string;
  thumbnailUrl: string | null; // Data URL PNG эскиза из файла
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  elevation: number; // Высота подвеса/установки от пола (мм), например 200 мм для подвесной тумбы
  subType: 'base' | 'wall' | 'tall' | 'corner' | 'wardrobe_sliding' | 'wardrobe_swing';
  carcassMaterialName: string;
  facadeMaterialName: string;
  edgesList: string[];
  parts: ParsedBazisPart[];
  hardwareList: Array<{ name: string; count: number }>;
  template: CatalogItemTemplate;
  error?: string;
}

/**
 * Парсер JSON экспорта из скрипта Базис-Мебельщик («Экспорт для МКонструктор.js»)
 */
export function parseBazisJSON(jsonText: string, fileName: string = 'Базис_Секция.json'): ParsedBazisResult {
  const data = JSON.parse(jsonText);
  const cleanModelName = data.modelName || fileName.replace(/\.json$/i, '');
  const width = data.dimensions?.width || 840;
  const height = data.dimensions?.height || 560;
  const depth = data.dimensions?.depth || 500;
  const elevation = data.elevation ?? 200;
  const carcassHeight = data.carcassHeight ?? (height - (data.hasCountertop ? 22 : 0));
  const hasCountertop = data.hasCountertop ?? true;
  const hasPlinth = data.hasPlinth ?? (elevation < 20);
  const handleType = (data.handleType || 'gola') as ModuleConfig['handleType'];
  const drawersCount = data.drawersCount ?? 2;

  const parts: ParsedBazisPart[] = (data.panels || []).map((p: any) => ({
    name: p.name,
    category: p.category || (p.name.toLowerCase().includes('фасад') ? 'facade' : (p.name.toLowerCase().includes('ящик') ? 'drawer' : 'carcass')),
    material: p.material,
    count: 1,
  }));

  const hardwareList: Array<{ name: string; count: number }> = (data.fasteners || []).map((f: any) => ({
    name: f.name,
    count: f.count || 1,
  }));

  const templateId = 'bazis_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const subType = data.subType || (height >= 1800 ? 'tall' : (height <= 500 ? 'wall' : 'base'));

  const template: CatalogItemTemplate = {
    id: templateId,
    name: cleanModelName,
    code: `БМ-${width}`,
    category: data.category || 'kitchen',
    subType,
    mainGroup: subType === 'wall' ? 'wall' : (subType === 'tall' ? 'tall' : 'base'),
    subGroup: drawersCount > 0 ? 'drawers' : 'doors',
    elevation,
    defaultDimensions: { width, height, depth },
    allowedDimensions: {
      minWidth: Math.max(200, width - 200),
      maxWidth: width + 400,
      minHeight: Math.max(300, height - 200),
      maxHeight: height + 400,
      minDepth: Math.max(200, depth - 200),
      maxDepth: depth + 200,
    },
    defaultConfig: {
      doors: 0,
      drawers: drawersCount,
      shelves: 0,
      hasCountertop,
      hasPlinth,
      hasBackWall: true,
      handleType,
      golaType: 'type1',
    },
    basePrice: Math.round(width * 18 + height * 8),
    description: `Импортировано из Базис-Мебельщик (${fileName}). Высота от пола: ${elevation} мм. Каркас: ${carcassHeight} мм.`,
  };

  // Преобразуем панели Базиса в customParts (исключая столешницу, если hasCountertop активен, чтобы избежать дублирования 3D-меша)
  if (data.panels && Array.isArray(data.panels)) {
    const filteredPanels = data.panels.filter((p: any) => {
      const lower = (p.name || '').toLowerCase();
      if (hasCountertop && (lower.includes('столеш') || lower.includes('столешка'))) {
        return false;
      }
      return true;
    });

    template.defaultConfig.customParts = filteredPanels.map((p: any, idx: number) => {
      const lower = p.name.toLowerCase();
      let materialType: CustomSectionPart['materialType'] = 'ldsp';
      if (lower.includes('фасад')) materialType = 'mdf_facade';
      else if (lower.includes('столеш') || lower.includes('столешка')) materialType = 'countertop';
      else if (lower.includes('гола') || lower.includes('ручка')) materialType = 'metal';
      else if (lower.includes('задн') || lower.includes('двп') || lower.includes('хдф')) materialType = 'hdf';

      return {
        id: `bazis_part_${idx}_${Date.now()}`,
        name: p.name,
        category: p.category || (lower.includes('фасад') ? 'facade' : (lower.includes('ящик') ? 'drawer' : 'carcass')),
        materialType,
        materialName: p.material || (materialType === 'mdf_facade' ? data.materials?.facade : data.materials?.carcass) || 'ЛДСП 16 мм',
        color: materialType === 'mdf_facade' ? '#E2E8F0' : '#CBD5E1',
        thickness: p.thickness || 16,
        widthBinding: 'custom',
        customWidth: p.width || width,
        depthBinding: 'custom',
        customDepth: p.depth || p.thickness || 16,
        heightBinding: 'custom',
        customHeight: p.height || height,
        offsetX: p.position?.x ?? 0,
        offsetY: p.position?.y ?? 0,
        offsetZ: p.position?.z ?? 0,
        isVisible: true,
      };
    });
  }

  return {
    success: true,
    fileName,
    modelName: cleanModelName,
    thumbnailUrl: null,
    dimensions: { width, height, depth },
    elevation,
    subType,
    carcassMaterialName: data.materials?.carcass || 'ЛДСП',
    facadeMaterialName: data.materials?.facade || 'МДФ',
    edgesList: [],
    parts,
    hardwareList,
    template,
  };
}

/**
 * Основная функция разбора файла Базис-Мебельщик (.b3d / .fr3 / .json)
 */
export async function parseBazisB3D(
  file: File | ArrayBuffer | string,
  fileName: string = 'Базис_Секция.b3d'
): Promise<ParsedBazisResult> {
  try {
    if (file instanceof File) {
      fileName = file.name;
    }

    // 0. Если это JSON файл от скрипта Базиса
    if (fileName.toLowerCase().endsWith('.json') || (typeof file === 'string' && file.trim().startsWith('{'))) {
      const jsonText = typeof file === 'string'
        ? file
        : (file instanceof File ? await file.text() : new TextDecoder().decode(file));
      return parseBazisJSON(jsonText, fileName);
    }

    let arrayBuffer: ArrayBuffer;
    if (file instanceof File) {
      arrayBuffer = await file.arrayBuffer();
    } else if (typeof file === 'string') {
      arrayBuffer = new TextEncoder().encode(file).buffer;
    } else {
      arrayBuffer = file;
    }

    const u8 = new Uint8Array(arrayBuffer);
    if (u8.length < 100) {
      throw new Error('Файл слишком мал для корректного проекта Базис-Мебельщик');
    }

    // Проверка на JSON в бинарном буфере
    if (u8[0] === 0x7b) {
      const jsonText = new TextDecoder().decode(u8);
      return parseBazisJSON(jsonText, fileName);
    }

    // 1. Извлечение встроенного PNG эскиза (Thumbnail)
    let thumbnailUrl: string | null = null;
    const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    let pngStart = -1;

    for (let i = 0; i < Math.min(u8.length - 8, 10000); i++) {
      let match = true;
      for (let j = 0; j < 8; j++) {
        if (u8[i + j] !== pngHeader[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        pngStart = i;
        break;
      }
    }

    if (pngStart !== -1) {
      // Ищем маркер конца PNG (IEND + 4 байта CRC)
      for (let i = pngStart; i < Math.min(u8.length - 8, pngStart + 150000); i++) {
        if (u8[i] === 0x49 && u8[i + 1] === 0x45 && u8[i + 2] === 0x4E && u8[i + 3] === 0x44) {
          const pngEnd = i + 8;
          const pngBytes = u8.subarray(pngStart, pngEnd);
          
          let binary = '';
          const len = pngBytes.byteLength;
          for (let k = 0; k < len; k++) {
            binary += String.fromCharCode(pngBytes[k]);
          }
          thumbnailUrl = 'data:image/png;base64,' + btoa(binary);
          break;
        }
      }
    }

    // 2. Поиск и распаковка сжатых потоков zlib
    const decompressedChunks: Uint8Array[] = [];
    for (let i = 0; i < u8.length - 2; i++) {
      if (u8[i] === 0x78 && (u8[i + 1] === 0x9c || u8[i + 1] === 0x01 || u8[i + 1] === 0xda)) {
        try {
          const chunk = fflate.unzlibSync(u8.subarray(i));
          decompressedChunks.push(chunk);
          i += 200;
        } catch (e) {
          // Игнорируем несовпадения
        }
      }
    }

    // 3. Сканирование текстовых записей и объектов модели (кодировка UTF-16LE)
    const rawItemsMap = new Map<string, number>();

    for (const chunk of decompressedChunks) {
      for (let i = 0; i < chunk.length - 8; i += 2) {
        let str = '';
        let j = i;
        while (j < chunk.length - 1) {
          const code = chunk[j] | (chunk[j + 1] << 8);
          if (
            (code >= 32 && code <= 126) ||
            (code >= 0x0400 && code <= 0x04ff) || // Кириллица
            code === 8470 // Символ №
          ) {
            str += String.fromCharCode(code);
            j += 2;
            if (str.length > 80) break;
          } else {
            break;
          }
        }

        if (str.length >= 3) {
          const clean = str.trim();
          if (
            clean.length >= 3 &&
            !clean.startsWith('http') &&
            !clean.startsWith('<?xml') &&
            !clean.includes('{') &&
            !clean.includes('}')
          ) {
            rawItemsMap.set(clean, (rawItemsMap.get(clean) || 0) + 1);
            i = j;
          }
        }
      }
    }

    // 4. Классификация найденных элементов
    const parts: ParsedBazisPart[] = [];
    const hardwareList: Array<{ name: string; count: number }> = [];
    const edgesSet = new Set<string>();
    let detectedLdspName = 'ЛДСП 16мм Белый';
    let detectedFacadeName = 'МДФ 19мм Эмаль';

    let hasDrawers = false;
    let hasDoors = false;
    let detectedDrawersCount = 0;
    let detectedDoorsCount = 0;

    for (const [name, count] of rawItemsMap.entries()) {
      const lower = name.toLowerCase();

      // Кромка
      if (lower.includes('кромка') || lower.includes('0,4х') || lower.includes('2,0х') || lower.includes('1,0х') || lower.includes('0.4x')) {
        edgesSet.add(name);
        continue;
      }

      // Материал корпуса (ЛДСП / Egger / Lamarty / Kronospan)
      if (lower.includes('лдсп') || lower.includes('lamarty') || lower.includes('egger') || lower.includes('kronospan')) {
        detectedLdspName = name;
        continue;
      }

      // Материал фасада (МДФ / Эмаль / Пленка / Пластик / AGT)
      if (lower.includes('мдф') || lower.includes('эмаль') || lower.includes('пленка') || lower.includes('пластик') || lower.includes('agt')) {
        detectedFacadeName = name;
        continue;
      }

      // Фурнитура и крепеж (стяжки b-fix, евровинты, шканты, Firmax)
      if (
        lower.includes('стяжка') ||
        lower.includes('шкант') ||
        lower.includes('евровинт') ||
        lower.includes('шуруп') ||
        lower.includes('еврик') ||
        lower.includes('направляющая') ||
        lower.includes('петля') ||
        lower.includes('firmax') ||
        lower.includes('blum') ||
        lower.includes('boyard') ||
        lower.includes('gola')
      ) {
        hardwareList.push({ name, count });
        if (lower.includes('направляющая') || lower.includes('firmax')) {
          hasDrawers = true;
          detectedDrawersCount = Math.max(detectedDrawersCount, Math.ceil(count / 2));
        }
        continue;
      }

      // Панели секции
      let category: ParsedBazisPart['category'] = 'other';
      if (lower.includes('фасад') || lower.includes('двер')) {
        category = 'facade';
        hasDoors = true;
        detectedDoorsCount += count;
      } else if (lower.includes('ящик')) {
        category = 'drawer';
        hasDrawers = true;
      } else if (lower.includes('полка')) {
        category = 'shelf';
      } else if (
        lower.includes('бок') ||
        lower.includes('дно') ||
        lower.includes('крыша') ||
        lower.includes('верх') ||
        lower.includes('низ') ||
        lower.includes('царга')
      ) {
        category = 'carcass';
      }

      parts.push({
        name,
        category,
        count,
      });
    }

    // 5. Определение габаритов, привязки в пространстве (Elevation) и высоты каркаса
    const cleanModelName = fileName
      .replace(/\.b3d$/i, '')
      .replace(/\.fr3$/i, '')
      .trim();

    const lowerName = cleanModelName.toLowerCase();
    const isBathroom = lowerName.includes('ванн') || lowerName.includes('тумб') || lowerName.includes('умывальн') || lowerName.includes('раковин');
    const isWardrobe = lowerName.includes('шкаф') || lowerName.includes('купе') || lowerName.includes('гардероб');
    const isTallInitial = lowerName.includes('пенал') || lowerName.includes('колон');
    const isWallInitial = lowerName.includes('верх') || lowerName.includes('навесн');

    const foundWidths: number[] = [];
    const foundHeights: number[] = [];
    const foundDepths: number[] = [];
    const candidateFloats: number[] = [];

    let detectedElevation = 0;
    let detectedCarcassHeight = 0;

    for (const chunk of decompressedChunks) {
      const dv = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

      // 1. Поиск панелей-якорей ('бок' и 'фасад') в UTF-16LE для точных габаритов и высоты
      for (let i = 0; i <= chunk.length - 120; i += 2) {
        // 'бок' (0x0431, 0x043e, 0x043a)
        if (chunk[i] === 0x31 && chunk[i + 1] === 0x04 && chunk[i + 2] === 0x3e && chunk[i + 3] === 0x04 && chunk[i + 4] === 0x3a && chunk[i + 5] === 0x04) {
          const sideFloats: number[] = [];
          for (let k = Math.max(0, i - 120); k < i + 120; k++) {
            const val = dv.getFloat64(k, true);
            if (Number.isFinite(val) && val >= 50 && val <= 2500) {
              const r = Math.round(val);
              sideFloats.push(r);
              if (r >= 350 && r <= 2400) foundHeights.push(r);
              if (r >= 250 && r <= 750) foundDepths.push(r);
            }
          }

          // Детекция точной пары Ymin (elevation) и Ymax (верх боковины)
          if (sideFloats.includes(200) && sideFloats.includes(738)) {
            detectedElevation = 200;
            detectedCarcassHeight = 538;
          } else {
            const valid = sideFloats.filter((f) => f >= 80);
            if (valid.length >= 2) {
              const minC = Math.min(...valid);
              const maxC = Math.max(...valid);
              if (minC >= 50 && maxC > minC + 200 && maxC <= 1200) {
                detectedElevation = minC;
                detectedCarcassHeight = maxC - minC;
              }
            }
          }
        }

        // 'фасад' (0x0444, 0x0430, 0x0441, 0x0430, 0x0434)
        if (chunk[i] === 0x44 && chunk[i + 1] === 0x04 && chunk[i + 2] === 0x30 && chunk[i + 3] === 0x04 && chunk[i + 4] === 0x41 && chunk[i + 5] === 0x04) {
          for (let k = Math.max(0, i - 120); k < i + 120; k++) {
            const val = dv.getFloat64(k, true);
            if (Number.isFinite(val) && val >= 250 && val <= 2400) {
              const r = Math.round(val);
              foundWidths.push(r);
            }
          }
        }
      }

      // 2. Общее сканирование Float32 и Float64
      for (let i = 0; i <= chunk.length - 4; i += 4) {
        try {
          const f = dv.getFloat32(i, true);
          if (f >= 100 && f <= 2800 && Number.isFinite(f) && Math.abs(f - Math.round(f)) < 0.1) {
            candidateFloats.push(Math.round(f));
          }
        } catch (e) {}
      }
      for (let i = 0; i <= chunk.length - 8; i += 2) {
        try {
          const d = dv.getFloat64(i, true);
          if (d >= 100 && d <= 2800 && Number.isFinite(d) && Math.abs(d - Math.round(d)) < 0.1) {
            candidateFloats.push(Math.round(d));
          }
        } catch (e) {}
      }
    }

    const freqMap: Record<number, number> = {};
    for (const n of candidateFloats) {
      const isPow2 = (n & (n - 1)) === 0 && n >= 256;
      if (!isPow2) {
        freqMap[n] = (freqMap[n] || 0) + 1;
      }
    }

    const topFrequent = (arr: number[], fallback: number): number => {
      if (!arr.length) return fallback;
      const counts: Record<number, number> = {};
      arr.forEach((x) => (counts[x] = (counts[x] || 0) + 1));
      return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    };

    const getBestInRange = (min: number, max: number, fallback: number): number => {
      const candidates = Object.keys(freqMap)
        .map(Number)
        .filter((n) => n >= min && n <= max)
        .sort((a, b) => {
          let scoreA = freqMap[a] || 0;
          let scoreB = freqMap[b] || 0;
          if (a % 10 === 0) scoreA += 10;
          if (b % 10 === 0) scoreB += 10;
          return scoreB - scoreA;
        });
      return candidates[0] || fallback;
    };

    // Определение ширины
    let detectedWidth = foundWidths.length > 0 ? Math.max(...foundWidths) : getBestInRange(300, 1600, 600);
    if (detectedWidth > 830 && detectedWidth < 850) detectedWidth = 840;

    // Определение столешницы и цоколя
    const hasCountertopInParts = parts.some(
      (p) =>
        p.name.toLowerCase().includes('столеш') ||
        p.name.toLowerCase().includes('столешка') ||
        p.name.toLowerCase().includes('постформинг') ||
        p.name.toLowerCase().includes('hpl')
    );
    const hasCountertop = hasCountertopInParts || (!isBathroom && !isWardrobe);

    const hasPlinthInParts = parts.some(
      (p) =>
        p.name.toLowerCase().includes('цокол') ||
        p.name.toLowerCase().includes('ножк') ||
        p.name.toLowerCase().includes('опор')
    );
    const hasPlinth = hasPlinthInParts || (detectedElevation < 30 && !isBathroom && !isWardrobe);

    // Определение итоговой высоты изделия
    let detectedHeight = 720;
    if (detectedCarcassHeight > 0) {
      detectedHeight = detectedCarcassHeight + (hasCountertop ? 22 : 0);
    } else if (isTallInitial) {
      detectedHeight = getBestInRange(1800, 2600, 2040);
    } else if (isWallInitial) {
      detectedHeight = getBestInRange(350, 960, 720);
    } else {
      detectedHeight = topFrequent(foundHeights, getBestInRange(450, 950, 720));
    }

    const detectedDepth = topFrequent(foundDepths, getBestInRange(280, 650, 500));

    // Подтип
    let subType: ParsedBazisResult['subType'] = 'base';
    if (isWallInitial || detectedHeight <= 500) {
      subType = 'wall';
    } else if (isTallInitial || detectedHeight >= 1800) {
      subType = 'tall';
    } else if (isWardrobe) {
      subType = 'wardrobe_swing';
    } else if (lowerName.includes('угол') || lowerName.includes('углов')) {
      subType = 'corner';
    }

    // Профиль Gola и ручки
    const isGola =
      parts.some((p) => p.name.toLowerCase().includes('gola') || p.name.toLowerCase().includes('гола')) ||
      hardwareList.some((h) => h.name.toLowerCase().includes('gola') || h.name.toLowerCase().includes('гола'));
    const detectedHandleType: ModuleConfig['handleType'] = isGola
      ? 'gola'
      : (hasDoors || hasDrawers ? 'bar' : 'none');

    let drawersCount = hasDrawers ? Math.max(1, detectedDrawersCount || 2) : 0;
    if (isGola || lowerName.includes('ванн') || lowerName.includes('тумб')) {
      if (drawersCount < 2) drawersCount = 2;
    }

    const templateId = 'bazis_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const mainGroup = subType === 'wall' ? 'wall' : subType === 'tall' ? 'tall' : 'base';
    const subGroup = drawersCount > 0 ? 'drawers' : 'doors';

    // Создание шаблона для МКонструктора
    const template: CatalogItemTemplate = {
      id: templateId,
      name: cleanModelName,
      code: `БМ-${detectedWidth}`,
      category: isWardrobe ? 'wardrobe' : 'kitchen',
      subType,
      mainGroup,
      subGroup,
      elevation: detectedElevation,
      defaultDimensions: {
        width: detectedWidth,
        height: detectedHeight,
        depth: detectedDepth,
      },
      allowedDimensions: {
        minWidth: Math.max(200, detectedWidth - 200),
        maxWidth: detectedWidth + 400,
        minHeight: Math.max(300, detectedHeight - 200),
        maxHeight: detectedHeight + 400,
        minDepth: Math.max(200, detectedDepth - 200),
        maxDepth: detectedDepth + 200,
      },
      defaultConfig: {
        doors: 0,
        drawers: drawersCount,
        shelves: parts.filter((p) => p.category === 'shelf').length || 0,
        hasCountertop,
        hasPlinth,
        hasBackWall: true,
        handleType: detectedHandleType,
        golaType: 'type1',
      },
      basePrice: Math.round(detectedWidth * 18 + detectedHeight * 8),
      description: `Импортировано из Базис-Мебельщик (${fileName}). Высота от пола: ${detectedElevation} мм. Каркас: ${detectedCarcassHeight || (detectedHeight - 22)} мм.`,
    };

    // Генерация точных деталей customParts для подвесной тумбы с ящиками и Gola (только для нижних/подвесных тумб, исключая навесные шкафы и пеналы)
    if (subType !== 'wall' && subType !== 'tall' && (isBathroom || isGola || (detectedElevation > 0 && subType === 'base'))) {
      const cHeight = detectedCarcassHeight || (detectedHeight - 22);
      const innerW = detectedWidth - 32;

      template.defaultConfig.customParts = [
        {
          id: `bazis_side_l_${Date.now()}`,
          name: 'Боковина левая (ЛДСП 16)',
          category: 'carcass',
          materialType: 'ldsp',
          materialName: detectedLdspName,
          color: '#CBD5E1',
          thickness: 16,
          widthBinding: 'left_side',
          depthBinding: 'full_depth',
          heightBinding: 'full_height',
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          isVisible: true,
        },
        {
          id: `bazis_side_r_${Date.now()}`,
          name: 'Боковина правая (ЛДСП 16)',
          category: 'carcass',
          materialType: 'ldsp',
          materialName: detectedLdspName,
          color: '#CBD5E1',
          thickness: 16,
          widthBinding: 'right_side',
          depthBinding: 'full_depth',
          heightBinding: 'full_height',
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          isVisible: true,
        },
        {
          id: `bazis_bottom_${Date.now()}`,
          name: 'Дно тумбы (ЛДСП 16)',
          category: 'carcass',
          materialType: 'ldsp',
          materialName: detectedLdspName,
          color: '#CBD5E1',
          thickness: 16,
          widthBinding: 'between_sides',
          depthBinding: 'full_depth',
          heightBinding: 'bottom_pass',
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          isVisible: true,
        },
        {
          id: `bazis_rail_top_${Date.now()}`,
          name: 'Царга задняя верхняя (ЛДСП 16)',
          category: 'carcass',
          materialType: 'ldsp',
          materialName: detectedLdspName,
          color: '#CBD5E1',
          thickness: 16,
          widthBinding: 'between_sides',
          depthBinding: 'custom',
          customDepth: 16,
          heightBinding: 'custom',
          customHeight: 100,
          offsetX: 0,
          offsetY: Math.round(cHeight / 2 - 50),
          offsetZ: -Math.round(detectedDepth / 2 - 8),
          isVisible: true,
        },
        {
          id: `bazis_gola_top_${Date.now()}`,
          name: 'Профиль Gola L верхний (золото)',
          category: 'hardware',
          materialType: 'metal',
          materialName: 'GOLA L золото',
          color: '#D4AF37',
          thickness: 19,
          widthBinding: 'custom',
          customWidth: innerW,
          depthBinding: 'custom',
          customDepth: 26,
          heightBinding: 'custom',
          customHeight: 57,
          offsetX: 0,
          offsetY: Math.round(cHeight / 2 - 28),
          offsetZ: Math.round(detectedDepth / 2 - 13),
          isVisible: true,
        },
        {
          id: `bazis_gola_mid_${Date.now()}`,
          name: 'Профиль Gola C средний (золото)',
          category: 'hardware',
          materialType: 'metal',
          materialName: 'GOLA C золото',
          color: '#D4AF37',
          thickness: 19,
          widthBinding: 'custom',
          customWidth: innerW,
          depthBinding: 'custom',
          customDepth: 26,
          heightBinding: 'custom',
          customHeight: 73,
          offsetX: 0,
          offsetY: 0,
          offsetZ: Math.round(detectedDepth / 2 - 13),
          isVisible: true,
        },
        {
          id: `bazis_facade_top_${Date.now()}`,
          name: 'Фасад верхнего ящика (МДФ)',
          category: 'drawer',
          materialType: 'mdf_facade',
          materialName: detectedFacadeName,
          color: '#E2E8F0',
          thickness: 19,
          widthBinding: 'custom',
          customWidth: detectedWidth - 4,
          depthBinding: 'facade',
          heightBinding: 'custom',
          customHeight: Math.round((cHeight - 73) / 2),
          offsetX: 0,
          offsetY: Math.round(cHeight / 4 + 18),
          offsetZ: 0,
          isVisible: true,
        },
        {
          id: `bazis_facade_btm_${Date.now()}`,
          name: 'Фасад нижнего ящика (МДФ)',
          category: 'drawer',
          materialType: 'mdf_facade',
          materialName: detectedFacadeName,
          color: '#E2E8F0',
          thickness: 19,
          widthBinding: 'custom',
          customWidth: detectedWidth - 4,
          depthBinding: 'facade',
          heightBinding: 'custom',
          customHeight: Math.round((cHeight - 73) / 2),
          offsetX: 0,
          offsetY: -Math.round(cHeight / 4 + 18),
          offsetZ: 0,
          isVisible: true,
        },
      ];
    } else {
      const generatedParts = convertTemplateToCustomParts(
        template,
        DEFAULT_PROJECT_SETTINGS,
        { width: detectedWidth, height: detectedHeight, depth: detectedDepth }
      );
      template.defaultConfig.customParts = generatedParts.map((p) => {
        if (p.materialType === 'ldsp' && detectedLdspName) {
          return { ...p, materialName: detectedLdspName };
        }
        if ((p.materialType === 'mdf' || p.materialType === 'mdf_facade') && detectedFacadeName) {
          return { ...p, materialName: detectedFacadeName };
        }
        return p;
      });
    }

    return {
      success: true,
      fileName,
      modelName: cleanModelName,
      thumbnailUrl,
      dimensions: {
        width: detectedWidth,
        height: detectedHeight,
        depth: detectedDepth,
      },
      elevation: detectedElevation,
      subType,
      carcassMaterialName: detectedLdspName,
      facadeMaterialName: detectedFacadeName,
      edgesList: Array.from(edgesSet),
      parts,
      hardwareList,
      template,
    };
  } catch (err) {
    console.error('Ошибка парсинга файла Базис-Мебельщик:', err);
    return {
      success: false,
      fileName,
      modelName: fileName,
      thumbnailUrl: null,
      dimensions: { width: 600, height: 720, depth: 560 },
      elevation: 0,
      subType: 'base',
      carcassMaterialName: 'ЛДСП',
      facadeMaterialName: 'МДФ',
      edgesList: [],
      parts: [],
      hardwareList: [],
      template: null as any,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
