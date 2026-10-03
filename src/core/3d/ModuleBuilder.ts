import * as THREE from 'three';
import { FurnitureModule, ProjectSettings, DEFAULT_PROJECT_SETTINGS } from '../../types';
import { getThreeMaterial } from './materials';
import { evaluatePartGeometry } from '../../utils/sectionEditorEngine';

export class ModuleBuilder {
  private static edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x1e293b,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -4.0,
  });

  private static highlightEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0x3b82f6,
    linewidth: 2,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -4.0,
  });

  // Красный контур для предупреждения о коллизии (пересечении шкафов)
  private static collisionEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0xef4444,
    linewidth: 3,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -4.0,
  });

  // CAD-контур для режима "Рентген" (контуры мебели для просмотра розеток и труб)
  private static wireframeEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0x0284c7,
    linewidth: 1.5,
    transparent: false,
    opacity: 1.0,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -4.0,
  });

  /**
   * Добавляет четкие CAD-контуры (EdgesGeometry) к объекту
   */
  public static addEdges(mesh: THREE.Mesh, isSelected: boolean = false, isColliding: boolean = false, isWireframe: boolean = false): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
    let mat = this.edgeMaterial;
    if (isColliding) {
      mat = this.collisionEdgeMaterial;
    } else if (isSelected) {
      mat = this.highlightEdgeMaterial;
    } else if (isWireframe) {
      mat = this.wireframeEdgeMaterial;
    }

    const line = new THREE.LineSegments(edges, mat);
    line.raycast = () => {};
    mesh.add(line);
    return line;
  }

  /**
   * 3D-плашка с размером в мм над шкафом
   */
  private static createDimensionSprite(text: string, isColliding: boolean = false): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    const width = canvas.width;
    ctx.fillStyle = isColliding ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect(10, 10, width - 20, 60, 12);
    ctx.fill();
    ctx.strokeStyle = isColliding ? '#fca5a5' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = 'bold 28px monospace, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = isColliding ? `⚠️ ${text} мм` : `${text} мм`;
    ctx.fillText(label, width / 2, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.4, 0.125, 1);
    sprite.name = 'dimension_sprite';
    sprite.userData = { isDimensionSprite: true };
    sprite.raycast = () => {};
    return sprite;
  }

  private static createHobMesh(): THREE.Group {
    const hobGroup = new THREE.Group();
    const w = 0.59;
    const d = 0.52;
    const h = 0.006;

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const glassGeo = new THREE.BoxGeometry(w, h, d);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.y = h / 2;
    hobGroup.add(glassMesh);

    const borderMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const bGeo = new THREE.BoxGeometry(w + 0.008, 0.004, d + 0.008);
    const bMesh = new THREE.Mesh(bGeo, borderMat);
    bMesh.position.y = 0.002;
    hobGroup.add(bMesh);

    const burnerMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.5,
    });
    const burners = [
      { x: -0.15, z: -0.12, r: 0.09 },
      { x: 0.15, z: -0.11, r: 0.11 },
      { x: -0.15, z: 0.13, r: 0.08 },
      { x: 0.15, z: 0.13, r: 0.08 },
    ];
    burners.forEach((b) => {
      const bGeo = new THREE.CylinderGeometry(b.r, b.r, 0.001, 32);
      const bMesh = new THREE.Mesh(bGeo, burnerMat);
      bMesh.position.set(b.x, h + 0.0005, b.z);
      hobGroup.add(bMesh);
    });

    return hobGroup;
  }

  private static createSinkMesh(): THREE.Group {
    const sinkGroup = new THREE.Group();
    const w = 0.56;
    const d = 0.48;

    const sinkMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.4,
      metalness: 0.1,
    });

    const rimGeo = new THREE.BoxGeometry(w, 0.008, d);
    const rimMesh = new THREE.Mesh(rimGeo, sinkMat);
    rimMesh.position.y = 0.004;
    sinkGroup.add(rimMesh);

    const bowlGeo = new THREE.BoxGeometry(w - 0.1, 0.015, d - 0.12);
    const bowlMesh = new THREE.Mesh(bowlGeo, sinkMat);
    bowlMesh.position.set(0, -0.005, 0.02);
    sinkGroup.add(bowlMesh);

    const faucetMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.2,
      metalness: 0.85,
    });
    const faucetGroup = new THREE.Group();
    faucetGroup.position.set(0, 0.004, -d / 2 + 0.06);

    const baseGeo = new THREE.CylinderGeometry(0.022, 0.025, 0.04, 24);
    const baseMesh = new THREE.Mesh(baseGeo, faucetMat);
    baseMesh.position.y = 0.02;
    faucetGroup.add(baseMesh);

    const neckGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 24);
    const neckMesh = new THREE.Mesh(neckGeo, faucetMat);
    neckMesh.position.y = 0.14;
    faucetGroup.add(neckMesh);

    const spoutGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.14, 24);
    const spoutMesh = new THREE.Mesh(spoutGeo, faucetMat);
    spoutMesh.rotation.x = Math.PI / 2;
    spoutMesh.position.set(0, 0.25, 0.07);
    faucetGroup.add(spoutMesh);

    sinkGroup.add(faucetGroup);
    return sinkGroup;
  }

  /**
   * Реалистичный встроенный духовой шкаф (Oven)
   */
  private static createOvenMesh(width: number, height: number, depth: number): THREE.Group {
    const ovenGroup = new THREE.Group();
    // Внутренний корпус
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.4 });
    const bodyGeo = new THREE.BoxGeometry(width - 0.01, height - 0.01, depth);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, 0, -depth / 2);
    ovenGroup.add(bodyMesh);

    // Лицевая панель из закаленного черного стекла
    const frontMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.85 });
    const frontGeo = new THREE.BoxGeometry(width, height, 0.018);
    const frontMesh = new THREE.Mesh(frontGeo, frontMat);
    frontMesh.position.set(0, 0, 0.009);
    ovenGroup.add(frontMesh);

    // Окно смотровое с легким тонированием
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.15,
      metalness: 0.9,
    });
    const winGeo = new THREE.BoxGeometry(width * 0.72, height * 0.48, 0.02);
    const winMesh = new THREE.Mesh(winGeo, windowMat);
    winMesh.position.set(0, -height * 0.08, 0.01);
    ovenGroup.add(winMesh);

    // Ручка духового шкафа (горизонтальный нержавеющий рейлинг)
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
    const barGeo = new THREE.CylinderGeometry(0.007, 0.007, width * 0.65, 16);
    const barMesh = new THREE.Mesh(barGeo, handleMat);
    barMesh.rotation.z = Math.PI / 2;
    barMesh.position.set(0, height * 0.22, 0.04);
    ovenGroup.add(barMesh);

    // Кронштейны ручки
    [-width * 0.28, width * 0.28].forEach((x) => {
      const standGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.03, 12);
      const standMesh = new THREE.Mesh(standGeo, handleMat);
      standMesh.rotation.x = Math.PI / 2;
      standMesh.position.set(x, height * 0.22, 0.025);
      ovenGroup.add(standMesh);
    });

    // Панель управления: 2 поворотные ручки-регулятора
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.3 });
    [-width * 0.32, width * 0.32].forEach((x) => {
      const knobGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 20);
      const knobMesh = new THREE.Mesh(knobGeo, knobMat);
      knobMesh.rotation.x = Math.PI / 2;
      knobMesh.position.set(x, height * 0.38, 0.022);
      ovenGroup.add(knobMesh);
    });

    // Цифровой LED-дисплей таймера по центру
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const screenGeo = new THREE.BoxGeometry(width * 0.2, 0.03, 0.002);
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, height * 0.38, 0.02);
    ovenGroup.add(screenMesh);

    return ovenGroup;
  }

  /**
   * 2-уровневая металлическая корзина бутылочницы карго (хром)
   */
  private static createCargoBasketMesh(width: number, height: number, depth: number): THREE.Group {
    const cargoGroup = new THREE.Group();
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.15,
    });

    const w = width - 0.04;
    const d = depth - 0.04;

    // 2 яруса: нижний и верхний
    const tierYs = [0.05, height * 0.52];

    tierYs.forEach((y) => {
      const shelfGeo = new THREE.BoxGeometry(w, 0.005, d);
      const shelfMesh = new THREE.Mesh(shelfGeo, chromeMat);
      shelfMesh.position.set(0, y, -d / 2);
      cargoGroup.add(shelfMesh);

      const fenceH = 0.07;
      const fGeo = new THREE.BoxGeometry(w, 0.004, 0.004);
      const fMesh = new THREE.Mesh(fGeo, chromeMat);
      fMesh.position.set(0, y + fenceH, -0.005);
      cargoGroup.add(fMesh);

      const bMesh = new THREE.Mesh(fGeo, chromeMat);
      bMesh.position.set(0, y + fenceH, -d + 0.005);
      cargoGroup.add(bMesh);

      const sGeo = new THREE.BoxGeometry(0.004, 0.004, d);
      const slMesh = new THREE.Mesh(sGeo, chromeMat);
      slMesh.position.set(-w / 2 + 0.002, y + fenceH, -d / 2);
      cargoGroup.add(slMesh);
      const srMesh = new THREE.Mesh(sGeo, chromeMat);
      srMesh.position.set(w / 2 - 0.002, y + fenceH, -d / 2);
      cargoGroup.add(srMesh);
    });

    // Вертикальные стойки
    const rodGeo = new THREE.CylinderGeometry(0.004, 0.004, height * 0.85, 12);
    [-w / 2 + 0.005, w / 2 - 0.005].forEach((x) => {
      const rodF = new THREE.Mesh(rodGeo, chromeMat);
      rodF.position.set(x, height * 0.45, -0.02);
      cargoGroup.add(rodF);

      const rodB = new THREE.Mesh(rodGeo, chromeMat);
      rodB.position.set(x, height * 0.45, -d + 0.02);
      cargoGroup.add(rodB);
    });

    // Нижние направляющие скрытого монтажа
    const runnerMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    const runnerGeo = new THREE.BoxGeometry(0.02, 0.025, d);
    const runnerMesh = new THREE.Mesh(runnerGeo, runnerMat);
    runnerMesh.position.set(0, 0.015, -d / 2);
    cargoGroup.add(runnerMesh);

    return cargoGroup;
  }

  /**
   * Корпус встраиваемой посудомоечной машины (ПММ)
   */
  private static createDishwasherMesh(width: number, height: number, depth: number): THREE.Group {
    const pmmGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const bodyGeo = new THREE.BoxGeometry(width - 0.01, height - 0.01, depth - 0.02);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, height / 2, -depth / 2);
    pmmGroup.add(bodyMesh);

    // Верхняя панель управления из нержавеющей стали
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
    const panelGeo = new THREE.BoxGeometry(width - 0.004, 0.04, 0.02);
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    panelMesh.position.set(0, height - 0.02, 0.01);
    pmmGroup.add(panelMesh);

    // Светодиодный индикатор работы (зеленый)
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const ledGeo = new THREE.SphereGeometry(0.003, 12, 12);
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.position.set(width * 0.35, height - 0.02, 0.021);
    pmmGroup.add(ledMesh);

    return pmmGroup;
  }

  /**
   * 2-уровневая хромированная сушка для посуды (сетка для чашек + поддон + стойка для тарелок)
   */
  private static createDishRackMesh(w: number, d: number, h: number): THREE.Group {
    const rackGroup = new THREE.Group();
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.15,
    });
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
      metalness: 0.1,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.05,
    });

    const innerW = w - 0.02;
    const innerD = d - 0.03;

    // 1) Нижний ярус: пластиковый белый поддон для капель воды
    const trayGeo = new THREE.BoxGeometry(innerW, 0.012, innerD);
    const trayMesh = new THREE.Mesh(trayGeo, trayMat);
    trayMesh.position.set(0, 0.02, -innerD / 2);
    rackGroup.add(trayMesh);

    // 2) Нижняя решетка для кружек и стаканов
    const lowerWireY = 0.045;
    const lFrameGeo = new THREE.BoxGeometry(innerW, 0.005, 0.005);
    const lFront = new THREE.Mesh(lFrameGeo, chromeMat);
    lFront.position.set(0, lowerWireY, -0.01);
    rackGroup.add(lFront);
    const lBack = new THREE.Mesh(lFrameGeo, chromeMat);
    lBack.position.set(0, lowerWireY, -innerD + 0.01);
    rackGroup.add(lBack);

    const numRods = Math.max(6, Math.floor(innerW / 0.04));
    const rodSpacing = innerW / (numRods + 1);
    const rodGeo = new THREE.BoxGeometry(0.003, 0.003, innerD - 0.02);
    for (let i = 1; i <= numRods; i++) {
      const rod = new THREE.Mesh(rodGeo, chromeMat);
      rod.position.set(-innerW / 2 + i * rodSpacing, lowerWireY, -innerD / 2);
      rackGroup.add(rod);
    }

    // 3) Верхний ярус: решетка для тарелок с вертикальными дугами
    const upperY = Math.max(0.28, h * 0.48);
    const uFront = new THREE.Mesh(lFrameGeo, chromeMat);
    uFront.position.set(0, upperY, -0.01);
    rackGroup.add(uFront);
    const uBack = new THREE.Mesh(lFrameGeo, chromeMat);
    uBack.position.set(0, upperY, -innerD + 0.01);
    rackGroup.add(uBack);

    const plateCount = Math.max(5, Math.floor(innerW / 0.035));
    const plateSpacing = innerW / (plateCount + 1);
    const plateRadius = Math.min(0.095, (innerD - 0.04) / 2);

    for (let p = 1; p <= plateCount; p++) {
      const x = -innerW / 2 + p * plateSpacing;
      const arcGeo = new THREE.CylinderGeometry(0.0025, 0.0025, plateRadius * 1.6, 8);
      const arcMesh = new THREE.Mesh(arcGeo, chromeMat);
      arcMesh.position.set(x, upperY + plateRadius * 0.8, -innerD / 2);
      rackGroup.add(arcMesh);

      if (p % 2 === 1) {
        const pGeo = new THREE.CylinderGeometry(plateRadius, plateRadius * 0.6, 0.012, 24);
        const pMesh = new THREE.Mesh(pGeo, plateMat);
        pMesh.rotation.z = Math.PI / 2;
        pMesh.position.set(x, upperY + plateRadius + 0.01, -innerD / 2);
        rackGroup.add(pMesh);
      }
    }

    // Боковые держатели
    const sideProfGeo = new THREE.BoxGeometry(0.012, h * 0.75, 0.02);
    [-innerW / 2 - 0.004, innerW / 2 + 0.004].forEach((sx) => {
      const spF = new THREE.Mesh(sideProfGeo, chromeMat);
      spF.position.set(sx, h * 0.45, -0.02);
      rackGroup.add(spF);
      const spB = new THREE.Mesh(sideProfGeo, chromeMat);
      spB.position.set(sx, h * 0.45, -innerD + 0.02);
      rackGroup.add(spB);
    });

    return rackGroup;
  }

  /**
   * Полновстраиваемая кухонная вытяжка (нижний корпус с фильтром, подсветкой и вентиляционным каналом)
   */
  private static createBuiltinHoodMesh(w: number, d: number, h: number): THREE.Group {
    const hoodGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
    });
    const filterMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.4,
    });
    const motorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.5,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });

    const hoodW = Math.min(w - 0.04, 0.52);
    const hoodD = Math.min(d - 0.04, 0.28);
    const hoodH = 0.16;

    // Нижняя панель с фильтром
    const panelGeo = new THREE.BoxGeometry(hoodW, 0.008, hoodD);
    const panelMesh = new THREE.Mesh(panelGeo, steelMat);
    panelMesh.position.set(0, 0.004, -d / 2);
    hoodGroup.add(panelMesh);

    // Сетчатый фильтр
    const filterGeo = new THREE.BoxGeometry(hoodW * 0.75, 0.005, hoodD * 0.72);
    const filterMesh = new THREE.Mesh(filterGeo, filterMat);
    filterMesh.position.set(0, 0.001, -d / 2);
    hoodGroup.add(filterMesh);

    // Точечные LED светильники
    [-hoodW * 0.32, hoodW * 0.32].forEach((lx) => {
      const spotGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.004, 16);
      const spotMesh = new THREE.Mesh(spotGeo, lightMat);
      spotMesh.position.set(lx, 0.001, -d / 2);
      hoodGroup.add(spotMesh);
    });

    // Металлический короб мотора
    const motorGeo = new THREE.BoxGeometry(hoodW * 0.65, hoodH, hoodD * 0.75);
    const motorMesh = new THREE.Mesh(motorGeo, motorMat);
    motorMesh.position.set(0, hoodH / 2, -d / 2);
    hoodGroup.add(motorMesh);

    // Вертикальный воздуховод Ø130 мм
    const ductRadius = 0.065;
    const ductHeight = Math.max(0.1, h - hoodH);
    const ductGeo = new THREE.CylinderGeometry(ductRadius, ductRadius, ductHeight, 24);
    const ductMesh = new THREE.Mesh(ductGeo, steelMat);
    ductMesh.position.set(0, hoodH + ductHeight / 2, -d / 2);
    hoodGroup.add(ductMesh);

    return hoodGroup;
  }

  /**
   * Встраиваемая или настольная микроволновая печь (СВЧ)
   */
  private static createMicrowaveMesh(w: number, d: number, h: number): THREE.Group {
    const mwGroup = new THREE.Group();
    const mwW = w - 0.02;
    const mwH = h - 0.02;
    const mwD = d - 0.02;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    const bodyGeo = new THREE.BoxGeometry(mwW, mwH, mwD);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, mwH / 2, -mwD / 2);
    mwGroup.add(bodyMesh);

    const doorW = mwW * 0.72;
    const doorGeo = new THREE.BoxGeometry(doorW, mwH * 0.88, 0.012);
    const doorMesh = new THREE.Mesh(doorGeo, glassMat);
    doorMesh.position.set(-mwW / 2 + doorW / 2 + 0.01, mwH / 2, 0.006);
    mwGroup.add(doorMesh);

    const hBarGeo = new THREE.CylinderGeometry(0.006, 0.006, mwH * 0.6, 12);
    const hBar = new THREE.Mesh(hBarGeo, chromeMat);
    hBar.position.set(-mwW / 2 + doorW - 0.02, mwH / 2, 0.025);
    mwGroup.add(hBar);

    const ctrlW = mwW - doorW - 0.03;
    const ctrlX = mwW / 2 - ctrlW / 2 - 0.01;

    const dispGeo = new THREE.BoxGeometry(ctrlW * 0.8, 0.024, 0.002);
    const dispMesh = new THREE.Mesh(dispGeo, screenMat);
    dispMesh.position.set(ctrlX, mwH * 0.78, 0.006);
    mwGroup.add(dispMesh);

    const knobGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 20);
    const knobMesh = new THREE.Mesh(knobGeo, chromeMat);
    knobMesh.rotation.x = Math.PI / 2;
    knobMesh.position.set(ctrlX, mwH * 0.42, 0.01);
    mwGroup.add(knobMesh);

    return mwGroup;
  }

  /**
   * Металлический ящик Tandembox (боковины, дно, задняя стенка и продольные рейлинги для глубоких ящиков)
   */
  private static createTandemboxMesh(w: number, h: number, d: number, hasRailing: boolean = false): THREE.Group {
    const boxGroup = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // slate-600 антрацит
      roughness: 0.35,
      metalness: 0.6,
    });
    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // светлое дно ящика
      roughness: 0.7,
      metalness: 0.05,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.2,
      metalness: 0.9,
    });

    const sideThick = 0.012;
    const boxH = Math.min(h * 0.75, 0.16);

    // Дно ящика
    const bGeo = new THREE.BoxGeometry(w - sideThick * 2, 0.016, d);
    const bMesh = new THREE.Mesh(bGeo, bottomMat);
    bMesh.position.set(0, 0.008, -d / 2);
    boxGroup.add(bMesh);

    // Левая металлическая стенка
    const lGeo = new THREE.BoxGeometry(sideThick, boxH, d);
    const lMesh = new THREE.Mesh(lGeo, boxMat);
    lMesh.position.set(-w / 2 + sideThick / 2, boxH / 2, -d / 2);
    boxGroup.add(lMesh);

    // Правая металлическая стенка
    const rGeo = new THREE.BoxGeometry(sideThick, boxH, d);
    const rMesh = new THREE.Mesh(rGeo, boxMat);
    rMesh.position.set(w / 2 - sideThick / 2, boxH / 2, -d / 2);
    boxGroup.add(rMesh);

    // Задняя металлическая стенка
    const backGeo = new THREE.BoxGeometry(w - sideThick * 2, boxH, sideThick);
    const backMesh = new THREE.Mesh(backGeo, boxMat);
    backMesh.position.set(0, boxH / 2, -d + sideThick / 2);
    boxGroup.add(backMesh);

    // Продольные круглые рейлинги для глубоких ящиков (Tandembox Railing под кастрюли)
    if (hasRailing) {
      const railR = 0.005;
      const railH = boxH + 0.06;
      // Левый рейлинг
      const lRailGeo = new THREE.CylinderGeometry(railR, railR, d - 0.02, 16);
      const lRail = new THREE.Mesh(lRailGeo, chromeMat);
      lRail.rotation.x = Math.PI / 2;
      lRail.position.set(-w / 2 + sideThick + 0.008, railH, -d / 2);
      boxGroup.add(lRail);

      // Правый рейлинг
      const rRailGeo = new THREE.CylinderGeometry(railR, railR, d - 0.02, 16);
      const rRail = new THREE.Mesh(rRailGeo, chromeMat);
      rRail.rotation.x = Math.PI / 2;
      rRail.position.set(w / 2 - sideThick - 0.008, railH, -d / 2);
      boxGroup.add(rRail);
    }

    return boxGroup;
  }

  /**
   * Лоток-органайзер для столовых приборов (вилки, ножи, ложки) для верхнего ящика
   */
  private static createCutleryTrayMesh(w: number, d: number): THREE.Group {
    const trayGroup = new THREE.Group();
    const trayH = 0.045;
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // slate-700 матовый пластик лотка
      roughness: 0.6,
      metalness: 0.1,
    });
    const cutleryMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // зеркальный хром столовых приборов
      roughness: 0.15,
      metalness: 0.95,
    });

    // Основание лотка
    const baseGeo = new THREE.BoxGeometry(w, 0.005, d);
    const baseMesh = new THREE.Mesh(baseGeo, trayMat);
    baseMesh.position.y = 0.0025;
    trayGroup.add(baseMesh);

    const borderThick = 0.005;
    // Передний и задний бортик
    const fBorderGeo = new THREE.BoxGeometry(w, trayH, borderThick);
    const fB = new THREE.Mesh(fBorderGeo, trayMat);
    fB.position.set(0, trayH / 2, d / 2 - borderThick / 2);
    trayGroup.add(fB);
    const bB = new THREE.Mesh(fBorderGeo, trayMat);
    bB.position.set(0, trayH / 2, -d / 2 + borderThick / 2);
    trayGroup.add(bB);

    // Левый и правый бортик
    const sBorderGeo = new THREE.BoxGeometry(borderThick, trayH, d - borderThick * 2);
    const lB = new THREE.Mesh(sBorderGeo, trayMat);
    lB.position.set(-w / 2 + borderThick / 2, trayH / 2, 0);
    trayGroup.add(lB);
    const rB = new THREE.Mesh(sBorderGeo, trayMat);
    rB.position.set(w / 2 - borderThick / 2, trayH / 2, 0);
    trayGroup.add(rB);

    // Продольные перегородки (4 секции)
    const compW = (w - borderThick * 2) / 4;
    for (let i = 1; i <= 3; i++) {
      const divGeo = new THREE.BoxGeometry(0.004, trayH * 0.8, d - borderThick * 2);
      const divMesh = new THREE.Mesh(divGeo, trayMat);
      divMesh.position.set(-w / 2 + borderThick + compW * i, (trayH * 0.8) / 2, 0);
      trayGroup.add(divMesh);
    }

    // 1. Вилки в первом отсеке
    for (let k = -0.015; k <= 0.015; k += 0.015) {
      const fH = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.003, d * 0.5), cutleryMat);
      fH.position.set(-w / 2 + compW * 0.5 + k, 0.008, 0.02);
      trayGroup.add(fH);
      const fT = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.04), cutleryMat);
      fT.position.set(-w / 2 + compW * 0.5 + k, 0.01, -d * 0.23);
      trayGroup.add(fT);
    }

    // 2. Ножи во втором отсеке
    for (let k = -0.015; k <= 0.015; k += 0.015) {
      const kH = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, d * 0.35), cutleryMat);
      kH.position.set(-w / 2 + compW * 1.5 + k, 0.008, 0.08);
      trayGroup.add(kH);
      const kB = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.002, d * 0.35), cutleryMat);
      kB.position.set(-w / 2 + compW * 1.5 + k, 0.009, -d * 0.16);
      trayGroup.add(kB);
    }

    // 3. Столовые ложки в третьем отсеке
    for (let k = -0.015; k <= 0.015; k += 0.015) {
      const sH = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.003, d * 0.48), cutleryMat);
      sH.position.set(-w / 2 + compW * 2.5 + k, 0.008, 0.04);
      trayGroup.add(sH);
      const sB = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.004, 16), cutleryMat);
      sB.scale.set(1, 1, 1.4);
      sB.position.set(-w / 2 + compW * 2.5 + k, 0.01, -d * 0.22);
      trayGroup.add(sB);
    }

    // 4. Чайные ложки в четвертом отсеке
    for (let k = -0.015; k <= 0.015; k += 0.015) {
      const tsH = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.003, d * 0.32), cutleryMat);
      tsH.position.set(-w / 2 + compW * 3.5 + k, 0.008, 0.06);
      trayGroup.add(tsH);
      const tsB = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.003, 16), cutleryMat);
      tsB.scale.set(1, 1, 1.3);
      tsB.position.set(-w / 2 + compW * 3.5 + k, 0.01, -d * 0.14);
      trayGroup.add(tsB);
    }

    return trayGroup;
  }

  /**
   * Мебельные 4-шарнирные чашечные петли для распашных дверей
   */
  private static createHingeMesh(): THREE.Group {
    const hingeGroup = new THREE.Group();
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      metalness: 0.9,
      roughness: 0.2,
    });

    const plateGeo = new THREE.BoxGeometry(0.012, 0.035, 0.045);
    const plate = new THREE.Mesh(plateGeo, chromeMat);
    hingeGroup.add(plate);

    const armGeo = new THREE.BoxGeometry(0.016, 0.018, 0.03);
    const arm = new THREE.Mesh(armGeo, chromeMat);
    arm.position.set(0.008, 0, 0.018);
    hingeGroup.add(arm);

    const cupGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 16);
    const cup = new THREE.Mesh(cupGeo, chromeMat);
    cup.rotation.x = Math.PI / 2;
    cup.position.set(0.008, 0, 0.038);
    hingeGroup.add(cup);

    return hingeGroup;
  }

  /**
   * Боковина каркаса с фрезерованными пазами (выпилами) под профили Gola:
   * Верхний выпил 55×26 мм под L-профиль под столешницу,
   * а также промежуточные выпилы 55×26 мм под C-профили между ящиками.
   */
  private static createGolaSidePanelGeometry(
    boardThick: number,
    sideHeight: number,
    carcassDepth: number,
    cutoutH: number = 0.055,
    cutoutD: number = 0.026,
    intermediateCutouts: { yLocal: number; h: number; d: number }[] = []
  ): THREE.BufferGeometry {
    const fZ = carcassDepth / 2;
    const bZ = -carcassDepth / 2;
    const topY = sideHeight / 2;
    const btmY = -sideHeight / 2;

    const shape = new THREE.Shape();
    // 2D Shape in (Z, Y):
    shape.moveTo(bZ, btmY);
    shape.lineTo(fZ, btmY);

    // Сортируем промежуточные выпилы под C-профиль снизу вверх
    const sortedCuts = [...intermediateCutouts].sort((a, b) => a.yLocal - b.yLocal);
    for (const cut of sortedCuts) {
      const cutBtm = cut.yLocal - cut.h / 2;
      const cutTop = cut.yLocal + cut.h / 2;
      if (cutBtm > btmY && cutTop < topY - cutoutH) {
        shape.lineTo(fZ, cutBtm);
        shape.lineTo(fZ - cut.d, cutBtm);
        shape.lineTo(fZ - cut.d, cutTop);
        shape.lineTo(fZ, cutTop);
      }
    }

    // Верхний выпил под L-профиль
    shape.lineTo(fZ, topY - cutoutH);
    shape.lineTo(fZ - cutoutD, topY - cutoutH);
    shape.lineTo(fZ - cutoutD, topY);
    shape.lineTo(bZ, topY);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: boardThick, bevelEnabled: false });
    geo.translate(0, 0, -boardThick / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Интегрированный алюминиевый профиль Gola L-образный (под столешницу)
   */
  public static createGolaLProfileMesh(width: number, golaMat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const thick = 0.002; // толщина алюминиевой стенки 2 мм

    // 1) Верхняя горизонтальная полка примыкания к низу столешницы
    const topGeo = new THREE.BoxGeometry(width, thick, 0.024);
    const topMesh = new THREE.Mesh(topGeo, golaMat);
    topMesh.position.set(0, -thick / 2, -0.012);
    group.add(topMesh);

    // 2) Задняя вертикальная стенка (в паз боковин)
    const backGeo = new THREE.BoxGeometry(width, 0.052, thick);
    const backMesh = new THREE.Mesh(backGeo, golaMat);
    backMesh.position.set(0, -0.052 / 2, -0.024 + thick / 2);
    group.add(backMesh);

    // 3) Нижнее корыто / скос для удобного хвата пальцами
    const bottomGeo = new THREE.BoxGeometry(width, thick, 0.014);
    const bottomMesh = new THREE.Mesh(bottomGeo, golaMat);
    bottomMesh.position.set(0, -0.052, -0.017);
    group.add(bottomMesh);

    // 4) Передний нижний видимый бортик вровень с фасадом/каркасом
    const lipGeo = new THREE.BoxGeometry(width, 0.012, thick);
    const lipMesh = new THREE.Mesh(lipGeo, golaMat);
    lipMesh.position.set(0, -0.046, -thick / 2);
    group.add(lipMesh);

    return group;
  }

  /**
   * Интегрированный межуровневый алюминиевый профиль Gola C-образный (между фасадами ящиков)
   * Позволяет захватывать верхний ящик снизу и нижний ящик сверху.
   */
  public static createGolaCProfileMesh(width: number, golaMat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const thick = 0.002; // толщина алюминиевой стенки 2 мм
    const totalH = 0.052; // 52 мм чистовая высота профиля
    const depth = 0.024; // 24 мм глубина посадки в паз

    // 1) Задняя вертикальная стенка (крепление в паз боковин)
    const backGeo = new THREE.BoxGeometry(width, totalH, thick);
    const backMesh = new THREE.Mesh(backGeo, golaMat);
    backMesh.position.set(0, 0, -depth + thick / 2);
    group.add(backMesh);

    // 2) Верхняя горизонтальная полка корыта
    const topGeo = new THREE.BoxGeometry(width, thick, 0.014);
    const topMesh = new THREE.Mesh(topGeo, golaMat);
    topMesh.position.set(0, totalH / 2 - thick / 2, -depth + 0.014 / 2);
    group.add(topMesh);

    // 3) Верхний лицевой бортик
    const topLipGeo = new THREE.BoxGeometry(width, 0.010, thick);
    const topLipMesh = new THREE.Mesh(topLipGeo, golaMat);
    topLipMesh.position.set(0, totalH / 2 - 0.010 / 2, -thick / 2);
    group.add(topLipMesh);

    // 4) Нижняя горизонтальная полка корыта
    const btmGeo = new THREE.BoxGeometry(width, thick, 0.014);
    const btmMesh = new THREE.Mesh(btmGeo, golaMat);
    btmMesh.position.set(0, -totalH / 2 + thick / 2, -depth + 0.014 / 2);
    group.add(btmMesh);

    // 5) Нижний лицевой бортик
    const btmLipGeo = new THREE.BoxGeometry(width, 0.010, thick);
    const btmLipMesh = new THREE.Mesh(btmLipGeo, golaMat);
    btmLipMesh.position.set(0, -totalH / 2 + 0.010 / 2, -thick / 2);
    group.add(btmLipMesh);

    // 6) Центральное ребро жесткости (перегородка между верхним и нижним захватом)
    const midGeo = new THREE.BoxGeometry(width, 0.004, 0.010);
    const midMesh = new THREE.Mesh(midGeo, golaMat);
    midMesh.position.set(0, 0, -depth + 0.010 / 2);
    group.add(midMesh);

    return group;
  }

  /**
   * Параметрическая 3D-модель мебельной ручки:
   * 'bar' (скоба), 'railing' (рейлинг), 'knob' (кнопка), 'profile' (накладная торцевая ручка на фасад)
   */
  public static createHandleMesh(
    type: 'bar' | 'railing' | 'knob' | 'profile' | 'gola' = 'bar',
    orientation: 'vertical' | 'horizontal' = 'vertical',
    handleMat: THREE.Material
  ): THREE.Group {
    const group = new THREE.Group();
    if (type === 'gola') return group;

    const length = type === 'knob' ? 0.03 : 0.16;
    const standoffH = 0.024; // 24 мм вылет от плоскости фасада

    if (type === 'knob') {
      // Ручка-кнопка (круглая с ножкой)
      const baseGeo = new THREE.CylinderGeometry(0.005, 0.007, standoffH * 0.6, 16);
      const baseMesh = new THREE.Mesh(baseGeo, handleMat);
      baseMesh.rotation.x = Math.PI / 2;
      baseMesh.position.z = (standoffH * 0.6) / 2;
      group.add(baseMesh);

      const capGeo = new THREE.CylinderGeometry(0.014, 0.012, standoffH * 0.4, 24);
      const capMesh = new THREE.Mesh(capGeo, handleMat);
      capMesh.rotation.x = Math.PI / 2;
      capMesh.position.z = standoffH * 0.6 + (standoffH * 0.4) / 2;
      group.add(capMesh);
    } else if (type === 'railing') {
      // Ручка-рейлинг (трубка круглого сечения 12 мм + 2 круглые ножки-стойки)
      const legRadius = 0.005;
      const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, standoffH, 16);
      legGeo.rotateX(Math.PI / 2);

      const leg1 = new THREE.Mesh(legGeo, handleMat);
      const leg2 = new THREE.Mesh(legGeo, handleMat);

      const barRadius = 0.006;
      const barGeo = new THREE.CylinderGeometry(barRadius, barRadius, length, 20);

      const span = length - 0.032; // стойки на расстоянии 128 мм при длине 160 мм

      if (orientation === 'vertical') {
        leg1.position.set(0, span / 2, standoffH / 2);
        leg2.position.set(0, -span / 2, standoffH / 2);
        const barMesh = new THREE.Mesh(barGeo, handleMat);
        barMesh.position.set(0, 0, standoffH);
        group.add(leg1, leg2, barMesh);
      } else {
        leg1.position.set(-span / 2, 0, standoffH / 2);
        leg2.position.set(span / 2, 0, standoffH / 2);
        barGeo.rotateZ(Math.PI / 2);
        const barMesh = new THREE.Mesh(barGeo, handleMat);
        barMesh.position.set(0, 0, standoffH);
        group.add(leg1, leg2, barMesh);
      }
    } else if (type === 'profile') {
      // Накладная торцевая ручка-профиль на торец фасада (аккуратный алюминиевый уголок)
      const profW = orientation === 'vertical' ? 0.012 : length;
      const profH = orientation === 'vertical' ? length : 0.012;
      const lipGeo = new THREE.BoxGeometry(profW, profH, 0.014);
      const lipMesh = new THREE.Mesh(lipGeo, handleMat);
      lipMesh.position.set(0, 0, 0.007);
      group.add(lipMesh);
    } else {
      // 'bar' — Ручка-скоба (современная прямоугольная скоба на ножках)
      const legGeo = new THREE.BoxGeometry(0.01, 0.01, standoffH);
      const leg1 = new THREE.Mesh(legGeo, handleMat);
      const leg2 = new THREE.Mesh(legGeo, handleMat);

      const span = length - 0.02;
      if (orientation === 'vertical') {
        leg1.position.set(0, span / 2, standoffH / 2);
        leg2.position.set(0, -span / 2, standoffH / 2);
        const barGeo = new THREE.BoxGeometry(0.012, length, 0.006);
        const barMesh = new THREE.Mesh(barGeo, handleMat);
        barMesh.position.set(0, 0, standoffH + 0.003);
        group.add(leg1, leg2, barMesh);
      } else {
        leg1.position.set(-span / 2, 0, standoffH / 2);
        leg2.position.set(span / 2, 0, standoffH / 2);
        const barGeo = new THREE.BoxGeometry(length, 0.012, 0.006);
        const barMesh = new THREE.Mesh(barGeo, handleMat);
        barMesh.position.set(0, 0, standoffH + 0.003);
        group.add(leg1, leg2, barMesh);
      }
    }

    return group;
  }

  /**
   * Точный расчет координат ручки на распашной двери с учетом стороны открывания, зазоров и смещения.
   * При горизонтальной ориентации: ручка автоматически располагается посередине двери, а смещение идет сверху.
   * При вертикальной ориентации: ручка смещается от бокового края открывания.
   */
  private static getDoorHandlePosition(
    doorWidth: number,
    doorHeight: number,
    isMirroredDoor: boolean,
    orientation: 'vertical' | 'horizontal',
    position: 'top' | 'center' | 'bottom',
    offsetM: number,
    handleLen: number
  ): { x: number; y: number } {
    let x: number;
    let y: number;

    if (orientation === 'horizontal') {
      // 1. По ширине X: ручка автоматически располагается строго посередине фасада двери
      x = !isMirroredDoor ? doorWidth / 2 : -doorWidth / 2;

      // 2. По высоте Y: смещение отсчитывается сверху (или снизу)
      if (position === 'top') {
        y = doorHeight / 2 - offsetM;
      } else if (position === 'bottom') {
        y = -doorHeight / 2 + offsetM;
      } else {
        y = 0;
      }
    } else {
      // При вертикальной ориентации:
      // 1. Ручка ставится со стороны открывания со смещением от бокового края
      x = !isMirroredDoor
        ? doorWidth - offsetM
        : -doorWidth + offsetM;

      // 2. По высоте Y:
      if (position === 'top') {
        y = doorHeight / 2 - offsetM - handleLen / 2;
      } else if (position === 'bottom') {
        y = -doorHeight / 2 + offsetM + handleLen / 2;
      } else {
        y = 0;
      }
    }

    return { x, y };
  }

  /**
   * Точный расчет координат ручки на выдвижном ящике
   */
  private static getDrawerHandlePosition(
    drawerHeight: number,
    orientation: 'vertical' | 'horizontal',
    position: 'top' | 'center' | 'bottom',
    offsetM: number,
    handleLen: number
  ): { y: number } {
    let y = 0;
    if (orientation === 'horizontal') {
      if (position === 'top') {
        y = drawerHeight / 2 - offsetM;
      } else if (position === 'bottom') {
        y = -drawerHeight / 2 + offsetM;
      } else {
        y = 0;
      }
    } else {
      if (position === 'top') {
        y = drawerHeight / 2 - offsetM - handleLen / 2;
      } else if (position === 'bottom') {
        y = -drawerHeight / 2 + offsetM + handleLen / 2;
      } else {
        y = 0;
      }
    }
    return { y };
  }

  /**
   * Применение физического метрического масштаба 1:1 к UV-координатам BoxGeometry
   * (Real-World UV Scaling: 1.0 м по ширине, 2.0 м по высоте листа).
   * Исключает деформацию и растяжение древесных волокон и каменных рисунков:
   * на узком ящике 150 мм и на пенале 2400 мм волокна дерева имеют абсолютно одинаковый масштаб.
   */
  public static applyMetricUVs(geometry: THREE.BufferGeometry, scaleX: number = 1.0, scaleY: number = 2.0): void {
    const params = (geometry as any).parameters;
    if (!params || typeof params.width !== 'number') return;
    const width = params.width;
    const height = params.height;
    const depth = params.depth;

    const uvAttr = geometry.attributes.uv;
    if (!uvAttr) return;
    const uvs = uvAttr.array as Float32Array;
    if (uvs.length < 48) return;

    // Face 0: +X (Right) - размеры depth x height
    const u0 = depth / scaleX;
    const v0 = height / scaleY;
    uvs[0] = 0;  uvs[1] = v0;
    uvs[2] = u0; uvs[3] = v0;
    uvs[4] = 0;  uvs[5] = 0;
    uvs[6] = u0; uvs[7] = 0;

    // Face 1: -X (Left) - размеры depth x height
    const u1 = depth / scaleX;
    const v1 = height / scaleY;
    uvs[8] = 0;  uvs[9] = v1;
    uvs[10] = u1; uvs[11] = v1;
    uvs[12] = 0;  uvs[13] = 0;
    uvs[14] = u1; uvs[15] = 0;

    // Face 2: +Y (Top) - размеры width x depth
    const u2 = width / scaleX;
    const v2 = depth / scaleY;
    uvs[16] = 0;  uvs[17] = v2;
    uvs[18] = u2; uvs[19] = v2;
    uvs[20] = 0;  uvs[21] = 0;
    uvs[22] = u2; uvs[23] = 0;

    // Face 3: -Y (Bottom) - размеры width x depth
    const u3 = width / scaleX;
    const v3 = depth / scaleY;
    uvs[24] = 0;  uvs[25] = v3;
    uvs[26] = u3; uvs[27] = v3;
    uvs[28] = 0;  uvs[29] = 0;
    uvs[30] = u3; uvs[31] = 0;

    // Face 4: +Z (Front) - размеры width x height
    const u4 = width / scaleX;
    const v4 = height / scaleY;
    uvs[32] = 0;  uvs[33] = v4;
    uvs[34] = u4; uvs[35] = v4;
    uvs[36] = 0;  uvs[37] = 0;
    uvs[38] = u4; uvs[39] = 0;

    // Face 5: -Z (Back) - размеры width x height
    const u5 = width / scaleX;
    const v5 = height / scaleY;
    uvs[40] = 0;  uvs[41] = v5;
    uvs[42] = u5; uvs[43] = v5;
    uvs[44] = 0;  uvs[45] = 0;
    uvs[46] = u5; uvs[47] = 0;

    uvAttr.needsUpdate = true;
  }

  public static applyMetricUVsToGroup(group: THREE.Group, scaleX: number = 1.0, scaleY: number = 2.0): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry && !child.userData?.isModuleCollider) {
        ModuleBuilder.applyMetricUVs(child.geometry, scaleX, scaleY);
      }
    });
  }

  /**
   * Создает единое бесшовное полотно столешницы для непрерывной цепочки состыкованных секций
   */
  public static createContinuousCountertopGroup(
    length: number, // метры
    depth: number,  // метры
    thickness: number, // метры
    materialId: string,
    isWireframe: boolean = false
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'continuous_countertop';
    group.userData = { isContinuousCountertop: true };

    let countertopMat = getThreeMaterial(materialId || 'countertop_marble', false);
    if (isWireframe) {
      countertopMat = countertopMat.clone();
      countertopMat.transparent = true;
      countertopMat.opacity = 0.18;
      countertopMat.depthWrite = false;
    }

    const topGeo = new THREE.BoxGeometry(length, thickness, depth);
    const topMesh = new THREE.Mesh(topGeo, countertopMat);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    this.addEdges(topMesh, false, false, isWireframe);
    group.add(topMesh);

    ModuleBuilder.applyMetricUVsToGroup(group);

    return group;
  }

  /**
   * Создает единую непрерывную планку цоколя для цепочки состыкованных секций
   */
  public static createContinuousPlinthGroup(
    length: number, // метры
    height: number, // метры
    thickness: number = 0.016, // метры
    materialId: string = 'carcass_white',
    isWireframe: boolean = false
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'continuous_plinth';
    group.userData = { isContinuousPlinth: true };

    let plinthMat = getThreeMaterial(materialId, false);
    if (isWireframe) {
      plinthMat = plinthMat.clone();
      plinthMat.transparent = true;
      plinthMat.opacity = 0.18;
      plinthMat.depthWrite = false;
    }

    const plinthGeo = new THREE.BoxGeometry(length, height, thickness);
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.castShadow = true;
    this.addEdges(plinthMesh, false, false, isWireframe);
    group.add(plinthMesh);

    ModuleBuilder.applyMetricUVsToGroup(group);

    return group;
  }

  /**
   * Сборка 3D-модуля мебели с поддержкой индикации коллизий
   */
  public static buildModuleGroup(
    module: FurnitureModule,
    isSelected: boolean,
    isColliding: boolean = false,
    isWireframe: boolean = false,
    settings?: ProjectSettings,
    isThumbnail: boolean = false,
    options?: {
      skipCountertop?: boolean;
      skipPlinth?: boolean;
      showDimensions?: boolean;
    }
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `module_${module.id}`;
    group.userData = { moduleId: module.id };

    const W = module.dimensions.width / 1000;
    const H = module.dimensions.height / 1000;
    const D = module.dimensions.depth / 1000;

    // ==========================================
    // СТЕНОВАЯ ПАНЕЛЬ / ФАРТУК (BACKSPLASH)
    // ==========================================
    if (module.subType === 'backsplash' || module.id.includes('backsplash')) {
      let panelMat = getThreeMaterial(module.materials.countertop || module.materials.facade || 'countertop_marble', isSelected);
      if (isWireframe) {
        panelMat = panelMat.clone();
        panelMat.transparent = true;
        panelMat.opacity = 0.25;
        panelMat.depthWrite = false;
      }

      const panelGeo = new THREE.BoxGeometry(W, H, D);
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.position.set(0, H / 2, 0);
      panelMesh.castShadow = true;
      panelMesh.receiveShadow = true;
      this.addEdges(panelMesh, isSelected, isColliding, isWireframe);
      group.add(panelMesh);

      // Интерактивный коллайдер для выбора и перемещения
      const colliderGeo = new THREE.BoxGeometry(W, H, Math.max(0.04, D));
      const colliderMat = new THREE.MeshBasicMaterial({
        color: isColliding ? 0xef4444 : 0xffffff,
        transparent: true,
        opacity: isColliding ? 0.25 : 0,
        depthWrite: false,
      });
      const colliderMesh = new THREE.Mesh(colliderGeo, colliderMat);
      colliderMesh.position.set(0, H / 2, 0);
      colliderMesh.name = 'raycast_collider';
      colliderMesh.userData = { moduleId: module.id, isModuleCollider: true };
      group.add(colliderMesh);

      if (!isThumbnail) {
        const dimSprite = this.createDimensionSprite(String(module.dimensions.width), isColliding);
        dimSprite.position.set(0, H + 0.08, 0);
        dimSprite.visible = options?.showDimensions !== false;
        group.add(dimSprite);
      }

      group.position.set(module.position.x / 1000, module.position.y / 1000, module.position.z / 1000);
      group.rotation.y = THREE.MathUtils.degToRad(module.rotation);

      ModuleBuilder.applyMetricUVsToGroup(group);

      return group;
    }

    let carcassMat = getThreeMaterial(module.materials.carcass, isSelected);
    let facadeMat = getThreeMaterial(module.materials.facade, isSelected);
    let handleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });

    if (isWireframe) {
      carcassMat = carcassMat.clone();
      carcassMat.transparent = true;
      carcassMat.opacity = 0.18;
      carcassMat.depthWrite = false;

      facadeMat = facadeMat.clone();
      facadeMat.transparent = true;
      facadeMat.opacity = 0.18;
      facadeMat.depthWrite = false;

      handleMat = handleMat.clone();
      handleMat.transparent = true;
      handleMat.opacity = 0.25;
      handleMat.depthWrite = false;
    } else if (isThumbnail) {
      // Стандартный чистый вид для каталога: приятные светлые однотонные цвета без полупрозрачности и без затемнений
      carcassMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#DFD5C6'),
        roughness: 0.6,
        metalness: 0.0,
      });
      facadeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#D29B5D'),
        roughness: 0.45,
        metalness: 0.0,
      });
      handleMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.35,
        metalness: 0.5,
      });
    }

    const isTallCabinet = module.subType === 'tall' || (module as any).mainGroup === 'tall' || module.id.startsWith('k_tall_');
    const isTopCabinet = module.subType === 'top' || (module as any).mainGroup === 'top' || module.id.startsWith('k_top_');
    const isWallCabinet = !isTallCabinet && !isTopCabinet && (module.subType === 'wall' || (module as any).mainGroup === 'wall' || module.id.startsWith('k_wall_'));
    const isBaseOrCorner = !isWallCabinet && !isTallCabinet && !isTopCabinet && (module.subType === 'base' || module.subType === 'corner');
    const isUpperCabinet = isWallCabinet || isTopCabinet;

    const boardThick = (settings?.dspThickness ?? 16) / 1000;
    const shouldHavePlinth = module.config.hasPlinth ?? (isBaseOrCorner || isTallCabinet);
    const plinthHeight = (shouldHavePlinth && (settings?.hasPlinth !== false))
      ? (settings?.plinthHeight ?? 120) / 1000
      : 0.0;

    // ==========================================
    // ПОЛЬЗОВАТЕЛЬСКАЯ СЕКЦИЯ (ИЗ РЕДАКТОРА СЕКЦИЙ)
    // ==========================================
    if (module.config.customParts && module.config.customParts.length > 0) {
      const hasTop = Boolean(module.config.hasCountertop) && !options?.skipCountertop;
      const topH = (settings?.countertopThickness ?? 40) / 1000;
      const overhangFront = hasTop ? (settings?.countertopFrontOverhang ?? 40) / 1000 : 0.0;
      const Z_frontCarcass = D / 2 - overhangFront;

      if (!options?.skipPlinth && shouldHavePlinth && (settings?.hasPlinth !== false)) {
        const plinthGeo = new THREE.BoxGeometry(W, plinthHeight, 0.016);
        const plinthMesh = new THREE.Mesh(plinthGeo, carcassMat);
        plinthMesh.position.set(0, plinthHeight / 2, Z_frontCarcass - 0.05);
        plinthMesh.castShadow = true;
        this.addEdges(plinthMesh, isSelected, isColliding, isWireframe);
        group.add(plinthMesh);
      }

      if (hasTop) {
        let topMat = getThreeMaterial(module.materials.countertop || 'countertop_marble', isSelected);
        if (isWireframe) {
          topMat = topMat.clone();
          topMat.transparent = true;
          topMat.opacity = 0.18;
          topMat.depthWrite = false;
        }
        const topGeo = new THREE.BoxGeometry(W, topH, D);
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.set(0, H - topH / 2, 0);
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        this.addEdges(topMesh, isSelected, isColliding, isWireframe);
        group.add(topMesh);
      }

      const bodyH = H - plinthHeight - (hasTop ? topH : 0);
      const bodyCenterY = plinthHeight + bodyH / 2;

      for (const part of module.config.customParts) {
        if (part.isVisible === false) continue;
        const geom = evaluatePartGeometry(
          part,
          { width: module.dimensions.width, height: Math.round(bodyH * 1000), depth: module.dimensions.depth },
          settings ?? DEFAULT_PROJECT_SETTINGS,
          module.config.customParts
        );

        let partMat = carcassMat;
        if (part.materialType === 'ldsp') {
          partMat = carcassMat;
        } else if (part.materialType === 'mdf_facade') {
          partMat = facadeMat;
        } else if (part.materialType === 'glass') {
          partMat = new THREE.MeshPhysicalMaterial({
            color: 0x93c5fd,
            transmission: 0.9,
            opacity: 1,
            transparent: true,
            roughness: 0.1,
            ior: 1.5,
          });
        } else if (part.materialType === 'hdf') {
          partMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
        } else if (part.materialType === 'countertop') {
          partMat = getThreeMaterial(module.materials.countertop || 'countertop_marble', isSelected);
        } else if (part.materialType === 'metal') {
          partMat = handleMat;
        } else if (part.materialType === 'mdf') {
          partMat = (part.category === 'facade' || part.category === 'drawer') ? facadeMat : carcassMat;
        } else {
          partMat = (part.category === 'facade' || part.category === 'drawer') ? facadeMat : carcassMat;
        }

        if (isWireframe && (part.materialType === 'glass' || part.materialType === 'hdf' || part.materialType === 'countertop' || part.materialType === 'metal')) {
          partMat = partMat.clone();
          partMat.transparent = true;
          partMat.opacity = 0.18;
          partMat.depthWrite = false;
        }

        const boxGeo = new THREE.BoxGeometry(
          Math.max(0.002, geom.width / 1000),
          Math.max(0.002, geom.height / 1000),
          Math.max(0.002, geom.depth / 1000)
        );
        const boxMesh = new THREE.Mesh(boxGeo, partMat);
        boxMesh.position.set(
          geom.posX / 1000,
          bodyCenterY + geom.posY / 1000,
          geom.posZ / 1000
        );
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        this.addEdges(boxMesh, isSelected, isColliding, isWireframe);
        group.add(boxMesh);
      }

      const totalH = H + (hasTop ? topH : 0);
      const colliderGeo = new THREE.BoxGeometry(W, totalH, D);
      const colliderMat = new THREE.MeshBasicMaterial({
        color: isColliding ? 0xef4444 : 0xffffff,
        transparent: true,
        opacity: isColliding ? 0.25 : 0,
        depthWrite: false,
      });
      const colliderMesh = new THREE.Mesh(colliderGeo, colliderMat);
      colliderMesh.position.set(0, totalH / 2, 0);
      colliderMesh.name = 'raycast_collider';
      colliderMesh.userData = { moduleId: module.id, isModuleCollider: true };
      group.add(colliderMesh);

      if (!isThumbnail) {
        const dimSprite = this.createDimensionSprite(String(module.dimensions.width), isColliding);
        dimSprite.position.set(0, totalH + (module.config.hasCountertop ? 0.14 : 0.08), D / 2);
        dimSprite.visible = options?.showDimensions !== false;
        group.add(dimSprite);
      }

      if (isWireframe) {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.userData?.isModuleCollider) {
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                m.transparent = true;
                m.opacity = Math.min(m.opacity ?? 1, 0.18);
                m.depthWrite = false;
              });
            }
          } else if (child instanceof THREE.LineSegments) {
            if (!isSelected && !isColliding) {
              child.material = ModuleBuilder.wireframeEdgeMaterial;
            }
          }
        });
      }

      group.position.set(module.position.x / 1000, module.position.y / 1000, module.position.z / 1000);
      group.rotation.y = THREE.MathUtils.degToRad(module.rotation);

      ModuleBuilder.applyMetricUVsToGroup(group);
      return group;
    }

    const defaultBlindWidth = isUpperCabinet ? (module.dimensions.depth || 320) : 600;
    const isBlindCorner = module.subType === 'corner' || module.id.includes('corner_blind') || Boolean(module.config.blindCornerWidth);
    const blindWidth = isBlindCorner ? (module.config.blindCornerWidth ?? defaultBlindWidth) / 1000 : 0;
    const isRightCorner = isBlindCorner && (module.config.blindCornerSide === 'right' || Boolean(module.config.isMirrored));

    const isOven = module.id.includes('oven') || module.name.toLowerCase().includes('духов');
    const isCargo = module.id.includes('cargo') || module.name.toLowerCase().includes('бутылоч') || module.name.toLowerCase().includes('карго');
    const isDishwasher = module.id.includes('dishwasher') || module.name.toLowerCase().includes('посудомоеч');
    const isDrying = module.config.specialCabinetType === 'drying' || module.id.includes('drying') || module.name.toLowerCase().includes('сушк');
    const isHood = module.config.specialCabinetType === 'hood' || module.id.includes('hood') || module.name.toLowerCase().includes('вытяжк');
    const isMicrowave = module.config.specialCabinetType === 'microwave' || module.id.includes('microwave') || module.name.toLowerCase().includes('свч') || module.name.toLowerCase().includes('микроволн');

    const isOpenCabinet = Boolean(module.config.isOpenShelf) || (module.config.doors === 0 && module.config.drawers === 0 && !isOven && !isDishwasher && !isCargo && !isMicrowave && !isDrying && !isHood);
    const isCombined = module.config.drawers > 0 && module.config.doors > 0 && !isOven;

    const doorOpeningType = module.config.doorOpeningType ?? 'swing';
    const isLift = doorOpeningType === 'lift';
    const isAventosHF = doorOpeningType === 'aventos_hf';
    const isDoubleLift = doorOpeningType === 'double_lift';

    // Глубина каркаса и свесы столешницы по настройкам проекта
    const carcassDepth = isWallCabinet
      ? D
      : (isTallCabinet
          ? Math.min(D, 0.560)
          : (isBaseOrCorner
              ? Math.min(D - 0.02, (settings?.baseBodyDepth ?? 560) / 1000)
              : D));

    const overhangFront = isTallCabinet
      ? 0.0
      : (isBaseOrCorner ? (settings?.countertopFrontOverhang ?? 40) / 1000 : 0.0);
    const overhangBack = isTallCabinet
      ? Math.max(0, D - carcassDepth)
      : (isBaseOrCorner ? Math.max(0, D - carcassDepth - overhangFront) : 0.0);

    // Координаты Z для каркаса и столешницы
    // Bounding Box модуля по Z: [-D/2, +D/2]
    // Z = -D/2 — стена (примагничивание задней кромки столешницы)
    // Z = +D/2 — передний край столешницы
    const Z_frontCarcass = D / 2 - overhangFront;
    const Z_backCarcass = -D / 2 + overhangBack;
    const Z_carcassCenter = (Z_frontCarcass + Z_backCarcass) / 2;
    const facadeThick = 0.018;

    // Параметрические зазоры и допуски фасадов по настройкам проекта
    const baseSideGap = (settings?.baseFacadeSideGap ?? 1.5) / 1000;
    const baseTopGap = (settings?.baseFacadeTopGap ?? 3.0) / 1000;
    const baseBottomGap = (settings?.baseFacadeBottomGap ?? 2.0) / 1000;

    const upperSideGap = (settings?.upperFacadeSideGap ?? 1.5) / 1000;
    const upperTopGap = (settings?.upperFacadeTopGap ?? 2.0) / 1000;
    const upperBottomOverhang = (settings?.upperFacadeBottomOverhang ?? 20.0) / 1000;

    const interGap = (settings?.interFacadeGap ?? 3.0) / 1000;

    const sideGap = isWallCabinet ? upperSideGap : baseSideGap;
    const topGap = isWallCabinet ? upperTopGap : baseTopGap;
    const bottomGap = isWallCabinet ? 0 : baseBottomGap;
    const bottomOverhang = isWallCabinet ? upperBottomOverhang : 0;

    // Интегрированная система профилей Gola
    const isGola = isBaseOrCorner && module.config.handleType === 'gola';
    const golaTopGap = 0.030; // 30 мм чистовой зазор под столешницей для скрытого хвата рукой
    const effectiveTopGap = isGola ? golaTopGap : topGap;
    const golaCutoutH = 0.055; // 55 мм выпил под профиль Gola
    const golaCutoutD = 0.026; // 26 мм выпил под профиль Gola

    const Z_facadeCenter = Z_frontCarcass + facadeThick / 2;

    // 1. ЦОКОЛЬ
    if (!options?.skipPlinth && module.config.hasPlinth && (settings?.hasPlinth !== false)) {
      if (isBlindCorner) {
        const visibleW = W - blindWidth;
        const plinthGeo = new THREE.BoxGeometry(visibleW, plinthHeight, 0.016);
        const plinthMesh = new THREE.Mesh(plinthGeo, carcassMat);
        const plinthX = isRightCorner
          ? -W / 2 + visibleW / 2
          : -W / 2 + blindWidth + visibleW / 2;
        plinthMesh.position.set(plinthX, plinthHeight / 2, Z_frontCarcass - 0.05);
        plinthMesh.castShadow = true;
        this.addEdges(plinthMesh, isSelected, isColliding);
        group.add(plinthMesh);
      } else {
        const plinthGeo = new THREE.BoxGeometry(W, plinthHeight, 0.016);
        const plinthMesh = new THREE.Mesh(plinthGeo, carcassMat);
        plinthMesh.position.set(0, plinthHeight / 2, Z_frontCarcass - 0.05);
        plinthMesh.castShadow = true;
        this.addEdges(plinthMesh, isSelected, isColliding);
        group.add(plinthMesh);
      }
    }

    // 2. БОКОВИНЫ КАРКАСА (ДЛЯ НИЖНИХ ТУМБ БОКОВИНЫ СТАВЯТСЯ НА ДНО: ВЫСОТА = bodyHeight - boardThick)
    const bodyHeight = H - plinthHeight;
    const sideHeight = isBaseOrCorner ? bodyHeight - boardThick : bodyHeight;
    const sidePosY = isBaseOrCorner
      ? plinthHeight + boardThick + sideHeight / 2
      : plinthHeight + bodyHeight / 2;

    // Расчет выкатных ящиков и позиций C-профилей Gola
    const golaType = module.config.golaType ?? 'type1';
    const hasDrawers = module.config.drawers > 0;
    const drawerCount = module.config.drawers;
    const isThreeDrawers = drawerCount === 3;
    const golaGap = 0.030; // 30 мм зазор Gola между фасадами под захват рукой

    const drawerGapSizes: number[] = [];
    const hasCProfileList: boolean[] = [];
    const cProfileWorldYs: number[] = [];
    let dHeights: number[] = [];
    const drawerBottomYs: number[] = [];

    if (hasDrawers) {
      for (let k = 0; k < drawerCount - 1; k++) {
        if (!isGola) {
          hasCProfileList.push(false);
          drawerGapSizes.push(interGap);
        } else if (drawerCount === 2) {
          hasCProfileList.push(true);
          drawerGapSizes.push(golaGap);
        } else if (golaType === 'type2') {
          hasCProfileList.push(true);
          drawerGapSizes.push(golaGap);
        } else {
          // type1: C-профиль только между нижним (k=0) и средним (k=1) ящиком
          const hasC = k === 0;
          hasCProfileList.push(hasC);
          drawerGapSizes.push(hasC ? golaGap : interGap);
        }
      }

      const totalInterGaps = drawerGapSizes.reduce((sum, g) => sum + g, 0);
      const availHeight = bodyHeight - effectiveTopGap - bottomGap - totalInterGaps;

      if (isThreeDrawers) {
        const topH = 0.140;
        const deepH = Math.max(0.05, (availHeight - topH) / 2);
        dHeights = [deepH, deepH, topH];
      } else {
        const dH = availHeight / drawerCount;
        dHeights = Array(drawerCount).fill(dH);
      }

      let curBtm = (isUpperCabinet ? 0 : plinthHeight) + bottomGap;
      for (let d = 0; d < drawerCount; d++) {
        drawerBottomYs.push(curBtm);
        const h = dHeights[d];
        curBtm += h;
        if (d < drawerCount - 1) {
          const gapSize = drawerGapSizes[d];
          if (hasCProfileList[d]) {
            cProfileWorldYs.push(curBtm + gapSize / 2);
          }
          curBtm += gapSize;
        }
      }
    }

    const sideIntermediateCutouts = isGola
      ? cProfileWorldYs.map((cY) => ({
          yLocal: cY - sidePosY,
          h: golaCutoutH,
          d: golaCutoutD,
        }))
      : [];

    const sideGeo = isGola
      ? this.createGolaSidePanelGeometry(boardThick, sideHeight, carcassDepth, golaCutoutH, golaCutoutD, sideIntermediateCutouts)
      : new THREE.BoxGeometry(boardThick, sideHeight, carcassDepth);

    const leftSide = new THREE.Mesh(sideGeo, carcassMat);
    leftSide.position.set(-W / 2 + boardThick / 2, sidePosY, Z_carcassCenter);
    leftSide.castShadow = true;
    leftSide.receiveShadow = true;
    this.addEdges(leftSide, isSelected, isColliding);
    group.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeo, carcassMat);
    rightSide.position.set(W / 2 - boardThick / 2, sidePosY, Z_carcassCenter);
    rightSide.castShadow = true;
    rightSide.receiveShadow = true;
    this.addEdges(rightSide, isSelected, isColliding);
    group.add(rightSide);

    // 3. ДНО КАРКАСА (ДЛЯ НИЖНИХ ТУМБ — ПРОХОДНОЕ ДНО НА ВСЮ ШИРИНУ W, БОКОВИНЫ СТАВЯТСЯ НА ДНО)
    const innerWidth = W - boardThick * 2;
    const bottomWidth = isBaseOrCorner ? W : innerWidth;
    const bottomGeo = new THREE.BoxGeometry(bottomWidth, boardThick, carcassDepth);
    const bottomMesh = new THREE.Mesh(bottomGeo, carcassMat);
    bottomMesh.position.set(0, plinthHeight + boardThick / 2, Z_carcassCenter);
    bottomMesh.castShadow = true;
    this.addEdges(bottomMesh, isSelected, isColliding);
    group.add(bottomMesh);

    // 4. КРЫШКА ИЛИ ЦАРГИ
    if (isUpperCabinet || isTallCabinet || module.category === 'wardrobe') {
      const topGeo = new THREE.BoxGeometry(innerWidth, boardThick, carcassDepth);
      const topMesh = new THREE.Mesh(topGeo, carcassMat);
      topMesh.position.set(0, H - boardThick / 2, Z_carcassCenter);
      topMesh.castShadow = true;
      this.addEdges(topMesh, isSelected, isColliding);
      group.add(topMesh);
    } else {
      const tsargW = 0.10; // 100 мм ширина верхней царги (евро-стандарт под стяжку столешницы)
      const strGeo = new THREE.BoxGeometry(innerWidth, boardThick, tsargW);

      if (isGola) {
        // При профиле Gola передняя царга монтируется вертикально за выпилом
        const fStrGeo = new THREE.BoxGeometry(innerWidth, tsargW, boardThick);
        const fStr = new THREE.Mesh(fStrGeo, carcassMat);
        fStr.position.set(0, H - tsargW / 2, Z_frontCarcass - golaCutoutD - boardThick / 2);
        this.addEdges(fStr, isSelected, isColliding);
        group.add(fStr);
      } else {
        const fStr = new THREE.Mesh(strGeo, carcassMat);
        fStr.position.set(0, H - boardThick / 2, Z_frontCarcass - tsargW / 2);
        this.addEdges(fStr, isSelected, isColliding);
        group.add(fStr);
      }

      const bStr = new THREE.Mesh(strGeo, carcassMat);
      bStr.position.set(0, H - boardThick / 2, Z_backCarcass + tsargW / 2);
      this.addEdges(bStr, isSelected, isColliding);
      group.add(bStr);
    }

    // 5. ЗАДНЯЯ СТЕНКА КАРКАСА
    if (!module.id.includes('sink') && !isOven && module.config.hasBackWall !== false) {
      const backGeo = new THREE.BoxGeometry(W - 0.008, bodyHeight - 0.008, 0.004);
      const backMesh = new THREE.Mesh(backGeo, carcassMat);
      backMesh.position.set(0, plinthHeight + bodyHeight / 2, Z_backCarcass + 0.002);
      this.addEdges(backMesh, isSelected, isColliding, isWireframe);
      group.add(backMesh);
    }

    // 6. СТОЛЕШНИЦА (СТРОГО РАВНА ГАБАРИТУ МОДУЛЯ D ПО ГЛУБИНЕ — ПО УМОЛЧАНИЮ 600 ММ)
    const topThick = (settings?.countertopThickness ?? 40) / 1000;

    if (module.config.hasCountertop) {
      if (!options?.skipCountertop) {
        let countertopMat = isThumbnail
          ? new THREE.MeshStandardMaterial({
              color: new THREE.Color('#FFFFFF'),
              roughness: 0.35,
              metalness: 0.0,
            })
          : getThreeMaterial(module.materials.countertop || 'countertop_marble', isSelected);
        if (isWireframe) {
          countertopMat = countertopMat.clone();
          countertopMat.transparent = true;
          countertopMat.opacity = 0.18;
          countertopMat.depthWrite = false;
        }

        const topGeo = new THREE.BoxGeometry(W, topThick, D);
        const topMesh = new THREE.Mesh(topGeo, countertopMat);
        topMesh.position.set(0, H + topThick / 2, 0);
        topMesh.castShadow = !isThumbnail;
        topMesh.receiveShadow = true;
        this.addEdges(topMesh, isSelected, isColliding);
        group.add(topMesh);
      }

      if (module.id.includes('sink') || module.name.toLowerCase().includes('мойк')) {
        const sink = this.createSinkMesh();
        sink.position.set(0, H + topThick, 0);
        group.add(sink);
      } else if (module.id.includes('oven') || module.id.includes('hob') || module.name.toLowerCase().includes('духов') || module.name.toLowerCase().includes('вароч')) {
        const hob = this.createHobMesh();
        hob.position.set(0, H + topThick, 0);
        group.add(hob);
      }
    }

    // Профиль Gola: верхний L-образный (под столешницу) и промежуточные C-образные (между ящиками)
    if (isGola) {
      let golaMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // сатинированный матовый алюминий
        metalness: 0.85,
        roughness: 0.25,
      });
      if (isWireframe) {
        golaMat = golaMat.clone();
        golaMat.transparent = true;
        golaMat.opacity = 0.25;
        golaMat.depthWrite = false;
      }

      // 1) Верхний L-профиль под столешницу
      const golaLMesh = this.createGolaLProfileMesh(W, golaMat);
      golaLMesh.position.set(0, H, Z_frontCarcass);
      group.add(golaLMesh);

      // 2) Промежуточные C-профили между ящиками
      for (const cY of cProfileWorldYs) {
        const golaCMesh = this.createGolaCProfileMesh(W, golaMat);
        golaCMesh.position.set(0, cY, Z_frontCarcass);
        group.add(golaCMesh);
      }
    }

    // 7. ПОЛКИ И ВНУТРЕННЕЕ НАПОЛНЕНИЕ
    if (isDrying) {
      // 2-уровневая хромированная сушка для посуды с поддоном
      const dishRack = this.createDishRackMesh(innerWidth, carcassDepth, bodyHeight);
      dishRack.position.set(0, plinthHeight, Z_frontCarcass);
      group.add(dishRack);
    } else if (isHood) {
      // Полновстраиваемая вытяжка в дне + вентканал
      const hoodMesh = this.createBuiltinHoodMesh(innerWidth, carcassDepth, bodyHeight);
      hoodMesh.position.set(0, plinthHeight, Z_frontCarcass);
      group.add(hoodMesh);

      // Укороченные боковые полочки вокруг воздуховода
      const sideShelfW = (innerWidth - 0.16) / 2;
      if (sideShelfW > 0.08) {
        const shelfGeo = new THREE.BoxGeometry(sideShelfW, boardThick, carcassDepth - 0.04);
        [-innerWidth / 2 + sideShelfW / 2 + 0.002, innerWidth / 2 - sideShelfW / 2 - 0.002].forEach((sx) => {
          const sMesh = new THREE.Mesh(shelfGeo, carcassMat);
          sMesh.position.set(sx, plinthHeight + bodyHeight * 0.55, Z_carcassCenter - 0.01);
          this.addEdges(sMesh, isSelected, isColliding);
          group.add(sMesh);
        });
      }
    } else if (isMicrowave) {
      // Горизонтальная полка над нишей микроволновки
      const mwNicheH = 0.38; // 380 мм ниша под СВЧ
      const shelfY = plinthHeight + mwNicheH + boardThick / 2;
      const shelfGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, carcassDepth - 0.01);
      const shelfMesh = new THREE.Mesh(shelfGeo, carcassMat);
      shelfMesh.position.set(0, shelfY, Z_carcassCenter - 0.005);
      this.addEdges(shelfMesh, isSelected, isColliding);
      group.add(shelfMesh);

      // Сама микроволновка в открытой нише
      const mwMesh = this.createMicrowaveMesh(innerWidth, carcassDepth - 0.01, mwNicheH);
      mwMesh.position.set(0, plinthHeight + 0.01, Z_frontCarcass);
      group.add(mwMesh);
    } else if (module.config.shelves > 0) {
      const isBlind = isBlindCorner;
      const pillarDepth = 0.08;
      // В приставных угловых полки укорочены спереди до вертикальной планки петель
      const shelfD = isBlind
        ? (carcassDepth - pillarDepth - 0.015)
        : (carcassDepth - 0.02);
      const shelfZ = isBlind
        ? (Z_backCarcass + 0.005 + shelfD / 2)
        : (Z_carcassCenter - 0.01);
      const shelfHeight = bodyHeight / (module.config.shelves + 1);
      for (let s = 1; s <= module.config.shelves; s++) {
        const shelfGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, shelfD);
        const shelfMesh = new THREE.Mesh(shelfGeo, carcassMat);
        shelfMesh.position.set(0, plinthHeight + shelfHeight * s, shelfZ);
        this.addEdges(shelfMesh, isSelected, isColliding);
        group.add(shelfMesh);
      }
    }

    // 8. ФАСАДЫ И РУЧКИ
    const handleType = module.config.handleType ?? ((isUpperCabinet && (bottomOverhang > 0.01 || isTopCabinet)) ? 'none' : 'bar');
    const showHandle = handleType !== 'none' && !isGola;
    const handleOrientation = module.config.handleOrientation ?? (module.config.drawers > 0 ? 'horizontal' : 'vertical');
    const handlePosition = module.config.handlePosition ?? (isUpperCabinet ? 'bottom' : 'top');
    const handleOffset = (module.config.handleOffset ?? 25) / 1000;
    const handleLen = handleType === 'knob' ? 0.03 : 0.16;

    if (isOpenCabinet) {
      // 8.OPEN: Открытая секция — фасады и ручки отсутствуют, полки открыты
    } else if (isTallCabinet) {
      this.buildTallCabinetInteriorAndFacades(group, module, {
        W, H, D, carcassDepth, boardThick, plinthHeight, bodyHeight, innerWidth, facadeThick,
        Z_frontCarcass, Z_carcassCenter, Z_facadeCenter,
        sideGap, topGap, bottomGap, interGap,
        handleType, showHandle, handleMat, facadeMat, carcassMat,
        isSelected, isColliding,
      });
    } else if (isOven) {
      // 8.OVEN: Встроенный духовой шкаф + нижний выдвижной ящик для противней
      const ovenDrawerH = 0.13;
      const ovenDrawerW = W - sideGap * 2;
      const ovenDrawerY = plinthHeight + bottomGap + ovenDrawerH / 2;

      // Нижний ящик под противни
      const drawerGroup = new THREE.Group();
      drawerGroup.userData = { isDrawerSlide: true, basePosZ: Z_frontCarcass + facadeThick / 2, maxSlideDistance: 0.25 };
      const dGeo = new THREE.BoxGeometry(ovenDrawerW, ovenDrawerH, facadeThick);
      const dMesh = new THREE.Mesh(dGeo, facadeMat);
      dMesh.castShadow = true;
      this.addEdges(dMesh, isSelected, isColliding);
      drawerGroup.add(dMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'horizontal', handleMat);
        hGroup.position.set(0, 0, facadeThick / 2);
        drawerGroup.add(hGroup);
      }
      const boxD = carcassDepth - 0.05;
      const boxW = innerWidth - 0.02;
      const tandembox = this.createTandemboxMesh(boxW, ovenDrawerH, boxD, false);
      tandembox.position.set(0, -ovenDrawerH / 2, -facadeThick / 2);
      drawerGroup.add(tandembox);

      drawerGroup.position.set(0, ovenDrawerY, Z_frontCarcass + facadeThick / 2);
      group.add(drawerGroup);

      // Горизонтальная полка под духовку
      const shelfY = plinthHeight + bottomGap + ovenDrawerH + boardThick / 2;
      const shelfGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, carcassDepth - 0.02);
      const shelfMesh = new THREE.Mesh(shelfGeo, carcassMat);
      shelfMesh.position.set(0, shelfY, Z_carcassCenter - 0.01);
      this.addEdges(shelfMesh, isSelected, isColliding);
      group.add(shelfMesh);

      // Встраиваемый духовой шкаф в нише
      const ovenH = bodyHeight - effectiveTopGap - (bottomGap + ovenDrawerH + boardThick);
      const ovenMesh = this.createOvenMesh(innerWidth, ovenH, carcassDepth - 0.02);
      ovenMesh.position.set(0, shelfY + boardThick / 2 + ovenH / 2, Z_frontCarcass);
      group.add(ovenMesh);

    } else if (isCargo) {
      // 8.CARGO: Бутылочница с 2-уровневой металлической корзиной
      const cargoH = bodyHeight - effectiveTopGap - bottomGap;
      const cargoW = W - sideGap * 2;
      const cargoGroup = new THREE.Group();
      cargoGroup.userData = { isDrawerSlide: true, basePosZ: Z_frontCarcass + facadeThick / 2, maxSlideDistance: 0.42 };

      const dGeo = new THREE.BoxGeometry(cargoW, cargoH, facadeThick);
      const dMesh = new THREE.Mesh(dGeo, facadeMat);
      dMesh.castShadow = true;
      this.addEdges(dMesh, isSelected, isColliding);
      cargoGroup.add(dMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
        hGroup.position.set(0, cargoH * 0.3, facadeThick / 2);
        cargoGroup.add(hGroup);
      }

      const basket = this.createCargoBasketMesh(innerWidth, cargoH - 0.06, carcassDepth - 0.04);
      basket.position.set(0, -cargoH / 2 + 0.02, -facadeThick / 2);
      cargoGroup.add(basket);

      cargoGroup.position.set(0, plinthHeight + bottomGap + cargoH / 2, Z_frontCarcass + facadeThick / 2);
      group.add(cargoGroup);

    } else if (isDishwasher) {
      // 8.DISHWASHER: Фасад для встраиваемой ПММ
      const doorH = bodyHeight - effectiveTopGap - bottomGap;
      const doorW = W - sideGap * 2;

      // Внутренний корпус посудомойки
      const pmmMesh = this.createDishwasherMesh(W, bodyHeight, carcassDepth);
      pmmMesh.position.set(0, plinthHeight, Z_frontCarcass);
      group.add(pmmMesh);

      // Навесной фасад
      const dGeo = new THREE.BoxGeometry(doorW, doorH, facadeThick);
      const dMesh = new THREE.Mesh(dGeo, facadeMat);
      dMesh.position.set(0, plinthHeight + bottomGap + doorH / 2, Z_frontCarcass + facadeThick / 2);
      dMesh.castShadow = true;
      this.addEdges(dMesh, isSelected, isColliding);
      group.add(dMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'horizontal', handleMat);
        hGroup.position.set(0, plinthHeight + bottomGap + doorH - handleOffset - 0.02, Z_frontCarcass + facadeThick);
        group.add(hGroup);
      }

    } else if (isCombined) {
      // 8.COMBINED: 1 верхний ящик под столовые приборы + нижняя распашная дверь (или 2 двери)
      const topDrawerH = 0.14;
      const drawerW = W - sideGap * 2;
      const topDrawerPosY = plinthHeight + bodyHeight - effectiveTopGap - topDrawerH / 2;

      // 1) Верхний ящик
      const drawerGroup = new THREE.Group();
      drawerGroup.userData = { isDrawerSlide: true, basePosZ: Z_frontCarcass + facadeThick / 2, maxSlideDistance: 0.36 };
      const dGeo = new THREE.BoxGeometry(drawerW, topDrawerH, facadeThick);
      const dMesh = new THREE.Mesh(dGeo, facadeMat);
      dMesh.castShadow = true;
      this.addEdges(dMesh, isSelected, isColliding);
      drawerGroup.add(dMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
        const hPos = this.getDrawerHandlePosition(topDrawerH, handleOrientation, handlePosition, handleOffset, handleLen);
        hGroup.position.set(0, hPos.y, facadeThick / 2);
        drawerGroup.add(hGroup);
      }
      const boxD = carcassDepth - 0.05;
      const boxW = innerWidth - 0.02;
      const tandembox = this.createTandemboxMesh(boxW, topDrawerH, boxD, false);
      tandembox.position.set(0, -topDrawerH / 2, -facadeThick / 2);
      drawerGroup.add(tandembox);

      const trayW = boxW - 0.03;
      const trayD = boxD * 0.72;
      const cutleryTray = this.createCutleryTrayMesh(trayW, trayD);
      cutleryTray.position.set(0, -topDrawerH / 2 + 0.016, -facadeThick / 2 - 0.015 - trayD / 2);
      drawerGroup.add(cutleryTray);

      drawerGroup.position.set(0, topDrawerPosY, Z_frontCarcass + facadeThick / 2);
      group.add(drawerGroup);

      // Горизонтальная перегородка
      const shelfY = plinthHeight + bodyHeight - effectiveTopGap - topDrawerH - interGap / 2;
      const shelfGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, carcassDepth - 0.02);
      const shelfMesh = new THREE.Mesh(shelfGeo, carcassMat);
      shelfMesh.position.set(0, shelfY, Z_carcassCenter - 0.01);
      this.addEdges(shelfMesh, isSelected, isColliding);
      group.add(shelfMesh);

      // 2) Нижняя дверь (или 2 двери)
      const doorH = bodyHeight - effectiveTopGap - bottomGap - interGap - topDrawerH;
      const doorBaseY = plinthHeight + bottomGap + doorH / 2;
      const doorCount = module.config.doors;

      if (doorCount === 1) {
        const doorW = W - sideGap * 2;
        const isMirrored = Boolean(module.config.isMirrored);

        if (!isMirrored) {
          // Петли на левой боковине
          const topHinge = this.createHingeMesh();
          topHinge.position.set(-W / 2 + boardThick, doorBaseY + doorH / 2 - 0.08, Z_frontCarcass - 0.05);
          topHinge.rotation.y = Math.PI / 2;
          group.add(topHinge);

          const btmHinge = this.createHingeMesh();
          btmHinge.position.set(-W / 2 + boardThick, doorBaseY - doorH / 2 + 0.08, Z_frontCarcass - 0.05);
          btmHinge.rotation.y = Math.PI / 2;
          group.add(btmHinge);

          const doorPivot = new THREE.Group();
          doorPivot.position.set(-W / 2 + sideGap, doorBaseY, Z_frontCarcass);
          doorPivot.userData = { isDoorPivot: true, maxOpenAngle: -Math.PI / 2.3 };

          const dGeo2 = new THREE.BoxGeometry(doorW, doorH, facadeThick);
          const dMesh2 = new THREE.Mesh(dGeo2, facadeMat);
          dMesh2.position.set(doorW / 2, 0, facadeThick / 2);
          dMesh2.castShadow = true;
          this.addEdges(dMesh2, isSelected, isColliding);
          doorPivot.add(dMesh2);

          if (showHandle) {
            const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
            const hPos = this.getDoorHandlePosition(doorW, doorH, false, handleOrientation, handlePosition, handleOffset, handleLen);
            hGroup.position.set(hPos.x, hPos.y, facadeThick);
            doorPivot.add(hGroup);
          }
          doorPivot.rotation.y = 0;
          group.add(doorPivot);
        } else {
          // Петли на правой боковине (зеркально)
          const topHinge = this.createHingeMesh();
          topHinge.position.set(W / 2 - boardThick, doorBaseY + doorH / 2 - 0.08, Z_frontCarcass - 0.05);
          topHinge.rotation.y = -Math.PI / 2;
          group.add(topHinge);

          const btmHinge = this.createHingeMesh();
          btmHinge.position.set(W / 2 - boardThick, doorBaseY - doorH / 2 + 0.08, Z_frontCarcass - 0.05);
          btmHinge.rotation.y = -Math.PI / 2;
          group.add(btmHinge);

          const doorPivot = new THREE.Group();
          doorPivot.position.set(W / 2 - sideGap, doorBaseY, Z_frontCarcass);
          doorPivot.userData = { isDoorPivot: true, maxOpenAngle: Math.PI / 2.3 };

          const dGeo2 = new THREE.BoxGeometry(doorW, doorH, facadeThick);
          const dMesh2 = new THREE.Mesh(dGeo2, facadeMat);
          dMesh2.position.set(-doorW / 2, 0, facadeThick / 2);
          dMesh2.castShadow = true;
          this.addEdges(dMesh2, isSelected, isColliding);
          doorPivot.add(dMesh2);

          if (showHandle) {
            const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
            const hPos = this.getDoorHandlePosition(doorW, doorH, true, handleOrientation, handlePosition, handleOffset, handleLen);
            hGroup.position.set(hPos.x, hPos.y, facadeThick);
            doorPivot.add(hGroup);
          }
          doorPivot.rotation.y = 0;
          group.add(doorPivot);
        }
      } else {
        const doorW = (W - sideGap * 2 - interGap) / 2;

        // Петли левой двери
        const topHingeL = this.createHingeMesh();
        topHingeL.position.set(-W / 2 + boardThick, doorBaseY + doorH / 2 - 0.08, Z_frontCarcass - 0.05);
        topHingeL.rotation.y = Math.PI / 2;
        group.add(topHingeL);

        const btmHingeL = this.createHingeMesh();
        btmHingeL.position.set(-W / 2 + boardThick, doorBaseY - doorH / 2 + 0.08, Z_frontCarcass - 0.05);
        btmHingeL.rotation.y = Math.PI / 2;
        group.add(btmHingeL);

        const leftPivot = new THREE.Group();
        leftPivot.position.set(-W / 2 + sideGap, doorBaseY, Z_frontCarcass);
        leftPivot.userData = { isDoorPivot: true, maxOpenAngle: -Math.PI / 2.3 };

        const lGeo = new THREE.BoxGeometry(doorW, doorH, facadeThick);
        const lMesh = new THREE.Mesh(lGeo, facadeMat);
        lMesh.position.set(doorW / 2, 0, facadeThick / 2);
        lMesh.castShadow = true;
        this.addEdges(lMesh, isSelected, isColliding);
        leftPivot.add(lMesh);

        if (showHandle) {
          const lh = this.createHandleMesh(handleType, handleOrientation, handleMat);
          const hPos = this.getDoorHandlePosition(doorW, doorH, false, handleOrientation, handlePosition, handleOffset, handleLen);
          lh.position.set(hPos.x, hPos.y, facadeThick);
          leftPivot.add(lh);
        }
        leftPivot.rotation.y = 0;
        group.add(leftPivot);

        // Петли правой двери
        const topHingeR = this.createHingeMesh();
        topHingeR.position.set(W / 2 - boardThick, doorBaseY + doorH / 2 - 0.08, Z_frontCarcass - 0.05);
        topHingeR.rotation.y = -Math.PI / 2;
        group.add(topHingeR);

        const btmHingeR = this.createHingeMesh();
        btmHingeR.position.set(W / 2 - boardThick, doorBaseY - doorH / 2 + 0.08, Z_frontCarcass - 0.05);
        btmHingeR.rotation.y = -Math.PI / 2;
        group.add(btmHingeR);

        const rightPivot = new THREE.Group();
        rightPivot.position.set(W / 2 - sideGap, doorBaseY, Z_frontCarcass);
        rightPivot.userData = { isDoorPivot: true, maxOpenAngle: Math.PI / 2.3 };

        const rGeo = new THREE.BoxGeometry(doorW, doorH, facadeThick);
        const rMesh = new THREE.Mesh(rGeo, facadeMat);
        rMesh.position.set(-doorW / 2, 0, facadeThick / 2);
        rMesh.castShadow = true;
        this.addEdges(rMesh, isSelected, isColliding);
        rightPivot.add(rMesh);

        if (showHandle) {
          const rh = this.createHandleMesh(handleType, handleOrientation, handleMat);
          const hPos = this.getDoorHandlePosition(doorW, doorH, true, handleOrientation, handlePosition, handleOffset, handleLen);
          rh.position.set(hPos.x, hPos.y, facadeThick);
          rightPivot.add(rh);
        }
        rightPivot.rotation.y = 0;
        group.add(rightPivot);
      }

    } else if (isMicrowave) {
      // 8.MICROWAVE: Фасад верхней секции над открытой нишей микроволновки
      const mwNicheH = 0.38;
      const topDoorH = bodyHeight - effectiveTopGap - (mwNicheH + boardThick);
      if (topDoorH > 0.12) {
        const topDoorW = W - sideGap * 2;
        const pivotY = (isUpperCabinet ? 0 : plinthHeight) + bodyHeight - effectiveTopGap;
        const doorPivot = new THREE.Group();
        doorPivot.position.set(0, pivotY, Z_frontCarcass);
        doorPivot.userData = { isLiftDoor: true, maxOpenAngle: -Math.PI / 2.3 };

        const dGeo = new THREE.BoxGeometry(topDoorW, topDoorH, facadeThick);
        const dMesh = new THREE.Mesh(dGeo, facadeMat);
        dMesh.position.set(0, -topDoorH / 2, facadeThick / 2);
        dMesh.castShadow = true;
        this.addEdges(dMesh, isSelected, isColliding);
        doorPivot.add(dMesh);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, 'horizontal', handleMat);
          hGroup.position.set(0, -topDoorH + handleOffset + 0.015, facadeThick);
          doorPivot.add(hGroup);
        }
        group.add(doorPivot);
      }

    } else if (isAventosHF) {
      // 8.AVENTOS_HF: Складной двухфасадный подъемник (складывание гармошкой вверх)
      const totalDoorH = bodyHeight - effectiveTopGap - bottomGap + bottomOverhang;
      const panelH = (totalDoorH - interGap) / 2;
      const doorW = W - sideGap * 2;

      // Верхняя панель (вращается вверх)
      const topPivot = new THREE.Group();
      topPivot.position.set(0, (isUpperCabinet ? 0 : plinthHeight) + bodyHeight - effectiveTopGap, Z_frontCarcass);
      topPivot.userData = { isLiftDoor: true, maxOpenAngle: -Math.PI / 3.0 };

      const topGeo = new THREE.BoxGeometry(doorW, panelH, facadeThick);
      const topMesh = new THREE.Mesh(topGeo, facadeMat);
      topMesh.position.set(0, -panelH / 2, facadeThick / 2);
      topMesh.castShadow = true;
      this.addEdges(topMesh, isSelected, isColliding);
      topPivot.add(topMesh);

      // Нижняя панель (складывается вперед относительно низа верхней панели)
      const bottomPivot = new THREE.Group();
      bottomPivot.position.set(0, -panelH, 0);
      bottomPivot.userData = { isAventosFold: true, foldAngle: Math.PI / 2.5 };

      const btmGeo = new THREE.BoxGeometry(doorW, panelH, facadeThick);
      const bMesh = new THREE.Mesh(btmGeo, facadeMat);
      bMesh.position.set(0, -panelH / 2, facadeThick / 2);
      bMesh.castShadow = true;
      this.addEdges(bMesh, isSelected, isColliding);
      bottomPivot.add(bMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'horizontal', handleMat);
        hGroup.position.set(0, -panelH + handleOffset + 0.015, facadeThick);
        bottomPivot.add(hGroup);
      }
      topPivot.add(bottomPivot);
      group.add(topPivot);

    } else if (isDoubleLift) {
      // 8.DOUBLE_LIFT: Два независимых горизонтальных фасада на подъемниках
      const totalDoorH = bodyHeight - effectiveTopGap - bottomGap + bottomOverhang;
      const panelH = (totalDoorH - interGap) / 2;
      const doorW = W - sideGap * 2;

      // 1) Верхний фасад
      const topPivot = new THREE.Group();
      topPivot.position.set(0, (isUpperCabinet ? 0 : plinthHeight) + bodyHeight - effectiveTopGap, Z_frontCarcass);
      topPivot.userData = { isLiftDoor: true, maxOpenAngle: -Math.PI / 2.3 };

      const topGeo = new THREE.BoxGeometry(doorW, panelH, facadeThick);
      const topMesh = new THREE.Mesh(topGeo, facadeMat);
      topMesh.position.set(0, -panelH / 2, facadeThick / 2);
      topMesh.castShadow = true;
      this.addEdges(topMesh, isSelected, isColliding);
      topPivot.add(topMesh);

      if (showHandle) {
        const th = this.createHandleMesh(handleType, 'horizontal', handleMat);
        th.position.set(0, -panelH + handleOffset + 0.015, facadeThick);
        topPivot.add(th);
      }
      group.add(topPivot);

      // 2) Нижний фасад
      const btmPivot = new THREE.Group();
      btmPivot.position.set(0, (isUpperCabinet ? 0 : plinthHeight) + bottomGap - bottomOverhang + panelH, Z_frontCarcass);
      btmPivot.userData = { isLiftDoor: true, maxOpenAngle: -Math.PI / 2.3 };

      const btmGeo = new THREE.BoxGeometry(doorW, panelH, facadeThick);
      const btmMesh = new THREE.Mesh(btmGeo, facadeMat);
      btmMesh.position.set(0, -panelH / 2, facadeThick / 2);
      btmMesh.castShadow = true;
      this.addEdges(btmMesh, isSelected, isColliding);
      btmPivot.add(btmMesh);

      if (showHandle) {
        const bh = this.createHandleMesh(handleType, 'horizontal', handleMat);
        bh.position.set(0, -panelH + handleOffset + 0.015, facadeThick);
        btmPivot.add(bh);
      }
      group.add(btmPivot);

    } else if (isLift) {
      // 8.LIFT: Одинарный поворотный подъемник (Aventos HK / HK-S / газлифт)
      const doorW = W - sideGap * 2;
      const doorH = bodyHeight - effectiveTopGap - bottomGap + bottomOverhang;
      const doorPivot = new THREE.Group();
      doorPivot.position.set(0, (isUpperCabinet ? 0 : plinthHeight) + bodyHeight - effectiveTopGap, Z_frontCarcass);
      doorPivot.userData = { isLiftDoor: true, maxOpenAngle: -Math.PI / 2.3 };

      const dGeo = new THREE.BoxGeometry(doorW, doorH, facadeThick);
      const dMesh = new THREE.Mesh(dGeo, facadeMat);
      dMesh.position.set(0, -doorH / 2, facadeThick / 2);
      dMesh.castShadow = true;
      this.addEdges(dMesh, isSelected, isColliding);
      doorPivot.add(dMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'horizontal', handleMat);
        hGroup.position.set(0, -doorH + handleOffset + 0.015, facadeThick);
        doorPivot.add(hGroup);
      }
      group.add(doorPivot);

    } else if (isBlindCorner) {
      // 8.A. УГЛОВОЙ МОДУЛЬ С ФАЛЬШ-ПАНЕЛЬЮ (BLIND CORNER CABINET)
      // Для верхних навесных шкафов:
      // 1) Единая фальш-панель 370 мм (320 мм глухая зона + 50 мм угловой добор).
      // 2) Торцевая возвратная планка 32 мм торцом наружу крепится прямо к единой панели на отметке 320 мм (dockX).
      // 3) 2 внутренние планки-упора из ЛДСП торцом вглубь:
      //    - первая прямо за нашей МДФ-планкой 32 мм (на отметке dockX)
      //    - вторая на расстоянии 50 мм от края глухой зоны (от боковины у стены).
      //    Эти планки служат жестким упором для каркаса соседнего примыкающего шкафа.
      // Высота фасадов и декор-угла: при свесе опускаются на уровень фасадов; без свеса — вровень с каркасом.
      // Для верхних навесных шкафов: декор-угол 50 мм + планка 32 мм (угол 32x32 мм)
      // Для нижних баз:
      // При ручке Gola (свес 36 мм): добор 36 мм, торцевая планка 18 мм (угол 18x18 мм под фасад 18 мм)
      // При накладной ручке (свес 50 мм): добор 50 мм, торцевая планка 32 мм (угол 32x32 мм под фасад 18 мм)
      const baseCornerFillerWidth = overhangFront;
      const baseReturnPlankWidth = Math.max(0.005, overhangFront - facadeThick);
      const cornerFillerWidth = isUpperCabinet ? 0.050 : baseCornerFillerWidth;
      const returnPlankWidth = isUpperCabinet ? 0.032 : baseReturnPlankWidth;
      const unifiedPanelWidth = blindWidth + cornerFillerWidth; // 370 мм единая фальш-панель для верхних
      const cornerAssemblyWidth = isUpperCabinet ? unifiedPanelWidth : blindWidth;
      const blindPanelWidth = isUpperCabinet ? blindWidth : (blindWidth - cornerFillerWidth);

      const doorHeight = bodyHeight - effectiveTopGap - bottomGap + bottomOverhang;
      const doorWidth = (W - cornerAssemblyWidth) - sideGap - (interGap / 2);
      const doorPosY = (isUpperCabinet ? 0 : plinthHeight) + bottomGap - bottomOverhang + doorHeight / 2;

      // Параметрическая высота декор-угла по свесу:
      const hasBottomOverhang = isUpperCabinet && bottomOverhang > 0.005;
      const fillerHeight = hasBottomOverhang ? doorHeight : bodyHeight;
      const fillerPosY = hasBottomOverhang ? doorPosY : ((isUpperCabinet ? 0 : plinthHeight) + bodyHeight / 2);

      // Внутренние параметры стоек/планок-упоров:
      const pillarThick = boardThick; // 16 мм
      const pillarDepth = 0.08; // 80 мм глубина планок
      const pillarHeight = isBaseOrCorner ? bodyHeight - boardThick : bodyHeight - boardThick * 2;
      const pillarPosY = plinthHeight + boardThick + pillarHeight / 2;
      const pillarZ = Z_frontCarcass - pillarDepth / 2;

      if (!isRightCorner) {
        // --- ЛЕВЫЙ УГЛОВОЙ МОДУЛЬ (Глухая зона слева, дверь справа) ---
        const dockX = -W / 2 + blindWidth;

        if (isUpperCabinet) {
          // 1) Единая фальш-панель 370 мм (320 мм глухая зона + 50 мм угловой добор)
          const uniGeo = new THREE.BoxGeometry(unifiedPanelWidth, fillerHeight, facadeThick);
          const uniMesh = new THREE.Mesh(uniGeo, facadeMat);
          uniMesh.position.set(-W / 2 + unifiedPanelWidth / 2, fillerPosY, Z_facadeCenter);
          uniMesh.castShadow = true;
          this.addEdges(uniMesh, isSelected, isColliding);
          group.add(uniMesh);

          // 2) Торцевая возвратная планка 32 мм (толщина 18 мм) — НАРУЖУ (+Z) от единой панели
          // Крепится на отметке dockX = -W/2 + blindWidth (320 мм).
          // Внешняя плоскость dockX служит стыком 90° для примыкающего шкафа.
          // Справа от нее остается 370 - (320 + 18) = 32 мм лицевой панели -> угол 32x32 мм!
          const retGeo = new THREE.BoxGeometry(facadeThick, fillerHeight, returnPlankWidth);
          const retMesh = new THREE.Mesh(retGeo, facadeMat);
          retMesh.position.set(
            dockX + facadeThick / 2,
            fillerPosY,
            Z_frontCarcass + facadeThick + returnPlankWidth / 2
          );
          retMesh.castShadow = true;
          this.addEdges(retMesh, isSelected, isColliding);
          group.add(retMesh);

          // 3) Две наружные упорные планки из ЛДСП (толщина 16 мм, глубина 32 мм торцом наружу от единой панели):
          // Обе планки выступают вперед на 32 мм (+Z) в глухой зоне — служат жестким упором для каркаса соседнего шкафа!
          // Планка 1: прямо за нашей МДФ-планкой (в глухой зоне встык к ней: от dockX - boardThick до dockX)
          const stop1Geo = new THREE.BoxGeometry(boardThick, fillerHeight, returnPlankWidth);
          const stop1Mesh = new THREE.Mesh(stop1Geo, carcassMat);
          stop1Mesh.position.set(
            dockX - boardThick / 2,
            fillerPosY,
            Z_frontCarcass + facadeThick + returnPlankWidth / 2
          );
          stop1Mesh.castShadow = true;
          this.addEdges(stop1Mesh, isSelected, isColliding);
          group.add(stop1Mesh);

          // Планка 2: на расстоянии 50 мм от левого края глухой зоны (от боковины у стены: от -W/2 + 50 мм)
          const stop2Geo = new THREE.BoxGeometry(boardThick, fillerHeight, returnPlankWidth);
          const stop2Mesh = new THREE.Mesh(stop2Geo, carcassMat);
          stop2Mesh.position.set(
            -W / 2 + 0.050 + boardThick / 2,
            fillerPosY,
            Z_frontCarcass + facadeThick + returnPlankWidth / 2
          );
          stop2Mesh.castShadow = true;
          this.addEdges(stop2Mesh, isSelected, isColliding);
          group.add(stop2Mesh);

        } else {
          // Для нижних баз:
          // 1) Фальш-панель глухой зоны
          const bpGeo = new THREE.BoxGeometry(blindPanelWidth, bodyHeight, facadeThick);
          const bpMesh = new THREE.Mesh(bpGeo, facadeMat);
          bpMesh.position.set(-W / 2 + blindPanelWidth / 2, plinthHeight + bodyHeight / 2, Z_facadeCenter);
          bpMesh.castShadow = true;
          this.addEdges(bpMesh, isSelected, isColliding);
          group.add(bpMesh);

          // 2) Угловой добор вровень с фасадом (36 мм под Gola, 50 мм под накладную)
          const spGeo = new THREE.BoxGeometry(cornerFillerWidth, bodyHeight, facadeThick * 1.05);
          const spMesh = new THREE.Mesh(spGeo, facadeMat);
          spMesh.position.set(-W / 2 + blindPanelWidth + cornerFillerWidth / 2, plinthHeight + bodyHeight / 2, Z_facadeCenter);
          spMesh.castShadow = true;
          this.addEdges(spMesh, isSelected, isColliding);
          group.add(spMesh);

          // 3) Торцевая планка (18 мм под Gola, 32 мм под накладную) + 2 упорные планки из ЛДСП
          if (returnPlankWidth > 0.005) {
            const retGeo = new THREE.BoxGeometry(facadeThick, bodyHeight, returnPlankWidth);
            const retMesh = new THREE.Mesh(retGeo, facadeMat);
            retMesh.position.set(
              -W / 2 + blindWidth - cornerFillerWidth + facadeThick / 2,
              plinthHeight + bodyHeight / 2,
              Z_frontCarcass + facadeThick + returnPlankWidth / 2
            );
            retMesh.castShadow = true;
            this.addEdges(retMesh, isSelected, isColliding);
            group.add(retMesh);

            const stop1Geo = new THREE.BoxGeometry(boardThick, bodyHeight, returnPlankWidth);
            const stop1Mesh = new THREE.Mesh(stop1Geo, carcassMat);
            stop1Mesh.position.set(
              -W / 2 + blindWidth - cornerFillerWidth - boardThick / 2,
              plinthHeight + bodyHeight / 2,
              Z_frontCarcass + facadeThick + returnPlankWidth / 2
            );
            stop1Mesh.castShadow = true;
            this.addEdges(stop1Mesh, isSelected, isColliding);
            group.add(stop1Mesh);

            const stop2Geo = new THREE.BoxGeometry(boardThick, bodyHeight, returnPlankWidth);
            const stop2Mesh = new THREE.Mesh(stop2Geo, carcassMat);
            stop2Mesh.position.set(
              -W / 2 + 0.050 + boardThick / 2,
              plinthHeight + bodyHeight / 2,
              Z_frontCarcass + facadeThick + returnPlankWidth / 2
            );
            stop2Mesh.castShadow = true;
            this.addEdges(stop2Mesh, isSelected, isColliding);
            group.add(stop2Mesh);
          }
        }

        // 4) Внутренняя вертикальная планка под петли (от дна до крышки)
        const pillarGeo = new THREE.BoxGeometry(pillarThick, pillarHeight, pillarDepth);
        const pillarMesh = new THREE.Mesh(pillarGeo, carcassMat);
        const pillarX = isUpperCabinet
          ? dockX + cornerFillerWidth - pillarThick / 2
          : -W / 2 + blindWidth - pillarThick / 2;
        pillarMesh.position.set(pillarX, pillarPosY, pillarZ);
        this.addEdges(pillarMesh, isSelected, isColliding);
        group.add(pillarMesh);

        // 5) Распашная дверь
        const pivotX = isUpperCabinet
          ? dockX + cornerFillerWidth + (interGap / 2)
          : -W / 2 + blindWidth + (interGap / 2);
        const doorPivot = new THREE.Group();
        doorPivot.position.set(pivotX, doorPosY, Z_frontCarcass);
        doorPivot.userData = { isDoorPivot: true, maxOpenAngle: -Math.PI / 2.3 };

        const dGeo = new THREE.BoxGeometry(doorWidth, doorHeight, facadeThick);
        const dMesh = new THREE.Mesh(dGeo, facadeMat);
        dMesh.position.set(doorWidth / 2, 0, facadeThick / 2);
        dMesh.castShadow = true;
        this.addEdges(dMesh, isSelected, isColliding);
        doorPivot.add(dMesh);

        // Петли
        const topHinge = this.createHingeMesh();
        topHinge.position.set(pivotX + 0.005, (isUpperCabinet ? 0 : plinthHeight) + bodyHeight - 0.12, Z_frontCarcass - 0.04);
        topHinge.rotation.y = Math.PI / 2;
        group.add(topHinge);

        const btmHinge = this.createHingeMesh();
        btmHinge.position.set(pivotX + 0.005, (isUpperCabinet ? 0 : plinthHeight) + 0.12, Z_frontCarcass - 0.04);
        btmHinge.rotation.y = Math.PI / 2;
        group.add(btmHinge);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
          const hPos = this.getDoorHandlePosition(doorWidth, doorHeight, false, handleOrientation, handlePosition, handleOffset, handleLen);
          hGroup.position.set(hPos.x, hPos.y, facadeThick);
          doorPivot.add(hGroup);
        }

        doorPivot.rotation.y = 0;
        group.add(doorPivot);

      } else {
        // --- ПРАВЫЙ УГЛОВОЙ МОДУЛЬ (ЗЕРКАЛЬНЫЙ: Дверь слева, глухая зона справа) ---
        const dockX = W / 2 - blindWidth;

        if (isWallCabinet) {
          // 1) Единая фальш-панель 370 мм (320 мм глухая зона + 50 мм угловой добор)
          const uniGeo = new THREE.BoxGeometry(unifiedPanelWidth, fillerHeight, facadeThick);
          const uniMesh = new THREE.Mesh(uniGeo, facadeMat);
          uniMesh.position.set(W / 2 - unifiedPanelWidth / 2, fillerPosY, Z_facadeCenter);
          uniMesh.castShadow = true;
          this.addEdges(uniMesh, isSelected, isColliding);
          group.add(uniMesh);

          // 2) Торцевая возвратная планка 32 мм (толщина 18 мм) — НАРУЖУ (+Z) от единой панели
          // Крепится на отметке dockX = W/2 - blindWidth (320 мм).
          // Внешняя плоскость dockX служит стыком 90° для примыкающего шкафа.
          // Слева от нее остается 370 - (320 + 18) = 32 мм лицевой панели -> угол 32x32 мм!
          const retGeo = new THREE.BoxGeometry(facadeThick, fillerHeight, returnPlankWidth);
          const retMesh = new THREE.Mesh(retGeo, facadeMat);
          retMesh.position.set(
            dockX - facadeThick / 2,
            fillerPosY,
            Z_frontCarcass + facadeThick + returnPlankWidth / 2
          );
          retMesh.castShadow = true;
          this.addEdges(retMesh, isSelected, isColliding);
          group.add(retMesh);

          // 3) Две наружные упорные планки из ЛДСП (толщина 16 мм, глубина 32 мм торцом наружу от единой панели):
          // Обе планки выступают вперед на 32 мм (+Z) в глухой зоне — служат жестким упором для каркаса соседнего шкафа!
          // Планка 1: прямо за нашей МДФ-планкой (в глухой зоне встык к ней: от dockX до dockX + boardThick)
          const stop1Geo = new THREE.BoxGeometry(boardThick, fillerHeight, returnPlankWidth);
          const stop1Mesh = new THREE.Mesh(stop1Geo, carcassMat);
          stop1Mesh.position.set(
            dockX + boardThick / 2,
            fillerPosY,
            Z_frontCarcass + facadeThick + returnPlankWidth / 2
          );
          stop1Mesh.castShadow = true;
          this.addEdges(stop1Mesh, isSelected, isColliding);
          group.add(stop1Mesh);

          // Планка 2: на расстоянии 50 мм от правого края глухой зоны (от боковины у стены: от W/2 - 50 мм)
          const stop2Geo = new THREE.BoxGeometry(boardThick, fillerHeight, returnPlankWidth);
          const stop2Mesh = new THREE.Mesh(stop2Geo, carcassMat);
          stop2Mesh.position.set(
            W / 2 - 0.050 - boardThick / 2,
            fillerPosY,
            Z_frontCarcass + facadeThick + returnPlankWidth / 2
          );
          stop2Mesh.castShadow = true;
          this.addEdges(stop2Mesh, isSelected, isColliding);
          group.add(stop2Mesh);

        } else {
          // Для нижних баз:
          // 1) Фальш-панель глухой зоны
          const bpGeo = new THREE.BoxGeometry(blindPanelWidth, bodyHeight, facadeThick);
          const bpMesh = new THREE.Mesh(bpGeo, facadeMat);
          bpMesh.position.set(W / 2 - blindPanelWidth / 2, plinthHeight + bodyHeight / 2, Z_facadeCenter);
          bpMesh.castShadow = true;
          this.addEdges(bpMesh, isSelected, isColliding);
          group.add(bpMesh);

          // 2) Угловой добор вровень с фасадом (36 мм под Gola, 50 мм под накладную)
          const spGeo = new THREE.BoxGeometry(cornerFillerWidth, bodyHeight, facadeThick * 1.05);
          const spMesh = new THREE.Mesh(spGeo, facadeMat);
          spMesh.position.set(W / 2 - blindWidth + cornerFillerWidth / 2, plinthHeight + bodyHeight / 2, Z_facadeCenter);
          spMesh.castShadow = true;
          this.addEdges(spMesh, isSelected, isColliding);
          group.add(spMesh);

          // 3) Торцевая планка (18 мм под Gola, 32 мм под накладную) + 2 упорные планки из ЛДСП
          if (returnPlankWidth > 0.005) {
            const retGeo = new THREE.BoxGeometry(facadeThick, bodyHeight, returnPlankWidth);
            const retMesh = new THREE.Mesh(retGeo, facadeMat);
            retMesh.position.set(
              W / 2 - blindWidth + cornerFillerWidth - facadeThick / 2,
              plinthHeight + bodyHeight / 2,
              Z_frontCarcass + facadeThick + returnPlankWidth / 2
            );
            retMesh.castShadow = true;
            this.addEdges(retMesh, isSelected, isColliding);
            group.add(retMesh);

            const stop1Geo = new THREE.BoxGeometry(boardThick, bodyHeight, returnPlankWidth);
            const stop1Mesh = new THREE.Mesh(stop1Geo, carcassMat);
            stop1Mesh.position.set(
              W / 2 - blindWidth + cornerFillerWidth + boardThick / 2,
              plinthHeight + bodyHeight / 2,
              Z_frontCarcass + facadeThick + returnPlankWidth / 2
            );
            stop1Mesh.castShadow = true;
            this.addEdges(stop1Mesh, isSelected, isColliding);
            group.add(stop1Mesh);

            const stop2Geo = new THREE.BoxGeometry(boardThick, bodyHeight, returnPlankWidth);
            const stop2Mesh = new THREE.Mesh(stop2Geo, carcassMat);
            stop2Mesh.position.set(
              W / 2 - 0.050 - boardThick / 2,
              plinthHeight + bodyHeight / 2,
              Z_frontCarcass + facadeThick + returnPlankWidth / 2
            );
            stop2Mesh.castShadow = true;
            this.addEdges(stop2Mesh, isSelected, isColliding);
            group.add(stop2Mesh);
          }
        }

        // 4) Внутренняя вертикальная планка под петли (от дна до крышки)
        const pillarGeo = new THREE.BoxGeometry(pillarThick, pillarHeight, pillarDepth);
        const pillarMesh = new THREE.Mesh(pillarGeo, carcassMat);
        const pillarX = isUpperCabinet
          ? dockX - cornerFillerWidth + pillarThick / 2
          : W / 2 - blindWidth + pillarThick / 2;
        pillarMesh.position.set(pillarX, pillarPosY, pillarZ);
        this.addEdges(pillarMesh, isSelected, isColliding);
        group.add(pillarMesh);

        // 5) Распашная дверь
        const pivotX = isUpperCabinet
          ? dockX - cornerFillerWidth - (interGap / 2)
          : W / 2 - blindWidth - (interGap / 2);
        const doorPivot = new THREE.Group();
        doorPivot.position.set(pivotX, doorPosY, Z_frontCarcass);
        doorPivot.userData = { isDoorPivot: true, maxOpenAngle: Math.PI / 2.3 };

        const dGeo = new THREE.BoxGeometry(doorWidth, doorHeight, facadeThick);
        const dMesh = new THREE.Mesh(dGeo, facadeMat);
        dMesh.position.set(-doorWidth / 2, 0, facadeThick / 2);
        dMesh.castShadow = true;
        this.addEdges(dMesh, isSelected, isColliding);
        doorPivot.add(dMesh);

        // Петли
        const topHinge = this.createHingeMesh();
        topHinge.position.set(pivotX - 0.005, (isUpperCabinet ? 0 : plinthHeight) + bodyHeight - 0.12, Z_frontCarcass - 0.04);
        topHinge.rotation.y = -Math.PI / 2;
        group.add(topHinge);

        const btmHinge = this.createHingeMesh();
        btmHinge.position.set(pivotX - 0.005, (isUpperCabinet ? 0 : plinthHeight) + 0.12, Z_frontCarcass - 0.04);
        btmHinge.rotation.y = -Math.PI / 2;
        group.add(btmHinge);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
          const hPos = this.getDoorHandlePosition(doorWidth, doorHeight, true, handleOrientation, handlePosition, handleOffset, handleLen);
          hGroup.position.set(hPos.x, hPos.y, facadeThick);
          doorPivot.add(hGroup);
        }

        doorPivot.rotation.y = 0;
        group.add(doorPivot);
      }

    } else if (module.config.drawers > 0) {
      // 8.B. МОДУЛИ С ВЫДВИЖНЫМИ ЯЩИКАМИ (ВКЛЮЧАЯ 3 ЯЩИКА: 1 ПОД ПРИБОРЫ + 2 ГЛУБОКИХ)
      const drawerW = W - sideGap * 2;

      for (let d = 0; d < drawerCount; d++) {
        const h = dHeights[d];
        const isTopCutlery = isThreeDrawers && d === drawerCount - 1;
        const isDeepPots = isThreeDrawers && (d === 0 || d === 1);

        const drawerGroup = new THREE.Group();
        const maxSlide = isTopCutlery ? 0.36 : (isDeepPots && d === 1 ? 0.28 : 0.20);
        const basePosZ = Z_frontCarcass + facadeThick / 2;
        drawerGroup.userData = { isDrawerSlide: true, basePosZ, maxSlideDistance: maxSlide };

        // 1) Фасадная панель ящика (с учетом боковых зазоров sideGap)
        const dGeo = new THREE.BoxGeometry(drawerW, h, facadeThick);
        const dMesh = new THREE.Mesh(dGeo, facadeMat);
        dMesh.castShadow = true;
        this.addEdges(dMesh, isSelected, isColliding);
        drawerGroup.add(dMesh);

        // 2) Ручка ящика
        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
          const hPos = this.getDrawerHandlePosition(h, handleOrientation, handlePosition, handleOffset, handleLen);
          hGroup.position.set(0, hPos.y, facadeThick / 2);
          drawerGroup.add(hGroup);
        }

        // 3) Внутренний короб Tandembox (боковины, дно, задняя стенка)
        const boxD = carcassDepth - 0.05;
        const boxW = innerWidth - 0.02;
        const tandembox = this.createTandemboxMesh(boxW, h, boxD, isDeepPots);
        tandembox.position.set(0, -h / 2, -facadeThick / 2);
        drawerGroup.add(tandembox);

        // 4) В верхнем ящике: вкладываем лоток-органайзер со столовыми приборами!
        if (isTopCutlery) {
          const trayW = boxW - 0.03;
          const trayD = boxD * 0.72;
          const cutleryTray = this.createCutleryTrayMesh(trayW, trayD);
          // Позиционируем строго внутри короба: передний бортик лотка отступает назад от фасада на 15 мм
          const trayPosZ = -facadeThick / 2 - 0.015 - trayD / 2;
          cutleryTray.position.set(0, -h / 2 + 0.016, trayPosZ);
          drawerGroup.add(cutleryTray);
        }

        const posY = (drawerBottomYs[d] ?? ((isUpperCabinet ? 0 : plinthHeight) + bottomGap)) + h / 2;
        const posZ = basePosZ;
        drawerGroup.position.set(0, posY, posZ);
        group.add(drawerGroup);
      }

    } else if (module.config.doors > 0) {
      // 8.C. РАСПАШНЫЕ ДВЕРИ
      const doorCount = module.config.doors;
      // Для навесных шкафов: фасад может иметь свес вниз (bottomOverhang, например 20 мм) для хвата снизу
      const doorHeight = bodyHeight - effectiveTopGap - bottomGap + bottomOverhang;
      const doorBaseY = (isUpperCabinet ? 0 : plinthHeight) + bottomGap - bottomOverhang + doorHeight / 2;

      if (doorCount === 1) {
        const doorWidth = W - sideGap * 2;
        const isMirrored = Boolean(module.config.isMirrored);

        if (!isMirrored) {
          // Внутренние мебельные петли на левой боковине корпуса (стандарт)
          const topHinge = this.createHingeMesh();
          topHinge.position.set(-W / 2 + boardThick, plinthHeight + bodyHeight - 0.12, Z_frontCarcass - 0.05);
          topHinge.rotation.y = Math.PI / 2;
          group.add(topHinge);

          const btmHinge = this.createHingeMesh();
          btmHinge.position.set(-W / 2 + boardThick, plinthHeight + 0.12, Z_frontCarcass - 0.05);
          btmHinge.rotation.y = Math.PI / 2;
          group.add(btmHinge);

          const doorPivot = new THREE.Group();
          doorPivot.position.set(-W / 2 + sideGap, doorBaseY, Z_frontCarcass);
          doorPivot.userData = { isDoorPivot: true, maxOpenAngle: -Math.PI / 2.3 };

          const dGeo = new THREE.BoxGeometry(doorWidth, doorHeight, facadeThick);
          const dMesh = new THREE.Mesh(dGeo, facadeMat);
          dMesh.position.set(doorWidth / 2, 0, facadeThick / 2);
          dMesh.castShadow = true;
          this.addEdges(dMesh, isSelected, isColliding);
          doorPivot.add(dMesh);

          // Ручка на правой стороне двери
          if (showHandle) {
            const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
            const hPos = this.getDoorHandlePosition(doorWidth, doorHeight, false, handleOrientation, handlePosition, handleOffset, handleLen);
            hGroup.position.set(hPos.x, hPos.y, facadeThick);
            doorPivot.add(hGroup);
          }

          doorPivot.rotation.y = 0;
          group.add(doorPivot);
        } else {
          // Внутренние мебельные петли на правой боковине корпуса (зеркально)
          const topHinge = this.createHingeMesh();
          topHinge.position.set(W / 2 - boardThick, plinthHeight + bodyHeight - 0.12, Z_frontCarcass - 0.05);
          topHinge.rotation.y = -Math.PI / 2;
          group.add(topHinge);

          const btmHinge = this.createHingeMesh();
          btmHinge.position.set(W / 2 - boardThick, plinthHeight + 0.12, Z_frontCarcass - 0.05);
          btmHinge.rotation.y = -Math.PI / 2;
          group.add(btmHinge);

          const doorPivot = new THREE.Group();
          doorPivot.position.set(W / 2 - sideGap, doorBaseY, Z_frontCarcass);
          doorPivot.userData = { isDoorPivot: true, maxOpenAngle: Math.PI / 2.3 };

          const dGeo = new THREE.BoxGeometry(doorWidth, doorHeight, facadeThick);
          const dMesh = new THREE.Mesh(dGeo, facadeMat);
          dMesh.position.set(-doorWidth / 2, 0, facadeThick / 2);
          dMesh.castShadow = true;
          this.addEdges(dMesh, isSelected, isColliding);
          doorPivot.add(dMesh);

          // Ручка на левой стороне двери
          if (showHandle) {
            const hGroup = this.createHandleMesh(handleType, handleOrientation, handleMat);
            const hPos = this.getDoorHandlePosition(doorWidth, doorHeight, true, handleOrientation, handlePosition, handleOffset, handleLen);
            hGroup.position.set(hPos.x, hPos.y, facadeThick);
            doorPivot.add(hGroup);
          }

          doorPivot.rotation.y = 0;
          group.add(doorPivot);
        }
      } else {
        // Двухдверная тумба: зазоры по бокам sideGap, между дверями interGap
        const doorWidth = (W - sideGap * 2 - interGap) / 2;

        const leftPivot = new THREE.Group();
        leftPivot.position.set(-W / 2 + sideGap, doorBaseY, Z_frontCarcass);
        leftPivot.userData = { isDoorPivot: true, maxOpenAngle: -Math.PI / 2.3 };

        const lGeo = new THREE.BoxGeometry(doorWidth, doorHeight, facadeThick);
        const lMesh = new THREE.Mesh(lGeo, facadeMat);
        lMesh.position.set(doorWidth / 2, 0, facadeThick / 2);
        lMesh.castShadow = true;
        this.addEdges(lMesh, isSelected, isColliding);
        leftPivot.add(lMesh);

        if (showHandle) {
          const lHandle = this.createHandleMesh(handleType, handleOrientation, handleMat);
          const hPos = this.getDoorHandlePosition(doorWidth, doorHeight, false, handleOrientation, handlePosition, handleOffset, handleLen);
          lHandle.position.set(hPos.x, hPos.y, facadeThick);
          leftPivot.add(lHandle);
        }
        leftPivot.rotation.y = 0;
        group.add(leftPivot);

        const rightPivot = new THREE.Group();
        rightPivot.position.set(W / 2 - sideGap, doorBaseY, Z_frontCarcass);
        rightPivot.userData = { isDoorPivot: true, maxOpenAngle: Math.PI / 2.3 };

        const rGeo = new THREE.BoxGeometry(doorWidth, doorHeight, facadeThick);
        const rMesh = new THREE.Mesh(rGeo, facadeMat);
        rMesh.position.set(-doorWidth / 2, 0, facadeThick / 2);
        rMesh.castShadow = true;
        this.addEdges(rMesh, isSelected, isColliding);
        rightPivot.add(rMesh);

        if (showHandle) {
          const rHandle = this.createHandleMesh(handleType, handleOrientation, handleMat);
          const hPos = this.getDoorHandlePosition(doorWidth, doorHeight, true, handleOrientation, handlePosition, handleOffset, handleLen);
          rHandle.position.set(hPos.x, hPos.y, facadeThick);
          rightPivot.add(rHandle);
        }
        rightPivot.rotation.y = 0;
        group.add(rightPivot);
      }
    }

    // 9. 3D РАЗМЕРНАЯ ЛИНИЯ НАД ШКАФОМ (КРАСНАЯ ПРИ КОЛЛИЗИИ)
    if (!isThumbnail) {
      const dimSprite = this.createDimensionSprite(String(module.dimensions.width), isColliding);
      dimSprite.position.set(0, H + (module.config.hasCountertop ? 0.14 : 0.08), D / 2);
      dimSprite.visible = options?.showDimensions !== false;
      group.add(dimSprite);
    }

    // 10. ТОЧНЫЙ 3D КОЛЛАЙДЕР (СТРОГО ПО ГАБАРИТУ СТОЛЕШНИЦЫ W × H × D)
    const totalH = H + (module.config.hasCountertop ? topThick : 0);
    const colliderGeo = new THREE.BoxGeometry(W, totalH, D);
    
    // Если коллизия активна, делаем коллайдер полупрозрачно красным, чтобы пользователь видел область пересечения!
    const colliderMat = new THREE.MeshBasicMaterial({
      color: isColliding ? 0xef4444 : 0xffffff,
      transparent: true,
      opacity: isColliding ? 0.25 : 0,
      depthWrite: false,
    });
    const collider = new THREE.Mesh(colliderGeo, colliderMat);
    collider.position.set(0, totalH / 2, 0);
    collider.name = 'raycast_collider';
    collider.userData = { isModuleCollider: true, moduleId: module.id };
    group.add(collider);

    // В режиме "Рентген" (контуры мебели) все элементы становятся полупрозрачными,
    // а CAD-контуры остаются четкими и яркими, чтобы розетки и трубы сзади просвечивали
    if (isWireframe) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && !child.userData?.isModuleCollider) {
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              m.transparent = true;
              m.opacity = Math.min(m.opacity ?? 1, 0.18);
              m.depthWrite = false;
            });
          }
        } else if (child instanceof THREE.LineSegments) {
          if (!isSelected && !isColliding) {
            child.material = ModuleBuilder.wireframeEdgeMaterial;
          }
        }
      });
    }

    group.position.set(module.position.x / 1000, module.position.y / 1000, module.position.z / 1000);
    group.rotation.y = THREE.MathUtils.degToRad(module.rotation);

    ModuleBuilder.applyMetricUVsToGroup(group);

    return group;
  }

  /**
   * Сборка фасадов и внутреннего наполнения кухонных пеналов (колонн)
   */
  private static buildTallCabinetInteriorAndFacades(
    group: THREE.Group,
    module: FurnitureModule,
    p: {
      W: number;
      H: number;
      D: number;
      carcassDepth: number;
      boardThick: number;
      plinthHeight: number;
      bodyHeight: number;
      innerWidth: number;
      facadeThick: number;
      Z_frontCarcass: number;
      Z_carcassCenter: number;
      Z_facadeCenter: number;
      sideGap: number;
      topGap: number;
      bottomGap: number;
      interGap: number;
      handleType: any;
      showHandle: boolean;
      handleMat: THREE.Material;
      facadeMat: THREE.Material;
      carcassMat: THREE.Material;
      isSelected: boolean;
      isColliding: boolean;
    }
  ) {
    const { W, H, innerWidth, facadeThick, Z_frontCarcass, Z_carcassCenter, Z_facadeCenter, sideGap, topGap, bottomGap, interGap, boardThick, plinthHeight, bodyHeight, carcassDepth, showHandle, handleType, handleMat, facadeMat, carcassMat, isSelected, isColliding } = p;

    // Линия столешницы: стандарт 860 мм от пола
    const baseLevelH = 0.860;
    const lowerSectionH = baseLevelH - plinthHeight;
    const lowerFacadeH = lowerSectionH - bottomGap - interGap / 2;
    const upperFacadeH = H - topGap - (baseLevelH + interGap / 2);
    const isMirrored = Boolean(module.config?.isMirrored);

    const specialTall = (module.config as any)?.specialTallType ||
      (module.id.includes('oven_mw') ? 'oven_mw' :
       module.id.includes('oven') ? 'oven' :
       module.id.includes('fridge') ? 'fridge' :
       module.id.includes('pantry') ? 'pantry' :
       module.id.includes('spacetower') ? 'spacetower' :
       module.id.includes('cargo') ? 'cargo' : 'pantry');

    if (specialTall === 'oven_mw') {
      // 1. ДУХОВКА + СВЧ В КОЛОННЕ
      // Снизу 2 выдвижных ящика до отметки 860 мм
      const dH = (lowerFacadeH - interGap) / 2;
      const dW = W - sideGap * 2;
      for (let i = 0; i < 2; i++) {
        const dY = plinthHeight + bottomGap + dH / 2 + i * (dH + interGap);
        const drawerGroup = new THREE.Group();
        drawerGroup.userData = { isDrawerSlide: true, basePosZ: Z_facadeCenter, maxSlideDistance: 0.35 };

        const dGeo = new THREE.BoxGeometry(dW, dH, facadeThick);
        const dMesh = new THREE.Mesh(dGeo, facadeMat);
        dMesh.castShadow = true;
        this.addEdges(dMesh, isSelected, isColliding);
        drawerGroup.add(dMesh);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, 'horizontal', handleMat);
          hGroup.position.set(0, 0, facadeThick / 2);
          drawerGroup.add(hGroup);
        }

        const tandembox = this.createTandemboxMesh(innerWidth - 0.02, dH, carcassDepth - 0.05, i === 0);
        tandembox.position.set(0, -dH / 2, -facadeThick / 2);
        drawerGroup.add(tandembox);

        drawerGroup.position.set(0, dY, Z_facadeCenter);
        group.add(drawerGroup);
      }

      // Полка под духовку
      const shelf1Y = baseLevelH;
      const sGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, carcassDepth - 0.02);
      const sMesh1 = new THREE.Mesh(sGeo, carcassMat);
      sMesh1.position.set(0, shelf1Y, Z_carcassCenter - 0.01);
      this.addEdges(sMesh1, isSelected, isColliding);
      group.add(sMesh1);

      // Встраиваемый духовой шкаф (595 мм)
      const ovenH = 0.595;
      const ovenMesh = this.createOvenMesh(innerWidth, ovenH, carcassDepth - 0.02);
      ovenMesh.position.set(0, shelf1Y + boardThick / 2 + ovenH / 2, Z_frontCarcass);
      group.add(ovenMesh);

      // Полка под СВЧ
      const shelf2Y = shelf1Y + boardThick + ovenH + boardThick / 2;
      const sMesh2 = new THREE.Mesh(sGeo, carcassMat);
      sMesh2.position.set(0, shelf2Y, Z_carcassCenter - 0.01);
      this.addEdges(sMesh2, isSelected, isColliding);
      group.add(sMesh2);

      // Встраиваемая микроволновка (380 мм)
      const mwH = 0.380;
      const mwMesh = this.createMicrowaveMesh(innerWidth, carcassDepth - 0.02, mwH);
      mwMesh.position.set(0, shelf2Y + boardThick / 2, Z_frontCarcass);
      group.add(mwMesh);

      // Полка над СВЧ
      const shelf3Y = shelf2Y + boardThick + mwH + boardThick / 2;
      const sMesh3 = new THREE.Mesh(sGeo, carcassMat);
      sMesh3.position.set(0, shelf3Y, Z_carcassCenter - 0.01);
      this.addEdges(sMesh3, isSelected, isColliding);
      group.add(sMesh3);

      // Верхняя распашная дверь (антресоль)
      const topDoorBaseY = shelf3Y + boardThick / 2;
      const topDoorH = H - topGap - topDoorBaseY;
      if (topDoorH > 0.15) {
        const topDoorW = W - sideGap * 2;
        const doorPivot = new THREE.Group();
        const hingeX = isMirrored ? (W / 2 - sideGap) : (-W / 2 + sideGap);
        const openDir = isMirrored ? 1 : -1;
        doorPivot.position.set(hingeX, topDoorBaseY + topDoorH / 2, Z_frontCarcass);
        doorPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

        const dGeo = new THREE.BoxGeometry(topDoorW, topDoorH, facadeThick);
        const dMesh = new THREE.Mesh(dGeo, facadeMat);
        dMesh.position.set(isMirrored ? -topDoorW / 2 : topDoorW / 2, 0, facadeThick / 2);
        dMesh.castShadow = true;
        this.addEdges(dMesh, isSelected, isColliding);
        doorPivot.add(dMesh);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
          const handlePosX = isMirrored ? (-topDoorW + 0.035) : (topDoorW - 0.035);
          hGroup.position.set(handlePosX, -topDoorH / 2 + 0.08, facadeThick);
          doorPivot.add(hGroup);
        }
        doorPivot.rotation.y = 0;
        group.add(doorPivot);

        // Промежуточная полка в высокой антресоли (H 2380)
        if (topDoorH > 0.45) {
          const midShelf = new THREE.Mesh(sGeo, carcassMat);
          midShelf.position.set(0, topDoorBaseY + topDoorH / 2, Z_carcassCenter - 0.01);
          this.addEdges(midShelf, isSelected, isColliding);
          group.add(midShelf);
        }
      }

    } else if (specialTall === 'oven') {
      // 2. ДУХОВОЙ ШКАФ НА КОМФОРТНОЙ ВЫСОТЕ
      // Снизу 2 ящика до 860 мм
      const dH = (lowerFacadeH - interGap) / 2;
      const dW = W - sideGap * 2;
      for (let i = 0; i < 2; i++) {
        const dY = plinthHeight + bottomGap + dH / 2 + i * (dH + interGap);
        const drawerGroup = new THREE.Group();
        drawerGroup.userData = { isDrawerSlide: true, basePosZ: Z_facadeCenter, maxSlideDistance: 0.35 };

        const dGeo = new THREE.BoxGeometry(dW, dH, facadeThick);
        const dMesh = new THREE.Mesh(dGeo, facadeMat);
        dMesh.castShadow = true;
        this.addEdges(dMesh, isSelected, isColliding);
        drawerGroup.add(dMesh);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, 'horizontal', handleMat);
          hGroup.position.set(0, 0, facadeThick / 2);
          drawerGroup.add(hGroup);
        }

        const tandembox = this.createTandemboxMesh(innerWidth - 0.02, dH, carcassDepth - 0.05, i === 0);
        tandembox.position.set(0, -dH / 2, -facadeThick / 2);
        drawerGroup.add(tandembox);

        drawerGroup.position.set(0, dY, Z_facadeCenter);
        group.add(drawerGroup);
      }

      // Полка под духовку
      const sGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, carcassDepth - 0.02);
      const sMesh1 = new THREE.Mesh(sGeo, carcassMat);
      sMesh1.position.set(0, baseLevelH, Z_carcassCenter - 0.01);
      this.addEdges(sMesh1, isSelected, isColliding);
      group.add(sMesh1);

      // Духовой шкаф (595 мм): верх духовки ровно на 1455 мм
      const ovenH = 0.595;
      const ovenMesh = this.createOvenMesh(innerWidth, ovenH, carcassDepth - 0.02);
      ovenMesh.position.set(0, baseLevelH + boardThick / 2 + ovenH / 2, Z_frontCarcass);
      group.add(ovenMesh);

      // Полка над духовкой на отметке 1455 + boardThick
      const shelfTopOven = baseLevelH + boardThick + ovenH + boardThick / 2;
      const sMeshTop = new THREE.Mesh(sGeo, carcassMat);
      sMeshTop.position.set(0, shelfTopOven, Z_carcassCenter - 0.01);
      this.addEdges(sMeshTop, isSelected, isColliding);
      group.add(sMeshTop);

      // Верхний распашной фасад: от 1460 мм до H (высота 720 мм или 920 мм вровень с навесными!)
      const topDoorBaseY = shelfTopOven + boardThick / 2;
      const topDoorH = H - topGap - topDoorBaseY;
      const topDoorW = W - sideGap * 2;
      const doorPivot = new THREE.Group();
      const hingeX = isMirrored ? (W / 2 - sideGap) : (-W / 2 + sideGap);
      const openDir = isMirrored ? 1 : -1;
      doorPivot.position.set(hingeX, topDoorBaseY + topDoorH / 2, Z_frontCarcass);
      doorPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

      const dGeo = new THREE.BoxGeometry(topDoorW, topDoorH, facadeThick);
      const dMesh = new THREE.Mesh(dGeo, facadeMat);
      dMesh.position.set(isMirrored ? -topDoorW / 2 : topDoorW / 2, 0, facadeThick / 2);
      dMesh.castShadow = true;
      this.addEdges(dMesh, isSelected, isColliding);
      doorPivot.add(dMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
        const handlePosX = isMirrored ? (-topDoorW + 0.035) : (topDoorW - 0.035);
        hGroup.position.set(handlePosX, -topDoorH / 2 + 0.08, facadeThick);
        doorPivot.add(hGroup);
      }
      doorPivot.rotation.y = 0;
      group.add(doorPivot);

      // 2 или 3 полки в верхней секции
      const numShelves = topDoorH > 0.8 ? 3 : 2;
      for (let s = 1; s <= numShelves; s++) {
        const sY = topDoorBaseY + (topDoorH / (numShelves + 1)) * s;
        const sh = new THREE.Mesh(sGeo, carcassMat);
        sh.position.set(0, sY, Z_carcassCenter - 0.01);
        this.addEdges(sh, isSelected, isColliding);
        group.add(sh);
      }

    } else if (specialTall === 'fridge') {
      // 3. ВСТРАИВАЕМЫЙ ХОЛОДИЛЬНИК
      // Нижняя дверь морозильной камеры (до 860 мм)
      const btmDoorH = lowerFacadeH;
      const doorW = W - sideGap * 2;
      const hingeX = isMirrored ? (W / 2 - sideGap) : (-W / 2 + sideGap);
      const openDir = isMirrored ? 1 : -1;

      const btmPivot = new THREE.Group();
      btmPivot.position.set(hingeX, plinthHeight + bottomGap + btmDoorH / 2, Z_frontCarcass);
      btmPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

      const btmGeo = new THREE.BoxGeometry(doorW, btmDoorH, facadeThick);
      const btmMesh = new THREE.Mesh(btmGeo, facadeMat);
      btmMesh.position.set(isMirrored ? -doorW / 2 : doorW / 2, 0, facadeThick / 2);
      btmMesh.castShadow = true;
      this.addEdges(btmMesh, isSelected, isColliding);
      btmPivot.add(btmMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
        const handlePosX = isMirrored ? (-doorW + 0.035) : (doorW - 0.035);
        hGroup.position.set(handlePosX, btmDoorH / 2 - 0.12, facadeThick);
        btmPivot.add(hGroup);
      }
      btmPivot.rotation.y = 0;
      group.add(btmPivot);

      // Верхняя дверь холодильной камеры
      const topDoorBaseY = baseLevelH + interGap / 2;
      const topDoorH = upperFacadeH;

      const topPivot = new THREE.Group();
      topPivot.position.set(hingeX, topDoorBaseY + topDoorH / 2, Z_frontCarcass);
      topPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

      const topGeo = new THREE.BoxGeometry(doorW, topDoorH, facadeThick);
      const topMesh = new THREE.Mesh(topGeo, facadeMat);
      topMesh.position.set(isMirrored ? -doorW / 2 : doorW / 2, 0, facadeThick / 2);
      topMesh.castShadow = true;
      this.addEdges(topMesh, isSelected, isColliding);
      topPivot.add(topMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
        const handlePosX = isMirrored ? (-doorW + 0.035) : (doorW - 0.035);
        hGroup.position.set(handlePosX, -topDoorH / 2 + 0.12, facadeThick);
        topPivot.add(hGroup);
      }
      topPivot.rotation.y = 0;
      group.add(topPivot);

      // Внутреннее наполнение холодильника (стеклянные полки)
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.5, roughness: 0.1 });
      const numFridgeShelves = topDoorH > 1.4 ? 4 : 3;
      for (let s = 1; s <= numFridgeShelves; s++) {
        const shGeo = new THREE.BoxGeometry(innerWidth - 0.008, 0.006, carcassDepth - 0.04);
        const shMesh = new THREE.Mesh(shGeo, glassMat);
        shMesh.position.set(0, topDoorBaseY + (topDoorH / (numFridgeShelves + 1)) * s, Z_carcassCenter);
        group.add(shMesh);
      }

    } else if (specialTall === 'cargo') {
      // 4. ВЫКАТНАЯ КОЛОННА КАРГО
      const cargoH = H - plinthHeight - bottomGap - topGap;
      const cargoW = W - sideGap * 2;
      const cargoGroup = new THREE.Group();
      cargoGroup.userData = { isDrawerSlide: true, basePosZ: Z_facadeCenter, maxSlideDistance: 0.45 };

      // Единый фасад на всю высоту
      const fGeo = new THREE.BoxGeometry(cargoW, cargoH, facadeThick);
      const fMesh = new THREE.Mesh(fGeo, facadeMat);
      fMesh.castShadow = true;
      this.addEdges(fMesh, isSelected, isColliding);
      cargoGroup.add(fMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
        hGroup.position.set(0, 0, facadeThick / 2);
        cargoGroup.add(hGroup);
      }

      // Выкатная металлическая рама с 5-6 корзинами
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
      const numBaskets = H > 2.2 ? 6 : 5;
      const bW = innerWidth - 0.04;
      const bD = carcassDepth - 0.05;

      for (let b = 0; b < numBaskets; b++) {
        const bY = -cargoH / 2 + 0.06 + (cargoH / numBaskets) * b;
        const bGeo = new THREE.BoxGeometry(bW, 0.005, bD);
        const bMesh = new THREE.Mesh(bGeo, chromeMat);
        bMesh.position.set(0, bY, -bD / 2);
        cargoGroup.add(bMesh);

        // Бортик корзины
        const fRGeo = new THREE.BoxGeometry(bW, 0.04, 0.004);
        const fRMesh = new THREE.Mesh(fRGeo, chromeMat);
        fRMesh.position.set(0, bY + 0.02, -0.005);
        cargoGroup.add(fRMesh);
      }

      cargoGroup.position.set(0, plinthHeight + bottomGap + cargoH / 2, Z_facadeCenter);
      group.add(cargoGroup);

    } else if (specialTall === 'spacetower') {
      // 5. SPACE TOWER (РАСПАШНЫЕ ДВЕРИ + 5 ВНУТРЕННИХ ВЫДВИЖНЫХ ЯЩИКОВ)
      const btmDoorH = lowerFacadeH;
      const doorW = W - sideGap * 2;
      const hingeX = isMirrored ? (W / 2 - sideGap) : (-W / 2 + sideGap);
      const openDir = isMirrored ? 1 : -1;

      // Нижняя распашная дверь
      const btmPivot = new THREE.Group();
      btmPivot.position.set(hingeX, plinthHeight + bottomGap + btmDoorH / 2, Z_frontCarcass);
      btmPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

      const btmGeo = new THREE.BoxGeometry(doorW, btmDoorH, facadeThick);
      const btmMesh = new THREE.Mesh(btmGeo, facadeMat);
      btmMesh.position.set(isMirrored ? -doorW / 2 : doorW / 2, 0, facadeThick / 2);
      btmMesh.castShadow = true;
      this.addEdges(btmMesh, isSelected, isColliding);
      btmPivot.add(btmMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
        const handlePosX = isMirrored ? (-doorW + 0.035) : (doorW - 0.035);
        hGroup.position.set(handlePosX, btmDoorH / 2 - 0.12, facadeThick);
        btmPivot.add(hGroup);
      }
      btmPivot.rotation.y = 0;
      group.add(btmPivot);

      // Верхняя распашная дверь
      const topDoorBaseY = baseLevelH + interGap / 2;
      const topDoorH = upperFacadeH;
      const topPivot = new THREE.Group();
      topPivot.position.set(hingeX, topDoorBaseY + topDoorH / 2, Z_frontCarcass);
      topPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

      const topGeo = new THREE.BoxGeometry(doorW, topDoorH, facadeThick);
      const topMesh = new THREE.Mesh(topGeo, facadeMat);
      topMesh.position.set(isMirrored ? -doorW / 2 : doorW / 2, 0, facadeThick / 2);
      topMesh.castShadow = true;
      this.addEdges(topMesh, isSelected, isColliding);
      topPivot.add(topMesh);

      if (showHandle) {
        const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
        const handlePosX = isMirrored ? (-doorW + 0.035) : (doorW - 0.035);
        hGroup.position.set(handlePosX, -topDoorH / 2 + 0.12, facadeThick);
        topPivot.add(hGroup);
      }
      topPivot.rotation.y = 0;
      group.add(topPivot);

      // 5 внутренних ящиков Tandembox
      const boxW = innerWidth - 0.02;
      const boxD = carcassDepth - 0.05;
      const boxH = 0.14;
      const drawerYs = [
        plinthHeight + 0.04,
        plinthHeight + 0.28,
        plinthHeight + 0.54,
        baseLevelH + 0.12,
        baseLevelH + 0.38,
      ];
      drawerYs.forEach((y, idx) => {
        const dGroup = new THREE.Group();
        dGroup.userData = { isDrawerSlide: true, basePosZ: Z_frontCarcass - 0.01, maxSlideDistance: 0.35 + idx * 0.02 };
        const tb = this.createTandemboxMesh(boxW, boxH, boxD, true);
        tb.position.set(0, 0, 0);
        dGroup.add(tb);
        dGroup.position.set(0, y, Z_frontCarcass - 0.01);
        group.add(dGroup);
      });

      // Верхние полки
      const sGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, carcassDepth - 0.02);
      const topShelfY = baseLevelH + 0.68;
      const tsh = new THREE.Mesh(sGeo, carcassMat);
      tsh.position.set(0, topShelfY, Z_carcassCenter - 0.01);
      this.addEdges(tsh, isSelected, isColliding);
      group.add(tsh);

    } else {
      // 6. ХОЗЯЙСТВЕННЫЙ ПЕНАЛ ДЛЯ ПРИПАСОВ И ПОСУДЫ (PANTRY)
      // Разделение по линии 860 мм
      const btmDoorH = lowerFacadeH;
      const topDoorBaseY = baseLevelH + interGap / 2;
      const topDoorH = upperFacadeH;

      const isTwoDoors = W >= 0.55 && module.config.doors >= 2;
      const doorW = isTwoDoors ? (W - sideGap * 2 - interGap) / 2 : (W - sideGap * 2);

      if (!isTwoDoors) {
        // Одностворчатый пенал (400, 450 мм)
        const hingeX = isMirrored ? (W / 2 - sideGap) : (-W / 2 + sideGap);
        const openDir = isMirrored ? 1 : -1;

        // Нижняя дверь
        const btmPivot = new THREE.Group();
        btmPivot.position.set(hingeX, plinthHeight + bottomGap + btmDoorH / 2, Z_frontCarcass);
        btmPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

        const btmGeo = new THREE.BoxGeometry(doorW, btmDoorH, facadeThick);
        const btmMesh = new THREE.Mesh(btmGeo, facadeMat);
        btmMesh.position.set(isMirrored ? -doorW / 2 : doorW / 2, 0, facadeThick / 2);
        btmMesh.castShadow = true;
        this.addEdges(btmMesh, isSelected, isColliding);
        btmPivot.add(btmMesh);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
          const handlePosX = isMirrored ? (-doorW + 0.035) : (doorW - 0.035);
          hGroup.position.set(handlePosX, btmDoorH / 2 - 0.12, facadeThick);
          btmPivot.add(hGroup);
        }
        btmPivot.rotation.y = 0;
        group.add(btmPivot);

        // Верхняя дверь
        const topPivot = new THREE.Group();
        topPivot.position.set(hingeX, topDoorBaseY + topDoorH / 2, Z_frontCarcass);
        topPivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

        const topGeo = new THREE.BoxGeometry(doorW, topDoorH, facadeThick);
        const topMesh = new THREE.Mesh(topGeo, facadeMat);
        topMesh.position.set(isMirrored ? -doorW / 2 : doorW / 2, 0, facadeThick / 2);
        topMesh.castShadow = true;
        this.addEdges(topMesh, isSelected, isColliding);
        topPivot.add(topMesh);

        if (showHandle) {
          const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
          const handlePosX = isMirrored ? (-doorW + 0.035) : (doorW - 0.035);
          hGroup.position.set(handlePosX, -topDoorH / 2 + 0.12, facadeThick);
          topPivot.add(hGroup);
        }
        topPivot.rotation.y = 0;
        group.add(topPivot);
      } else {
        // Двустворчатый пенал (600 мм)
        // Нижняя пара дверей
        [-1, 1].forEach((side) => {
          const hingeX = side * (W / 2 - sideGap);
          const openDir = -side;
          const pivot = new THREE.Group();
          pivot.position.set(hingeX, plinthHeight + bottomGap + btmDoorH / 2, Z_frontCarcass);
          pivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

          const dGeo = new THREE.BoxGeometry(doorW, btmDoorH, facadeThick);
          const dMesh = new THREE.Mesh(dGeo, facadeMat);
          dMesh.position.set(-side * doorW / 2, 0, facadeThick / 2);
          dMesh.castShadow = true;
          this.addEdges(dMesh, isSelected, isColliding);
          pivot.add(dMesh);

          if (showHandle) {
            const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
            hGroup.position.set(-side * (doorW - 0.035), btmDoorH / 2 - 0.12, facadeThick);
            pivot.add(hGroup);
          }
          pivot.rotation.y = 0;
          group.add(pivot);
        });

        // Верхняя пара дверей
        [-1, 1].forEach((side) => {
          const hingeX = side * (W / 2 - sideGap);
          const openDir = -side;
          const pivot = new THREE.Group();
          pivot.position.set(hingeX, topDoorBaseY + topDoorH / 2, Z_frontCarcass);
          pivot.userData = { isDoorPivot: true, maxOpenAngle: openDir * Math.PI / 2.3 };

          const dGeo = new THREE.BoxGeometry(doorW, topDoorH, facadeThick);
          const dMesh = new THREE.Mesh(dGeo, facadeMat);
          dMesh.position.set(-side * doorW / 2, 0, facadeThick / 2);
          dMesh.castShadow = true;
          this.addEdges(dMesh, isSelected, isColliding);
          pivot.add(dMesh);

          if (showHandle) {
            const hGroup = this.createHandleMesh(handleType, 'vertical', handleMat);
            hGroup.position.set(-side * (doorW - 0.035), -topDoorH / 2 + 0.12, facadeThick);
            pivot.add(hGroup);
          }
          pivot.rotation.y = 0;
          group.add(pivot);
        });
      }

      // Полки: 2 в нижней секции, 3-4 в верхней секции
      const sGeo = new THREE.BoxGeometry(innerWidth - 0.004, boardThick, carcassDepth - 0.02);
      // Разделительная полка на уровне 860 мм
      const midShelf = new THREE.Mesh(sGeo, carcassMat);
      midShelf.position.set(0, baseLevelH, Z_carcassCenter - 0.01);
      this.addEdges(midShelf, isSelected, isColliding);
      group.add(midShelf);

      // Нижняя полка
      const btmShelf = new THREE.Mesh(sGeo, carcassMat);
      btmShelf.position.set(0, plinthHeight + lowerSectionH / 2, Z_carcassCenter - 0.01);
      this.addEdges(btmShelf, isSelected, isColliding);
      group.add(btmShelf);

      // Верхние полки
      const numTopShelves = H > 2.2 ? 4 : 3;
      for (let s = 1; s <= numTopShelves; s++) {
        const sh = new THREE.Mesh(sGeo, carcassMat);
        sh.position.set(0, baseLevelH + (upperFacadeH / (numTopShelves + 1)) * s, Z_carcassCenter - 0.01);
        this.addEdges(sh, isSelected, isColliding);
        group.add(sh);
      }
    }
  }

}
