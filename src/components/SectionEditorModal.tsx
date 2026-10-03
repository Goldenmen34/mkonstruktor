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
  Trash2,
  Plus,
  Sliders,
  Package,
  Wrench,
  Info,
  Ruler,
  Save,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Split,
  Box,
  Palette,
  Compass,
  LayoutGrid,
} from 'lucide-react';
import {
  CustomSectionPart,
  PartWidthBinding,
  PartDepthBinding,
  PartHeightBinding,
  PartMaterialType,
  ProjectSettings,
} from '../types';
import { usePlannerStore } from '../store/usePlannerStore';
import { CATALOG_ITEMS, CatalogItemTemplate, CatalogMainGroup, getModuleCode } from '../data/catalog';
import {
  convertTemplateToCustomParts,
  evaluatePartGeometry,
  createNewCustomPart,
  MATERIAL_PRESETS,
  MaterialPreset,
  EvaluatedPartGeometry,
} from '../utils/sectionEditorEngine';

interface MeshItem {
  mesh: THREE.Mesh;
  partId: string;
  edges?: THREE.LineSegments;
}

export const SectionEditorModal: React.FC = () => {
  const {
    isSectionEditorOpen,
    sectionEditorTemplateId,
    sectionEditorModuleId,
    closeSectionEditor,
    saveCustomSection,
    modules,
    updateModule,
    projectSettings,
    customTemplates,
  } = usePlannerStore();

  // Основные параметры редактируемой секции
  const [sectionCode, setSectionCode] = useState<string>('НС-Д');
  const [sectionName, setSectionName] = useState<string>('Новая мебельная секция');
  const [sectionDescription, setSectionDescription] = useState<string>('');
  const [mainGroup, setMainGroup] = useState<CatalogMainGroup>('base');
  const [dimensions, setDimensions] = useState<{ width: number; height: number; depth: number }>({
    width: 600,
    height: 720,
    depth: 560,
  });
  const [parts, setParts] = useState<CustomSectionPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showEdges, setShowEdges] = useState<boolean>(true);

  // Модальные окна
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isAddPartOpen, setIsAddPartOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [librarySearch, setLibrarySearch] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<boolean>(false);

  // Three.js рефы
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshesMapRef = useRef<Map<string, MeshItem>>(new Map());
  const boundingBoxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const plinthMeshRef = useRef<THREE.Mesh | null>(null);
  const countertopMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-999, -999));
  const animationFrameRef = useRef<number | null>(null);

  // Orbit controls state
  const sphericalRef = useRef(new THREE.Spherical(2.2, Math.PI / 3.2, Math.PI / 4));
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  // Параметры цоколя и столешницы
  const hasPlinth = mainGroup === 'base' || mainGroup === 'tall';
  const plinthHeightMm = (hasPlinth && projectSettings.hasPlinth !== false) ? (projectSettings.plinthHeight ?? 120) : 0;
  const hasCountertop = mainGroup === 'base';
  const topHMm = hasCountertop ? (projectSettings.countertopThickness ?? 40) : 0;

  // Размеры собственно корпуса секции (без цоколя и столешницы)
  const carcassDimensions = useMemo(() => ({
    width: dimensions.width,
    height: Math.max(100, dimensions.height - plinthHeightMm - topHMm),
    depth: dimensions.depth,
  }), [dimensions, plinthHeightMm, topHMm]);

  // Инициализация секции при открытии модального окна
  useEffect(() => {
    if (!isSectionEditorOpen) return;

    // 1. Если передано id модуля со сцены
    if (sectionEditorModuleId) {
      const mod = modules.find((m) => m.id === sectionEditorModuleId);
      if (mod) {
        const code = mod.code || getModuleCode(mod);
        setSectionCode(code ? `${code}-МОД` : '');
        setSectionName(mod.name.includes('(Копия)') ? mod.name : `${mod.name} (Копия)`);
        setDimensions({
          width: mod.dimensions.width,
          height: mod.dimensions.height,
          depth: mod.dimensions.depth,
        });
        const modGroup: CatalogMainGroup = (mod.subType === 'wall' || mod.subType === 'top' || mod.subType === 'tall') ? mod.subType : 'base';
        setMainGroup(modGroup);

        const modHasPl = modGroup === 'base' || modGroup === 'tall';
        const modPlH = (modHasPl && projectSettings.hasPlinth !== false) ? (projectSettings.plinthHeight ?? 120) : 0;
        const modHasTp = modGroup === 'base';
        const modTopH = modHasTp ? (projectSettings.countertopThickness ?? 40) : 0;
        const modCarcassH = Math.max(100, mod.dimensions.height - modPlH - modTopH);

        if (mod.config.customParts && mod.config.customParts.length > 0) {
          setParts(JSON.parse(JSON.stringify(mod.config.customParts)));
        } else {
          // Ищем шаблон модуля в каталоге
          const tpl = [...CATALOG_ITEMS, ...customTemplates].find((t) => t.id === mod.catalogId) ?? CATALOG_ITEMS[0];
          const newParts = convertTemplateToCustomParts(tpl, projectSettings, {
            width: mod.dimensions.width,
            height: modCarcassH,
            depth: mod.dimensions.depth,
          }, mod.config);
          setParts(newParts);
        }
        setSelectedPartId(null);
        return;
      }
    }

    // 2. Если передано id шаблона из библиотеки
    if (sectionEditorTemplateId) {
      const tpl = [...CATALOG_ITEMS, ...customTemplates].find((t) => t.id === sectionEditorTemplateId);
      if (tpl) {
        setSectionCode(tpl.code || getModuleCode(tpl) || '');
        setSectionName(tpl.name);
        setSectionDescription(tpl.description || '');
        setMainGroup(tpl.mainGroup);
        setDimensions({
          width: tpl.defaultDimensions.width,
          height: tpl.defaultDimensions.height,
          depth: tpl.defaultDimensions.depth,
        });
        const tplHasPl = tpl.mainGroup === 'base' || tpl.mainGroup === 'tall';
        const tplPlH = (tplHasPl && projectSettings.hasPlinth !== false) ? (projectSettings.plinthHeight ?? 120) : 0;
        const tplHasTp = tpl.mainGroup === 'base';
        const tplTopH = tplHasTp ? (projectSettings.countertopThickness ?? 40) : 0;
        const tplCarcassH = Math.max(100, tpl.defaultDimensions.height - tplPlH - tplTopH);

        if (tpl.defaultConfig.customParts && tpl.defaultConfig.customParts.length > 0) {
          setParts(JSON.parse(JSON.stringify(tpl.defaultConfig.customParts)));
        } else {
          const newParts = convertTemplateToCustomParts(tpl, projectSettings, {
            width: tpl.defaultDimensions.width,
            height: tplCarcassH,
            depth: tpl.defaultDimensions.depth,
          });
          setParts(newParts);
        }
        setSelectedPartId(null);
        return;
      }
    }

    // 3. По умолчанию: загружаем стандартную напольную тумбу
    const defaultTpl = CATALOG_ITEMS.find((c) => c.id === 'k_base_1door') ?? CATALOG_ITEMS[0];
    if (defaultTpl) {
      setSectionCode(defaultTpl.code || 'НС-Д');
      setSectionName(defaultTpl.name);
      setMainGroup(defaultTpl.mainGroup);
      setDimensions({
        width: defaultTpl.defaultDimensions.width,
        height: defaultTpl.defaultDimensions.height,
        depth: defaultTpl.defaultDimensions.depth,
      });
      const defHasPl = defaultTpl.mainGroup === 'base' || defaultTpl.mainGroup === 'tall';
      const defPlH = (defHasPl && projectSettings.hasPlinth !== false) ? (projectSettings.plinthHeight ?? 120) : 0;
      const defHasTp = defaultTpl.mainGroup === 'base';
      const defTopH = defHasTp ? (projectSettings.countertopThickness ?? 40) : 0;
      const defCarcassH = Math.max(100, defaultTpl.defaultDimensions.height - defPlH - defTopH);

      const newParts = convertTemplateToCustomParts(defaultTpl, projectSettings, {
        width: defaultTpl.defaultDimensions.width,
        height: defCarcassH,
        depth: defaultTpl.defaultDimensions.depth,
      });
      setParts(newParts);
      setSelectedPartId(null);
    }
  }, [isSectionEditorOpen, sectionEditorTemplateId, sectionEditorModuleId]);

  // Выбранная деталь
  const selectedPart = useMemo(() => {
    return parts.find((p) => p.id === selectedPartId) ?? null;
  }, [parts, selectedPartId]);

  // Геометрия выбранной детали
  const selectedPartGeometry: EvaluatedPartGeometry | null = useMemo(() => {
    if (!selectedPart) return null;
    return evaluatePartGeometry(selectedPart, carcassDimensions, projectSettings, parts);
  }, [selectedPart, carcassDimensions, projectSettings, parts]);

  // Инициализация Three.js сцены
  useEffect(() => {
    if (!isSectionEditorOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    // Сцена
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090D16');
    sceneRef.current = scene;

    // Сетка пола
    const grid = new THREE.GridHelper(3.5, 35, '#1E293B', '#0F172A');
    grid.position.y = -dimensions.height / 2000;
    scene.add(grid);
    gridRef.current = grid;

    // Камера
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 50);
    cameraRef.current = camera;
    targetRef.current.set(0, 0, 0);
    sphericalRef.current.set(2.2, Math.PI / 3.2, Math.PI / 4);
    camera.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
    camera.lookAt(targetRef.current);

    // Рендерер
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Освещение: студийная схема
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(3, 4, 3);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.4);
    dirLight2.position.set(-3, 2, -2);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xfef08a, 0.3);
    dirLight3.position.set(0, -3, 2);
    scene.add(dirLight3);

    // BoxHelper для выделения
    const boxHelper = new THREE.BoxHelper(new THREE.Mesh(), 0x38bdf8);
    boxHelper.visible = false;
    scene.add(boxHelper);
    boundingBoxHelperRef.current = boxHelper;

    // Цикл анимации
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!canvas || !rendererRef.current || !cameraRef.current) return;
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (plinthMeshRef.current) {
        scene.remove(plinthMeshRef.current);
        plinthMeshRef.current.geometry.dispose();
        plinthMeshRef.current = null;
      }
      if (countertopMeshRef.current) {
        scene.remove(countertopMeshRef.current);
        countertopMeshRef.current.geometry.dispose();
        countertopMeshRef.current = null;
      }
      gridRef.current = null;
      renderer.dispose();
    };
  }, [isSectionEditorOpen]);

  // Перестроение 3D мешей деталей при изменении parts, dimensions или настроек
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Удаляем предыдущие меши деталей
    meshesMapRef.current.forEach((item) => {
      scene.remove(item.mesh);
      item.mesh.geometry.dispose();
      if (Array.isArray(item.mesh.material)) {
        item.mesh.material.forEach((m) => m.dispose());
      } else {
        item.mesh.material.dispose();
      }
      if (item.edges) {
        item.edges.geometry.dispose();
      }
    });
    meshesMapRef.current.clear();

    // Удаляем предыдущий визуальный цоколь и столешницу
    if (plinthMeshRef.current) {
      scene.remove(plinthMeshRef.current);
      plinthMeshRef.current.geometry.dispose();
      if (Array.isArray(plinthMeshRef.current.material)) {
        plinthMeshRef.current.material.forEach((m) => m.dispose());
      } else {
        plinthMeshRef.current.material.dispose();
      }
      plinthMeshRef.current = null;
    }

    if (countertopMeshRef.current) {
      scene.remove(countertopMeshRef.current);
      countertopMeshRef.current.geometry.dispose();
      if (Array.isArray(countertopMeshRef.current.material)) {
        countertopMeshRef.current.material.forEach((m) => m.dispose());
      } else {
        countertopMeshRef.current.material.dispose();
      }
      countertopMeshRef.current = null;
    }

    // Расчет уровней по высоте
    const floorY = -dimensions.height / 2000;
    const plinthH = plinthHeightMm / 1000;
    const topH = topHMm / 1000;
    const carcassH = carcassDimensions.height / 1000;
    const bodyCenterY = floorY + plinthH + carcassH / 2;

    // Синхронизируем положение сетки пола
    if (gridRef.current) {
      gridRef.current.position.y = floorY;
    }

    // Создаем новые меши для каждой детали корпуса
    parts.forEach((part) => {
      if (part.isVisible === false) return;

      const geom = evaluatePartGeometry(part, carcassDimensions, projectSettings, parts);
      const isSelected = part.id === selectedPartId;
      const isHovered = part.id === hoveredPartId;

      // Геометрия
      const boxGeo = new THREE.BoxGeometry(
        Math.max(0.002, geom.width / 1000),
        Math.max(0.002, geom.height / 1000),
        Math.max(0.002, geom.depth / 1000)
      );

      // Материал
      const preset = MATERIAL_PRESETS[part.materialType] ?? MATERIAL_PRESETS.ldsp;
      let meshMat: THREE.Material;

      if (part.materialType === 'glass') {
        meshMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(isSelected ? '#60A5FA' : preset.color),
          transparent: true,
          opacity: isSelected ? 0.75 : 0.45,
          roughness: 0.1,
          metalness: 0.9,
          transmission: 0.85,
          ior: 1.5,
        });
      } else {
        let baseColor = part.color || preset.color;
        if (isSelected) {
          baseColor = '#38BDF8';
        } else if (isHovered) {
          baseColor = '#94A3B8';
        }

        meshMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(baseColor),
          roughness: preset.roughness,
          metalness: preset.metalness,
        });
      }

      const mesh = new THREE.Mesh(boxGeo, meshMat);
      mesh.position.set(geom.posX / 1000, bodyCenterY + geom.posY / 1000, geom.posZ / 1000);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { partId: part.id };

      let edgeLines: THREE.LineSegments | undefined;
      if (showEdges) {
        const edgeGeo = new THREE.EdgesGeometry(boxGeo);
        const edgeMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0x0284c7 : isHovered ? 0x38bdf8 : 0x1e293b,
          linewidth: isSelected ? 2 : 1,
        });
        edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
        mesh.add(edgeLines);
      }

      scene.add(mesh);
      meshesMapRef.current.set(part.id, { mesh, partId: part.id, edges: edgeLines });

      // Обновление рамки выделения
      if (isSelected && boundingBoxHelperRef.current) {
        boundingBoxHelperRef.current.setFromObject(mesh);
        boundingBoxHelperRef.current.visible = true;
      }
    });

    // Визуальный цоколь (если модуль напольный или пенал)
    if (plinthHeightMm > 0) {
      const plinthW = Math.max(0.1, dimensions.width / 1000);
      const plinthD = 0.016;
      const plinthGeo = new THREE.BoxGeometry(plinthW, plinthH, plinthD);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: '#475569',
        roughness: 0.6,
        metalness: 0.1,
      });
      const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
      const zFront = dimensions.depth / 2000 - 0.05;
      plinthMesh.position.set(0, floorY + plinthH / 2, zFront);
      plinthMesh.castShadow = true;
      plinthMesh.receiveShadow = true;

      if (showEdges) {
        const pEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(plinthGeo),
          new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 })
        );
        plinthMesh.add(pEdges);
      }

      scene.add(plinthMesh);
      plinthMeshRef.current = plinthMesh;
    }

    // Визуальная столешница (для напольных тумб под столешницу)
    if (hasCountertop && topHMm > 0) {
      const topW = Math.max(0.1, dimensions.width / 1000);
      const topD = Math.max(0.1, dimensions.depth / 1000);
      const topGeo = new THREE.BoxGeometry(topW, topH, topD);
      const topMat = new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.4,
        metalness: 0.2,
      });
      const topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.set(0, floorY + plinthH + carcassH + topH / 2, 0);
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;

      if (showEdges) {
        const tEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(topGeo),
          new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 1 })
        );
        topMesh.add(tEdges);
      }

      scene.add(topMesh);
      countertopMeshRef.current = topMesh;
    }

    if (!selectedPartId && boundingBoxHelperRef.current) {
      boundingBoxHelperRef.current.visible = false;
    }
  }, [parts, dimensions, carcassDimensions, plinthHeightMm, topHMm, hasCountertop, selectedPartId, hoveredPartId, showEdges, projectSettings]);

  // Обработчики мыши для вращения камеры и клика по деталям
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
    } else if (e.button === 2) {
      isPanningRef.current = true;
    }
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    if (isDraggingRef.current && cameraRef.current) {
      // Вращение
      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI - 0.1, sphericalRef.current.phi - deltaY * 0.008)
      );
      cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
      cameraRef.current.lookAt(targetRef.current);
    } else if (isPanningRef.current && cameraRef.current) {
      // Панорамирование
      const factor = sphericalRef.current.radius * 0.001;
      targetRef.current.x -= deltaX * factor;
      targetRef.current.y += deltaY * factor;
      cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
      cameraRef.current.lookAt(targetRef.current);
    } else {
      // Raycasting при наведении
      if (!canvasRef.current || !cameraRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const meshes = Array.from(meshesMapRef.current.values()).map((m) => m.mesh);
      const intersects = raycasterRef.current.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const hitPartId = intersects[0].object.userData?.partId;
        if (hitPartId !== hoveredPartId) {
          setHoveredPartId(hitPartId);
        }
      } else if (hoveredPartId !== null) {
        setHoveredPartId(null);
      }
    }

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || !cameraRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const meshes = Array.from(meshesMapRef.current.values()).map((m) => m.mesh);
    const intersects = raycasterRef.current.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitPartId = intersects[0].object.userData?.partId;
      setSelectedPartId(hitPartId);
    } else {
      // Клик по пустому пространству — снимаем выделение
      setSelectedPartId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    sphericalRef.current.radius = Math.max(
      0.6,
      Math.min(6.0, sphericalRef.current.radius + e.deltaY * 0.0018)
    );
    cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
    cameraRef.current.lookAt(targetRef.current);
  };

  // Пресеты видов камеры
  const setCameraPreset = (preset: 'iso' | 'front' | 'side' | 'top') => {
    if (!cameraRef.current) return;
    targetRef.current.set(0, 0, 0);

    if (preset === 'iso') {
      sphericalRef.current.set(2.2, Math.PI / 3.2, Math.PI / 4);
    } else if (preset === 'front') {
      sphericalRef.current.set(2.0, Math.PI / 2, 0);
    } else if (preset === 'side') {
      sphericalRef.current.set(2.0, Math.PI / 2, Math.PI / 2);
    } else if (preset === 'top') {
      sphericalRef.current.set(2.2, 0.05, 0);
    }

    cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
    cameraRef.current.lookAt(targetRef.current);
  };

  // Изменение параметров выбранной детали
  const updateSelectedPart = (updates: Partial<CustomSectionPart>) => {
    if (!selectedPartId) return;
    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPartId) return p;
        return { ...p, ...updates };
      })
    );
  };

  // Удаление детали
  const deletePart = (id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
    if (selectedPartId === id) {
      setSelectedPartId(null);
    }
  };

  // Дублирование детали
  const duplicatePart = (part: CustomSectionPart) => {
    const clone: CustomSectionPart = {
      ...part,
      id: `part_clone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${part.name} (Копия)`,
      offsetY: part.offsetY + 50, // Небольшой сдвиг вверх, чтобы деталь не сливалась
    };
    setParts((prev) => [...prev, clone]);
    setSelectedPartId(clone.id);
  };

  // Добавление новой детали
  const handleAddNewPart = (
    type: 'shelf' | 'divider' | 'facade' | 'panel' | 'tsarga' | 'drawer' | 'custom',
    materialType: PartMaterialType
  ) => {
    const newPart = createNewCustomPart(type, materialType, carcassDimensions, projectSettings, parts);
    setParts((prev) => [...prev, newPart]);
    setSelectedPartId(newPart.id);
    setIsAddPartOpen(false);
  };

  // Применить изменения напрямую к модулю на сцене
  const handleApplyToSceneModule = () => {
    if (!sectionEditorModuleId) return;
    const isBase = mainGroup === 'base';
    const isTall = mainGroup === 'tall';
    updateModule(sectionEditorModuleId, {
      name: sectionName.trim() || undefined,
      dimensions: { ...dimensions },
      subType: mainGroup as any,
      config: {
        ...modules.find((m) => m.id === sectionEditorModuleId)?.config,
        doors: parts.filter((p) => p.category === 'facade').length,
        drawers: parts.filter((p) => p.category === 'drawer').length,
        shelves: parts.filter((p) => p.category === 'shelf').length,
        hasCountertop: isBase,
        hasPlinth: isBase || isTall,
        customParts: JSON.parse(JSON.stringify(parts)),
      } as any,
    });
    setApplySuccess(true);
    setTimeout(() => {
      setApplySuccess(false);
      closeSectionEditor();
    }, 900);
  };

  // Сохранение секции в библиотеку
  const handleSaveToCatalog = () => {
    const isBase = mainGroup === 'base';
    const isTall = mainGroup === 'tall';
    const newId = `custom_sec_${Date.now()}`;
    const newTemplate: CatalogItemTemplate = {
      id: newId,
      category: 'kitchen',
      subType: mainGroup as any,
      mainGroup: mainGroup,
      subGroup: 'all' as any,
      code: sectionCode.trim() || (mainGroup === 'base' ? 'НС-КАСТОМ' : mainGroup === 'wall' ? 'ВС-КАСТОМ' : mainGroup === 'tall' ? 'П-КАСТОМ' : 'ВС-А-КАСТОМ'),
      name: sectionName.trim() || 'Пользовательская секция',
      description: sectionDescription.trim() || `Собственная сборка из ${parts.length} деталей`,
      defaultDimensions: { ...dimensions },
      allowedDimensions: {
        minWidth: 200,
        maxWidth: 1200,
        minHeight: 300,
        maxHeight: 2400,
        minDepth: 250,
        maxDepth: 800,
      },
      tags: ['пользовательский', 'кастом', 'редактор', mainGroup],
      defaultConfig: {
        doors: parts.filter((p) => p.category === 'facade').length,
        drawers: parts.filter((p) => p.category === 'drawer').length,
        shelves: parts.filter((p) => p.category === 'shelf').length,
        hasCountertop: isBase,
        hasPlinth: isBase || isTall,
        customParts: JSON.parse(JSON.stringify(parts)),
      },
      basePrice: Math.round(5000 + parts.length * 800),
    };

    saveCustomSection(newTemplate);

    // Если редактировали существующий модуль на сцене — обновляем его на сцене тоже
    if (sectionEditorModuleId) {
      updateModule(sectionEditorModuleId, {
        name: newTemplate.name,
        dimensions: { ...dimensions },
        subType: mainGroup as any,
        config: {
          ...modules.find((m) => m.id === sectionEditorModuleId)?.config,
          doors: newTemplate.defaultConfig.doors,
          drawers: newTemplate.defaultConfig.drawers,
          shelves: newTemplate.defaultConfig.shelves,
          hasCountertop: isBase,
          hasPlinth: isBase || isTall,
          customParts: JSON.parse(JSON.stringify(parts)),
        } as any,
      });
    }

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsSaveModalOpen(false);
    }, 1200);
  };

  // Фильтрация списка деталей
  const filteredParts = useMemo(() => {
    if (filterCategory === 'all') return parts;
    return parts.filter((p) => {
      if (filterCategory === 'carcass') return p.category === 'carcass';
      if (filterCategory === 'shelf') return p.category === 'shelf' || p.category === 'divider';
      if (filterCategory === 'facade') return p.category === 'facade' || p.category === 'drawer';
      if (filterCategory === 'back') return p.category === 'back';
      return true;
    });
  }, [parts, filterCategory]);

  if (!isSectionEditorOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col select-none overflow-hidden animate-in fade-in duration-150">
      {/* ========================================================= */}
      {/* ВЕРХНЯЯ ПАНЕЛЬ (HEADER) */}
      {/* ========================================================= */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 gap-4">
        {/* Заголовок и иконка */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {sectionCode && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-500/25 border border-blue-500/40 text-blue-300 shrink-0">
                  {sectionCode}
                </span>
              )}
              <input
                type="text"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                className="bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 focus:border-blue-500 rounded-lg px-2.5 py-1 text-sm font-bold text-white tracking-wide truncate transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
                title="Нажмите для редактирования названия"
              />
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 shrink-0">
                Редактор секций
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>Деталей: <strong className="text-slate-200">{parts.length}</strong></span>
              <span>•</span>
              <span>Тип: <strong className="text-slate-200">{mainGroup === 'base' ? 'Нижняя база' : mainGroup === 'wall' ? 'Навесной шкаф' : mainGroup === 'tall' ? 'Пенал' : 'Антресоль'}</strong></span>
            </div>
          </div>
        </div>

        {/* Габариты секции (W × H × D) с мгновенной перестройкой */}
        <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[10px] font-bold text-slate-500 font-mono">Ш</span>
            <input
              type="number"
              value={dimensions.width}
              onChange={(e) => setDimensions({ ...dimensions, width: Math.max(150, Number(e.target.value)) })}
              className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-blue-400 focus:outline-none focus:border-blue-500"
              step={10}
            />
            <span className="text-[10px] text-slate-500">мм</span>
          </div>

          <span className="text-slate-600 font-bold">×</span>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[10px] font-bold text-slate-500 font-mono">В</span>
            <input
              type="number"
              value={dimensions.height}
              onChange={(e) => setDimensions({ ...dimensions, height: Math.max(200, Number(e.target.value)) })}
              className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-blue-400 focus:outline-none focus:border-blue-500"
              step={10}
            />
            <span className="text-[10px] text-slate-500">мм</span>
          </div>

          <span className="text-slate-600 font-bold">×</span>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[10px] font-bold text-slate-500 font-mono">Г</span>
            <input
              type="number"
              value={dimensions.depth}
              onChange={(e) => setDimensions({ ...dimensions, depth: Math.max(150, Number(e.target.value)) })}
              className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-blue-400 focus:outline-none focus:border-blue-500"
              step={10}
            />
            <span className="text-[10px] text-slate-500">мм</span>
          </div>

          {(plinthHeightMm > 0 || topHMm > 0) && (
            <span
              className="text-[10px] text-slate-400 font-mono pl-1.5 border-l border-slate-800 shrink-0"
              title={`Цоколь: ${plinthHeightMm} мм, каркас: ${carcassDimensions.height} мм${topHMm > 0 ? `, столешница: ${topHMm} мм` : ''}`}
            >
              корпус: <strong className="text-blue-300 font-semibold">{carcassDimensions.height}</strong> мм
            </span>
          )}
        </div>

        {/* Кнопки действий: Выбрать из библиотеки, Сохранить как новую секцию, Закрыть */}
        <div className="flex items-center gap-2">
          {/* Кнопка библиотеки */}
          <button
            onClick={() => setIsLibraryOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Открыть секцию</span>
          </button>

          {/* Кнопка прямого применения к модулю на сцене */}
          {sectionEditorModuleId && (
            <button
              onClick={handleApplyToSceneModule}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                applySuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{applySuccess ? 'Применено!' : 'Применить к модулю'}</span>
            </button>
          )}

          {/* Сохранить секцию */}
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Сохранить в библиотеку</span>
          </button>

          {/* Закрыть редактор */}
          <button
            onClick={closeSectionEditor}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
            title="Закрыть редактор"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* ОСНОВНАЯ РАБОЧАЯ ОБЛАСТЬ (3 КОЛОНКИ) */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ========================================================= */}
        {/* ЛЕВАЯ КОЛОНКА: ДЕРЕВО КОНСТРУКЦИИ СЕКЦИИ */}
        {/* ========================================================= */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10 shadow-xl">
          {/* Шапка левой панели */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Дерево конструкции ({parts.length})</span>
            </div>
            <button
              onClick={() => setIsAddPartOpen(true)}
              className="px-2.5 py-1 rounded-md bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Деталь</span>
            </button>
          </div>

          {/* Фильтр категорий */}
          <div className="p-2 border-b border-slate-800 flex items-center gap-1 text-[11px] overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Все' },
              { id: 'carcass', label: 'Корпус' },
              { id: 'shelf', label: 'Полки' },
              { id: 'facade', label: 'Фасады' },
              { id: 'back', label: 'Задняя' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className={`px-2 py-1 rounded-md transition-colors font-medium whitespace-nowrap ${
                  filterCategory === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Список деталей */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-800/40">
            {filteredParts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Нет деталей в этой категории
              </div>
            ) : (
              filteredParts.map((part) => {
                const isSelected = part.id === selectedPartId;
                const isHovered = part.id === hoveredPartId;
                const geom = evaluatePartGeometry(part, carcassDimensions, projectSettings, parts);

                return (
                  <div
                    key={part.id}
                    onClick={() => setSelectedPartId(part.id)}
                    onMouseEnter={() => setHoveredPartId(part.id)}
                    onMouseLeave={() => setHoveredPartId(null)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10'
                        : isHovered
                        ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                        : 'bg-slate-850/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Индикатор видимости */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSelectedPart({ isVisible: part.isVisible === false ? true : false });
                          setParts((prev) =>
                            prev.map((p) => (p.id === part.id ? { ...p, isVisible: !p.isVisible } : p))
                          );
                        }}
                        className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                        title={part.isVisible === false ? 'Показать деталь' : 'Скрыть деталь'}
                      >
                        {part.isVisible === false ? (
                          <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate leading-tight flex items-center gap-1.5">
                          <span>{part.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {geom.cutLength} × {geom.cutWidth} × {geom.thickness} мм
                        </div>
                      </div>
                    </div>

                    {/* Действия в строке детали: копия и удаление */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePart(part);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700/60 transition-colors"
                        title="Дублировать деталь"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePart(part.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                        title="Удалить деталь"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ========================================================= */}
        {/* ЦЕНТР: 3D VIEWPORT С ОРБИТ-КОНТРОЛОМ И РАСКРОЕМ */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-950">
          {/* Холст WebGL */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />

          {/* Панель ракурсов камеры и CAD-контуров (плавающая сверху) */}
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-lg z-20">
            <button
              onClick={() => setCameraPreset('iso')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              3D Изометрия
            </button>
            <button
              onClick={() => setCameraPreset('front')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Спереди
            </button>
            <button
              onClick={() => setCameraPreset('side')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Сбоку
            </button>
            <button
              onClick={() => setCameraPreset('top')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Сверху
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button
              onClick={() => setShowEdges(!showEdges)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                showEdges ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Переключить показ CAD-контуров"
            >
              Контуры
            </button>
          </div>

          {/* Плашка подсказки управления */}
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 pointer-events-none shadow-md">
            🖱️ <strong>ЛКМ</strong> — Вращение • <strong>ПКМ</strong> — Сдвиг • <strong>Колесо</strong> — Масштаб • <strong>Клик по детали</strong> — Выбор
          </div>

          {/* HUD выбранной детали в 3D */}
          {selectedPart && selectedPartGeometry && (
            <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 rounded-xl p-3 text-xs text-slate-200 shadow-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">
                <Box className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>{selectedPart.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-blue-300 border border-slate-700">
                    {selectedPart.materialType.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Раскрой: <strong className="text-slate-200">{selectedPartGeometry.cutLength} × {selectedPartGeometry.cutWidth}</strong> × {selectedPartGeometry.thickness} мм ({selectedPartGeometry.areaM2} м²)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ПРАВАЯ КОЛОНКА: ИНСПЕКТОР СВОЙСТВ ДЕТАЛИ */}
        {/* ========================================================= */}
        <aside className="w-84 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-10 shadow-xl overflow-y-auto">
          {selectedPart && selectedPartGeometry ? (
            <div className="p-4 space-y-4">
              {/* Шапка свойств */}
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    Параметры детали
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    ID: {selectedPart.id.substring(0, 16)}...
                  </p>
                </div>
                <button
                  onClick={() => deletePart(selectedPart.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Удалить деталь"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Название детали */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">Название детали:</label>
                <input
                  type="text"
                  value={selectedPart.name}
                  onChange={(e) => updateSelectedPart({ name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* 2. Категория детали */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">Категория детали:</label>
                <select
                  value={selectedPart.category}
                  onChange={(e) => updateSelectedPart({ category: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="carcass">Корпус / Стойка / Горизонт</option>
                  <option value="facade">Фасад распашной</option>
                  <option value="drawer">Фасад ящика</option>
                  <option value="shelf">Полка вкладная</option>
                  <option value="divider">Стойка внутренняя (перегородка)</option>
                  <option value="back">Задняя стенка (ХДФ)</option>
                  <option value="custom">Пользовательская деталь / Панель</option>
                </select>
              </div>

              {/* 2. Тип материала и толщина */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">Материал детали:</label>
                <select
                  value={selectedPart.materialType}
                  onChange={(e) => {
                    const nextMat = e.target.value as PartMaterialType;
                    const preset = MATERIAL_PRESETS[nextMat];
                    updateSelectedPart({
                      materialType: nextMat,
                      materialName: preset.name,
                      color: preset.color,
                      thickness: preset.defaultThickness,
                    });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ldsp">ЛДСП 16 мм (Корпус/Полки)</option>
                  <option value="mdf">МДФ 16 мм</option>
                  <option value="mdf_facade">МДФ фасад 18 мм</option>
                  <option value="hdf">ХДФ 4 мм (Задняя стенка)</option>
                  <option value="glass">Стекло закаленное 6 мм</option>
                  <option value="metal">Алюминий / Металл</option>
                  <option value="countertop">Столешница HPL 38 мм</option>
                </select>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">Толщина материала:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      value={selectedPart.thickness}
                      onChange={(e) => updateSelectedPart({ thickness: Math.max(1, Number(e.target.value)) })}
                      className="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-500">мм</span>
                  </div>
                </div>
              </div>

              {/* 3. Параметрические привязки к граням */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  Привязка к граням секции
                </div>

                {/* По ширине */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">По ширине (границам X):</label>
                  <select
                    value={selectedPart.widthBinding}
                    onChange={(e) => updateSelectedPart({ widthBinding: e.target.value as PartWidthBinding })}
                    className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="between_sides">Между внутренними боковинами</option>
                    <option value="full_width">На всю внешнюю ширину корпуса</option>
                    <option value="left_side">Левая стойка</option>
                    <option value="right_side">Правая стойка</option>
                    <option value="custom">Пользовательский фиксированный размер</option>
                  </select>
                </div>

                {/* По глубине */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">По глубине (границам Z):</label>
                  <select
                    value={selectedPart.depthBinding}
                    onChange={(e) => updateSelectedPart({ depthBinding: e.target.value as PartDepthBinding })}
                    className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="full_depth">На полную глубину каркаса</option>
                    <option value="recessed_front">С отступом спереди (-20 мм под петли)</option>
                    <option value="back_wall">Задняя стенка корпуса</option>
                    <option value="facade">Фасад накладной спереди</option>
                    <option value="custom">Пользовательская глубина</option>
                  </select>
                </div>

                {/* По высоте */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">По высоте (границам Y):</label>
                  <select
                    value={selectedPart.heightBinding}
                    onChange={(e) => updateSelectedPart({ heightBinding: e.target.value as PartHeightBinding })}
                    className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="shelf">Полка вкладная (на высоте Y)</option>
                    <option value="bottom_pass">Дно корпуса (горизонт нижний)</option>
                    <option value="top_roof">Крышка корпуса (горизонт верхний)</option>
                    <option value="between_bottom_top">Перегородка между дном и верхом</option>
                    <option value="full_height">На всю высоту корпуса</option>
                    <option value="facade">Фасад на высоту корпуса</option>
                    <option value="custom">Пользовательская высота</option>
                  </select>
                </div>
              </div>

              {/* 4. Расчетные раскройные размеры */}
              <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
                <div className="text-[11px] font-bold text-blue-300 flex items-center justify-between">
                  <span>Размеры для раскроя:</span>
                  <span className="font-mono text-white">{selectedPartGeometry.areaM2} м²</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Длина (размер 1)</span>
                    <strong className="text-white text-sm">{selectedPartGeometry.cutLength}</strong> мм
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Ширина (размер 2)</span>
                    <strong className="text-white text-sm">{selectedPartGeometry.cutWidth}</strong> мм
                  </div>
                </div>

                {/* Ручная корректировка при custom */}
                {(selectedPart.widthBinding === 'custom' || selectedPart.heightBinding === 'custom' || selectedPart.depthBinding === 'custom') && (
                  <div className="pt-1 space-y-1.5 border-t border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-400">Точный ручной ввод:</span>
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                      {selectedPart.widthBinding === 'custom' && (
                        <div>
                          <span className="text-[9px] text-slate-500 block">Ширина</span>
                          <input
                            type="number"
                            value={selectedPart.customWidth ?? selectedPartGeometry.width}
                            onChange={(e) => updateSelectedPart({ customWidth: Number(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white"
                          />
                        </div>
                      )}
                      {selectedPart.heightBinding === 'custom' && (
                        <div>
                          <span className="text-[9px] text-slate-500 block">Высота</span>
                          <input
                            type="number"
                            value={selectedPart.customHeight ?? selectedPartGeometry.height}
                            onChange={(e) => updateSelectedPart({ customHeight: Number(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white"
                          />
                        </div>
                      )}
                      {selectedPart.depthBinding === 'custom' && (
                        <div>
                          <span className="text-[9px] text-slate-500 block">Глубина</span>
                          <input
                            type="number"
                            value={selectedPart.customDepth ?? selectedPartGeometry.depth}
                            onChange={(e) => updateSelectedPart({ customDepth: Number(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Положение в пространстве (Смещения X, Y, Z) */}
              <div className="space-y-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
                  <span>Смещение в пространстве</span>
                  <button
                    onClick={() => updateSelectedPart({ offsetX: 0, offsetY: 0, offsetZ: 0 })}
                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Сброс
                  </button>
                </div>

                {/* Смещение Y (Вверх / Вниз) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ArrowUp className="w-3 h-3 text-emerald-400" />
                      По высоте (Y):
                    </span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        value={selectedPart.offsetY}
                        onChange={(e) => updateSelectedPart({ offsetY: Number(e.target.value) })}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white"
                      />
                      <span className="text-[10px] text-slate-500">мм</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={-Math.round(dimensions.height / 2)}
                    max={Math.round(dimensions.height / 2)}
                    value={selectedPart.offsetY}
                    onChange={(e) => updateSelectedPart({ offsetY: Number(e.target.value) })}
                    className="w-full accent-blue-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Смещение X (Влево / Вправо) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-indigo-400" />
                      По ширине (X):
                    </span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        value={selectedPart.offsetX}
                        onChange={(e) => updateSelectedPart({ offsetX: Number(e.target.value) })}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white"
                      />
                      <span className="text-[10px] text-slate-500">мм</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={-Math.round(dimensions.width / 2)}
                    max={Math.round(dimensions.width / 2)}
                    value={selectedPart.offsetX}
                    onChange={(e) => updateSelectedPart({ offsetX: Number(e.target.value) })}
                    className="w-full accent-blue-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Смещение Z (Вперёд / Назад) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ArrowDown className="w-3 h-3 text-amber-400" />
                      По глубине (Z):
                    </span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        value={selectedPart.offsetZ}
                        onChange={(e) => updateSelectedPart({ offsetZ: Number(e.target.value) })}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white"
                      />
                      <span className="text-[10px] text-slate-500">мм</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={-Math.round(dimensions.depth / 2)}
                    max={Math.round(dimensions.depth / 2)}
                    value={selectedPart.offsetZ}
                    onChange={(e) => updateSelectedPart({ offsetZ: Number(e.target.value) })}
                    className="w-full accent-blue-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Быстрые действия */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => duplicatePart(selectedPart)}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Дублировать деталь</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-full space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 border border-slate-700">
                <Box className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-300">Деталь не выбрана</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  Кликните по любой детали на 3D сцене или выберите ее в дереве конструкции слева
                </p>
              </div>
              <button
                onClick={() => setIsAddPartOpen(true)}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить новую деталь</span>
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* ========================================================= */}
      {/* МОДАЛЬНОЕ ОКНО: ДОБАВЛЕНИЕ НОВОЙ ДЕТАЛИ */}
      {/* ========================================================= */}
      {isAddPartOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Добавить деталь в секцию</span>
              </div>
              <button
                onClick={() => setIsAddPartOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Выберите тип создаваемой детали. Система автоматически привяжет ее к существующей конструкции корпуса:
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  type: 'shelf' as const,
                  title: 'Вкладная полка',
                  desc: 'Горизонтальная полка между боковинами с отступом',
                  icon: Layers,
                  mat: 'ldsp' as const,
                },
                {
                  type: 'divider' as const,
                  title: 'Внутренняя стойка',
                  desc: 'Вертикальная перегородка между дном и верхом',
                  icon: Split,
                  mat: 'ldsp' as const,
                },
                {
                  type: 'facade' as const,
                  title: 'Накладной фасад',
                  desc: 'Лицевой фасад из МДФ с отступами',
                  icon: Box,
                  mat: 'mdf_facade' as const,
                },
                {
                  type: 'drawer' as const,
                  title: 'Фасад ящика',
                  desc: 'Лицевой фасад выдвижного ящика',
                  icon: LayoutGrid,
                  mat: 'mdf_facade' as const,
                },
                {
                  type: 'tsarga' as const,
                  title: 'Царга / планка',
                  desc: 'Горизонтальная планка жесткости 100 мм',
                  icon: Compass,
                  mat: 'ldsp' as const,
                },
                {
                  type: 'panel' as const,
                  title: 'Декоративная панель',
                  desc: 'Панель накладная наружная',
                  icon: Palette,
                  mat: 'ldsp' as const,
                },
                {
                  type: 'custom' as const,
                  title: 'Произвольная деталь',
                  desc: 'Элемент со свободными привязками',
                  icon: Sparkles,
                  mat: 'ldsp' as const,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleAddNewPart(item.type, item.mat)}
                    className="p-3 rounded-xl bg-slate-800/80 hover:bg-blue-600/20 border border-slate-700/80 hover:border-blue-500/60 text-left transition-all group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white group-hover:text-blue-300">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* МОДАЛЬНОЕ ОКНО: БИБЛИОТЕКА СЕКЦИЙ ДЛЯ ОТКРЫТИЯ */}
      {/* ========================================================= */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Выбрать секцию из библиотеки</h3>
                  <p className="text-[11px] text-slate-400">
                    Выберите готовую секцию, чтобы открыть ее для редактирования конструкции
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Поиск по каталогу */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/40">
              <input
                type="text"
                placeholder="Поиск по названию секции (пенал, 1 дверь, ящики, полка)..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Сетка шаблонов */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-3">
              {[...customTemplates, ...CATALOG_ITEMS]
                .filter((tpl) => {
                  if (!librarySearch.trim()) return true;
                  const q = librarySearch.toLowerCase();
                  const code = (tpl.code || getModuleCode(tpl)).toLowerCase();
                  return code.includes(q) || tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q);
                })
                .map((tpl) => {
                  const isCustom = Boolean((tpl as any).isCustomSection || tpl.defaultConfig.customParts);
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        setSectionCode(tpl.code || getModuleCode(tpl) || '');
                        setSectionName(tpl.name);
                        setSectionDescription(tpl.description || '');
                        setMainGroup(tpl.mainGroup);
                        setDimensions({
                          width: tpl.defaultDimensions.width,
                          height: tpl.defaultDimensions.height,
                          depth: tpl.defaultDimensions.depth,
                        });
                        if (tpl.defaultConfig.customParts && tpl.defaultConfig.customParts.length > 0) {
                          setParts(JSON.parse(JSON.stringify(tpl.defaultConfig.customParts)));
                        } else {
                          const tplHasPl = tpl.mainGroup === 'base' || tpl.mainGroup === 'tall';
                          const tplPlH = (tplHasPl && projectSettings.hasPlinth !== false) ? (projectSettings.plinthHeight ?? 120) : 0;
                          const tplHasTp = tpl.mainGroup === 'base';
                          const tplTopH = tplHasTp ? (projectSettings.countertopThickness ?? 40) : 0;
                          const tplCarcassH = Math.max(100, tpl.defaultDimensions.height - tplPlH - tplTopH);

                          const newParts = convertTemplateToCustomParts(tpl, projectSettings, {
                            width: tpl.defaultDimensions.width,
                            height: tplCarcassH,
                            depth: tpl.defaultDimensions.depth,
                          });
                          setParts(newParts);
                        }
                        setSelectedPartId(null);
                        setIsLibraryOpen(false);
                      }}
                      className="p-3 rounded-xl bg-slate-800/80 hover:bg-blue-600/15 border border-slate-700 hover:border-blue-500/60 cursor-pointer transition-all flex flex-col justify-between group shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(tpl.code || getModuleCode(tpl)) && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-500/40">
                                {tpl.code || getModuleCode(tpl)}
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                              {tpl.defaultDimensions.width}×{tpl.defaultDimensions.height}×{tpl.defaultDimensions.depth}
                            </span>
                          </div>
                          {isCustom && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Кастом
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-200 group-hover:text-blue-300 transition-colors line-clamp-2">
                          {tpl.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between text-[11px] text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                        <span>Открыть в редакторе</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* МОДАЛЬНОЕ ОКНО: СОХРАНЕНИЕ КАК НОВАЯ СЕКЦИЯ */}
      {/* ========================================================= */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Save className="w-4 h-4 text-blue-400" />
                <span>Сохранение мебельной секции</span>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Обозначение секции (код):</label>
                <input
                  type="text"
                  value={sectionCode}
                  onChange={(e) => setSectionCode(e.target.value)}
                  placeholder="Например: НС-2Д, ВС-П, П-2Д"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Название секции в библиотеке:</label>
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="Например: НС-2Д · Пенал 600 с 2 полками"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Категория каталога:</label>
                <select
                  value={mainGroup}
                  onChange={(e) => setMainGroup(e.target.value as CatalogMainGroup)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="base">Кухонные нижние секции</option>
                  <option value="wall">Кухонные верхние шкафы</option>
                  <option value="tall">Кухонные пеналы (колонны)</option>
                  <option value="top">Антресоли (3-й ярус)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Краткое описание конструкции:</label>
                <textarea
                  value={sectionDescription}
                  onChange={(e) => setSectionDescription(e.target.value)}
                  rows={3}
                  placeholder="Опишите особенности (количество полок, фасадов, внутреннее наполнение)..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Габариты секции:</span>
                  <span className="font-mono text-slate-200 font-bold">{dimensions.width} × {dimensions.height} × {dimensions.depth} мм</span>
                </div>
                <div className="flex justify-between">
                  <span>Количество деталей:</span>
                  <span className="font-mono text-slate-200 font-bold">{parts.length} шт.</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveToCatalog}
                className={`px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                }`}
              >
                {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saveSuccess ? 'Успешно сохранено!' : 'Сохранить секцию'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
