/**
 * ============================================================================
 * МКонструктор 3D • Модуль Импорта из Базис-Мебельщик (.b3d / .fr3)
 * ============================================================================
 * 
 * 1. Читает бинарные файлы .b3d и фрагменты .fr3 прямо в браузере (на клиенте).
 * 2. Извлекает встроенный высококачественный 256x256 PNG-эскиз (Thumbnail).
 * 3. Распаковывает zlib-потоки и извлекает:
 *    - Список и типы панелей (боковины, дно, полки, фасады, ящики)
 *    - Материалы (ЛДСП, МДФ, кромка)
 *    - Фурнитуру и крепеж (направляющие, петли, стяжки, евровинты)
 *    - Габариты (Ширина, Высота, Глубина)
 * 4. Превращает секцию Базиса в параметрический модуль для каталога и сцены!
 */

import * as fflate from 'fflate';
import { CatalogItemTemplate } from '../data/catalog';

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
 * Основная функция разбора файла Базис-Мебельщик (.b3d / .fr3)
 */
export async function parseBazisB3D(file: File | ArrayBuffer, fileName: string = 'Базис_Секция.b3d'): Promise<ParsedBazisResult> {
  try {
    let arrayBuffer: ArrayBuffer;
    if (file instanceof File) {
      fileName = file.name;
      arrayBuffer = await file.arrayBuffer();
    } else {
      arrayBuffer = file;
    }

    const u8 = new Uint8Array(arrayBuffer);
    if (u8.length < 100) {
      throw new Error('Файл слишком мал для корректного проекта Базис-Мебельщик');
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
          
          // Конвертация в Base64 Data URL
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
          i += 200; // Пропускаем уже разобранную область
        } catch (e) {
          // Игнорируем ложные совпадения сигнатуры
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
          } else {
            break;
          }
        }

        if (str.length >= 3 && /[А-Яа-яЁё]/.test(str)) {
          const clean = str.trim().replace(/[\r\n\t]/g, ' ');
          if (
            clean.length >= 3 &&
            !clean.includes('<?xml') &&
            !clean.includes('<Estimate') &&
            !clean.includes('OrderName')
          ) {
            rawItemsMap.set(clean, (rawItemsMap.get(clean) || 0) + 1);
          }
          i = j;
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

      // Фурнитура и крепеж
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
      } else if (lower.includes('бок') || lower.includes('дно') || lower.includes('крыша') || lower.includes('верх') || lower.includes('царга')) {
        category = 'carcass';
      }

      parts.push({
        name,
        category,
        count,
      });
    }

    // 5. Определение габаритов
    // Ищем характерные мебельные размеры (Ширина, Глубина, Высота)
    let detectedWidth = 600;
    let detectedHeight = 720;
    let detectedDepth = 560;

    // Сканируем числа из decompressedChunks
    const candidateFloats: number[] = [];
    for (const chunk of decompressedChunks) {
      for (let i = 0; i < chunk.length - 4; i += 4) {
        try {
          const f = new DataView(chunk.buffer, chunk.byteOffset + i, 4).getFloat32(0, true);
          if (f >= 100 && f <= 2800 && Number.isFinite(f) && Math.abs(f - Math.round(f)) < 0.1) {
            candidateFloats.push(Math.round(f));
          }
        } catch (e) {}
      }
    }

    // Умный поиск стандартных габаритов
    const widths = candidateFloats.filter((n) => n >= 300 && n <= 1200 && n % 50 === 0);
    const depths = candidateFloats.filter((n) => n >= 300 && n <= 600);
    const heights = candidateFloats.filter((n) => (n >= 700 && n <= 920) || (n >= 1900 && n <= 2400));

    if (widths.length > 0) detectedWidth = widths[0];
    if (depths.length > 0) detectedDepth = depths[0];
    if (heights.length > 0) detectedHeight = heights[0];

    // Очищенное имя модели
    const cleanModelName = fileName
      .replace(/\.b3d$/i, '')
      .replace(/\.fr3$/i, '')
      .trim();

    // 6. Определение типа секции (подтип)
    let subType: ParsedBazisResult['subType'] = 'base';
    const lowerName = cleanModelName.toLowerCase();
    if (lowerName.includes('верх') || lowerName.includes('навесн') || detectedHeight <= 500) {
      subType = 'wall';
      detectedHeight = detectedHeight || 720;
      detectedDepth = Math.min(detectedDepth, 350);
    } else if (lowerName.includes('пенал') || lowerName.includes('колон') || detectedHeight >= 1800) {
      subType = 'tall';
      detectedHeight = Math.max(detectedHeight, 2040);
    } else if (lowerName.includes('шкаф') || lowerName.includes('купе')) {
      subType = 'wardrobe_swing';
    } else if (lowerName.includes('угол') || lowerName.includes('углов')) {
      subType = 'corner';
    }

    const templateId = 'bazis_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    const mainGroup = subType === 'wall' ? 'wall' : subType === 'tall' ? 'tall' : 'base';
    const subGroup = hasDrawers ? 'drawers' : 'doors';

    // 7. Создание шаблона для МКонструктора
    const template: CatalogItemTemplate = {
      id: templateId,
      name: cleanModelName,
      code: `БМ-${detectedWidth}`,
      category: subType.startsWith('wardrobe') ? 'wardrobe' : 'kitchen',
      subType: subType,
      mainGroup,
      subGroup,
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
        doors: hasDoors ? Math.max(1, detectedDoorsCount || 1) : 0,
        drawers: hasDrawers ? Math.max(1, detectedDrawersCount || 2) : 0,
        shelves: parts.filter((p) => p.category === 'shelf').length || 1,
        hasCountertop: subType === 'base',
        hasPlinth: subType === 'base',
        hasBackWall: true,
        handleType: 'bar',
      },
      basePrice: Math.round(detectedWidth * 18 + detectedHeight * 8),
      description: `Импортировано из Базис-Мебельщик (${fileName}). Материалы: ${detectedLdspName}, ${detectedFacadeName}.`,
    };

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
