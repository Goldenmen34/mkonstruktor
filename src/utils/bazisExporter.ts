/**
 * ============================================================================
 * МКонструктор 3D • Модуль Экспорта в Базис-Мебельщик (Bazis-Mebelshik)
 * ============================================================================
 * 
 * 1. Генерация скрипта Базис-Мебельщик 10/11/12 (.js) для построения параметрической
 *    модели со всеми панелями, толщинами, кромками и блоками.
 * 2. Генерация детальной спецификации для «Базис-Раскрой» (.csv).
 */

import { FurnitureModule, RoomConfig } from '../types';

export interface BazisExportOptions {
  // Толщина плитных материалов
  ldspThickness: 16 | 18; // ЛДСП корпуса (16 мм или 18 мм)
  facadeThickness: 16 | 19 | 22; // Фасады МДФ (16, 19, 22 мм)
  backWallThickness: 4; // Задняя стенка ХДФ (4 мм)
  countertopThickness: 28 | 38; // Столешница (28 или 38 мм)
  
  // Технологические зазоры
  facadeGap: number; // Зазор между фасадами (по умолчанию 2-3 мм)
  grooveOffset: number; // Отступ паза под заднюю стенку от заднего торца (16 мм)
  shelfInset: number; // Отступ полок от переднего края (15 мм)
  
  // Кромка
  frontEdgeThickness: 1.0 | 2.0; // Лицевая кромка корпуса (1 или 2 мм)
  innerEdgeThickness: 0.4; // Внутренняя техническая кромка (0.4 мм)
  
  // Опции
  includeCountertop: boolean; // Включать столешницу
  includePlinth: boolean; // Включать цоколь
  includeDrawersBoxes: boolean; // Строить внутренние короба ящиков
  clearSceneFirst: boolean; // Очищать модель в Базисе перед построением
}

export const DEFAULT_BAZIS_OPTIONS: BazisExportOptions = {
  ldspThickness: 16,
  facadeThickness: 19,
  backWallThickness: 4,
  countertopThickness: 38,
  facadeGap: 2.5,
  grooveOffset: 16,
  shelfInset: 15,
  frontEdgeThickness: 1.0,
  innerEdgeThickness: 0.4,
  includeCountertop: true,
  includePlinth: true,
  includeDrawersBoxes: true,
  clearSceneFirst: true,
};

export interface CutListPart {
  pos: number;
  code: string;
  name: string;
  length: number; // мм
  width: number;  // мм
  thickness: number; // мм
  count: number;
  material: string;
  edgeL1: string;
  edgeL2: string;
  edgeW1: string;
  edgeW2: string;
  groove: string;
  moduleName: string;
  notes?: string;
}

/**
 * 1. Генерация JS-скрипта для запуска в Базис-Мебельщик (10 / 11 / 12)
 */
export function generateBazisScript(
  modules: FurnitureModule[],
  room: RoomConfig,
  options: Partial<BazisExportOptions> = {}
): string {
  const opt: BazisExportOptions = { ...DEFAULT_BAZIS_OPTIONS, ...options };
  const dateStr = new Date().toLocaleString('ru-RU');

  let code = `// =============================================================================
// Скрипт автоматического построения мебели в Базис-Мебельщик (10 / 11 / 12)
// Сгенерировано системой «МКонструктор 3D • Мебельный Конструктор»
// Дата: ${dateStr}
// Количество модулей: ${modules.length}
// =============================================================================
// КАК ЗАПУСТИТЬ В БАЗИС-МЕБЕЛЬЩИК:
// 1. Откройте Базис-Мебельщик.
// 2. В верхнем меню выберите: «Скрипты» -> «Выполнить скрипт...» (или нажмите Ctrl+F12).
// 3. Выберите этот файл (.js) — Базис автоматически построит весь проект подетально!
// =============================================================================

`;

  if (opt.clearSceneFirst) {
    code += `// Очистка текущей модели\ntry { Model.Clear(); } catch (e) {}\n\n`;
  }

  code += `// --- Инициализация материалов проекта ---
var ldspThick = ${opt.ldspThickness};
var facadeThick = ${opt.facadeThickness};
var hdfThick = ${opt.backWallThickness};
var tabletopThick = ${opt.countertopThickness};

var matCarcass = "ЛДСП " + ldspThick + "мм Белый";
var matFacade = "МДФ " + facadeThick + "мм Эмаль";
var matHdf = "ХДФ " + hdfThick + "мм Белый";
var matTabletop = "Столешница " + tabletopThick + "мм";
var matPlinth = "Цоколь ПВХ 100мм";

// Установка активных материалов в Базисе
try {
  if (typeof SetMaterial === 'function') {
    SetMaterial(matCarcass, ldspThick);
  }
} catch (e) {}

// Вспомогательная функция для добавления панелей
function createPanel(w, h, th, name, matName) {
  try {
    if (typeof SetMaterial === 'function') SetMaterial(matName || matCarcass, th);
  } catch (e) {}
  var p = null;
  if (typeof AddPanel3D === 'function') {
    p = AddPanel3D(th, w, h);
  } else if (typeof AddPanel === 'function') {
    p = AddPanel(w, h);
  } else if (typeof AddHorizPanel === 'function') {
    p = AddHorizPanel(0, 0, w, h, 0);
  }
  if (p && name) p.Name = name;
  return p;
}

// Вспомогательная функция позиционирования панели
function setPos(obj, x, y, z) {
  if (!obj) return;
  if (typeof NewVector === 'function') {
    obj.Position = NewVector(x, y, z);
  } else if (obj.Position) {
    obj.Position.x = x;
    obj.Position.y = y;
    obj.Position.z = z;
  }
}

// Вспомогательная функция создания блока
function startCabinetBlock(name) {
  if (typeof BeginBlock === 'function') {
    return BeginBlock(name);
  } else if (typeof Action !== 'undefined' && Action.AddBlock) {
    return Action.AddBlock(name);
  }
  return null;
}

function finishCabinetBlock() {
  if (typeof EndBlock === 'function') {
    EndBlock();
  }
}

`;

  // Обход всех модулей проекта
  modules.forEach((mod, idx) => {
    const modNum = idx + 1;
    const w = Math.round(mod.dimensions.width);
    const h = Math.round(mod.dimensions.height);
    const d = Math.round(mod.dimensions.depth);
    const posX = Math.round(mod.position.x);
    const posY = Math.round(mod.position.y);
    const posZ = Math.round(mod.position.z);
    const rot = Math.round(mod.rotation || 0);

    const isBase = mod.subType === 'base' || mod.category === 'kitchen' && posY < 500;
    const isWall = mod.subType === 'wall';
    const isTall = mod.subType === 'tall';
    const isWardrobe = mod.category === 'wardrobe' || mod.subType.startsWith('wardrobe');
    
    const hasPlinth = mod.config.hasPlinth !== false && isBase;
    const plinthH = hasPlinth ? 100 : 0;
    const carcassH = isBase ? Math.max(100, h - plinthH) : h;

    const doors = mod.config.doors || 0;
    const drawers = mod.config.drawers || 0;
    const shelves = mod.config.shelves || 0;

    code += `// =============================================================================\n`;
    code += `// МОДУЛЬ #${modNum}: ${mod.code || mod.name} (${w}x${h}x${d} мм)\n`;
    code += `// =============================================================================\n`;
    code += `(function() {\n`;
    code += `  var blockName = "${modNum}. ${mod.code ? mod.code + ' ' : ''}${mod.name} [${w}x${h}x${d}]";\n`;
    code += `  var blk = startCabinetBlock(blockName);\n\n`;

    // 1. Левая боковина
    code += `  // Боковина левая\n`;
    code += `  var pLeft = createPanel(${d}, ${carcassH}, ldspThick, "Боковина левая", matCarcass);\n`;
    code += `  setPos(pLeft, 0, ${plinthH}, 0);\n`;
    code += `  if (pLeft && pLeft.Orient) pLeft.Orient(1); // вертикальная ориентация Z-Y\n\n`;

    // 2. Правая боковина
    code += `  // Боковина правая\n`;
    code += `  var pRight = createPanel(${d}, ${carcassH}, ldspThick, "Боковина правая", matCarcass);\n`;
    code += `  setPos(pRight, ${w - opt.ldspThickness}, ${plinthH}, 0);\n`;
    code += `  if (pRight && pRight.Orient) pRight.Orient(1);\n\n`;

    // 3. Дно
    const bottomW = w - 2 * opt.ldspThickness;
    code += `  // Дно секции\n`;
    code += `  var pBottom = createPanel(${bottomW}, ${d}, ldspThick, "Дно", matCarcass);\n`;
    code += `  setPos(pBottom, ${opt.ldspThickness}, ${plinthH}, 0);\n\n`;

    // 4. Крыша или Царги
    if (isBase) {
      // Царги для нижних модулей (передняя и задняя стяжные планки)
      code += `  // Царга передняя (стяжная планка)\n`;
      code += `  var pStrut1 = createPanel(${bottomW}, 80, ldspThick, "Царга передняя", matCarcass);\n`;
      code += `  setPos(pStrut1, ${opt.ldspThickness}, ${plinthH + carcassH - opt.ldspThickness}, 0);\n\n`;

      code += `  // Царга задняя (стяжная планка)\n`;
      code += `  var pStrut2 = createPanel(${bottomW}, 80, ldspThick, "Царга задняя", matCarcass);\n`;
      code += `  setPos(pStrut2, ${opt.ldspThickness}, ${plinthH + carcassH - opt.ldspThickness}, ${d - 80});\n\n`;
    } else {
      // Полноценная крыша для верхних шкафов, пеналов и гардеробов
      code += `  // Крыша (верхний горизонт)\n`;
      code += `  var pTop = createPanel(${bottomW}, ${d}, ldspThick, "Крыша", matCarcass);\n`;
      code += `  setPos(pTop, ${opt.ldspThickness}, ${plinthH + carcassH - opt.ldspThickness}, 0);\n\n`;
    }

    // 5. Полки
    if (shelves > 0) {
      code += `  // Съемные / вкладные полки (${shelves} шт.)\n`;
      const step = Math.round(carcassH / (shelves + 1));
      for (let s = 1; s <= shelves; s++) {
        const shelfY = plinthH + s * step;
        const shelfD = d - opt.shelfInset;
        code += `  var pShelf${s} = createPanel(${bottomW - 2}, ${shelfD}, ldspThick, "Полка ${s}", matCarcass);\n`;
        code += `  setPos(pShelf${s}, ${opt.ldspThickness + 1}, ${shelfY}, 0);\n`;
      }
      code += `\n`;
    }

    // 6. Задняя стенка (ХДФ 4 мм)
    if (mod.config.hasBackWall !== false) {
      code += `  // Задняя стенка (ХДФ 4 мм)\n`;
      code += `  var pBack = createPanel(${w - 4}, ${carcassH - 4}, hdfThick, "Задняя стенка ХДФ", matHdf);\n`;
      code += `  setPos(pBack, 2, ${plinthH + 2}, ${d - opt.backWallThickness});\n\n`;
    }

    // 7. Фасады
    if (drawers > 0) {
      code += `  // Выдвижные ящики и накладки (${drawers} шт.)\n`;
      const drawerHeight = Math.round((carcassH - (drawers + 1) * opt.facadeGap) / drawers);
      const drawerW = Math.round(w - 2 * opt.facadeGap);

      for (let dr = 0; dr < drawers; dr++) {
        const drY = Math.round(plinthH + opt.facadeGap + dr * (drawerHeight + opt.facadeGap));
        code += `  // Накладка ящика ${dr + 1}\n`;
        code += `  var pDrawerFacade${dr + 1} = createPanel(${drawerW}, ${drawerHeight}, facadeThick, "Фасад ящика ${dr + 1}", matFacade);\n`;
        code += `  setPos(pDrawerFacade${dr + 1}, ${opt.facadeGap}, ${drY}, -facadeThick);\n`;

        if (opt.includeDrawersBoxes) {
          const boxD = d - 50;
          const boxH = Math.min(drawerHeight - 40, 160);
          const boxInnerW = bottomW - 26; // 13мм зазор на направляющие с каждой стороны
          code += `  // Короб ящика ${dr + 1}\n`;
          code += `  var pBoxSideL${dr + 1} = createPanel(${boxD}, ${boxH}, ldspThick, "Боковина ящика L ${dr + 1}", matCarcass);\n`;
          code += `  setPos(pBoxSideL${dr + 1}, ${opt.ldspThickness + 13}, ${drY + 20}, 20);\n`;
          code += `  var pBoxSideR${dr + 1} = createPanel(${boxD}, ${boxH}, ldspThick, "Боковина ящика R ${dr + 1}", matCarcass);\n`;
          code += `  setPos(pBoxSideR${dr + 1}, ${w - opt.ldspThickness - 13 - opt.ldspThickness}, ${drY + 20}, 20);\n`;
        }
      }
      code += `\n`;
    } else if (doors > 0) {
      code += `  // Распашные фасады (${doors} дв.)\n`;
      const doorH = Math.round(carcassH - 2 * opt.facadeGap);
      if (doors === 1) {
        const doorW = Math.round(w - 2 * opt.facadeGap);
        code += `  var pDoor = createPanel(${doorW}, ${doorH}, facadeThick, "Фасад распашной", matFacade);\n`;
        code += `  setPos(pDoor, ${opt.facadeGap}, ${plinthH + opt.facadeGap}, -facadeThick);\n\n`;
      } else {
        const doorW = Math.round((w - 3 * opt.facadeGap) / 2);
        code += `  var pDoorL = createPanel(${doorW}, ${doorH}, facadeThick, "Фасад левый", matFacade);\n`;
        code += `  setPos(pDoorL, ${opt.facadeGap}, ${plinthH + opt.facadeGap}, -facadeThick);\n`;
        code += `  var pDoorR = createPanel(${doorW}, ${doorH}, facadeThick, "Фасад правый", matFacade);\n`;
        code += `  setPos(pDoorR, ${opt.facadeGap * 2 + doorW}, ${plinthH + opt.facadeGap}, -facadeThick);\n\n`;
      }
    }

    // 8. Цоколь
    if (hasPlinth && opt.includePlinth) {
      code += `  // Цокольная планка\n`;
      code += `  var pPlinth = createPanel(${w}, ${plinthH}, ldspThick, "Цоколь", matPlinth);\n`;
      code += `  setPos(pPlinth, 0, 0, 30);\n\n`;
    }

    // 9. Столешница
    if (isBase && opt.includeCountertop && mod.config.hasCountertop !== false) {
      const topDepth = d + 40; // 40 мм свес спереди
      code += `  // Столешница со свесом 40 мм\n`;
      code += `  var pTabletop = createPanel(${w}, ${topDepth}, tabletopThick, "Столешница", matTabletop);\n`;
      code += `  setPos(pTabletop, 0, ${plinthH + carcassH}, -40);\n\n`;
    }

    // Закрытие блока и установка глобальной позиции и вращения
    code += `  finishCabinetBlock();\n`;
    code += `  if (blk) {\n`;
    code += `    setPos(blk, ${posX}, ${posY}, ${posZ});\n`;
    if (rot !== 0) {
      code += `    if (blk.Rotate && typeof NewVector === 'function') {\n`;
      code += `      blk.Rotate(NewVector(0, 1, 0), ${rot});\n`;
      code += `    }\n`;
    }
    code += `  }\n`;
    code += `})();\n\n`;
  });

  code += `// Готово! Развертка и обновление габаритной рамки модели
try {
  if (typeof Action !== 'undefined' && Action.Finish) Action.Finish();
} catch (e) {}
`;

  return code;
}

/**
 * 2. Генерация детальной спецификации для «Базис-Раскрой» (.csv)
 */
export function generateBazisCutList(
  modules: FurnitureModule[],
  options: Partial<BazisExportOptions> = {}
): CutListPart[] {
  const opt: BazisExportOptions = { ...DEFAULT_BAZIS_OPTIONS, ...options };
  const parts: CutListPart[] = [];
  let posCounter = 1;

  modules.forEach((mod) => {
    const w = Math.round(mod.dimensions.width);
    const h = Math.round(mod.dimensions.height);
    const d = Math.round(mod.dimensions.depth);
    const modCode = mod.code || `M-${w}`;
    const modName = mod.name;

    const isBase = mod.subType === 'base' || mod.category === 'kitchen' && (mod.position.y || 0) < 500;
    const hasPlinth = mod.config.hasPlinth !== false && isBase;
    const plinthH = hasPlinth ? 100 : 0;
    const carcassH = isBase ? Math.max(100, h - plinthH) : h;

    const doors = mod.config.doors || 0;
    const drawers = mod.config.drawers || 0;
    const shelves = mod.config.shelves || 0;

    const edgeFront = `${opt.frontEdgeThickness}x19`;
    const edgeInner = `${opt.innerEdgeThickness}x19`;

    // 1. Боковины (2 шт: левая и правая)
    parts.push({
      pos: posCounter++,
      code: `${modCode}.01`,
      name: 'Боковина',
      length: carcassH,
      width: d,
      thickness: opt.ldspThickness,
      count: 2,
      material: `ЛДСП ${opt.ldspThickness}мм Корпус`,
      edgeL1: edgeFront,
      edgeL2: '-',
      edgeW1: edgeInner,
      edgeW2: edgeInner,
      groove: 'Паз 4х10 отступ 16',
      moduleName: modName,
      notes: 'Левая и правая',
    });

    // 2. Дно
    const bottomW = w - 2 * opt.ldspThickness;
    parts.push({
      pos: posCounter++,
      code: `${modCode}.02`,
      name: 'Дно',
      length: bottomW,
      width: d,
      thickness: opt.ldspThickness,
      count: 1,
      material: `ЛДСП ${opt.ldspThickness}мм Корпус`,
      edgeL1: edgeFront,
      edgeL2: '-',
      edgeW1: '-',
      edgeW2: '-',
      groove: 'Паз 4х10 отступ 16',
      moduleName: modName,
    });

    // 3. Крыша или Царги
    if (isBase) {
      parts.push({
        pos: posCounter++,
        code: `${modCode}.03`,
        name: 'Царга стяжная',
        length: bottomW,
        width: 80,
        thickness: opt.ldspThickness,
        count: 2,
        material: `ЛДСП ${opt.ldspThickness}мм Корпус`,
        edgeL1: edgeInner,
        edgeL2: edgeInner,
        edgeW1: '-',
        edgeW2: '-',
        groove: '-',
        moduleName: modName,
        notes: 'Передняя и задняя стяжка',
      });
    } else {
      parts.push({
        pos: posCounter++,
        code: `${modCode}.03`,
        name: 'Крыша',
        length: bottomW,
        width: d,
        thickness: opt.ldspThickness,
        count: 1,
        material: `ЛДСП ${opt.ldspThickness}мм Корпус`,
        edgeL1: edgeFront,
        edgeL2: '-',
        edgeW1: '-',
        edgeW2: '-',
        groove: 'Паз 4х10 отступ 16',
        moduleName: modName,
      });
    }

    // 4. Полки
    if (shelves > 0) {
      parts.push({
        pos: posCounter++,
        code: `${modCode}.04`,
        name: 'Полка вкладная',
        length: bottomW - 2,
        width: d - opt.shelfInset,
        thickness: opt.ldspThickness,
        count: shelves,
        material: `ЛДСП ${opt.ldspThickness}мм Корпус`,
        edgeL1: edgeFront,
        edgeL2: '-',
        edgeW1: '-',
        edgeW2: '-',
        groove: '-',
        moduleName: modName,
        notes: 'Съемная',
      });
    }

    // 5. Задняя стенка (ХДФ 4 мм)
    if (mod.config.hasBackWall !== false) {
      parts.push({
        pos: posCounter++,
        code: `${modCode}.05`,
        name: 'Задняя стенка',
        length: carcassH - 4,
        width: w - 4,
        thickness: opt.backWallThickness,
        count: 1,
        material: `ХДФ ${opt.backWallThickness}мм Белый`,
        edgeL1: '-',
        edgeL2: '-',
        edgeW1: '-',
        edgeW2: '-',
        groove: '-',
        moduleName: modName,
        notes: 'В паз / в четверть',
      });
    }

    // 6. Фасады
    if (drawers > 0) {
      const drawerHeight = Math.round((carcassH - (drawers + 1) * opt.facadeGap) / drawers);
      const drawerW = Math.round(w - 2 * opt.facadeGap);
      parts.push({
        pos: posCounter++,
        code: `${modCode}.ФД`,
        name: 'Фасад ящика',
        length: drawerW,
        width: drawerHeight,
        thickness: opt.facadeThickness,
        count: drawers,
        material: `МДФ ${opt.facadeThickness}мм Фасад`,
        edgeL1: '2.0x19 (по периметру)',
        edgeL2: '2.0x19',
        edgeW1: '2.0x19',
        edgeW2: '2.0x19',
        groove: '-',
        moduleName: modName,
        notes: 'Фрезеровка / эмаль',
      });
    } else if (doors > 0) {
      const doorH = Math.round(carcassH - 2 * opt.facadeGap);
      if (doors === 1) {
        parts.push({
          pos: posCounter++,
          code: `${modCode}.Ф1`,
          name: 'Фасад распашной',
          length: doorH,
          width: Math.round(w - 2 * opt.facadeGap),
          thickness: opt.facadeThickness,
          count: 1,
          material: `МДФ ${opt.facadeThickness}мм Фасад`,
          edgeL1: '2.0x19 (по периметру)',
          edgeL2: '2.0x19',
          edgeW1: '2.0x19',
          edgeW2: '2.0x19',
          groove: '-',
          moduleName: modName,
        });
      } else {
        const doorW = Math.round((w - 3 * opt.facadeGap) / 2);
        parts.push({
          pos: posCounter++,
          code: `${modCode}.Ф2`,
          name: 'Фасад распашной (пара)',
          length: doorH,
          width: doorW,
          thickness: opt.facadeThickness,
          count: 2,
          material: `МДФ ${opt.facadeThickness}мм Фасад`,
          edgeL1: '2.0x19 (по периметру)',
          edgeL2: '2.0x19',
          edgeW1: '2.0x19',
          edgeW2: '2.0x19',
          groove: '-',
          moduleName: modName,
        });
      }
    }
  });

  return parts;
}

/**
 * 3. Форматирование таблицы деталей в CSV для прямого импорта в Базис-Раскрой
 */
export function formatBazisCutListCsv(parts: CutListPart[]): string {
  // UTF-8 BOM для безупречного открытия в Excel и Базис-Раскрой на русском языке
  const BOM = '\uFEFF';
  const headers = [
    '№',
    'Обозначение',
    'Наименование',
    'Длина',
    'Ширина',
    'Толщина',
    'Количество',
    'Материал',
    'Кромка Д1',
    'Кромка Д2',
    'Кромка Ш1',
    'Кромка Ш2',
    'Паз',
    'Модуль',
    'Примечание',
  ];

  const rows = parts.map((p) => [
    p.pos,
    `"${p.code}"`,
    `"${p.name}"`,
    p.length,
    p.width,
    p.thickness,
    p.count,
    `"${p.material}"`,
    `"${p.edgeL1}"`,
    `"${p.edgeL2}"`,
    `"${p.edgeW1}"`,
    `"${p.edgeW2}"`,
    `"${p.groove}"`,
    `"${p.moduleName}"`,
    `"${p.notes || ''}"`,
  ]);

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  return BOM + csvContent;
}

/**
 * Утилита скачивания файла в браузере
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
