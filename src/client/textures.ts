import * as THREE from 'three';

export class ProceduralTextures {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Lush Emerald Grass Lawn Texture with blade noise and color depth
   */
  public static getLushGrassTexture(): THREE.CanvasTexture {
    if (this.cache.has('lush_grass')) return this.cache.get('lush_grass')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Rich lawn gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#2e7d32');
    grad.addColorStop(0.5, '#388e3c');
    grad.addColorStop(1, '#1b5e20');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Individual grass blades & micro-color variations
    for (let i = 0; i < 35000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = 3 + Math.random() * 5;
      const angle = (Math.random() - 0.5) * 0.8;

      ctx.strokeStyle = Math.random() > 0.4 ? '#4caf50' : (Math.random() > 0.5 ? '#66bb6a' : '#1b5e20');
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(angle) * len, y - Math.cos(angle) * len);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    this.cache.set('lush_grass', texture);
    return texture;
  }

  /**
   * Asphalt Road with painted markings and tar texture
   */
  public static getRoadTexture(): THREE.CanvasTexture {
    if (this.cache.has('road')) return this.cache.get('road')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark smooth bitumen
    ctx.fillStyle = '#1e2229';
    ctx.fillRect(0, 0, 512, 512);

    // Fine mineral grain
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.floor(25 + Math.random() * 30);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Double yellow center divider lines
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(246, 0, 8, 512);
    ctx.fillRect(258, 0, 8, 512);

    // Crisp white shoulder edge lines
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(28, 0, 10, 512);
    ctx.fillRect(474, 0, 10, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 14);
    this.cache.set('road', texture);
    return texture;
  }

  /**
   * Cobblestone Plaza Pavers with 3D stone bevels
   */
  public static getCobblestoneTexture(): THREE.CanvasTexture {
    if (this.cache.has('cobble')) return this.cache.get('cobble')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 512);

    const size = 32;
    for (let y = 0; y < 512; y += size) {
      const offsetX = ((y / size) % 2 === 0) ? 0 : size / 2;
      for (let x = -size; x < 512 + size; x += size) {
        // Individual stone with lighting bevel
        const shade = Math.floor(110 + (Math.random() - 0.5) * 35);
        ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
        ctx.beginPath();
        ctx.roundRect(x + offsetX + 2, y + 2, size - 4, size - 4, 6);
        ctx.fill();

        // Highlight top-left edge
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + offsetX + 4, y + size - 4);
        ctx.lineTo(x + offsetX + 4, y + 4);
        ctx.lineTo(x + offsetX + size - 4, y + 4);
        ctx.stroke();

        // Shadow bottom-right edge
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(x + offsetX + size - 4, y + 4);
        ctx.lineTo(x + offsetX + size - 4, y + size - 4);
        ctx.lineTo(x + offsetX + 4, y + size - 4);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    this.cache.set('cobble', texture);
    return texture;
  }

  /**
   * Sidewalk Concrete Tiles with expansion grooves
   */
  public static getSidewalkTexture(): THREE.CanvasTexture {
    if (this.cache.has('sidewalk')) return this.cache.get('sidewalk')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }

    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#f1f5f9' : '#94a3b8';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.2, 1.2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 18);
    this.cache.set('sidewalk', texture);
    return texture;
  }

  /**
   * Textured Brick Wall with mortar courses
   */
  public static getBrickTexture(brickColor: string = '#991b1b', mortarColor: string = '#e2e8f0'): THREE.CanvasTexture {
    const key = `brick_${brickColor}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = mortarColor;
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const rowHeight = 512 / rows;
    const brickWidth = 64;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 0) ? 0 : brickWidth / 2;
      for (let x = -brickWidth; x < 512 + brickWidth; x += brickWidth) {
        ctx.fillStyle = brickColor;
        ctx.fillRect(x + offsetX + 2, r * rowHeight + 2, brickWidth - 4, rowHeight - 4);

        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
        ctx.fillRect(x + offsetX + 2, r * rowHeight + 2, brickWidth - 4, rowHeight - 4);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Elegant Multi-story Windowed Facade with architectural trim
   */
  public static getTownhouseFacadeTexture(): THREE.CanvasTexture {
    if (this.cache.has('townhouse_facade')) return this.cache.get('townhouse_facade')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Limestone / stucco base
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 512, 512);

    // Decorative horizontal cornices
    for (let floor = 0; floor <= 4; floor++) {
      const fy = floor * 128;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, fy, 512, 6);

      if (floor < 4) {
        // Windows on this floor
        for (let w = 0; w < 4; w++) {
          const wx = w * 128 + 24;
          const wy = fy + 24;

          // Shutters
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(wx - 14, wy, 12, 70);
          ctx.fillRect(wx + 62, wy, 12, 70);

          // Window frame
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wx - 2, wy - 2, 64, 74);

          // Glass
          const lit = (floor + w) % 2 === 0;
          ctx.fillStyle = lit ? '#fef08a' : '#38bdf8';
          ctx.fillRect(wx, wy, 60, 70);

          // Window grid bars
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wx + 28, wy, 4, 70);
          ctx.fillRect(wx, wy + 33, 60, 4);

          // Flower box below window
          ctx.fillStyle = '#78350f';
          ctx.fillRect(wx - 4, wy + 72, 68, 12);
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(wx, wy + 70, 60, 6);
          // Red/pink flowers
          for (let f = 0; f < 5; f++) {
            ctx.fillStyle = f % 2 === 0 ? '#ef4444' : '#f43f5e';
            ctx.beginPath();
            ctx.arc(wx + 8 + f * 11, wy + 69, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set('townhouse_facade', texture);
    return texture;
  }

  /**
   * Polished Hardwood Parquet for building interiors
   */
  public static getWoodTexture(): THREE.CanvasTexture {
    if (this.cache.has('wood')) return this.cache.get('wood')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 256, 256);

    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = (y % 8 === 0) ? '#92400e' : '#451a03';
      ctx.fillRect(0, y, 256, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('wood', texture);
    return texture;
  }

  /**
   * Ornate Antique Gothic Clock Face with Roman Numerals, Minute Ring, and Brass Accents
   */
  public static getClockFaceTexture(): THREE.CanvasTexture {
    if (this.cache.has('clock_face')) return this.cache.get('clock_face')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const cx = 256;
    const cy = 256;
    const radius = 236;

    // Outer Heavy Brass Rim
    const rimGrad = ctx.createRadialGradient(cx, cy, radius - 20, cx, cy, radius);
    rimGrad.addColorStop(0, '#d97706');
    rimGrad.addColorStop(0.5, '#fef08a');
    rimGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner Antique Enamel Ivory Dial
    const dialGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, radius - 22);
    dialGrad.addColorStop(0, '#fefce8');
    dialGrad.addColorStop(0.85, '#fef3c7');
    dialGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = dialGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 22, 0, Math.PI * 2);
    ctx.fill();

    // Concentric Inlaid Gold Rings
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 25, 0, Math.PI * 2);
    ctx.arc(cx, cy, radius - 45, 0, Math.PI * 2);
    ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.stroke();

    // 60 Minute Graduation Ticks
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const isFive = i % 5 === 0;
      const r1 = radius - (isFive ? 42 : 34);
      const r2 = radius - 25;

      ctx.strokeStyle = isFive ? '#1e293b' : '#64748b';
      ctx.lineWidth = isFive ? 4.5 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      ctx.stroke();
    }

    // Roman Numerals
    const romanNumerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px "Times New Roman", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const numR = radius - 70;
      const nx = cx + Math.cos(angle) * numR;
      const ny = cy + Math.sin(angle) * numR;
      ctx.fillText(romanNumerals[i], nx, ny);
    }

    // Central Ornate Filigree Rose Pattern
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * 32, cy + Math.sin(angle) * 32, 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Clock Hands (Set at authentic dramatic time: 10:10)
    // Hour Hand (pointing at 10)
    const hourAngle = (10 / 12) * Math.PI * 2 - Math.PI / 2 + (10 / 60) * (Math.PI / 6);
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hourAngle) * 95, cy + Math.sin(hourAngle) * 95);
    ctx.stroke();
    // Diamond spade on hour hand
    ctx.beginPath();
    ctx.arc(cx + Math.cos(hourAngle) * 75, cy + Math.sin(hourAngle) * 75, 12, 0, Math.PI * 2);
    ctx.fill();

    // Minute Hand (pointing at 2 = 10 mins)
    const minAngle = (10 / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minAngle) * 140, cy + Math.sin(minAngle) * 140);
    ctx.stroke();

    // Central Brass Cap
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('clock_face', texture);
    return texture;
  }

  /**
   * Jagged Mountain Rock & Granite Cliff Texture with moss & stratification
   */
  public static getMountainRockTexture(): THREE.CanvasTexture {
    if (this.cache.has('mountain_rock')) return this.cache.get('mountain_rock')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base slate / granite tone
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 512, 512);

    // Geological horizontal rock stratification bands
    for (let y = 0; y < 512; y += 8 + Math.random() * 12) {
      const shade = Math.floor(40 + Math.random() * 35);
      ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 8})`;
      ctx.fillRect(0, y, 512, 6 + Math.random() * 8);
    }

    // Granite noise & craggy cracks
    for (let i = 0; i < 25000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const color = Math.random() > 0.6 ? '#64748b' : (Math.random() > 0.4 ? '#334155' : '#1e293b');
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    // Moss streaks along crevices
    ctx.fillStyle = 'rgba(46, 125, 50, 0.45)';
    for (let i = 0; i < 40; i++) {
      const mx = Math.random() * 512;
      const my = Math.random() * 512;
      ctx.beginPath();
      ctx.ellipse(mx, my, 25 + Math.random() * 35, 6 + Math.random() * 8, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    this.cache.set('mountain_rock', texture);
    return texture;
  }

  /**
   * Terracotta Mediterranean Curved Roof Tiles with shading & mortar
   */
  public static getRoofTileTexture(hue: 'terracotta' | 'slate' | 'crimson' = 'terracotta'): THREE.CanvasTexture {
    const key = `roof_${hue}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const baseColor = hue === 'terracotta' ? '#c2410c' : (hue === 'crimson' ? '#991b1b' : '#334155');
    const shadowColor = hue === 'terracotta' ? '#7c2d12' : (hue === 'crimson' ? '#450a0a' : '#0f172a');
    const highlightColor = hue === 'terracotta' ? '#ea580c' : (hue === 'crimson' ? '#dc2626' : '#64748b');

    ctx.fillStyle = shadowColor;
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const cols = 8;
    const rh = 512 / rows;
    const cw = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      const shiftX = (r % 2 === 0) ? 0 : cw / 2;

      for (let c = -1; c <= cols; c++) {
        const x = c * cw + shiftX;

        // Curved cylindrical tile gradient
        const tileGrad = ctx.createLinearGradient(x, y, x + cw, y);
        tileGrad.addColorStop(0, shadowColor);
        tileGrad.addColorStop(0.4, highlightColor);
        tileGrad.addColorStop(0.7, baseColor);
        tileGrad.addColorStop(1, shadowColor);

        ctx.fillStyle = tileGrad;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, cw - 4, rh + 4, [0, 0, 8, 8]);
        ctx.fill();

        // Shading shadow at tile bottom lip
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 2, y + rh - 3, cw - 4, 4);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Deep fissured natural tree bark
   */
  public static getBarkTexture(): THREE.CanvasTexture {
    if (this.cache.has('tree_bark')) return this.cache.get('tree_bark')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#3e2723';
    ctx.fillRect(0, 0, 256, 256);

    for (let x = 0; x < 256; x += 3 + Math.random() * 5) {
      const tone = Math.random() > 0.5 ? '#4e342e' : '#271714';
      ctx.fillStyle = tone;
      ctx.fillRect(x, 0, 2 + Math.random() * 3, 256);
    }

    // Knot details
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = '#1b0000';
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 6, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    this.cache.set('tree_bark', texture);
    return texture;
  }

  /**
   * Multi-shade leafy foliage cluster texture for dense hiding bushes
   */
  public static getFoliageTexture(): THREE.CanvasTexture {
    if (this.cache.has('foliage')) return this.cache.get('foliage')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#14532d'; // Deep forest green
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const tone = Math.random() > 0.6 ? '#22c55e' : (Math.random() > 0.3 ? '#16a34a' : '#15803d');
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(x, y, 4 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('foliage', texture);
    return texture;
  }

  /**
   * Military PUBG-Style Supply Crate with metal brackets and stencils
   */
  public static getMilitaryCrateTexture(): THREE.CanvasTexture {
    if (this.cache.has('military_crate')) return this.cache.get('military_crate')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Olive drab / tactical army base
    ctx.fillStyle = '#3f4f34';
    ctx.fillRect(0, 0, 256, 256);

    // Weathered metal corner brackets
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 36, 36);
    ctx.fillRect(220, 0, 36, 36);
    ctx.fillRect(0, 220, 36, 36);
    ctx.fillRect(220, 220, 36, 36);

    // Rivets
    ctx.fillStyle = '#cbd5e1';
    [10, 26].forEach((rx) => {
      [10, 26].forEach((ry) => {
        ctx.fillRect(rx, ry, 3, 3);
        ctx.fillRect(256 - rx, ry, 3, 3);
        ctx.fillRect(rx, 256 - ry, 3, 3);
        ctx.fillRect(256 - rx, 256 - ry, 3, 3);
      });
    });

    // Stencil Military Markings
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TACTICAL SUPPLY', 128, 120);
    ctx.font = 'bold 16px monospace';
    ctx.fillText('DROP #08-A', 128, 145);

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('military_crate', texture);
    return texture;
  }

  /**
   * Scenic canal / river water with specular shimmer
   */
  public static getWaterTexture(): THREE.CanvasTexture {
    if (this.cache.has('water')) return this.cache.get('water')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#0369a1');
    grad.addColorStop(0.5, '#0284c7');
    grad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Water wavelets
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.arc(x, y, 6 + Math.random() * 12, 0, Math.PI);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 12);
    this.cache.set('water', texture);
    return texture;
  }

  /**
   * Framed Multi-pane Glass Window
   */
  public static getGlassWindowTexture(): THREE.CanvasTexture {
    if (this.cache.has('glass_window')) return this.cache.get('glass_window')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Wood frame border
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 0, 256, 256);

    // 4 glass panes
    const paneWidth = 106;
    const paneHeight = 106;
    const gap = 16;

    const panePositions = [
      { x: gap, y: gap },
      { x: gap * 2 + paneWidth, y: gap },
      { x: gap, y: gap * 2 + paneHeight },
      { x: gap * 2 + paneWidth, y: gap * 2 + paneHeight }
    ];

    panePositions.forEach((pos) => {
      // Glass gradient
      const pGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x + paneWidth, pos.y + paneHeight);
      pGrad.addColorStop(0, 'rgba(186, 230, 253, 0.85)');
      pGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.7)');
      pGrad.addColorStop(1, 'rgba(2, 132, 199, 0.9)');
      ctx.fillStyle = pGrad;
      ctx.fillRect(pos.x, pos.y, paneWidth, paneHeight);

      // Diagonal specular glare line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pos.x + 15, pos.y + paneHeight - 10);
      ctx.lineTo(pos.x + paneWidth - 10, pos.y + 15);
      ctx.stroke();
    });

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('glass_window', texture);
    return texture;
  }
}
