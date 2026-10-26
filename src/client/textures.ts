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
}
