import * as THREE from 'three';
import { FurnitureModule, RoomConfig, PlannerMode, ProjectSettings } from '../../types';
import { RoomData } from '../../types/room';
import { ModuleBuilder } from './ModuleBuilder';
import { RoomBuilder } from './RoomBuilder';
import { findCollinearChains } from './chainMerging';
import { buildVertexMap, distancePointToSegment, isBoxInsideRoom, snapAndClampToWalls, getOutwardWallNormal, getInwardWallNormal } from '../../utils/roomGeometry';

export interface SceneManagerCallbacks {
  onSelectModule: (id: string | null) => void;
  onUpdatePosition: (id: string, newPos: { x: number; y: number; z: number }, newRotation?: number) => void;
  onSelectWall?: (wallId: string | null) => void;
  onSelectColumn?: (columnId: string | null) => void;
  onUpdateColumnPosition?: (id: string, x: number, z: number) => void;
  onSelectOpening?: (openingId: string | null) => void;
  onUpdateOpeningOffset?: (openingId: string, offset: number) => void;
  onDragEnd?: () => void;
  onToggleModuleDoors?: (id: string) => void;
  onOpenModuleMenu?: (id: string, screenPos: { x: number; y: number }) => void;
}

export function isWallCornerBlind(m: FurnitureModule): boolean {
  if (!m) return false;
  const catId = m.catalogId || '';
  const modId = m.id || '';
  const isWallOrTop =
    m.subType === 'wall' ||
    m.subType === 'top' ||
    catId.startsWith('k_wall_') ||
    modId.startsWith('k_wall_') ||
    catId.startsWith('k_top_') ||
    modId.startsWith('k_top_') ||
    (m as any).mainGroup === 'wall' ||
    (m as any).mainGroup === 'top';
  const isBlind =
    catId.includes('corner_blind') ||
    modId.includes('corner_blind') ||
    (m as any).subGroup === 'corner_blind' ||
    (m as any).subGroup === 'top_corner' ||
    Boolean(m.config?.blindCornerSide) ||
    Boolean(m.config?.blindCornerWidth && isWallOrTop);
  return isWallOrTop && isBlind;
}

export function isBaseCornerBlind(m: FurnitureModule): boolean {
  if (!m) return false;
  const catId = m.catalogId || '';
  const modId = m.id || '';
  const isBase =
    m.subType === 'base' ||
    m.subType === 'corner' ||
    catId.startsWith('k_base_') ||
    modId.startsWith('k_base_') ||
    (m as any).mainGroup === 'base';
  const isBlind =
    catId.includes('corner_blind') ||
    modId.includes('corner_blind') ||
    (m as any).subGroup === 'corner_blind' ||
    Boolean(m.config?.blindCornerWidth && !isWallCornerBlind(m));
  return isBase && isBlind;
}

export function isUpperModule(m: FurnitureModule): boolean {
  if (!m) return false;
  const catId = m.catalogId || '';
  const modId = m.id || '';
  return (
    m.subType === 'wall' ||
    m.subType === 'top' ||
    catId.startsWith('k_wall_') ||
    modId.startsWith('k_wall_') ||
    catId.startsWith('k_top_') ||
    modId.startsWith('k_top_') ||
    (m as any).mainGroup === 'wall' ||
    (m as any).mainGroup === 'top'
  );
}

export class SceneManager {
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera3D: THREE.PerspectiveCamera;
  private camera2D: THREE.OrthographicCamera;
  private currentCamera: THREE.Camera;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  // Динамическая плоскость перемещения (подстраивается под высоту модуля Y)
  private dragPlane: THREE.Plane;

  // Группы
  private roomGroup: THREE.Group;
  private modulesGroup: THREE.Group;
  private suspensionPlaneGroup: THREE.Group;

  // Интерактивность и коллизии
  private callbacks: SceneManagerCallbacks;
  private isMouseDown: boolean = false;
  private pointerDownPos = { x: 0, y: 0 };
  private isDraggingModule: boolean = false;
  private isDraggingColumn: boolean = false;
  private isDraggingOpening: boolean = false;
  private hoveredModuleId: string | null = null;
  private hoveredWallId: string | null = null;
  private draggedModuleId: string | null = null;
  private draggedColumnId: string | null = null;
  private draggedOpeningId: string | null = null;
  private dragPlaneIntersection = new THREE.Vector3();
  private dragOffset = new THREE.Vector3();
  // Параметры перемещения модулей вдоль вертикальной плоскости стены в 3D
  private draggedWallId: string | null = null;
  private dragWallOffsetT: number = 0;
  private dragWallOffsetY: number = 0;
  private mode: PlannerMode = '3D';
  private collidingIds = new Set<string>();
  private isWireframeMode: boolean = false;
  private showDimensions: boolean = true;

  // Вращение и панорамирование камеры
  private isRotatingCamera: boolean = false;
  private isPanningCamera: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private cameraTarget = new THREE.Vector3(0, 0.9, 0);
  private spherical = new THREE.Spherical(4.8, Math.PI / 3.4, Math.PI / 4);
  private targetSpherical = new THREE.Spherical(4.8, Math.PI / 3.4, Math.PI / 4);

  // Освещение
  private dirLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;

  private resizeObserver!: ResizeObserver;
  private currentRoomConfig?: RoomConfig;
  private currentRoomData?: RoomData;
  private currentModules: FurnitureModule[] = [];
  private projectSettings?: ProjectSettings;
  private selectedId: string | null = null;
  private pendingWallHit: { wallId: string; point: THREE.Vector3 } | null = null;
  private pendingOpeningHit: { openingId: string; wallId: string; point: THREE.Vector3 } | null = null;
  private animationFrameId: number | null = null;

  // Плавная 60 FPS интерполяция открытия фасадов и выдвижения ящиков
  private moduleOpenProgress = new Map<string, number>();
  private middleClickModuleId: string | null = null;

  // Связанные функции-обработчики для надёжного удаления слушателей при dispose
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnDblClick = this.onDoubleClick.bind(this);
  private boundOnWheel = this.onWheel.bind(this);
  private boundOnAuxClick = this.onAuxClick.bind(this);
  private boundOnMouseLeave = this.onMouseLeave.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);
  private boundOnWindowContextMenu = (e: MouseEvent) => {
    if (this.isPanningCamera) {
      e.preventDefault();
    }
  };

  constructor(canvas: HTMLCanvasElement, callbacks: SceneManagerCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0f19');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    this.renderer.setSize(width, height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Группы объектов сцены (инициализируем до камер)
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    this.modulesGroup = new THREE.Group();
    this.scene.add(this.modulesGroup);

    this.suspensionPlaneGroup = new THREE.Group();
    this.scene.add(this.suspensionPlaneGroup);
    this.suspensionPlaneGroup.visible = false;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // 3D Камера
    const aspect = width / height;
    this.camera3D = new THREE.PerspectiveCamera(42, aspect, 0.1, 50);
    this.update3DCameraTransform();

    // 2D Камера
    const frustumSize = 5.5;
    this.camera2D = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    this.camera2D.up.set(0, 0, -1);
    this.camera2D.position.set(0, 10, 0);
    this.camera2D.lookAt(0, 0, 0);

    this.currentCamera = this.camera3D;

    this.initStudioLights();
    this.bindEvents();
    this.initResizeObserver();
    this.render();
  }

  private initResizeObserver() {
    const target = this.canvas.parentElement || this.canvas;
    this.resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.handleResize(width, height);
          }
        }
      });
    });
    this.resizeObserver.observe(target);
  }

  public resize() {
    const target = this.canvas.parentElement || this.canvas;
    const rect = target.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.handleResize(rect.width, rect.height);
    }
  }

  private handleResize(w: number, h: number) {
    const aspect = w / h;
    this.camera3D.aspect = aspect;
    this.camera3D.updateProjectionMatrix();

    const frustumSize = 5.5;
    this.camera2D.left = (-frustumSize * aspect) / 2;
    this.camera2D.right = (frustumSize * aspect) / 2;
    this.camera2D.top = frustumSize / 2;
    this.camera2D.bottom = -frustumSize / 2;
    this.camera2D.updateProjectionMatrix();

    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  private initStudioLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbf5, 1.25);
    this.dirLight.position.set(4, 6.5, 4.5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 20;
    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.radius = 2.0;

    const d = 3.5;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    this.fillLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    this.fillLight.position.set(-4, 5, -2);
    this.scene.add(this.fillLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.35);
    hemiLight.position.set(0, 10, 0);
    this.scene.add(hemiLight);
  }

  public setMode(mode: PlannerMode) {
    this.mode = mode;
    this.hoveredWallId = null;
    this.updateWallHoverVisuals();
    if (this.currentRoomData) {
      this.updateRoomData(this.currentRoomData);
    }
    if (mode === '2D') {
      this.showSuspensionPlane(false);
      this.currentCamera = this.camera2D;
      this.camera2D.up.set(0, 0, -1);
      this.camera2D.position.set(0, 10, 0);
      this.camera2D.lookAt(0, 0, 0);
      this.camera2D.updateProjectionMatrix();
    } else {
      this.currentCamera = this.camera3D;
      this.update3DCameraTransform();
    }
    this.updateWallOcclusion();
  }

  public updateRoomData(roomData: RoomData) {
    this.currentRoomData = roomData;
    this.hoveredWallId = null;
    while (this.roomGroup.children.length > 0) {
      this.roomGroup.remove(this.roomGroup.children[0]);
    }
    const builtGroup = RoomBuilder.buildRoom(roomData, this.mode);
    this.roomGroup.add(builtGroup);
    this.updateWallOcclusion();
    this.updateWallHoverVisuals();
    this.buildSuspensionPlane();
  }

  public updateWallOcclusion() {
    if (!this.roomGroup || !this.camera3D) return;

    if (this.mode === '2D') {
      this.roomGroup.traverse((child) => {
        if (child.userData && child.userData.type === 'wall') {
          const mesh = child as THREE.Mesh;
          mesh.visible = true;
          if (mesh.material && mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.opacity = 1.0;
            mesh.material.depthWrite = true;
          }
          child.userData.isObstructing = false;
          mesh.children.forEach((c) => {
            c.visible = true;
            if (c instanceof THREE.LineSegments) {
              const mat = c.material as THREE.LineBasicMaterial;
              if (mat) mat.opacity = 1.0;
            }
          });
        } else if (child.userData && (child.userData.type === 'wallPlinth' || child.userData.type === 'wallOpening')) {
          child.visible = true;
        }
      });
      return;
    }

    const camX = this.camera3D.position.x;
    const camZ = this.camera3D.position.z;

    // 1. Определяем статус obstructing для каждой стены по ее нормали и направлению к камере
    const obstructingWallIds = new Set<string>();

    this.roomGroup.traverse((child) => {
      if (child.userData && child.userData.type === 'wall' && child.userData.midPoint) {
        const mid = child.userData.midPoint;
        const outNorm = child.userData.outwardNormal;

        let isObstructing = false;
        if (outNorm) {
          const dx = camX - mid.x;
          const dz = camZ - mid.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 1e-4) {
            const toCamX = dx / dist;
            const toCamZ = dz / dist;
            // Проекция направления на камеру на внешнюю нормаль стены
            // cosAlpha = 1.0 -> камера прямо перед стеной снаружи помещения
            // cosAlpha = 0.0 -> камера строго в торец стены (90°)
            // cosAlpha < 0.0 -> камера находится с внутренней стороны стены
            const cosAlpha = outNorm.nx * toCamX + outNorm.nz * toCamZ;

            // Порог 0.22 (угол ~77°): стена держится видимой и исчезает только тогда,
            // когда камера подошла почти в торец и смотрит снаружи внутрь помещения
            isObstructing = cosAlpha > 0.22;
          }
        } else {
          const dot = camX * mid.x + camZ * mid.z;
          isObstructing = dot > 0.45;
        }

        if (isObstructing && child.userData.wallId) {
          obstructingWallIds.add(child.userData.wallId);
        }
      }
    });

    // 2. Применяем 100% прозрачность / скрытие передней стены:
    // Скрываемая стена становится mesh.visible = false, чтобы полностью исключить
    // малейшее искажение цветов мебели, фасадов и столешниц!
    this.roomGroup.traverse((child) => {
      if (child.userData && child.userData.type === 'wall') {
        const mesh = child as THREE.Mesh;
        const isObs = Boolean(child.userData.wallId && obstructingWallIds.has(child.userData.wallId));
        
        if (child.userData.isObstructing !== isObs) {
          child.userData.isObstructing = isObs;
          mesh.visible = !isObs;
          if (mesh.material && mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.opacity = isObs ? 0.0 : 1.0;
            mesh.material.depthWrite = !isObs;
          }
          mesh.children.forEach((c) => {
            c.visible = !isObs;
          });
        }
      } else if (child.userData && (child.userData.type === 'wallPlinth' || child.userData.type === 'wallOpening')) {
        const isObs = Boolean(child.userData.wallId && obstructingWallIds.has(child.userData.wallId));
        if (child.visible === isObs) {
          child.visible = !isObs;
        }
      }
    });
  }

  public updateWallHoverVisuals() {
    if (!this.roomGroup) return;

    this.roomGroup.traverse((child) => {
      if (child.userData && child.userData.type === 'wall' && child.userData.wallId) {
        if (this.mode === '3D' && child.userData.isObstructing) return;

        const wallId = child.userData.wallId;
        const isSelected = this.mode === '2D' && this.currentRoomData?.selectedWallId === wallId;
        const isHovered = this.mode === '2D' && this.hoveredWallId === wallId;

        // Меш стены (основное тело)
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          const mat = child.material;
          if (isSelected) {
            mat.color.set('#38bdf8');
            mat.emissive.set('#0369a1');
            mat.emissiveIntensity = 0.35;
          } else if (isHovered) {
            mat.color.set('#7dd3fc');
            mat.emissive.set('#0284c7');
            mat.emissiveIntensity = 0.55;
          } else {
            const defColor = child.userData.defaultColor || this.currentRoomData?.wallColor || '#E2E8F0';
            mat.color.set(defColor);
            mat.emissive.set(0x000000);
            mat.emissiveIntensity = 0;
          }
        }

        // Контурные CAD-линии
        child.children.forEach((c) => {
          if (c instanceof THREE.LineSegments && c.material instanceof THREE.LineBasicMaterial) {
            if (isSelected) {
              c.material.color.set(0x0284c7);
            } else if (isHovered) {
              c.material.color.set(0x38bdf8);
            } else {
              c.material.color.set(0x475569);
            }
          }
        });

        // Размерный бейдж (Sprite)
        if (child instanceof THREE.Sprite && child.userData.isBadge) {
          if (isHovered && !isSelected) {
            child.scale.set(0.62, 0.15, 1);
          } else {
            child.scale.set(0.55, 0.13, 1);
          }
        }
      }
    });
  }

  public showSuspensionPlane(visible: boolean) {
    if (this.mode === '2D') {
      this.suspensionPlaneGroup.visible = false;
      return;
    }
    this.suspensionPlaneGroup.visible = visible;
  }

  public buildSuspensionPlane() {
    while (this.suspensionPlaneGroup.children.length > 0) {
      const child = this.suspensionPlaneGroup.children[0];
      this.suspensionPlaneGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      } else if (child instanceof THREE.LineSegments) {
        child.geometry?.dispose();
        (child.material as THREE.Material)?.dispose();
      } else if (child instanceof THREE.Sprite) {
        (child.material as THREE.SpriteMaterial)?.map?.dispose();
        child.material?.dispose();
      }
    }

    const startHeightMm = this.projectSettings?.upperBaseStartHeight ?? 1440;
    const startHeightM = startHeightMm / 1000;

    let shape: THREE.Shape | null = null;
    let centerX = 0;
    let centerZ = 0;

    if (this.currentRoomData && this.currentRoomData.vertices && this.currentRoomData.vertices.length >= 3) {
      const verts = this.currentRoomData.vertices;
      shape = new THREE.Shape();
      shape.moveTo(verts[0].x / 1000, -verts[0].z / 1000);
      let sumX = verts[0].x / 1000;
      let sumZ = verts[0].z / 1000;

      for (let i = 1; i < verts.length; i++) {
        shape.lineTo(verts[i].x / 1000, -verts[i].z / 1000);
        sumX += verts[i].x / 1000;
        sumZ += verts[i].z / 1000;
      }
      shape.closePath();

      centerX = sumX / verts.length;
      centerZ = sumZ / verts.length;
    } else if (this.currentRoomConfig) {
      const W = this.currentRoomConfig.width / 1000;
      const L = this.currentRoomConfig.length / 1000;
      shape = new THREE.Shape();
      shape.moveTo(-W / 2, -L / 2);
      shape.lineTo(W / 2, -L / 2);
      shape.lineTo(W / 2, L / 2);
      shape.lineTo(-W / 2, L / 2);
      shape.closePath();
      centerX = 0;
      centerZ = 0;
    }

    if (!shape) return;

    // 1. Полупрозрачная плоскость уровня начала верхних баз
    const planeGeo = new THREE.ShapeGeometry(shape);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.position.y = startHeightM;
    planeMesh.raycast = () => {};
    this.suspensionPlaneGroup.add(planeMesh);

    // 2. Четкий контур по периметру плоскости
    const edgeGeo = new THREE.EdgesGeometry(planeGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLine.rotation.x = -Math.PI / 2;
    edgeLine.position.y = startHeightM;
    edgeLine.raycast = () => {};
    this.suspensionPlaneGroup.add(edgeLine);

    // 3. Информационный размерный бейдж (спрайт)
    const badge = this.createSuspensionPlaneBadge(`${startHeightMm} мм • Уровень верхних шкафов`);
    badge.position.set(centerX, startHeightM + 0.08, centerZ);
    this.suspensionPlaneGroup.add(badge);
  }

  private createSuspensionPlaneBadge(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 70;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 364, 54, 8);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 190, 35);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.76, 0.14, 1);
    sprite.raycast = () => {};
    return sprite;
  }

  private computeSnappedUpperY(currentMod: FurnitureModule, rawY: number): number {
    const baseElevation = this.projectSettings?.upperBaseStartHeight ?? 1440;
    const modH = currentMod.dimensions.height;

    // Модули верхнего яруса и антресоли строго не могут опускаться ниже базовой плоскости
    let clampedY = Math.max(baseElevation, rawY);

    // Ограничение по высоте потолка помещения (не выходить за пределы потолка)
    const roomHeight = this.currentRoomConfig?.height ?? 2700;
    const maxY = roomHeight - modH;
    if (maxY >= baseElevation) {
      clampedY = Math.min(maxY, clampedY);
    }

    const snapThreshold = 75; // 75 мм радиус магнитного захвата высоты
    let bestSnapY: number | null = null;
    let minDiff = snapThreshold;

    // 1. Привязка к базовой плоскости (нижний край на 1440 мм)
    const diffBase = Math.abs(clampedY - baseElevation);
    if (diffBase < minDiff) {
      bestSnapY = baseElevation;
      minDiff = diffBase;
    }

    // 2. Привязка к ключевым высотным точкам других модулей
    for (const other of this.currentModules) {
      if (other.id === currentMod.id) continue;

      const oBottom = other.position.y || 0;
      const oH = other.dimensions.height;
      const oTop = oBottom + oH;

      // Точка 1: Низ вровень с низом соседа (Bottom-to-Bottom)
      // Пример: опустили шкаф 700 вниз рядом со шкафом 900 -> дно примагнитилось в одну линию
      if (oBottom >= baseElevation - 10) {
        const diffBottom = Math.abs(clampedY - oBottom);
        if (diffBottom < minDiff) {
          bestSnapY = oBottom;
          minDiff = diffBottom;
        }
      }

      // Точка 2: Верх вровень с верхом соседа (Top-to-Top)
      // Пример: подняли шкаф 700 вверх -> верхняя грань примагнитилась к верхней грани шкафа 900
      const snapTopToTop = oTop - modH;
      if (snapTopToTop >= baseElevation - 10) {
        const diffTop = Math.abs(clampedY - snapTopToTop);
        if (diffTop < minDiff) {
          bestSnapY = snapTopToTop;
          minDiff = diffTop;
        }
      }

      // Точка 3: Дно на крышку нижестоящего модуля (Bottom-to-Top / Stacking)
      // Пример: антресоль ставится поверх шкафа 700, 900 или пенала -> дно садится точно на крышку
      if (oTop >= baseElevation - 10) {
        const diffStack = Math.abs(clampedY - oTop);
        if (diffStack < minDiff) {
          bestSnapY = oTop;
          minDiff = diffStack;
        }
      }

      // Точка 4: Верх вровень с дном вышестоящей секции (Top-to-Bottom)
      const snapTopToBottom = oBottom - modH;
      if (snapTopToBottom >= baseElevation - 10) {
        const diffUnder = Math.abs(clampedY - snapTopToBottom);
        if (diffUnder < minDiff) {
          bestSnapY = snapTopToBottom;
          minDiff = diffUnder;
        }
      }
    }

    return bestSnapY !== null ? Math.round(bestSnapY) : Math.round(clampedY);
  }

  public updateRoom(room: RoomConfig) {
    this.currentRoomConfig = room;
    while (this.roomGroup.children.length > 0) {
      this.roomGroup.remove(this.roomGroup.children[0]);
    }

    const W = room.width / 1000;
    const L = room.length / 1000;
    const H = room.height / 1000;

    const floorGeo = new THREE.PlaneGeometry(W, L);
    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(room.floorColor),
      roughness: 0.5,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.roomGroup.add(floorMesh);

    const grid = new THREE.GridHelper(Math.max(W, L), Math.round(Math.max(W, L) * 2), 0x0284c7, 0x1e293b);
    grid.position.y = 0.001;
    this.roomGroup.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(room.wallColor),
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const edgeLineMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1.5 });

    const backWallGeo = new THREE.PlaneGeometry(W, H);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, H / 2, -L / 2);
    backWall.receiveShadow = true;
    const bEdges = new THREE.LineSegments(new THREE.EdgesGeometry(backWallGeo), edgeLineMat);
    bEdges.raycast = () => {};
    backWall.add(bEdges);
    this.roomGroup.add(backWall);

    const leftWallGeo = new THREE.PlaneGeometry(L, H);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-W / 2, H / 2, 0);
    leftWall.receiveShadow = true;
    const lEdges = new THREE.LineSegments(new THREE.EdgesGeometry(leftWallGeo), edgeLineMat);
    lEdges.raycast = () => {};
    leftWall.add(lEdges);
    this.roomGroup.add(leftWall);

    this.buildSuspensionPlane();
  }

  public setWireframeMode(enabled: boolean) {
    this.isWireframeMode = enabled;
    this.updateModules(this.currentModules, this.selectedId, this.collidingIds);
  }

  public setShowDimensions(show: boolean) {
    this.showDimensions = show;
    this.modulesGroup.traverse((child) => {
      if (child instanceof THREE.Sprite && child.userData?.isDimensionSprite) {
        child.visible = show;
      }
    });
  }

  public setProjectSettings(settings: ProjectSettings) {
    this.projectSettings = settings;
    this.buildSuspensionPlane();
    this.updateModules(this.currentModules, this.selectedId, this.collidingIds);
  }

  public getFloorPointFromClient(clientX: number, clientY: number, elevation: number = 0): { x: number; y: number; z: number } | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.currentCamera);

    // 1. Для навесных модулей (elevation > 0) сначала проверяем пересечение с мешами стен помещения
    if (elevation > 0) {
      const wallMeshes: THREE.Object3D[] = [];
      this.roomGroup.traverse((child) => {
        if (child.userData && child.userData.type === 'wall' && child.userData.wallId) {
          if (this.mode === '3D' && child.userData.isObstructing) return;
          wallMeshes.push(child);
        }
      });

      const wallIntersects = this.raycaster.intersectObjects(wallMeshes, true);
      if (wallIntersects.length > 0) {
        return {
          x: Math.round(wallIntersects[0].point.x * 1000),
          y: elevation,
          z: Math.round(wallIntersects[0].point.z * 1000),
        };
      }
    }

    // 2. Горизонтальная плоскость на высоте elevation
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation / 1000);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, target)) {
      return {
        x: Math.round(target.x * 1000),
        y: elevation,
        z: Math.round(target.z * 1000),
      };
    }
    return null;
  }

  public updateModules(modules: FurnitureModule[], selectedId: string | null, collidingIds?: Set<string>) {
    this.currentModules = modules;
    this.selectedId = selectedId;
    if (collidingIds !== undefined) {
      this.collidingIds = collidingIds;
    }

    // Если прямо сейчас идет перетаскивание модуля мышью — избегаем тяжелой пересборки сцены на лету.
    // Модуль уже перемещается напрямую с 60 FPS через Three.js transform
    if (this.isDraggingModule) {
      return;
    }

    // 1. Поиск неразрывных состыкованных цепочек секций (flush dock)
    const countertopChains = findCollinearChains(modules, 'countertop', this.projectSettings);
    const plinthChains = findCollinearChains(modules, 'plinth', this.projectSettings);

    const skipCountertopIds = new Set<string>();
    for (const chain of countertopChains) {
      for (const m of chain.modules) {
        skipCountertopIds.add(m.id);
      }
    }

    const skipPlinthIds = new Set<string>();
    for (const chain of plinthChains) {
      for (const m of chain.modules) {
        skipPlinthIds.add(m.id);
      }
    }

    while (this.modulesGroup.children.length > 0) {
      this.modulesGroup.remove(this.modulesGroup.children[0]);
    }

    // 2. Сборка модулей мебели
    modules.forEach((mod) => {
      const isSelected = mod.id === selectedId;
      const isColliding = this.collidingIds.has(mod.id);
      const modGroup = ModuleBuilder.buildModuleGroup(
        mod,
        isSelected,
        isColliding,
        this.isWireframeMode,
        this.projectSettings,
        false,
        {
          skipCountertop: skipCountertopIds.has(mod.id),
          skipPlinth: skipPlinthIds.has(mod.id),
          showDimensions: this.showDimensions,
        }
      );
      this.modulesGroup.add(modGroup);

      // Синхронизируем текущий прогресс анимации (если модуль только добавлен, берем начальное значение)
      const currentProgress = this.moduleOpenProgress.get(mod.id) ?? (mod.config.isOpen ? 1.0 : 0.0);
      this.moduleOpenProgress.set(mod.id, currentProgress);
      this.applyModuleAnimation(mod.id, currentProgress);
    });

    // 3. Создание монолитных бесшовных полотен столешниц для состыкованных секций
    for (const chain of countertopChains) {
      const topThick = (this.projectSettings?.countertopThickness ?? 40) / 1000;
      const ctGroup = ModuleBuilder.createContinuousCountertopGroup(
        chain.length / 1000,
        chain.depth / 1000,
        topThick,
        chain.material,
        this.isWireframeMode
      );
      ctGroup.position.set(
        chain.worldCenter.x / 1000,
        chain.worldCenter.y / 1000,
        chain.worldCenter.z / 1000
      );
      ctGroup.rotation.y = THREE.MathUtils.degToRad(chain.theta);
      this.modulesGroup.add(ctGroup);
    }

    // 4. Создание единых непрерывных планок цоколя для состыкованных секций
    for (const chain of plinthChains) {
      const plinthHeight = (this.projectSettings?.plinthHeight ?? 120) / 1000;
      const plGroup = ModuleBuilder.createContinuousPlinthGroup(
        chain.length / 1000,
        plinthHeight,
        0.016,
        chain.material,
        this.isWireframeMode
      );
      plGroup.position.set(
        chain.worldCenter.x / 1000,
        chain.worldCenter.y / 1000,
        chain.worldCenter.z / 1000
      );
      plGroup.rotation.y = THREE.MathUtils.degToRad(chain.theta);
      this.modulesGroup.add(plGroup);
    }
  }

  private updateCollisionVisuals() {
    this.modulesGroup.traverse((child) => {
      if (child.userData && child.userData.isEdgeLine && child.userData.moduleId) {
        const isColliding = this.collidingIds.has(child.userData.moduleId);
        const line = child as THREE.LineSegments;
        if (line.material && line.material instanceof THREE.LineBasicMaterial) {
          if (isColliding) {
            line.material.color.set('#ef4444');
          } else if (child.userData.moduleId === this.selectedId) {
            line.material.color.set('#38bdf8');
          } else {
            line.material.color.set('#64748b');
          }
        }
      }
    });
  }

  private update3DCameraTransform() {
    this.camera3D.position.setFromSpherical(this.spherical).add(this.cameraTarget);
    this.camera3D.lookAt(this.cameraTarget);
    this.updateWallOcclusion();
  }

  private getIntersectedModule(e: MouseEvent): { moduleId: string; point: THREE.Vector3 } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.currentCamera);

    const colliders: THREE.Object3D[] = [];
    this.modulesGroup.traverse((child) => {
      if (child.userData && child.userData.isModuleCollider) {
        colliders.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(colliders, false);
    if (intersects.length > 0) {
      return {
        moduleId: intersects[0].object.userData.moduleId,
        point: intersects[0].point,
      };
    }
    return null;
  }

  private getIntersectedColumn(e: MouseEvent): { columnId: string; point: THREE.Vector3 } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.currentCamera);

    const colMeshes: THREE.Object3D[] = [];
    this.roomGroup.traverse((child) => {
      if (child.userData && child.userData.type === 'column' && child.userData.columnId) {
        colMeshes.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(colMeshes, false);
    if (intersects.length > 0) {
      return {
        columnId: intersects[0].object.userData.columnId,
        point: intersects[0].point,
      };
    }
    return null;
  }

  private getIntersectedOpening(e: MouseEvent): { openingId: string; wallId: string; point: THREE.Vector3 } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.currentCamera);

    const openMeshes: THREE.Object3D[] = [];
    this.roomGroup.traverse((child) => {
      if (child.userData && child.userData.type === 'opening' && child.userData.openingId) {
        openMeshes.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(openMeshes, true);
    if (intersects.length > 0) {
      let curr: THREE.Object3D | null = intersects[0].object;
      while (curr && (!curr.userData || !curr.userData.openingId)) {
        curr = curr.parent;
      }
      if (curr && curr.userData.openingId) {
        return {
          openingId: curr.userData.openingId,
          wallId: curr.userData.wallId,
          point: intersects[0].point,
        };
      }
    }
    return null;
  }

  private getIntersectedWall(e: MouseEvent): { wallId: string; point: THREE.Vector3 } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.currentCamera);

    const wallMeshes: THREE.Object3D[] = [];
    this.roomGroup.traverse((child) => {
      if (child.userData && child.userData.type === 'wall' && child.userData.wallId) {
        if (this.mode === '3D' && child.userData.isObstructing) return;
        wallMeshes.push(child);
      }
    });

    const directIntersects = this.raycaster.intersectObjects(wallMeshes, true);
    if (directIntersects.length > 0) {
      let curObj: THREE.Object3D | null = directIntersects[0].object;
      while (curObj && (!curObj.userData || !curObj.userData.wallId)) {
        curObj = curObj.parent;
      }
      if (curObj && curObj.userData && curObj.userData.wallId) {
        return {
          wallId: curObj.userData.wallId,
          point: directIntersects[0].point,
        };
      }
    }

    if (this.mode === '2D' && this.currentRoomData && this.currentRoomData.walls.length > 0) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, hitPoint)) {
        const clickX = hitPoint.x * 1000;
        const clickZ = hitPoint.z * 1000;
        const vMap = buildVertexMap(this.currentRoomData.vertices);

        let bestWallId: string | null = null;
        let minSurfaceDist = 350; // 350 мм комфортная зона захвата стены на 2D-плане

        for (const wall of this.currentRoomData.walls) {
          const v1 = vMap[wall.startVertexId];
          const v2 = vMap[wall.endVertexId];
          if (!v1 || !v2) continue;

          const outNorm = getOutwardWallNormal(wall, vMap, this.currentRoomData.vertices);
          const halfT = wall.thickness / 2;

          // Отрезок центра физической толщины стены
          const c1x = v1.x + outNorm.nx * halfT;
          const c1z = v1.z + outNorm.nz * halfT;
          const c2x = v2.x + outNorm.nx * halfT;
          const c2z = v2.z + outNorm.nz * halfT;

          const resCenter = distancePointToSegment(clickX, clickZ, c1x, c1z, c2x, c2z);
          const resInner = distancePointToSegment(clickX, clickZ, v1.x, v1.z, v2.x, v2.z);

          // Расстояние до поверхности стены (если клик внутри толщины стены, то 0)
          const surfaceDist = Math.min(Math.max(0, resCenter.distance - halfT), resInner.distance);

          if (surfaceDist < minSurfaceDist) {
            minSurfaceDist = surfaceDist;
            bestWallId = wall.id;
          }
        }

        if (bestWallId) {
          return {
            wallId: bestWallId,
            point: hitPoint,
          };
        }
      }
    }

    return null;
  }

  private bindEvents() {
    this.canvas.addEventListener('mousedown', this.boundOnMouseDown);
    this.canvas.addEventListener('dblclick', this.boundOnDblClick);
    window.addEventListener('mousemove', this.boundOnMouseMove);
    window.addEventListener('mouseup', this.boundOnMouseUp);
    this.canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
    this.canvas.addEventListener('auxclick', this.boundOnAuxClick);
    this.canvas.addEventListener('mouseleave', this.boundOnMouseLeave);
    this.canvas.addEventListener('contextmenu', this.boundOnContextMenu);
    window.addEventListener('contextmenu', this.boundOnWindowContextMenu);
  }

  public dispose() {
    this.canvas.removeEventListener('mousedown', this.boundOnMouseDown);
    this.canvas.removeEventListener('dblclick', this.boundOnDblClick);
    window.removeEventListener('mousemove', this.boundOnMouseMove);
    window.removeEventListener('mouseup', this.boundOnMouseUp);
    this.canvas.removeEventListener('wheel', this.boundOnWheel);
    this.canvas.removeEventListener('auxclick', this.boundOnAuxClick);
    this.canvas.removeEventListener('mouseleave', this.boundOnMouseLeave);
    this.canvas.removeEventListener('contextmenu', this.boundOnContextMenu);
    window.removeEventListener('contextmenu', this.boundOnWindowContextMenu);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.scene.environment) {
      this.scene.environment.dispose();
      this.scene.environment = null;
    }
    this.renderer.dispose();
  }

  private onDoubleClick(e: MouseEvent) {
    if (this.mode === '3D') {
      const hit = this.getIntersectedModule(e);
      if (hit) {
        this.callbacks.onToggleModuleDoors?.(hit.moduleId);
      }
    }
  }

  private onContextMenu(e: MouseEvent) {
    e.preventDefault();
    const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (moveDist <= 6) {
      const hit = this.getIntersectedModule(e);
      if (hit) {
        this.callbacks.onSelectModule(hit.moduleId);
        this.callbacks.onOpenModuleMenu?.(hit.moduleId, { x: e.clientX, y: e.clientY });
      }
    }
  }

  private onAuxClick(e: MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
    }
  }

  private onMouseLeave() {
    if (this.hoveredWallId !== null) {
      this.hoveredWallId = null;
      this.updateWallHoverVisuals();
    }
    this.hoveredModuleId = null;
    if (!this.isMouseDown) {
      this.showSuspensionPlane(false);
    }
  }

  private onMouseDown(e: MouseEvent) {
    this.isMouseDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    // СКМ (колёсико мыши) — захват модуля для вызова контекстного меню или панорамирование сцены
    if (e.button === 1) {
      e.preventDefault();
      const hit = this.getIntersectedModule(e);
      this.middleClickModuleId = hit ? hit.moduleId : null;
      this.isPanningCamera = true;
      this.isRotatingCamera = false;
      this.isDraggingModule = false;
      this.isDraggingColumn = false;
      this.draggedModuleId = null;
      this.draggedColumnId = null;
      this.pendingOpeningHit = null;
      this.pendingWallHit = null;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // ПКМ — панорамирование сцены
    if (e.button === 2) {
      this.isPanningCamera = true;
      this.isRotatingCamera = false;
      this.isDraggingModule = false;
      this.isDraggingColumn = false;
      this.draggedModuleId = null;
      this.draggedColumnId = null;
      this.pendingOpeningHit = null;
      this.pendingWallHit = null;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0) {
      // 1. В 2D режиме (редактирование комнаты): наивысший приоритет у стен, колонн и проёмов
      if (this.mode === '2D') {
        const openHit = this.getIntersectedOpening(e);
        const wallHit = this.getIntersectedWall(e) || (this.hoveredWallId ? { wallId: this.hoveredWallId, point: new THREE.Vector3() } : null);
        this.pendingOpeningHit = openHit;
        this.pendingWallHit = wallHit;

        const colHit = this.getIntersectedColumn(e);
        if (colHit) {
          const colObj = this.currentRoomData?.columns.find((c) => c.id === colHit.columnId);
          if (colObj) {
            this.draggedColumnId = colObj.id;
            this.callbacks.onSelectColumn?.(colObj.id);
            this.callbacks.onSelectWall?.(null);
            this.callbacks.onSelectOpening?.(null);
            this.callbacks.onSelectModule(null);

            this.dragPlane.set(new THREE.Vector3(0, 1, 0), 0);
            if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersection)) {
              this.dragOffset.set(
                colObj.x / 1000 - this.dragPlaneIntersection.x,
                0,
                colObj.z / 1000 - this.dragPlaneIntersection.z
              );
            }
            return;
          }
        }

        if (openHit || wallHit) {
          // Клик по стене или проёму в 2D: блокируем панорамирование, готовим чистый клик
          this.isPanningCamera = false;
          this.draggedModuleId = null;
          this.draggedColumnId = null;
          return;
        }

        // Если не стена и не короб, проверяем клик по модулю мебели
        const hit = this.getIntersectedModule(e);
        if (hit) {
          this.draggedModuleId = hit.moduleId;
          this.draggedWallId = null;
          this.dragWallOffsetT = 0;
          this.dragWallOffsetY = 0;
          const modObj = this.currentModules.find((m) => m.id === hit.moduleId);
          if (modObj) {
            const elevation = (modObj.position.y || 0) / 1000;
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -elevation);
            if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersection)) {
              this.dragOffset.set(
                modObj.position.x / 1000 - this.dragPlaneIntersection.x,
                elevation - hit.point.y,
                modObj.position.z / 1000 - this.dragPlaneIntersection.z
              );
            }
          }
          return;
        }

        // Клик по чистому пространству пола: панорамирование плана
        this.isPanningCamera = true;
        return;
      }

      // 2. В 3D режиме: выделяется и перемещается только мебель
      const hit = this.getIntersectedModule(e);
      if (hit) {
        this.draggedModuleId = hit.moduleId;

        const modObj = this.currentModules.find((m) => m.id === hit.moduleId);
        if (modObj) {
          const elevation = (modObj.position.y || 0) / 1000;
          this.dragPlane.set(new THREE.Vector3(0, 1, 0), -elevation);

          if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersection)) {
            this.dragOffset.set(
              modObj.position.x / 1000 - this.dragPlaneIntersection.x,
              elevation - hit.point.y,
              modObj.position.z / 1000 - this.dragPlaneIntersection.z
            );
          }

          // Поиск базовой стены и вычисление смещений перетаскивания в вертикальной плоскости стены
          this.draggedWallId = null;
          this.dragWallOffsetT = 0;
          this.dragWallOffsetY = 0;

          if (this.currentRoomData && this.currentRoomData.walls.length > 0) {
            const vMap = buildVertexMap(this.currentRoomData.vertices);
            let closestWall: any = null;
            let minSurfaceDist = Infinity;

            for (const wall of this.currentRoomData.walls) {
              const v1 = vMap[wall.startVertexId];
              const v2 = vMap[wall.endVertexId];
              if (!v1 || !v2) continue;
              const dx = v2.x - v1.x;
              const dz = v2.z - v1.z;
              const wallLen = Math.hypot(dx, dz);
              if (wallLen < 5) continue;
              const ux = dx / wallLen;
              const uz = dz / wallLen;
              const t = (modObj.position.x - v1.x) * ux + (modObj.position.z - v1.z) * uz;
              const tClamped = Math.max(0, Math.min(wallLen, t));
              const px = v1.x + ux * tClamped;
              const pz = v1.z + uz * tClamped;
              const dist = Math.hypot(modObj.position.x - px, modObj.position.z - pz);
              if (dist < minSurfaceDist) {
                minSurfaceDist = dist;
                closestWall = wall;
              }
            }

            if (closestWall) {
              const v1 = vMap[closestWall.startVertexId];
              const v2 = vMap[closestWall.endVertexId];
              const dx = v2.x - v1.x;
              const dz = v2.z - v1.z;
              const wallLen = Math.hypot(dx, dz);
              const ux = dx / wallLen;
              const uz = dz / wallLen;
              const inwardNormal = getInwardWallNormal(closestWall, vMap, this.currentRoomData.vertices);
              const wallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                new THREE.Vector3(inwardNormal.nx, 0, inwardNormal.nz),
                new THREE.Vector3(v1.x / 1000, 0, v1.z / 1000)
              );

              const hitWall = new THREE.Vector3();
              if (this.raycaster.ray.intersectPlane(wallPlane, hitWall)) {
                const hitX = hitWall.x * 1000;
                const hitY = hitWall.y * 1000;
                const hitZ = hitWall.z * 1000;
                const hitT = (hitX - v1.x) * ux + (hitZ - v1.z) * uz;
                const modT = (modObj.position.x - v1.x) * ux + (modObj.position.z - v1.z) * uz;
                const modY = modObj.position.y || 0;

                this.draggedWallId = closestWall.id;
                this.dragWallOffsetT = modT - hitT;
                this.dragWallOffsetY = modY - hitY;
              }
            }
          }

          if (isUpperModule(modObj)) {
            this.showSuspensionPlane(true);
          }
        }
      } else {
        this.draggedModuleId = null;
        this.draggedColumnId = null;
        this.draggedOpeningId = null;
        this.isRotatingCamera = true;
      }
    }
  }

  private onMouseMove(e: MouseEvent) {
    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);

    if (this.isMouseDown && this.draggedModuleId && moveDist > 5) {
      this.isDraggingModule = true;
    }
    if (this.isMouseDown && this.draggedColumnId && moveDist > 5 && this.mode === '2D') {
      this.isDraggingColumn = true;
    }
    if (
      this.isMouseDown &&
      !this.draggedModuleId &&
      !this.draggedColumnId &&
      !this.isPanningCamera &&
      !this.pendingWallHit &&
      !this.pendingOpeningHit &&
      moveDist > 5
    ) {
      if (this.mode === '3D') {
        this.isRotatingCamera = true;
      } else {
        this.isPanningCamera = true;
      }
    }

    // 1. ПЕРЕМЕЩЕНИЕ ВЕНТКОРОБА / КОЛОННЫ (ТОЛЬКО В 2D РЕЖИМЕ РЕДАКТИРОВАНИЯ КОМНАТЫ)
    if (this.isDraggingColumn && this.draggedColumnId && this.mode === '2D') {
      this.canvas.style.cursor = 'grabbing';

      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.currentCamera);

      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersection)) {
        let targetX = (this.dragPlaneIntersection.x + this.dragOffset.x) * 1000;
        let targetZ = (this.dragPlaneIntersection.z + this.dragOffset.z) * 1000;

        const col = this.currentRoomData?.columns.find((c) => c.id === this.draggedColumnId);
        if (col) {
          const cW = col.width;
          const cD = col.depth;

          // УМНОЕ ПРИМАГНИЧИВАНИЕ И ОГРАНИЧЕНИЕ ВЕНТКОРОБА ПО ВСЕМ СТЕНАМ (включая уступы, ниши и внутренние грани)
          if (this.currentRoomData && this.currentRoomData.walls.length > 0) {
            const vMap = buildVertexMap(this.currentRoomData.vertices);
            const snapped = snapAndClampToWalls(
              targetX,
              targetZ,
              cW,
              cD,
              this.currentRoomData.walls,
              vMap,
              this.currentRoomData.vertices,
              0, // gap = 0 (встык к стенам)
              80,
              col.x,
              col.z
            );
            targetX = snapped.x;
            targetZ = snapped.z;

            // ЖЕСТКИЙ ЗАПРЕТ ВЫХОДА ВЕНТКОРОБА ЗА ПРЕДЕЛЫ КОНТУРА СТЕН (ПОЛИГОН)
            if (this.currentRoomData.vertices.length >= 3) {
              const isInside = isBoxInsideRoom(targetX, targetZ, cW, cD, this.currentRoomData.vertices);
              if (!isInside) {
                // Пробуем скольжение только по X
                if (isBoxInsideRoom(targetX, col.z, cW, cD, this.currentRoomData.vertices)) {
                  targetZ = col.z;
                } else if (isBoxInsideRoom(col.x, targetZ, cW, cD, this.currentRoomData.vertices)) {
                  // Пробуем скольжение только по Z
                  targetX = col.x;
                } else {
                  // Полный блок движения за пределы стен
                  targetX = col.x;
                  targetZ = col.z;
                }
              }
            }
          }

          this.callbacks.onUpdateColumnPosition?.(col.id, Math.round(targetX), Math.round(targetZ));
        }
      }
      return;
    }

    // 2. ПЕРЕМЕЩЕНИЕ МОДУЛЯ МЕБЕЛИ С УЧЕТОМ ВСЕХ СТЕН И ВНУТРЕННИХ ГРАНЕЙ
    if (this.isDraggingModule && this.draggedModuleId) {
      this.canvas.style.cursor = 'grabbing';

      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.currentCamera);

      const currentMod = this.currentModules.find((m) => m.id === this.draggedModuleId);
      if (currentMod) {
        const modW = currentMod.dimensions.width;
        const modH = currentMod.dimensions.height;
        const modD = currentMod.dimensions.depth;

        const WALL_GAP = 2; // 2 мм отступ от стены для сохранения CAD-контура
        const snapThreshold = 100;
        let currentRotation = (currentMod.rotation || 0) % 360;
        let isLockedToWall = false;
        let targetX = currentMod.position.x;
        let targetZ = currentMod.position.z;
        let targetY = currentMod.position.y || 0;

        let closestWall: any = null;
        let wallUx = 0;
        let wallUz = 0;
        let wallNx = 0;
        let wallNz = 0;
        let wallLen = 0;
        let cursorT = 0;
        let v1 = { x: 0, z: 0 };
        const vMap = this.currentRoomData ? buildVertexMap(this.currentRoomData.vertices) : {};

        // 1. В 3D РЕЖИМЕ: ПЕРЕМЕЩЕНИЕ ВДОЛЬ ВЕРТИКАЛЬНОЙ ПЛОСКОСТИ СТЕНЫ (Wall Plane Raycasting)
        // Исключает паразитный горизонтальный дрейф при движении мыши вверх/вниз и вылет в пространство комнаты
        if (this.mode === '3D' && this.currentRoomData && this.currentRoomData.walls.length > 0) {
          const rayDir = this.raycaster.ray.direction;
          interface WallCandidate {
            wall: any;
            hitPt: THREE.Vector3;
            t: number;
            wallLen: number;
            ux: number;
            uz: number;
            inwardNormal: { nx: number; nz: number };
            distToCam: number;
            isInsideWallBounds: boolean;
          }
          const candidates: WallCandidate[] = [];

          for (const wall of this.currentRoomData.walls) {
            const wV1 = vMap[wall.startVertexId];
            const wV2 = vMap[wall.endVertexId];
            if (!wV1 || !wV2) continue;

            const dx = wV2.x - wV1.x;
            const dz = wV2.z - wV1.z;
            const len = Math.hypot(dx, dz);
            if (len < 5) continue;

            const ux = dx / len;
            const uz = dz / len;
            const inwardNormal = getInwardWallNormal(wall, vMap, this.currentRoomData.vertices);

            // Проверяем, обращена ли внутренняя грань стены к лучу камеры
            const dotNorm = rayDir.x * inwardNormal.nx + rayDir.z * inwardNormal.nz;
            if (dotNorm >= -0.05) continue;

            const wallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(inwardNormal.nx, 0, inwardNormal.nz),
              new THREE.Vector3(wV1.x / 1000, 0, wV1.z / 1000)
            );

            const hitPt = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(wallPlane, hitPt)) {
              const hx = hitPt.x * 1000;
              const hz = hitPt.z * 1000;
              const t = (hx - wV1.x) * ux + (hz - wV1.z) * uz;
              const distToCam = this.currentCamera.position.distanceTo(hitPt);
              const isInsideWallBounds = t >= -150 && t <= len + 150;

              candidates.push({
                wall,
                hitPt,
                t,
                wallLen: len,
                ux,
                uz,
                inwardNormal,
                distToCam,
                isInsideWallBounds,
              });
            }
          }

          let bestCand: WallCandidate | null = null;
          if (this.draggedWallId) {
            const curWallCand = candidates.find((c) => c.wall.id === this.draggedWallId);
            if (curWallCand) {
              if (curWallCand.isInsideWallBounds) {
                bestCand = curWallCand;
              } else {
                // Курсор вышел за пределы текущей стены: проверяем смежную стену, куда перешел курсор
                const otherCand = candidates.find((c) => c.wall.id !== this.draggedWallId && c.isInsideWallBounds);
                if (otherCand) {
                  bestCand = otherCand;
                  this.draggedWallId = otherCand.wall.id;
                  this.dragWallOffsetT = 0;
                } else {
                  bestCand = curWallCand;
                }
              }
            }
          }

          if (!bestCand && candidates.length > 0) {
            const inBounds = candidates.filter((c) => c.isInsideWallBounds);
            if (inBounds.length > 0) {
              inBounds.sort((a, b) => a.distToCam - b.distToCam);
              bestCand = inBounds[0];
            } else {
              candidates.sort((a, b) => a.distToCam - b.distToCam);
              bestCand = candidates[0];
            }
            if (bestCand) {
              this.draggedWallId = bestCand.wall.id;
              this.dragWallOffsetT = 0;
            }
          }

          if (bestCand) {
            isLockedToWall = true;
            closestWall = bestCand.wall;
            v1 = vMap[closestWall.startVertexId];
            wallUx = bestCand.ux;
            wallUz = bestCand.uz;
            wallNx = bestCand.inwardNormal.nx;
            wallNz = bestCand.inwardNormal.nz;
            wallLen = bestCand.wallLen;
            cursorT = bestCand.t + this.dragWallOffsetT;

            // Вычисляем угол поворота строго по нормали стены
            const rawAngleRad = Math.atan2(wallNx, wallNz);
            let deg = Math.round(((rawAngleRad * 180) / Math.PI + 360) % 360);
            if (Math.abs(deg - 0) < 5 || Math.abs(deg - 360) < 5) deg = 0;
            else if (Math.abs(deg - 90) < 5) deg = 90;
            else if (Math.abs(deg - 180) < 5) deg = 180;
            else if (Math.abs(deg - 270) < 5) deg = 270;
            currentRotation = deg;

            // Вычисляем целевую высоту targetY для навесных шкафов и антресолей
            if (isUpperModule(currentMod)) {
              const rawElevMm = bestCand.hitPt.y * 1000 + this.dragWallOffsetY;
              targetY = this.computeSnappedUpperY(currentMod, rawElevMm);
            } else {
              targetY = currentMod.position.y || 0;
            }
          }
        }

        // 2. В 2D РЕЖИМЕ (ИЛИ 3D ФОЛБЭК БЕЗ СТЕН): ПЕРЕМЕЩЕНИЕ ПО ПЛОСКОСТИ ПОЛА
        if (!isLockedToWall) {
          if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersection)) {
            targetX = (this.dragPlaneIntersection.x + this.dragOffset.x) * 1000;
            targetZ = (this.dragPlaneIntersection.z + this.dragOffset.z) * 1000;

            if (isUpperModule(currentMod)) {
              const baseElevation = this.projectSettings?.upperBaseStartHeight ?? 1440;
              targetY = Math.max(baseElevation, targetY);
            }

            if (this.currentRoomData && this.currentRoomData.walls.length > 0) {
              const WALL_MAGNET_THRESHOLD = 600;
              let minSurfaceDist = Infinity;
              let bestInwardNormal = { nx: 0, nz: 1 };
              let bestWallProj = { px: 0, pz: 0, t: 0, wallLen: 0, ux: 0, uz: 0 };

              for (const wall of this.currentRoomData.walls) {
                const wV1 = vMap[wall.startVertexId];
                const wV2 = vMap[wall.endVertexId];
                if (!wV1 || !wV2) continue;

                const dx = wV2.x - wV1.x;
                const dz = wV2.z - wV1.z;
                const len = Math.hypot(dx, dz);
                if (len < 5) continue;

                const ux = dx / len;
                const uz = dz / len;

                const t = (targetX - wV1.x) * ux + (targetZ - wV1.z) * uz;
                const tClamped = Math.max(0, Math.min(len, t));
                const px = wV1.x + ux * tClamped;
                const pz = wV1.z + uz * tClamped;

                const dist = Math.hypot(targetX - px, targetZ - pz);
                if (dist < minSurfaceDist) {
                  minSurfaceDist = dist;
                  closestWall = wall;
                  bestInwardNormal = getInwardWallNormal(wall, vMap, this.currentRoomData.vertices);
                  bestWallProj = { px, pz, t, wallLen: len, ux, uz };
                }
              }

              if (closestWall && minSurfaceDist < WALL_MAGNET_THRESHOLD) {
                isLockedToWall = true;
                v1 = vMap[closestWall.startVertexId];
                wallUx = bestWallProj.ux;
                wallUz = bestWallProj.uz;
                wallNx = bestInwardNormal.nx;
                wallNz = bestInwardNormal.nz;
                wallLen = bestWallProj.wallLen;
                cursorT = bestWallProj.t;

                const rawAngleRad = Math.atan2(wallNx, wallNz);
                let deg = Math.round(((rawAngleRad * 180) / Math.PI + 360) % 360);
                if (Math.abs(deg - 0) < 5 || Math.abs(deg - 360) < 5) deg = 0;
                else if (Math.abs(deg - 90) < 5) deg = 90;
                else if (Math.abs(deg - 180) < 5) deg = 180;
                else if (Math.abs(deg - 270) < 5) deg = 270;
                currentRotation = deg;
              }
            }
          }
        }

        if (isLockedToWall && closestWall) {
          // Расстояние центра модуля от внутренней грани стены
          const isBacksplashMod = currentMod.subType === 'backsplash' || currentMod.id.includes('backsplash');
          const effectiveDepth = isBacksplashMod ? (currentMod.dimensions.depth || 4) : modD;
          const distCenter = effectiveDepth / 2 + WALL_GAP;

          // Ограничение смещения вдоль стены с сохранением технологического зазора WALL_GAP от угловых стен
          const clampWallMin = modW / 2 + WALL_GAP;
          const clampWallMax = wallLen - modW / 2 - WALL_GAP;
          let tFinal = Math.max(clampWallMin, Math.min(clampWallMax, cursorT));
          let clampTMin = clampWallMin;
          let clampTMax = clampWallMax;
          let snappedT: number | null = null;
          let bestSnapDist = snapThreshold; // 100 мм

          // Магнитная стыковка к соседям (на этой же стене И на перпендикулярных стенах через виртуальную панель)
          const curBottom = targetY;
          const curTop = targetY + modH;
          for (const other of this.currentModules) {
            if (other.id === this.draggedModuleId) continue;

                const oBottom = other.position.y || 0;
                const oTop = oBottom + other.dimensions.height;
                const isVerticallyOverlapping = (curTop > oBottom + 10) && (curBottom < oTop - 10);

                // Вычисляем угол поворота другого модуля
                const otherRotDeg = ((other.rotation || 0) % 360 + 360) % 360;
                const otherRotRad = (otherRotDeg * Math.PI) / 180;
                const cosR = Math.cos(otherRotRad);
                const sinR = Math.sin(otherRotRad);
                const oHw = other.dimensions.width / 2;
                const oHd = other.dimensions.depth / 2;

                // Точная трансформация локальных координат Three.js (Euler Y) в мировые XZ
                const toWorld = (lx: number, lz: number) => ({
                  x: other.position.x + cosR * lx + sinR * lz,
                  z: other.position.z - sinR * lx + cosR * lz,
                });

                const angleDiff = Math.abs((otherRotDeg - currentRotation) % 180);
                const isPerpendicular = angleDiff === 90;

                const otherIsWallBlind = isWallCornerBlind(other);
                const otherIsBaseBlind = isBaseCornerBlind(other);
                const otherIsBlind = otherIsWallBlind || otherIsBaseBlind;

                const curIsWallBlind = isWallCornerBlind(currentMod);
                const curIsBaseBlind = isBaseCornerBlind(currentMod);
                const curIsBlind = curIsWallBlind || curIsBaseBlind;

                // 1. ВИРТУАЛЬНАЯ ПАНЕЛЬ СТЫКОВКИ (VIRTUAL DOCKING PANEL)
                // Когда приставной шкаф (currentMod) движется по перпендикулярной стене навстречу угловому модулю (other)
                if (otherIsBlind && isPerpendicular) {
                  const isOtherRight = Boolean(other.config?.blindCornerSide === 'right' || other.config?.isMirrored);
                  // Для верхних навесных: глубина каркаса 320 + фасад 18 + планки 32 = 370 мм (вынос 50 мм от каркаса)
                  // Для нижних баз: габарит столешницы 600 мм, добор и упорные планки выходят точно в створ столешницы 600 мм (стык вровень)
                  const plankExtra = otherIsWallBlind ? 50 : 0;
                  const dockLz = oHd + plankExtra;
                  const blindW = otherIsWallBlind ? 320 : (other.config?.blindCornerWidth ?? 600);

                  const lxStart = !isOtherRight ? -oHw : (oHw - blindW);
                  const lxEnd = !isOtherRight ? (-oHw + blindW) : oHw;

                  // Отрезок виртуальной панели привязки в мировых координатах
                  const pStart = toWorld(lxStart, dockLz);
                  const pEnd = toWorld(lxEnd, dockLz);

                  // Проекция виртуальной панели на текущую стену
                  const tStart = (pStart.x - v1.x) * wallUx + (pStart.z - v1.z) * wallUz;
                  const tEnd = (pEnd.x - v1.x) * wallUx + (pEnd.z - v1.z) * wallUz;
                  const tVirtualPanel = (tStart + tEnd) / 2;

                  // Перпендикулярное расстояние виртуальной панели от текущей стены (глубина)
                  const perpStart = (pStart.x - v1.x) * wallNx + (pStart.z - v1.z) * wallNz;
                  const perpEnd = (pEnd.x - v1.x) * wallNx + (pEnd.z - v1.z) * wallNz;
                  const minPerp = Math.min(perpStart, perpEnd);
                  const maxPerp = Math.max(perpStart, perpEnd);

                  // Проверяем, что перемещаемый модуль находится в створе этой виртуальной панели
                  if (maxPerp > 10 && minPerp < modD + 60 && isVerticallyOverlapping) {
                    const otherCenterT = (other.position.x - v1.x) * wallUx + (other.position.z - v1.z) * wallUz;

                    if (otherCenterT > tVirtualPanel) {
                      // Угловой шкаф находится впереди (по направлению +t стены)
                      // Приставной шкаф упирается в виртуальную панель с ближней стороны (t < tVirtualPanel)
                      const dockT = tVirtualPanel - modW / 2;
                      clampTMax = Math.min(clampTMax, dockT);

                      const dist = Math.abs(cursorT - dockT);
                      if (dist < bestSnapDist) {
                        snappedT = dockT;
                        bestSnapDist = dist;
                      }
                    } else {
                      // Угловой шкаф находится позади (по направлению -t стены)
                      // Приставной шкаф упирается в виртуальную панель с дальней стороны (t > tVirtualPanel)
                      const dockT = tVirtualPanel + modW / 2;
                      clampTMin = Math.max(clampTMin, dockT);

                      const dist = Math.abs(cursorT - dockT);
                      if (dist < bestSnapDist) {
                        snappedT = dockT;
                        bestSnapDist = dist;
                      }
                    }
                  }
                  continue;
                }

                // 2. ЕСЛИ САМ ПЕРЕМЕЩАЕМЫЙ МОДУЛЬ — УГЛОВОЙ BLIND, И ДВИЖЕТСЯ В УГОЛ К ПЕРПЕНДИКУЛЯРНОЙ СТЕНЕ
                if (curIsBlind && isPerpendicular) {
                  const isCurRight = Boolean(currentMod.config?.blindCornerSide === 'right' || currentMod.config?.isMirrored);
                  const blindLocalX = isCurRight ? 1 : -1;
                  const curCosR = Math.cos((currentRotation * Math.PI) / 180);
                  const curSinR = Math.sin((currentRotation * Math.PI) / 180);
                  const blindWorldX = curCosR * blindLocalX;
                  const blindWorldZ = -curSinR * blindLocalX;
                  const dotBlind = blindWorldX * wallUx + blindWorldZ * wallUz;

                  // Если глухая зона направлена в сторону угла (начала стены t=0)
                  if (dotBlind < -0.3) {
                    const cornerDockT = modW / 2 + WALL_GAP;
                    const dist = Math.abs(cursorT - cornerDockT);
                    if (dist < bestSnapDist) {
                      snappedT = cornerDockT;
                      bestSnapDist = dist;
                    }
                  } else if (dotBlind > 0.3) {
                    // Глухая зона направлена в сторону конца стены t=wallLen
                    const cornerDockT = wallLen - modW / 2 - WALL_GAP;
                    const dist = Math.abs(cursorT - cornerDockT);
                    if (dist < bestSnapDist) {
                      snappedT = cornerDockT;
                      bestSnapDist = dist;
                    }
                  }
                  continue;
                }

                // 3. СТЫКОВКА ДВУХ СТАНДАРТНЫХ МОДУЛЕЙ НА ПЕРПЕНДИКУЛЯРНЫХ СТЕНАХ В УГЛУ
                if (isPerpendicular && !otherIsBlind && !curIsBlind) {
                  const oCorners = [
                    toWorld(-oHw, -oHd),
                    toWorld(oHw, -oHd),
                    toWorld(oHw, oHd),
                    toWorld(-oHw, oHd),
                  ];
                  const ts = oCorners.map((c) => (c.x - v1.x) * wallUx + (c.z - v1.z) * wallUz);
                  const perps = oCorners.map((c) => (c.x - v1.x) * wallNx + (c.z - v1.z) * wallNz);
                  const minT = Math.min(...ts);
                  const maxT = Math.max(...ts);
                  const minPerp = Math.min(...perps);
                  const maxPerp = Math.max(...perps);

                  if (minPerp < modD + 60 && maxPerp > 10 && isVerticallyOverlapping) {
                    const otherCenterT = (minT + maxT) / 2;
                    if (otherCenterT > cursorT) {
                      const dockT = minT - modW / 2;
                      clampTMax = Math.min(clampTMax, dockT);
                      const dist = Math.abs(cursorT - dockT);
                      if (dist < bestSnapDist) {
                        snappedT = dockT;
                        bestSnapDist = dist;
                      }
                    } else {
                      const dockT = maxT + modW / 2;
                      clampTMin = Math.max(clampTMin, dockT);
                      const dist = Math.abs(cursorT - dockT);
                      if (dist < bestSnapDist) {
                        snappedT = dockT;
                        bestSnapDist = dist;
                      }
                    }
                  }
                  continue;
                }

                // 4. СТЫКОВКА МОДУЛЕЙ НА ОДНОЙ СТЕНЕ (ПАРАЛЛЕЛЬНЫХ)
                if (!isPerpendicular) {
                  const oCorners = [
                    toWorld(-oHw, -oHd),
                    toWorld(oHw, -oHd),
                    toWorld(oHw, oHd),
                    toWorld(-oHw, oHd),
                  ];
                  if (otherIsWallBlind) {
                    const isOtherRight = Boolean(other.config?.blindCornerSide === 'right' || other.config?.isMirrored);
                    if (!isOtherRight) {
                      oCorners.push(toWorld(-oHw, oHd + 50), toWorld(-oHw + 370, oHd + 50));
                    } else {
                      oCorners.push(toWorld(oHw, oHd + 50), toWorld(oHw - 370, oHd + 50));
                    }
                  }
                  const ts = oCorners.map((c) => (c.x - v1.x) * wallUx + (c.z - v1.z) * wallUz);
                  const perps = oCorners.map((c) => (c.x - v1.x) * wallNx + (c.z - v1.z) * wallNz);
                  const minT = Math.min(...ts);
                  const maxT = Math.max(...ts);
                  const minPerp = Math.min(...perps);
                  const maxPerp = Math.max(...perps);

                  if (minPerp < 800 && maxPerp > -100) {
                    const snapBefore = minT - modW / 2;
                    const snapAfter = maxT + modW / 2;
                    const otherCenterT = (minT + maxT) / 2;

                    if (isVerticallyOverlapping) {
                      // ОДИН ЯРУС: блокируем проникновение и примагничиваем к боковинам
                      if (otherCenterT > cursorT) {
                        if (cursorT > minT - modW - 50) {
                          clampTMax = Math.min(clampTMax, snapBefore);
                        }
                        const dist = Math.abs(cursorT - snapBefore);
                        if (dist < bestSnapDist) {
                          snappedT = snapBefore;
                          bestSnapDist = dist;
                        }
                      } else {
                        if (cursorT < maxT + modW + 50) {
                          clampTMin = Math.max(clampTMin, snapAfter);
                        }
                        const dist = Math.abs(cursorT - snapAfter);
                        if (dist < bestSnapDist) {
                          snappedT = snapAfter;
                          bestSnapDist = dist;
                        }
                      }
                    } else {
                      // РАЗНЫЕ ЯРУСЫ (например, антресоль 900 поверх шкафа 500, навесной шкаф над тумбой):
                      // Свободное скольжение без физического заклинивания + явная магнитная привязка:

                      // 1. По левому краю (Left-to-Left: левые грани секций вровень)
                      const snapLeft = minT + modW / 2;
                      const distLeft = Math.abs(cursorT - snapLeft);
                      if (distLeft < bestSnapDist) {
                        snappedT = snapLeft;
                        bestSnapDist = distLeft;
                      }

                      // 2. По правому краю (Right-to-Right: правые грани секций вровень)
                      const snapRight = maxT - modW / 2;
                      const distRight = Math.abs(cursorT - snapRight);
                      if (distRight < bestSnapDist) {
                        snappedT = snapRight;
                        bestSnapDist = distRight;
                      }

                      // 3. По центру секции (соосность / симметрия)
                      const distCenter = Math.abs(cursorT - otherCenterT);
                      if (distCenter < bestSnapDist) {
                        snappedT = otherCenterT;
                        bestSnapDist = distCenter;
                      }

                      // 4. По внешним границам (встык к крайним точкам)
                      const distBefore = Math.abs(cursorT - snapBefore);
                      if (distBefore < bestSnapDist) {
                        snappedT = snapBefore;
                        bestSnapDist = distBefore;
                      }
                      const distAfter = Math.abs(cursorT - snapAfter);
                      if (distAfter < bestSnapDist) {
                        snappedT = snapAfter;
                        bestSnapDist = distAfter;
                      }
                    }
                  }
                }
              }

              // Применяем примагничивание и жесткое ограничение
              if (snappedT !== null) {
                tFinal = snappedT;
              }
              if (clampTMin <= clampTMax) {
                tFinal = Math.max(clampTMin, Math.min(clampTMax, tFinal));
              } else {
                tFinal = Math.max(clampWallMin, Math.min(clampWallMax, tFinal));
              }

              // Позиционируем модуль строго по направлению стены
              const ptX = v1.x + wallUx * tFinal;
              const ptZ = v1.z + wallUz * tFinal;
              targetX = ptX + wallNx * distCenter;
              targetZ = ptZ + wallNz * distCenter;
            } else {
              // Если модуль посреди комнаты: свободное движение с учетом текущего угла
              const isRot90 = currentRotation === 90 || currentRotation === 270;
              const effW = isRot90 ? modD : modW;

              for (const other of this.currentModules) {
                if (other.id === this.draggedModuleId) continue;
                const isSameTier =
                  Math.abs(currentMod.position.y - other.position.y) < 300 ||
                  other.subType === 'tall' ||
                  currentMod.subType === 'tall';

                const isSameRowZ = Math.abs(targetZ - other.position.z) < 180;
                if (isSameTier && isSameRowZ) {
                  const otherRot = (other.rotation || 0) % 360;
                  const otherIsRot90 = otherRot === 90 || otherRot === 270;
                  const otherEffW = otherIsRot90 ? other.dimensions.depth : other.dimensions.width;

                  const snapRight = other.position.x + otherEffW / 2 + effW / 2;
                  const snapLeft = other.position.x - otherEffW / 2 - effW / 2;

                  if (Math.abs(targetX - snapRight) < snapThreshold) {
                    targetX = snapRight;
                    targetZ = other.position.z;
                  } else if (Math.abs(targetX - snapLeft) < snapThreshold) {
                    targetX = snapLeft;
                    targetZ = other.position.z;
                  }
                }
              }
            }

          // Эффективные габариты с учетом актуального поворота
          const isRot90 = currentRotation === 90 || currentRotation === 270;
          const effW = isRot90 ? modD : modW;
          const effD = isRot90 ? modW : modD;

          // УМНОЕ ПРИМАГНИЧИВАНИЕ И ОГРАНИЧЕНИЕ ПО ВСЕМ СТЕНАМ (включая внутренние грани, уступы и ниши)
          if (this.currentRoomData && this.currentRoomData.walls.length > 0) {
            // Примагничивание к стенам вызываем ТОЛЬКО если модуль не привязан к стене (в свободном движении)
            if (!isLockedToWall) {
              const vMap = buildVertexMap(this.currentRoomData.vertices);
              const snapped = snapAndClampToWalls(
                targetX,
                targetZ,
                effW,
                effD,
                this.currentRoomData.walls,
                vMap,
                this.currentRoomData.vertices,
                WALL_GAP,
                snapThreshold,
                currentMod.position.x,
                currentMod.position.z
              );
              targetX = snapped.x;
              targetZ = snapped.z;
            }

            // ЖЕСТКИЙ ЗАПРЕТ ВЫХОДА ЗА КОНТУР СТЕН ПОМЕЩЕНИЯ (ПОЛИГОН)
            if (this.currentRoomData.vertices.length >= 3) {
              const isInside = isBoxInsideRoom(targetX, targetZ, effW, effD, this.currentRoomData.vertices);
              if (!isInside) {
                // Пробуем скольжение только по X
                if (isBoxInsideRoom(targetX, currentMod.position.z, effW, effD, this.currentRoomData.vertices)) {
                  targetZ = currentMod.position.z;
                } else if (isBoxInsideRoom(currentMod.position.x, targetZ, effW, effD, this.currentRoomData.vertices)) {
                  // Пробуем скольжение только по Z
                  targetX = currentMod.position.x;
                } else {
                  // Полный блок движения за пределы стен
                  targetX = currentMod.position.x;
                  targetZ = currentMod.position.z;
                }
              }
            }
          } else if (this.currentRoomConfig) {
            // Фолбэк для простой комнаты без RoomData (только RoomConfig)
            const minX = -this.currentRoomConfig.width / 2;
            const maxX = this.currentRoomConfig.width / 2;
            const minZ = -this.currentRoomConfig.length / 2;
            const maxZ = this.currentRoomConfig.length / 2;
            targetX = Math.max(minX + effW / 2 + WALL_GAP, Math.min(maxX - effW / 2 - WALL_GAP, targetX));
            targetZ = Math.max(minZ + effD / 2 + WALL_GAP, Math.min(maxZ - effD / 2 - WALL_GAP, targetZ));
          }

          // Детекция коллизий с модулями и венткоробами
          const newCollidingIds = new Set<string>();

          for (const other of this.currentModules) {
            if (other.id === this.draggedModuleId) continue;

            const otherRot = (other.rotation || 0) % 360;
            const otherIsRot90 = otherRot === 90 || otherRot === 270;
            const otherEffW = otherIsRot90 ? other.dimensions.depth : other.dimensions.width;
            const otherEffD = otherIsRot90 ? other.dimensions.width : other.dimensions.depth;

            const overlapX = (effW + otherEffW) / 2 - Math.abs(targetX - other.position.x);
            const overlapY =
              (modH + other.dimensions.height) / 2 -
              Math.abs(targetY + modH / 2 - ((other.position.y || 0) + other.dimensions.height / 2));
            const overlapZ = (effD + otherEffD) / 2 - Math.abs(targetZ - other.position.z);

            if (overlapX > 6 && overlapY > 6 && overlapZ > 6) {
              newCollidingIds.add(currentMod.id);
              newCollidingIds.add(other.id);
            }
          }

          // Коллизии и привязка к венткоробам
          if (this.currentRoomData?.columns) {
            for (const col of this.currentRoomData.columns) {
              const cW = col.width;
              const cD = col.depth;

              const snapColDist = 80;
              const colRight = col.x + cW / 2 + effW / 2 + WALL_GAP;
              if (Math.abs(targetX - colRight) < snapColDist && Math.abs(targetZ - col.z) < (effD + cD) / 2) {
                targetX = colRight;
              }
              const colLeft = col.x - cW / 2 - effW / 2 - WALL_GAP;
              if (Math.abs(targetX - colLeft) < snapColDist && Math.abs(targetZ - col.z) < (effD + cD) / 2) {
                targetX = colLeft;
              }
              const colFront = col.z + cD / 2 + effD / 2 + WALL_GAP;
              if (Math.abs(targetZ - colFront) < snapColDist && Math.abs(targetX - col.x) < (effW + cW) / 2) {
                targetZ = colFront;
              }

              const colOverlapX = (effW + cW) / 2 - Math.abs(targetX - col.x);
              const colOverlapZ = (effD + cD) / 2 - Math.abs(targetZ - col.z);
              if (colOverlapX > 6 && colOverlapZ > 6) {
                newCollidingIds.add(currentMod.id);
              }
            }
          }

          // Коллизии с проёмами (двери и окна)
          if (this.currentRoomData?.openings && this.currentRoomData.walls) {
            const vMap = buildVertexMap(this.currentRoomData.vertices);
            for (const op of this.currentRoomData.openings) {
              const wall = this.currentRoomData.walls.find((w) => w.id === op.wallId);
              if (!wall) continue;
              const v1 = vMap[wall.startVertexId];
              const v2 = vMap[wall.endVertexId];
              if (!v1 || !v2) continue;

              const dx = v2.x - v1.x;
              const dz = v2.z - v1.z;
              const len = Math.hypot(dx, dz);
              if (len < 5) continue;

              // Проекция центра модуля на линию стены
              const dirX = dx / len;
              const dirZ = dz / len;
              const proj = (targetX - v1.x) * dirX + (targetZ - v1.z) * dirZ;
              const perpDist = Math.abs((targetX - v1.x) * (-dirZ) + (targetZ - v1.z) * dirX);

              // Если модуль примыкает к стене
              const maxDistToWall = Math.max(effW, effD) / 2 + wall.thickness / 2 + 50;
              if (perpDist < maxDistToWall) {
                const opStart = op.offsetFromStart - op.width / 2;
                const opEnd = op.offsetFromStart + op.width / 2;
                const modHalf = (Math.abs(dirX) > Math.abs(dirZ) ? effW : effD) / 2;
                const modStart = proj - modHalf;
                const modEnd = proj + modHalf;

                // Перекрытие по проекции стены
                const overlap = Math.min(opEnd, modEnd) - Math.max(opStart, modStart);
                if (overlap > 10) {
                  // Для дверей: блокируется любой модуль на полу
                  if (op.type === 'door') {
                    newCollidingIds.add(currentMod.id);
                  } else if (op.type === 'window') {
                    // Для окон: проверяем пересечение по высоте (высокие колонны, навесные шкафы)
                    const modBottom = Math.round(targetY);
                    const modTop = modBottom + modH;
                    const winBottom = op.sillHeight;
                    const winTop = op.sillHeight + op.height;

                    if (modTop > winBottom + 10 && modBottom < winTop - 10) {
                      newCollidingIds.add(currentMod.id);
                    }
                  }
                }
              }
            }
          }

          const wasColliding = this.collidingIds.has(this.draggedModuleId);
          const isCollidingNow = newCollidingIds.has(this.draggedModuleId);
          if (wasColliding !== isCollidingNow || newCollidingIds.size !== this.collidingIds.size) {
            this.collidingIds = newCollidingIds;
            this.updateCollisionVisuals();
          }

          // Мгновенно обновляем Three.js трансформ модуля для 60 FPS плавности
          const draggedGroup = this.modulesGroup.children.find(
            (c) => c.userData && c.userData.moduleId === this.draggedModuleId
          );
          if (draggedGroup) {
            draggedGroup.position.set(targetX / 1000, targetY / 1000, targetZ / 1000);
            draggedGroup.rotation.y = THREE.MathUtils.degToRad(currentRotation);
          }

          currentMod.position.x = Math.round(targetX);
          currentMod.position.y = Math.round(targetY);
          currentMod.position.z = Math.round(targetZ);
          currentMod.rotation = currentRotation;
        }
        return;
      }

    // 3. ВРАЩЕНИЕ КАМЕРЫ (ТОЛЬКО В 3D И ЕСЛИ НЕ ПАНОРАМИРУЕМ)
    if (this.isRotatingCamera && !this.isPanningCamera && this.mode === '3D') {
      this.canvas.style.cursor = 'grabbing';
      this.targetSpherical.theta -= deltaX * 0.0055;
      this.targetSpherical.phi -= deltaY * 0.0055;
      this.targetSpherical.phi = Math.max(0.05, Math.min(Math.PI / 2 + 0.45, this.targetSpherical.phi));
      return;
    }

    // 4. ПАНОРАМИРОВАНИЕ КАМЕРЫ (ЗАХВАТ СЦЕНЫ И ПЕРЕТАСКИВАНИЕ)
    if (this.isPanningCamera) {
      this.canvas.style.cursor = 'grabbing';
      if (this.mode === '3D') {
        const rect = this.canvas.getBoundingClientRect();
        this.camera3D.updateMatrixWorld();
        const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera3D.matrixWorld, 0).normalize();
        const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera3D.matrixWorld, 1).normalize();
        const factor =
          (2 * Math.tan(THREE.MathUtils.degToRad(this.camera3D.fov / 2)) * this.spherical.radius) /
          (rect.height || 1);
        this.cameraTarget.addScaledVector(camRight, -deltaX * factor);
        this.cameraTarget.addScaledVector(camUp, deltaY * factor);
        this.update3DCameraTransform();
      } else {
        const rect = this.canvas.getBoundingClientRect();
        const aspect = rect.width / (rect.height || 1);
        const frustumH = 5.5 / this.camera2D.zoom;
        const frustumW = frustumH * aspect;
        this.camera2D.position.x -= (deltaX / rect.width) * frustumW;
        this.camera2D.position.z -= (deltaY / rect.height) * frustumH;
      }
      return;
    }

    // 5. ПОДСВЕТКА И КУРСОР ПРИ НАВЕДЕНИИ
    if (!this.isMouseDown) {
      if (this.mode === '2D') {
        // В 2D режиме (редактирование комнаты): наивысший приоритет у проёмов, коробов и стен!
        const openHit = this.getIntersectedOpening(e);
        const colHit = this.getIntersectedColumn(e);
        const wallHit = !openHit && !colHit ? this.getIntersectedWall(e) : null;
        const modHit = !openHit && !colHit && !wallHit ? this.getIntersectedModule(e) : null;

        const nextHoveredWallId = wallHit ? wallHit.wallId : null;
        if (nextHoveredWallId !== this.hoveredWallId) {
          this.hoveredWallId = nextHoveredWallId;
          this.updateWallHoverVisuals();
        }

        this.hoveredModuleId = modHit ? modHit.moduleId : null;
        this.canvas.style.cursor = openHit || colHit || wallHit || modHit ? 'pointer' : 'grab';
      } else {
        // В 3D режиме: стены вообще не подсвечиваются и не выделяются при наведении
        if (this.hoveredWallId !== null) {
          this.hoveredWallId = null;
          this.updateWallHoverVisuals();
        }
        const modHit = this.getIntersectedModule(e);
        this.hoveredModuleId = modHit ? modHit.moduleId : null;
        this.canvas.style.cursor = modHit ? 'pointer' : 'grab';
      }
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 1) {
      this.isPanningCamera = false;
      this.isMouseDown = false;
      this.draggedWallId = null;
      this.dragWallOffsetT = 0;
      this.dragWallOffsetY = 0;
      this.showSuspensionPlane(false);
      this.canvas.style.cursor = this.hoveredModuleId || this.hoveredWallId ? 'pointer' : 'grab';
      const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (moveDist <= 6) {
        // Клик колёсиком мыши по модулю (без перемещения сцены)
        const hit = this.middleClickModuleId
          ? { moduleId: this.middleClickModuleId }
          : this.getIntersectedModule(e);
        if (hit) {
          this.callbacks.onSelectModule(hit.moduleId);
          this.callbacks.onOpenModuleMenu?.(hit.moduleId, { x: e.clientX, y: e.clientY });
        }
      }
      this.middleClickModuleId = null;
      return;
    }

    if (e.button === 2) {
      this.isPanningCamera = false;
      this.isMouseDown = false;
      this.draggedWallId = null;
      this.dragWallOffsetT = 0;
      this.dragWallOffsetY = 0;
      this.showSuspensionPlane(false);
      this.canvas.style.cursor = this.hoveredModuleId || this.hoveredWallId ? 'pointer' : 'grab';
      return;
    }

    const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);

    if (e.button === 0) {
      if (this.mode === '2D') {
        // ТОЛЬКО ВО ВКЛАДКЕ "КОМНАТА" (2D) РАЗРЕШЕНО ВЫДЕЛЯТЬ И НАСТРАИВАТЬ СТЕНЫ, КОЛОННЫ И ПРОЁМЫ
        const isClick = moveDist <= 30 || Boolean(this.pendingWallHit) || Boolean(this.pendingOpeningHit);
        if (isClick && !this.isDraggingColumn && !this.isDraggingModule) {
          const openHit = this.pendingOpeningHit || this.getIntersectedOpening(e);
          if (openHit) {
            this.callbacks.onSelectOpening?.(openHit.openingId);
            this.callbacks.onSelectWall?.(openHit.wallId);
            this.callbacks.onSelectModule(null);
            this.callbacks.onSelectColumn?.(null);
          } else {
            const colHit = this.getIntersectedColumn(e);
            if (colHit) {
              this.callbacks.onSelectColumn?.(colHit.columnId);
              this.callbacks.onSelectWall?.(null);
              this.callbacks.onSelectOpening?.(null);
              this.callbacks.onSelectModule(null);
            } else {
              const wallHit = this.pendingWallHit || this.getIntersectedWall(e) || (this.hoveredWallId ? { wallId: this.hoveredWallId, point: new THREE.Vector3() } : null);
              if (wallHit) {
                this.callbacks.onSelectWall?.(wallHit.wallId);
                this.callbacks.onSelectModule(null);
              } else {
                const hit = this.getIntersectedModule(e);
                if (hit) {
                  this.callbacks.onSelectModule(hit.moduleId);
                  this.callbacks.onSelectWall?.(null);
                  this.callbacks.onSelectColumn?.(null);
                  this.callbacks.onSelectOpening?.(null);
                } else if (moveDist <= 8) {
                  this.callbacks.onSelectModule(null);
                  this.callbacks.onSelectColumn?.(null);
                  this.callbacks.onSelectOpening?.(null);
                  // При клике на чистое пространство пола не сбрасываем выбранную стену
                }
              }
            }
          }
        }
      } else {
        // В РЕЖИМЕ 3D: стены вообще не выбираются, выбираются только модули мебели
        const isClick = moveDist <= 25;
        if (isClick && !this.isDraggingModule) {
          const hit = this.getIntersectedModule(e);
          if (hit) {
            this.callbacks.onSelectModule(hit.moduleId);
            this.callbacks.onSelectWall?.(null);
            this.callbacks.onSelectColumn?.(null);
            this.callbacks.onSelectOpening?.(null);
          } else if (moveDist <= 8) {
            this.callbacks.onSelectModule(null);
          }
        }
      }
    }

    this.pendingWallHit = null;
    this.pendingOpeningHit = null;

    // Завершение перетаскивания (сохраняем итоговую позицию и снимок в историю)
    if (this.isDraggingModule && this.draggedModuleId) {
      const draggedMod = this.currentModules.find((m) => m.id === this.draggedModuleId);
      if (draggedMod) {
        this.callbacks.onUpdatePosition(
          this.draggedModuleId,
          {
            x: Math.round(draggedMod.position.x),
            y: Math.round(draggedMod.position.y || 0),
            z: Math.round(draggedMod.position.z),
          },
          draggedMod.rotation
        );
      }
      this.callbacks.onDragEnd?.();
    } else if (this.isDraggingColumn) {
      this.callbacks.onDragEnd?.();
    }

    this.isMouseDown = false;
    this.isDraggingModule = false;
    this.isDraggingColumn = false;
    this.draggedModuleId = null;
    this.draggedColumnId = null;
    this.draggedWallId = null;
    this.dragWallOffsetT = 0;
    this.dragWallOffsetY = 0;
    this.isRotatingCamera = false;
    this.isPanningCamera = false;
    this.showSuspensionPlane(false);
    this.canvas.style.cursor = this.hoveredModuleId || this.hoveredWallId ? 'pointer' : 'grab';
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    if (this.mode === '3D') {
      this.targetSpherical.radius += e.deltaY * 0.0035;
      this.targetSpherical.radius = Math.max(1.5, Math.min(15, this.targetSpherical.radius));
    } else {
      this.camera2D.zoom -= e.deltaY * 0.001;
      this.camera2D.zoom = Math.max(0.5, Math.min(3.0, this.camera2D.zoom));
      this.camera2D.updateProjectionMatrix();
    }
  }

  public captureScreenshot(): string {
    this.renderer.render(this.scene, this.currentCamera);
    return this.canvas.toDataURL('image/jpeg', 0.94);
  }

  public resetCameraView(view: 'iso' | 'top' | 'front') {
    if (view === 'top') {
      this.setMode('2D');
      this.camera2D.position.set(0, 10, 0);
      this.camera2D.zoom = 1;
      this.camera2D.updateProjectionMatrix();
    } else if (view === 'front') {
      this.setMode('3D');
      this.spherical.set(4.5, Math.PI / 2.05, 0);
      this.targetSpherical.set(4.5, Math.PI / 2.05, 0);
      this.cameraTarget.set(0, 0.9, 0);
      this.update3DCameraTransform();
    } else {
      this.setMode('3D');
      this.spherical.set(4.8, Math.PI / 3.4, Math.PI / 4);
      this.targetSpherical.set(4.8, Math.PI / 3.4, Math.PI / 4);
      this.cameraTarget.set(0, 0.9, 0);
      this.update3DCameraTransform();
    }
  }

  private updateAnimations() {
    if (!this.currentModules || this.currentModules.length === 0) return;

    for (const mod of this.currentModules) {
      const target = mod.config.isOpen ? 1.0 : 0.0;
      const current = this.moduleOpenProgress.get(mod.id) ?? target;

      if (Math.abs(current - target) > 0.001) {
        // Коэффициент 0.12 дает плавный переход ~300-350 мс при 60 FPS (как TWEEN easeOut в Brosko)
        const next = THREE.MathUtils.lerp(current, target, 0.12);
        this.moduleOpenProgress.set(mod.id, next);
        this.applyModuleAnimation(mod.id, next);
      } else if (current !== target) {
        this.moduleOpenProgress.set(mod.id, target);
        this.applyModuleAnimation(mod.id, target);
      }
    }
  }

  private applyModuleAnimation(moduleId: string, progress: number) {
    const modGroup = this.modulesGroup.getObjectByName(`module_${moduleId}`);
    if (!modGroup) return;

    modGroup.traverse((child) => {
      if (child.userData?.isDoorPivot && typeof child.userData.maxOpenAngle === 'number') {
        child.rotation.y = child.userData.maxOpenAngle * progress;
      } else if (
        child.userData?.isLiftDoor &&
        typeof child.userData.maxOpenAngle === 'number'
      ) {
        child.rotation.x = child.userData.maxOpenAngle * progress;
      } else if (
        child.userData?.isAventosFold &&
        typeof child.userData.foldAngle === 'number'
      ) {
        child.rotation.x = child.userData.foldAngle * progress;
      } else if (
        child.userData?.isDrawerSlide &&
        typeof child.userData.basePosZ === 'number' &&
        typeof child.userData.maxSlideDistance === 'number'
      ) {
        child.position.z = child.userData.basePosZ + child.userData.maxSlideDistance * progress;
      }
    });
  }

  private render() {
    this.animationFrameId = requestAnimationFrame(this.render.bind(this));

    // Плавное кинематографическое вращение и зум камеры (Smooth Damping) в 3D
    if (this.mode === '3D') {
      const damping = 0.22;
      const dTheta = this.targetSpherical.theta - this.spherical.theta;
      const dPhi = this.targetSpherical.phi - this.spherical.phi;
      const dRadius = this.targetSpherical.radius - this.spherical.radius;

      if (Math.abs(dTheta) > 0.0001 || Math.abs(dPhi) > 0.0001 || Math.abs(dRadius) > 0.0001) {
        this.spherical.theta += dTheta * damping;
        this.spherical.phi += dPhi * damping;
        this.spherical.radius += dRadius * damping;
        this.update3DCameraTransform();
      }
    }

    this.updateAnimations();
    this.renderer.render(this.scene, this.currentCamera);
  }
}
