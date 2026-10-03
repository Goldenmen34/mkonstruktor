import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import {
  X,
  Layers,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Sliders,
  Package,
  Wrench,
  Info,
  Ruler,
} from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { extractModuleDetailing, ModulePart, ModuleDetailingSummary } from '../utils/moduleDetailing';

interface PartMeshItem {
  mesh: THREE.Mesh;
  part: ModulePart;
  badgeSprite?: THREE.Sprite;
  edgeLines?: THREE.LineSegments;
  edgeBandsGroup?: THREE.Group;
}

export const ModuleExplodeModal: React.FC = () => {
  const {
    isExplodeModalOpen,
    explodeModuleId,
    closeExplodeModal,
    modules,
    projectSettings,
  } = usePlannerStore();

  const [explodeFactor, setExplodeFactor] = useState<number>(0.55); // 0.0 to 1.0
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);
  const [showBadges, setShowBadges] = useState<boolean>(true);
  const [showEdges, setShowEdges] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'parts' | 'hardware'>('parts');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const partMeshesRef = useRef<Map<string, PartMeshItem>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-999, -999));
  const animationFrameRef = useRef<number | null>(null);

  // Orbit controls state
  const sphericalRef = useRef(new THREE.Spherical(2.2, Math.PI / 3.2, Math.PI / 4));
  const targetRef = useRef(new THREE.Vector3(0, 0.45, 0));
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const activeModule = useMemo(() => {
    return modules.find((m) => m.id === explodeModuleId) ?? null;
  }, [modules, explodeModuleId]);

  const detailingSummary: ModuleDetailingSummary | null = useMemo(() => {
    if (!activeModule) return null;
    return extractModuleDetailing(activeModule, projectSettings);
  }, [activeModule, projectSettings]);

  // Генерация круглой текстуры бейджа с номером детали
  const createBadgeTexture = (num: number, isHighlight: boolean): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);

      // Фон круглого значка
      ctx.beginPath();
      ctx.arc(64, 64, 56, 0, Math.PI * 2);
      ctx.fillStyle = isHighlight ? '#3B82F6' : '#1E293B';
      ctx.fill();

      // Обводка
      ctx.lineWidth = 8;
      ctx.strokeStyle = isHighlight ? '#93C5FD' : '#64748B';
      ctx.stroke();

      // Текст номера
      ctx.font = 'bold 58px monospace, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), 64, 68);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // Инициализация Three.js сцены для отдельного модуля
  useEffect(() => {
    if (!isExplodeModalOpen || !canvasRef.current || !detailingSummary) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 500;

    // Сцена
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B0F19');
    sceneRef.current = scene;

    // Сетка и мягкий пол
    const grid = new THREE.GridHelper(4, 20, '#1E293B', '#131D31');
    grid.position.y = 0;
    scene.add(grid);

    // Камера
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 50);
    cameraRef.current = camera;
    targetRef.current.set(0, (activeModule?.dimensions.height ?? 840) / 2000, 0);
    sphericalRef.current.set(2.4, Math.PI / 3.4, Math.PI / 4.2);
    camera.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
    camera.lookAt(targetRef.current);

    // Рендерер
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x90b0e0, 0.6);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    // Создание 3D деталей модуля
    const partMeshes = new Map<string, PartMeshItem>();

    detailingSummary.parts.forEach((part) => {
      const geo = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
      const mat = new THREE.MeshStandardMaterial({
        color: part.color,
        roughness: 0.35,
        metalness: 0.08,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { partId: part.id, partNumber: part.number };

      // 1) Тонкие CAD контуры детали (серые/графитовые ребра)
      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgeLineMat = new THREE.LineBasicMaterial({
        color: '#334155',
        linewidth: 1,
      });
      const edgeLines = new THREE.LineSegments(edgesGeo, edgeLineMat);
      mesh.add(edgeLines);

      // 2) Точечная подсветка кромки строго по заданным торцам (L1, L2, W1, W2)
      const edgeBandsGroup = new THREE.Group();
      edgeBandsGroup.name = 'edgeBandsGroup';

      const [sx, sy, sz] = part.size;
      const stripThick = 0.0016; // 1.6 мм толщина светящейся кромки
      const offset = stripThick / 2 + 0.0004;

      // Определение ориентации панели: наименьший габарит — это толщина щита
      let tAxis: 'x' | 'y' | 'z' = 'x';
      if (sy <= sx && sy <= sz) {
        tAxis = 'y';
      } else if (sz <= sx && sz <= sy) {
        tAxis = 'z';
      }

      // Карта торцов для данной детали в 3D пространстве
      interface EdgeFaceDef {
        edgeKey: 'l1' | 'l2' | 'w1' | 'w2';
        geoSize: [number, number, number];
        localPos: [number, number, number];
      }

      let faceDefs: EdgeFaceDef[] = [];

      if (tAxis === 'x') {
        // Вертикальные детали (боковины, стойка угловая, возвратный добор): толщина вдоль X
        faceDefs = [
          { edgeKey: 'l1', geoSize: [sx, sy, stripThick], localPos: [0, 0, sz / 2 + offset] },   // Лицевой торец (+Z)
          { edgeKey: 'l2', geoSize: [sx, sy, stripThick], localPos: [0, 0, -sz / 2 - offset] },  // Задний торец к стене (-Z)
          { edgeKey: 'w1', geoSize: [sx, stripThick, sz], localPos: [0, sy / 2 + offset, 0] },   // Верхний торец (+Y)
          { edgeKey: 'w2', geoSize: [sx, stripThick, sz], localPos: [0, -sy / 2 - offset, 0] },  // Нижний торец (-Y)
        ];
      } else if (tAxis === 'y') {
        // Горизонтальные детали (дно, крышка, царги, полки, столешница): толщина вдоль Y
        faceDefs = [
          { edgeKey: 'l1', geoSize: [sx, sy, stripThick], localPos: [0, 0, sz / 2 + offset] },   // Передний торец (+Z)
          { edgeKey: 'l2', geoSize: [sx, sy, stripThick], localPos: [0, 0, -sz / 2 - offset] },  // Задний торец (-Z)
          { edgeKey: 'w1', geoSize: [stripThick, sy, sz], localPos: [-sx / 2 - offset, 0, 0] },  // Левый торец (-X)
          { edgeKey: 'w2', geoSize: [stripThick, sy, sz], localPos: [sx / 2 + offset, 0, 0] },   // Правый торец (+X)
        ];
      } else {
        // Фасадные панели (двери, фасады ящиков, глухая фальш-накладка, добор): толщина вдоль Z
        faceDefs = [
          { edgeKey: 'l1', geoSize: [sx, stripThick, sz], localPos: [0, sy / 2 + offset, 0] },   // Верхний торец (+Y)
          { edgeKey: 'l2', geoSize: [sx, stripThick, sz], localPos: [0, -sy / 2 - offset, 0] },  // Нижний торец (-Y)
          { edgeKey: 'w1', geoSize: [stripThick, sy, sz], localPos: [-sx / 2 - offset, 0, 0] },  // Левый торец (-X)
          { edgeKey: 'w2', geoSize: [stripThick, sy, sz], localPos: [sx / 2 + offset, 0, 0] },   // Правый торец (+X)
        ];
      }

      // Создаем накладную светящуюся кромку ТОЛЬКО на тех сторонах, где edge.thickness > 0
      faceDefs.forEach(({ edgeKey, geoSize, localPos }) => {
        const edgeSpec = part.edges[edgeKey];
        if (!edgeSpec || edgeSpec.thickness <= 0) return;

        const is2mm = edgeSpec.thickness >= 2.0;

        // Накладная полоса кромки с приятным свечением (чуть ярче, но без пересветов)
        const stripGeo = new THREE.BoxGeometry(geoSize[0], geoSize[1], geoSize[2]);
        const stripMat = new THREE.MeshStandardMaterial({
          color: is2mm ? '#F59E0B' : '#06B6D4',
          emissive: is2mm ? '#F59E0B' : '#06B6D4',
          emissiveIntensity: 0.65,
          roughness: 0.25,
          metalness: 0.1,
        });

        const stripMesh = new THREE.Mesh(stripGeo, stripMat);
        stripMesh.position.set(localPos[0], localPos[1], localPos[2]);

        // Контурное ребро для максимальной четкости грани в CAD-виде
        const stripEdgeGeo = new THREE.EdgesGeometry(stripGeo);
        const stripEdgeLine = new THREE.LineSegments(
          stripEdgeGeo,
          new THREE.LineBasicMaterial({
            color: is2mm ? '#FEF08A' : '#CFFAFE', // Контурное свечение ребра
            linewidth: 2,
          })
        );
        stripMesh.add(stripEdgeLine);
        edgeBandsGroup.add(stripMesh);
      });

      edgeBandsGroup.visible = showEdges;
      mesh.add(edgeBandsGroup);

      // Бейдж с номером детали (3D Billboard Sprite)
      const badgeTex = createBadgeTexture(part.number, false);
      const spriteMat = new THREE.SpriteMaterial({ map: badgeTex, depthTest: false, transparent: true });
      const badgeSprite = new THREE.Sprite(spriteMat);
      badgeSprite.scale.set(0.085, 0.085, 1);
      // Размещаем чуть выше верхней плоскости детали
      badgeSprite.position.set(0, part.size[1] / 2 + 0.06, 0);
      mesh.add(badgeSprite);

      scene.add(mesh);
      partMeshes.set(part.id, { mesh, part, badgeSprite, edgeLines, edgeBandsGroup });
    });

    partMeshesRef.current = partMeshes;

    // Цикл рендеринга
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Плавное авто-воспроизведение взрыва (пульсация)
      if (isPlaying) {
        setExplodeFactor((prev) => {
          const next = prev + 0.008;
          return next > 1.0 ? 0.0 : next;
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!canvas || !renderer || !camera) return;
      const r = canvas.getBoundingClientRect();
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
      scene.clear();
      partMeshesRef.current.clear();
    };
  }, [isExplodeModalOpen, detailingSummary, isPlaying]);

  // Обновление положений деталей в зависимости от ползунка explodeFactor
  useEffect(() => {
    if (!partMeshesRef.current || !sceneRef.current) return;

    partMeshesRef.current.forEach(({ mesh, part, badgeSprite }) => {
      const explodeDist = explodeFactor * 0.38; // масштаб разлета в метрах
      const [bx, by, bz] = part.pos;
      const [dx, dy, dz] = part.explodeDir;

      mesh.position.set(
        bx + dx * explodeDist,
        by + dy * explodeDist,
        bz + dz * explodeDist
      );

      if (badgeSprite) {
        badgeSprite.visible = showBadges;
      }
    });
  }, [explodeFactor, showBadges]);

  // Переключение видимости подсветки кромок деталей
  useEffect(() => {
    partMeshesRef.current.forEach(({ edgeBandsGroup }) => {
      if (edgeBandsGroup) {
        edgeBandsGroup.visible = showEdges;
      }
    });
  }, [showEdges]);

  // Подсветка выбранной или наведенной детали
  useEffect(() => {
    partMeshesRef.current.forEach(({ mesh, part, badgeSprite }) => {
      const isSelected = part.id === selectedPartId;
      const isHovered = part.id === hoveredPartId;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (isSelected) {
        mat.color.set('#3B82F6');
        mat.emissive.set('#1D4ED8');
        mat.emissiveIntensity = 0.4;
      } else if (isHovered) {
        mat.color.set('#60A5FA');
        mat.emissive.set('#2563EB');
        mat.emissiveIntensity = 0.2;
      } else {
        mat.color.set(part.color);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0.0;
      }

      if (badgeSprite) {
        badgeSprite.material.map = createBadgeTexture(part.number, isSelected || isHovered);
        badgeSprite.material.needsUpdate = true;
      }
    });
  }, [selectedPartId, hoveredPartId]);

  // Orbit controls (мышь/тач)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current && cameraRef.current) {
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 + 0.1, sphericalRef.current.phi - deltaY * 0.008)
      );

      cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
      cameraRef.current.lookAt(targetRef.current);

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Raycasting hover
    if (canvasRef.current && cameraRef.current && sceneRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const meshes: THREE.Mesh[] = [];
      partMeshesRef.current.forEach((val) => meshes.push(val.mesh));

      const intersects = raycasterRef.current.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const pId = hit.userData?.partId;
        if (pId && pId !== hoveredPartId) {
          setHoveredPartId(pId);
        }
      } else {
        if (hoveredPartId !== null) setHoveredPartId(null);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || !cameraRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const meshes: THREE.Mesh[] = [];
    partMeshesRef.current.forEach((val) => meshes.push(val.mesh));

    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      const pId = hit.userData?.partId;
      setSelectedPartId(pId === selectedPartId ? null : pId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    sphericalRef.current.radius = Math.max(
      0.8,
      Math.min(5.0, sphericalRef.current.radius + e.deltaY * 0.002)
    );
    cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
    cameraRef.current.lookAt(targetRef.current);
  };

  const handleResetCamera = () => {
    if (!cameraRef.current || !activeModule) return;
    targetRef.current.set(0, (activeModule.dimensions.height ?? 840) / 2000, 0);
    sphericalRef.current.set(2.4, Math.PI / 3.4, Math.PI / 4.2);
    cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
    cameraRef.current.lookAt(targetRef.current);
  };

  // Копирование таблицы деталей в формате Excel / Таблицы
  const handleCopyTable = () => {
    if (!detailingSummary) return;

    let text = `Деталировка модуля: ${detailingSummary.module.name} (${detailingSummary.module.dimensions.width}×${detailingSummary.module.dimensions.height}×${detailingSummary.module.dimensions.depth} мм)\n`;
    text += `№\tНаименование\tДлина (мм)\tШирина (мм)\tТолщина (мм)\tКол-во\tМатериал\tКромка L1\tКромка L2\tКромка W1\tКромка W2\n`;

    detailingSummary.parts.forEach((p) => {
      text += `${p.number}\t${p.name}\t${p.length}\t${p.width}\t${p.thickness}\t${p.quantity}\t${p.materialName}\t${p.edges.l1.label}\t${p.edges.l2.label}\t${p.edges.w1.label}\t${p.edges.w2.label}\n`;
    });

    text += `\n--- СВОДНЫЙ РАСХОД КРОМКИ ---\n`;
    Object.values(detailingSummary.edgeTotals).forEach((e) => {
      text += `${e.label}: ${e.lengthMeters.toFixed(2)} п.м.\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isExplodeModalOpen || !activeModule || !detailingSummary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        ref={containerRef}
        className="w-full max-w-7xl h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden text-slate-100"
      >
        {/* ВЕРХНЯЯ ШАПКА */}
        <div className="px-5 py-3.5 border-b border-slate-700/80 bg-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white truncate">
                  Деталировка: {activeModule.name}
                </h3>
                {activeModule.config.isMirrored && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Зеркальный
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Габариты: {activeModule.dimensions.width} × {activeModule.dimensions.height} × {activeModule.dimensions.depth} мм</span>
                <span>•</span>
                <span>Деталей: {detailingSummary.totalPartsCount} шт.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTable}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
              title="Копировать таблицу деталей для Excel / Базис-Мебельщик"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Скопировано!' : 'Копировать (Excel)'}</span>
            </button>

            <button
              onClick={closeExplodeModal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
              title="Закрыть окно"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ОСНОВНОЙ КОНТЕНТ (3D СЛЕВА + ТАБЛИЦА СПРАВА) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* ЛЕВАЯ КОЛОНКА: ИНТЕРАКТИВНОЕ 3D ОКНО ВЗРЫВ-СХЕМЫ */}
          <div className="flex-1 flex flex-col relative bg-slate-950 min-h-[340px] border-b lg:border-b-0 lg:border-r border-slate-700/80">
            {/* Панель управления 3D взрывом */}
            <div className="absolute top-3 left-3 right-3 z-10 p-2.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/70 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              {/* Ползунок степени взрыва */}
              <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                <span className="text-xs font-semibold text-slate-300 whitespace-nowrap flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  Взрыв:
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={explodeFactor}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setExplodeFactor(parseFloat(e.target.value));
                  }}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-blue-300 w-10 text-right">
                  {Math.round(explodeFactor * 100)}%
                </span>
              </div>

              {/* Быстрые пресеты и переключатели */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setExplodeFactor(0);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                    explodeFactor === 0
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Собрано
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setExplodeFactor(0.5);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                    explodeFactor > 0.45 && explodeFactor < 0.55
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  50%
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setExplodeFactor(1.0);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                    explodeFactor === 1.0
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  100%
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isPlaying
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                  title={isPlaying ? 'Остановить авто-взрыв' : 'Включить плавную анимацию взрыва'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => setShowBadges(!showBadges)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    showBadges
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                  title={showBadges ? 'Скрыть 3D номера деталей' : 'Показать 3D номера деталей'}
                >
                  {showBadges ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => setShowEdges(!showEdges)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    showEdges
                      ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                  title={showEdges ? 'Скрыть подсветку кромок на торцах' : 'Показать подсветку кромок на торцах (ПВХ 2.0 / 0.4)'}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleResetCamera}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
                  title="Сбросить ракурс камеры"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas 3D */}
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleClick}
              onWheel={handleWheel}
              className="w-full h-full cursor-grab active:cursor-grabbing block"
            />

            {/* Легенда кромки в 3D сцене */}
            <div className="absolute bottom-3 left-3 z-10 px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/70 text-[11px] space-y-1.5 shadow-lg pointer-events-none">
              <div className="font-semibold text-slate-200 text-xs mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Обозначение кромки на торцах:
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                <span className="text-slate-200 font-medium">ПВХ 2.0 мм (Фасады)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                <span className="text-slate-200 font-medium">ПВХ 0.4 мм (Каркас)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                <span className="text-slate-400">Без кромки (Стыки, задние торцы, цоколь)</span>
              </div>
            </div>

            {/* Подсказка управления */}
            <div className="absolute bottom-3 right-3 z-10 px-2.5 py-1.5 rounded-lg bg-slate-900/70 backdrop-blur-sm border border-slate-800 text-[10px] text-slate-400 pointer-events-none hidden sm:block">
              Вращение: ЛКМ • Масштаб: Колесо • Клик: Выбрать деталь
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: ТАБЛИЦА СПЕЦИФИКАЦИИ ДЕТАЛЕЙ И ИТОГИ */}
          <div className="w-full lg:w-[540px] xl:w-[600px] flex flex-col bg-slate-900/95 overflow-hidden">
            {/* Переключатель вкладок: Детали / Фурнитура */}
            <div className="p-3 border-b border-slate-700/80 flex items-center justify-between gap-2 shrink-0 bg-slate-800/40">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab('parts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'parts'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Детали ({detailingSummary.parts.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('hardware')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'hardware'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Фурнитура ({detailingSummary.hardware.length})</span>
                </button>
              </div>

              {selectedPartId && (
                <button
                  onClick={() => setSelectedPartId(null)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                >
                  Снять выбор
                </button>
              )}
            </div>

            {/* ТАБЛИЦА 1: СПЕЦИФИКАЦИЯ ДЕТАЛЕЙ */}
            {activeTab === 'parts' && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 text-slate-300 font-semibold uppercase tracking-wider text-[10px] z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">№</th>
                      <th className="py-2.5 px-3">Деталь</th>
                      <th className="py-2.5 px-3 text-right">Размер (мм)</th>
                      <th className="py-2.5 px-3 text-center">Кромка (L1/L2/W1/W2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {detailingSummary.parts.map((part) => {
                      const isSelected = part.id === selectedPartId;
                      const isHovered = part.id === hoveredPartId;

                      return (
                        <tr
                          key={part.id}
                          onClick={() => setSelectedPartId(isSelected ? null : part.id)}
                          onMouseEnter={() => setHoveredPartId(part.id)}
                          onMouseLeave={() => setHoveredPartId(null)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-600/25 border-l-4 border-l-blue-500'
                              : isHovered
                              ? 'bg-slate-800/60'
                              : 'hover:bg-slate-800/30'
                          }`}
                        >
                          {/* № бейджа */}
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono font-bold text-[11px] ${
                                isSelected || isHovered
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-slate-800 border border-slate-700 text-slate-300'
                              }`}
                            >
                              {part.number}
                            </span>
                          </td>

                          {/* Наименование и материал */}
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-200">{part.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">
                              {part.materialName}
                            </div>
                          </td>

                          {/* Размеры (Длина × Ширина × Толщина) */}
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
                            {part.length} × {part.width} × {part.thickness}
                          </td>

                          {/* Кромка по сторонам */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {[part.edges.l1, part.edges.l2, part.edges.w1, part.edges.w2].map((edge, idx) => (
                                <span
                                  key={idx}
                                  title={`Сторона ${idx === 0 ? 'L1 (перед)' : idx === 1 ? 'L2 (зад)' : idx === 2 ? 'W1 (верх/бок)' : 'W2 (низ/бок)'}: ${edge.label}`}
                                  className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold ${
                                    edge.thickness === 2.0
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : edge.thickness === 0.4 || edge.thickness === 1.0
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                      : 'bg-slate-800 text-slate-500'
                                  }`}
                                >
                                  {edge.thickness > 0 ? edge.thickness : '—'}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ТАБЛИЦА 2: ФУРНИТУРА И КРЕПЁЖ */}
            {activeTab === 'hardware' && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 text-slate-300 font-semibold uppercase tracking-wider text-[10px] z-10">
                    <tr>
                      <th className="py-2.5 px-3">Наименование фурнитуры</th>
                      <th className="py-2.5 px-3 text-right w-24">Количество</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {detailingSummary.hardware.map((hw) => (
                      <tr key={hw.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-200">
                          {hw.name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                          {hw.count} {hw.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ИТОГОВЫЙ БЛОК: СВОДНЫЙ РАСХОД КРОМКИ И МАТЕРИАЛОВ */}
            <div className="p-3.5 border-t border-slate-700/80 bg-slate-800/60 shrink-0 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Сводный расход материалов:</span>
                <span className="text-slate-400 lowercase font-normal">на 1 данный модуль</span>
              </div>

              {/* Расход кромки */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-medium text-slate-300">Кромка ПВХ 2.0 мм:</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {detailingSummary.edgeTotals['2.0'].lengthMeters.toFixed(2)} п.м.
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span className="text-xs font-medium text-slate-300">Кромка ПВХ 0.4 мм:</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {detailingSummary.edgeTotals['0.4'].lengthMeters.toFixed(2)} п.м.
                  </span>
                </div>
              </div>

              {/* Площадь плитных материалов */}
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/70 text-[11px] space-y-1">
                {Object.entries(detailingSummary.areaTotals).map(([mat, area]) => (
                  <div key={mat} className="flex items-center justify-between text-slate-300 font-mono">
                    <span className="truncate pr-2">{mat}:</span>
                    <span className="font-bold text-white shrink-0">{area.toFixed(2)} м²</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
