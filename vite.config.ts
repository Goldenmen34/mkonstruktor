import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Плагин локальной папки "projects" на диске:
 * Создает физическую папку projects и автоматически сохраняет/читает
 * реальные .json файлы проектов на жестком диске компьютера.
 */
function localProjectsPlugin(): Plugin {
  const projectsDir = path.resolve(__dirname, 'projects');
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }

  return {
    name: 'vite-plugin-local-projects',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // GET /api/bazis/sample - отдать пример файла Базиса для тестирования импорта
        if (req.url === '/api/bazis/sample') {
          const samplePath = path.resolve(__dirname, 'Базис пример', 'Токарева ванная.b3d');
          if (fs.existsSync(samplePath)) {
            const buf = fs.readFileSync(samplePath);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="Tokareva_vannaya.b3d"');
            res.end(buf);
            return;
          }
        }

        if (!req.url?.startsWith('/api/projects')) {
          return next();
        }

        // POST /api/projects/open-folder - открыть физическую папку в Проводнике Windows
        if (req.method === 'POST' && req.url === '/api/projects/open-folder') {
          const command = process.platform === 'win32'
            ? `explorer "${projectsDir}"`
            : process.platform === 'darwin'
            ? `open "${projectsDir}"`
            : `xdg-open "${projectsDir}"`;
          exec(command, (err) => {
            if (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, path: projectsDir }));
            }
          });
          return;
        }

        // GET /api/projects - список всех проектов с диска
        if (req.method === 'GET') {
          try {
            const files = fs.readdirSync(projectsDir).filter((f) => f.endsWith('.json'));
            const list = [];
            for (const f of files) {
              try {
                const content = fs.readFileSync(path.join(projectsDir, f), 'utf-8');
                const parsed = JSON.parse(content);
                list.push(parsed);
              } catch (e) {
                console.error('Ошибка чтения файла проекта:', f, e);
              }
            }
            // Сортировка по дате обновления (сначала свежие)
            list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(list));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // POST /api/projects - сохранение проекта на диск
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const project = JSON.parse(body);
              if (!project || !project.id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Некорректные данные проекта' }));
                return;
              }

              // Удаляем старые файлы этого проекта (если имя изменилось)
              const existingFiles = fs.readdirSync(projectsDir).filter((f) => f.startsWith(`${project.id}__`) || f === `${project.id}.json`);
              for (const ef of existingFiles) {
                try {
                  fs.unlinkSync(path.join(projectsDir, ef));
                } catch {}
              }

              const safeName = (project.name || 'Проект').replace(/[/\\?%*:|"<>]/g, '_');
              const fileName = `${project.id}__${safeName}.json`;
              const filePath = path.join(projectsDir, fileName);

              fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, filePath, fileName }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // DELETE /api/projects/:id - удаление проекта с диска
        if (req.method === 'DELETE') {
          const urlParts = req.url.split('/');
          const id = urlParts[urlParts.length - 1];
          if (id) {
            const files = fs.readdirSync(projectsDir).filter((f) => f.startsWith(`${id}__`) || f === `${id}.json`);
            for (const f of files) {
              try {
                fs.unlinkSync(path.join(projectsDir, f));
              } catch {}
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        next();
      });
    },
  };
}

/**
 * Плагин массовой интеграции декоров и текстур:
 * Сканирует локальные папки (например Bazis11/Текстуры/EGGER),
 * копирует текстуры в public/textures/ и формирует готовую базу для кабинета собственника.
 */
function localMaterialsPlugin(): Plugin {
  const publicDir = path.resolve(__dirname, 'public');
  const texturesBaseDir = path.join(publicDir, 'textures');
  if (!fs.existsSync(texturesBaseDir)) {
    fs.mkdirSync(texturesBaseDir, { recursive: true });
  }

  function parseTextureFileName(fileName: string) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    const m1 = base.match(/^([A-ZА-Я0-9]+)\s+(ST\d+|PM|PG|[A-Z0-9]+)\s*([A-ZА-Яа-я].+)$/);
    if (m1) {
      return {
        article: `${m1[1]} ${m1[2]}`,
        textureCode: m1[2],
        cleanName: m1[3].trim(),
      };
    }

    const m2 = base.match(/^([A-ZА-Я0-9]{2,10})\s+([A-ZА-Яа-я].+)$/);
    if (m2) {
      return {
        article: m2[1],
        textureCode: '',
        cleanName: m2[2].trim(),
      };
    }

    return {
      article: '',
      textureCode: '',
      cleanName: base.trim(),
    };
  }

  function getRoughnessByCode(code: string): number {
    const c = (code || '').toUpperCase();
    if (c === 'PG') return 0.08;
    if (c === 'PM') return 0.85;
    if (c === 'ST37' || c === 'ST38' || c === 'ST28') return 0.52;
    if (c === 'ST9' || c === 'ST15') return 0.70;
    if (c === 'ST10' || c === 'ST12' || c === 'ST22') return 0.60;
    return 0.65;
  }

  function inferColorFromName(name: string, category: string): string {
    const n = (name + ' ' + category).toLowerCase();
    if (n.includes('белый') || n.includes('алебастр') || n.includes('платиновый') || n.includes('white') || n.includes('снег') || n.includes('арктика')) return '#F8F9FA';
    if (n.includes('черный') || n.includes('чёрный') || n.includes('black') || n.includes('графит') || n.includes('антрацит')) return '#2B2D42';
    if (n.includes('серый') || n.includes('grey') || n.includes('gray') || n.includes('чипполино') || n.includes('бетон')) return '#9E9E9E';
    if (n.includes('кашемир') || n.includes('крем') || n.includes('ваниль') || n.includes('песок') || n.includes('бежевый') || n.includes('беж') || n.includes('коттон')) return '#E8D8C8';
    if (n.includes('желтый') || n.includes('жёлтый') || n.includes('шафран') || n.includes('карри') || n.includes('кукуруз') || n.includes('бархат') || n.includes('цитрус') || n.includes('бриллиант')) return '#F5C000';
    if (n.includes('зеленый') || n.includes('зелёный') || n.includes('олива') || n.includes('мят')) return '#5C8374';
    if (n.includes('синий') || n.includes('голуб') || n.includes('индиго') || n.includes('морск')) return '#274C77';
    if (n.includes('красный') || n.includes('бордо') || n.includes('терракот')) return '#B83B3B';
    if (n.includes('дуб') || n.includes('ясень') || n.includes('вяз') || n.includes('орех') || n.includes('дерев') || n.includes('древес') || n.includes('сосна') || n.includes('бук') || n.includes('баменда') || n.includes('робиния') || n.includes('лион') || n.includes('тоссини')) return '#B89772';
    if (n.includes('мрамор') || n.includes('каррара') || n.includes('камень') || n.includes('металл') || n.includes('керамо') || n.includes('керамика')) return '#D1D5DB';
    return '#B89772';
  }

  function extractFolderColors(folderPath: string): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      if (process.platform === 'win32' && folderPath && fs.existsSync(folderPath)) {
        const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
$map = @{}
Get-ChildItem -Path "${folderPath.replace(/"/g, '`"')}" -Recurse -File | ForEach-Object {
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($_.FullName)
    $thumb = New-Object System.Drawing.Bitmap(1, 1)
    $g = [System.Drawing.Graphics]::FromImage($thumb)
    $g.DrawImage($bmp, 0, 0, 1, 1)
    $p = $thumb.GetPixel(0, 0)
    $hex = "#{0:X2}{1:X2}{2:X2}" -f $p.R, $p.G, $p.B
    $map[$_.Name] = $hex
    $g.Dispose()
    $thumb.Dispose()
    $bmp.Dispose()
  } catch {}
}
$map | ConvertTo-Json -Compress
`;
        try {
          const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
          exec(`powershell -NoProfile -EncodedCommand ${b64}`, { maxBuffer: 30 * 1024 * 1024 }, (err, stdout) => {
            if (!err && stdout) {
              const start = stdout.indexOf('{');
              const end = stdout.lastIndexOf('}');
              if (start !== -1 && end !== -1) {
                try {
                  const parsed = JSON.parse(stdout.slice(start, end + 1));
                  resolve(parsed);
                  return;
                } catch {}
              }
            }
            resolve({});
          });
        } catch {
          resolve({});
        }
      } else {
        resolve({});
      }
    });
  }

  function scanDirectoryRecursive(dir: string, baseDir: string, result: any[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectoryRecursive(fullPath, baseDir, result);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const relativeDir = path.relative(baseDir, dir);
          const category = relativeDir && relativeDir !== '.' ? relativeDir.split(path.sep)[0] : 'Общие';
          const { article, textureCode, cleanName } = parseTextureFileName(entry.name);
          const stat = fs.statSync(fullPath);
          const color = inferColorFromName(cleanName, category);

          result.push({
            id: `item_${path.basename(baseDir).toLowerCase()}_${category}_${entry.name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
            fileName: entry.name,
            cleanName,
            article,
            textureCode,
            category,
            fullPath,
            size: stat.size,
            roughness: getRoughnessByCode(textureCode),
            metalness: 0.05,
            color,
            previewUrl: `/api/materials/preview?path=${encodeURIComponent(fullPath)}`,
          });
        }
      }
    }
  }

  return {
    name: 'vite-plugin-local-materials',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/materials')) {
          return next();
        }

        // 0. GET /api/materials/preview?path=...
        if (req.method === 'GET' && req.url?.startsWith('/api/materials/preview')) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const filePath = urlObj.searchParams.get('path');
            if (filePath && fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
              res.setHeader('Content-Type', mime);
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {}
          res.statusCode = 404;
          res.end();
          return;
        }

        // 1. GET /api/materials/check-presets
        if (req.method === 'GET' && req.url === '/api/materials/check-presets') {
          try {
            const homeDir = process.env.USERPROFILE || process.env.HOME || '';
            const bazisRoot = path.join(homeDir, 'Documents', 'Bazis11', 'Текстуры');
            const presets = [];

            if (fs.existsSync(bazisRoot)) {
              const folders = fs.readdirSync(bazisRoot, { withFileTypes: true });
              for (const f of folders) {
                if (f.isDirectory()) {
                  const fullFolderPath = path.join(bazisRoot, f.name);
                  let fileCount = 0;
                  try {
                    const walk = (d: string) => {
                      const list = fs.readdirSync(d, { withFileTypes: true });
                      for (const item of list) {
                        if (item.isDirectory()) walk(path.join(d, item.name));
                        else if (['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(item.name).toLowerCase())) fileCount++;
                      }
                    };
                    walk(fullFolderPath);
                  } catch {}

                  if (fileCount > 0) {
                    presets.push({
                      name: f.name,
                      path: fullFolderPath,
                      fileCount,
                    });
                  }
                }
              }
            }

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, presets }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // 2. POST /api/materials/scan-folder
        if (req.method === 'POST' && req.url === '/api/materials/scan-folder') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body);
              const folderPath = parsed.folderPath?.trim();
              if (!folderPath || !fs.existsSync(folderPath)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Папка не найдена или путь пуст' }));
                return;
              }

              const brand = parsed.brand?.trim() || path.basename(folderPath);
              const items: any[] = [];
              scanDirectoryRecursive(folderPath, folderPath, items);

              // Извлекаем реальные цвета из файлов образцов
              let colorMap: Record<string, string> = {};
              try {
                colorMap = await extractFolderColors(folderPath);
              } catch {}

              for (const it of items) {
                if (colorMap[it.fileName]) {
                  it.color = colorMap[it.fileName];
                }
              }

              const categorySet = new Set<string>();
              items.forEach((it) => categorySet.add(it.category));
              const categories = Array.from(categorySet);

              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({
                success: true,
                brand,
                folderPath,
                categories,
                items,
                totalCount: items.length,
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 3. POST /api/materials/import-folder
        if (req.method === 'POST' && req.url === '/api/materials/import-folder') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body);
              const {
                folderPath,
                brand,
                sections = ['ldsp', 'facade'],
                costPrice = 3800,
                markupMultiplier = 1.8,
                unit = 'sheet',
                selectedItems = [],
              } = payload;

              if (!selectedItems || selectedItems.length === 0) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Список выбранных позиций пуст' }));
                return;
              }

              // Извлекаем реальные средние цвета файлов из папки (PowerShell System.Drawing)
              let colorMap: Record<string, string> = {};
              if (folderPath && fs.existsSync(folderPath)) {
                try {
                  colorMap = await extractFolderColors(folderPath);
                } catch {}
              }

              const safeBrand = (brand || 'EGGER').replace(/[/\\?%*:|"<>]/g, '_').trim();
              const brandDestDir = path.join(texturesBaseDir, safeBrand);
              if (!fs.existsSync(brandDestDir)) {
                fs.mkdirSync(brandDestDir, { recursive: true });
              }

              const importedItems: any[] = [];

              for (const it of selectedItems) {
                const safeCat = (it.category || 'Общие').replace(/[/\\?%*:|"<>]/g, '_').trim();
                const catDestDir = path.join(brandDestDir, safeCat);
                if (!fs.existsSync(catDestDir)) {
                  fs.mkdirSync(catDestDir, { recursive: true });
                }

                const fileName = it.fileName || path.basename(it.fullPath);
                const destFilePath = path.join(catDestDir, fileName);

                if (fs.existsSync(it.fullPath)) {
                  fs.copyFileSync(it.fullPath, destFilePath);
                }

                const textureUrl = `/textures/${encodeURIComponent(safeBrand)}/${encodeURIComponent(safeCat)}/${encodeURIComponent(fileName)}`;
                const itemColor = colorMap[fileName] || it.color || inferColorFromName(it.cleanName || fileName, it.category || '');

                for (const section of sections) {
                  const itemId = `mat_${safeBrand.toLowerCase()}_${section}_${it.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
                  const clientPrice = Math.round(Number(costPrice) * Number(markupMultiplier));

                  importedItems.push({
                    id: itemId,
                    name: it.cleanName || fileName,
                    article: it.article || '',
                    brand: safeBrand,
                    section: section,
                    category: it.category || 'Общие',
                    costPrice: Number(costPrice),
                    markupMultiplier: Number(markupMultiplier),
                    clientPrice,
                    unit: unit,
                    color: itemColor,
                    textureUrl,
                    imageUrl: textureUrl,
                    roughness: it.roughness ?? 0.65,
                    metalness: it.metalness ?? 0.05,
                    isActive: true,
                    updatedAt: new Date().toISOString(),
                  });
                }
              }

              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({
                success: true,
                count: importedItems.length,
                brand: safeBrand,
                items: importedItems,
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. GET /api/materials/all-texture-colors
        if (req.method === 'GET' && req.url === '/api/materials/all-texture-colors') {
          try {
            const colorMap = await extractFolderColors(texturesBaseDir);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, colorMap }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localProjectsPlugin(),
    localMaterialsPlugin(),
  ],
  server: {
    port: 3000,
    open: false,
    watch: {
      ignored: ['**/projects/**', '**/public/textures/**', '**/textures/**'],
    },
  },
});
