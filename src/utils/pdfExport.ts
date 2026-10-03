import { jsPDF } from 'jspdf';
import { FurnitureModule, RoomConfig } from '../types';

interface PDFExportOptions {
  clientName: string;
  room: RoomConfig;
  modules: FurnitureModule[];
  pricing: {
    modulesTotal: number;
    countertopTotal: number;
    hardwareTotal: number;
    assemblyTotal: number;
    grandTotal: number;
  };
  screenshotDataUrl?: string;
}

/**
 * Вспомогательная функция рисования скругленного прямоугольника
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Безопасная загрузка изображения (Data URL или URL)
 */
function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Генерирует официальное коммерческое предложение в PDF
 * с 100% поддержкой кириллицы через нативный Canvas 2D API (высокое разрешение 200 DPI)
 * и упаковку в A4 через jsPDF.
 * Не зависит от HTML2Canvas и не падает на стилях Tailwind CSS v4.
 */
export async function generateQuotationPDF(options: PDFExportOptions): Promise<void> {
  try {
    const curDate = new Date().toLocaleDateString('ru-RU');
    const screenshotImg = await loadImage(options.screenshotDataUrl);

    // Габариты листа А4 при 192 DPI (для безупречной типографики при печати)
    const PAGE_W = 1600;
    const PAGE_H = 2263;
    const MARGIN = 80;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Не удалось инициализировать 2D-контекст рендеринга');
    }

    // 1. Фон документа (чисто-белый)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    let curY = MARGIN;

    // 2. Шапка документа
    // Логотип МКонструктор
    ctx.font = 'bold 36px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('МКонструктор', MARGIN, curY + 36);

    const logoMetrics = ctx.measureText('МКонструктор');
    const badgeX = MARGIN + logoMetrics.width + 16;
    const badgeY = curY + 8;
    const badgeW = 180;
    const badgeH = 34;

    // Бейдж 3D КОНСТРУКТОР
    ctx.fillStyle = '#f0f9ff';
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 15px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#0284c7';
    ctx.fillText('3D КОНСТРУКТОР', badgeX + 18, badgeY + 23);

    // Подзаголовок
    ctx.font = '19px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Мебельный Конструктор • Спецификация и расчет стоимости проекта', MARGIN, curY + 76);

    // Реквизиты справа
    ctx.textAlign = 'right';
    ctx.font = '18px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`Дата: ${curDate}`, PAGE_W - MARGIN, curY + 32);

    ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    const client = options.clientName ? `Заказчик: ${options.clientName}` : 'Заказчик: Частный заказчик';
    ctx.fillText(client, PAGE_W - MARGIN, curY + 64);
    ctx.textAlign = 'left';

    curY += 105;

    // Акцентный синий разделитель
    ctx.beginPath();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.moveTo(MARGIN, curY);
    ctx.lineTo(PAGE_W - MARGIN, curY);
    ctx.stroke();

    curY += 24;

    // 3. Плашка параметров помещения
    const roomBoxH = 64;
    ctx.fillStyle = '#f8fafc';
    drawRoundedRect(ctx, MARGIN, curY, CONTENT_W, roomBoxH, 8);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '18px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(
      `Габариты помещения: ${options.room.width} × ${options.room.length} мм  |  Высота: ${options.room.height} мм`,
      MARGIN + 24,
      curY + 39
    );

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`Всего секций: ${options.modules.length} шт.`, PAGE_W - MARGIN - 24, curY + 39);
    ctx.textAlign = 'left';

    curY += roomBoxH + 24;

    // 4. Снимок 3D-проекта
    if (screenshotImg) {
      const imgBoxH = 460;
      ctx.fillStyle = '#0b0f19';
      drawRoundedRect(ctx, MARGIN, curY, CONTENT_W, imgBoxH, 8);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Центрируем изображение с сохранением пропорций
      const imgAspect = screenshotImg.width / screenshotImg.height;
      let drawW = CONTENT_W;
      let drawH = CONTENT_W / imgAspect;

      if (drawH > imgBoxH) {
        drawH = imgBoxH;
        drawW = imgBoxH * imgAspect;
      }

      const drawX = MARGIN + (CONTENT_W - drawW) / 2;
      const drawY = curY + (imgBoxH - drawH) / 2;

      ctx.save();
      drawRoundedRect(ctx, MARGIN, curY, CONTENT_W, imgBoxH, 8);
      ctx.clip();
      ctx.drawImage(screenshotImg, drawX, drawY, drawW, drawH);
      ctx.restore();

      curY += imgBoxH + 30;
    }

    // 5. Заголовок таблицы спецификации
    ctx.font = 'bold 22px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Спецификация модулей мебели', MARGIN, curY + 22);

    curY += 36;

    // 6. Таблица спецификации
    const tableHeaderH = 46;
    const colX = {
      num: MARGIN + 16,
      name: MARGIN + 70,
      category: MARGIN + 620,
      dimensions: MARGIN + 820,
      price: PAGE_W - MARGIN - 24,
    };

    // Шапка таблицы (Dark Slate)
    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, MARGIN, curY, CONTENT_W, tableHeaderH, 6);
    ctx.fill();

    ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('№', colX.num, curY + 29);
    ctx.fillText('Наименование модуля', colX.name, curY + 29);
    ctx.fillText('Категория', colX.category, curY + 29);
    ctx.fillText('Габариты (Ш×В×Г)', colX.dimensions, curY + 29);
    ctx.textAlign = 'right';
    ctx.fillText('Стоимость', colX.price, curY + 29);
    ctx.textAlign = 'left';

    curY += tableHeaderH;

    // Строки таблицы
    const rowH = 42;
    options.modules.forEach((mod, idx) => {
      const widthFactor = mod.dimensions.width / 600;
      const price = Math.round(mod.basePrice * widthFactor);

      // Зебра
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(MARGIN, curY, CONTENT_W, rowH);

      // Разделительная линия снизу строки
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN, curY + rowH);
      ctx.lineTo(PAGE_W - MARGIN, curY + rowH);
      ctx.stroke();

      // Номер
      ctx.font = '16px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${idx + 1}`, colX.num, curY + 27);

      // Название
      ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(mod.name, colX.name, curY + 27);

      // Категория
      ctx.font = '15px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(mod.category === 'kitchen' ? 'Кухня' : 'Шкаф', colX.category, curY + 27);

      // Размеры
      ctx.font = '15px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText(
        `${mod.dimensions.width} × ${mod.dimensions.height} × ${mod.dimensions.depth} мм`,
        colX.dimensions,
        curY + 27
      );

      // Цена
      ctx.textAlign = 'right';
      ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${price.toLocaleString('ru-RU')} ₽`, colX.price, curY + 27);
      ctx.textAlign = 'left';

      curY += rowH;
    });

    curY += 26;

    // 7. Итоговая смета (карточка стоимости)
    const summaryH = 210;
    ctx.fillStyle = '#f8fafc';
    drawRoundedRect(ctx, MARGIN, curY, CONTENT_W, summaryH, 8);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const drawSummaryRow = (label: string, value: string, rowY: number, isBold = false) => {
      ctx.font = isBold
        ? 'bold 17px "Segoe UI", Roboto, Arial, sans-serif'
        : '16px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(label, MARGIN + 28, rowY);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(value, PAGE_W - MARGIN - 28, rowY);
      ctx.textAlign = 'left';
    };

    drawSummaryRow(
      'Стоимость корпусов и фасадов:',
      `${options.pricing.modulesTotal.toLocaleString('ru-RU')} ₽`,
      curY + 34
    );
    drawSummaryRow(
      'Столешница, цоколи и пристенные плинтусы:',
      `${options.pricing.countertopTotal.toLocaleString('ru-RU')} ₽`,
      curY + 66
    );
    drawSummaryRow(
      'Фурнитура (петли с доводчиками, направляющие ящиков):',
      `${options.pricing.hardwareTotal.toLocaleString('ru-RU')} ₽`,
      curY + 98
    );
    drawSummaryRow(
      'Монтаж и профессиональная сборка (10%):',
      `${options.pricing.assemblyTotal.toLocaleString('ru-RU')} ₽`,
      curY + 130
    );

    // Разделительная пунктирная линия
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(MARGIN + 28, curY + 152);
    ctx.lineTo(PAGE_W - MARGIN - 28, curY + 152);
    ctx.stroke();
    ctx.setLineDash([]); // сброс пунктира

    // Итого к оплате
    ctx.font = 'bold 20px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('ИТОГО К ОПЛАТЕ:', MARGIN + 28, curY + 188);

    ctx.textAlign = 'right';
    ctx.font = 'bold 26px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText(`${options.pricing.grandTotal.toLocaleString('ru-RU')} ₽`, PAGE_W - MARGIN - 28, curY + 188);
    ctx.textAlign = 'left';

    // 8. Подвал документа
    const footerY = PAGE_H - MARGIN + 10;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, footerY - 24);
    ctx.lineTo(PAGE_W - MARGIN, footerY - 24);
    ctx.stroke();

    ctx.font = '14px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Проект подготовлен в 3D конструкторе «МКонструктор» • Мебельный Конструктор', MARGIN, footerY);

    ctx.textAlign = 'right';
    ctx.fillText('Действительно в течение 14 календарных дней', PAGE_W - MARGIN, footerY);
    ctx.textAlign = 'left';

    // 9. Создаем PDF лист формата A4 и сохраняем
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    pdf.save(`Смета_МКонструктор_${curDate}.pdf`);
  } catch (error) {
    console.error('Ошибка генерации PDF сметы:', error);
    alert(`Ошибка генерации PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}
