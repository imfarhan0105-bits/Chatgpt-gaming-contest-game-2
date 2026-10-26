import * as THREE from 'three';

export class ProceduralTextures {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Asphalt Road with lane stripes and grain
   */
  public static getRoadTexture(): THREE.CanvasTexture {
    if (this.cache.has('road')) return this.cache.get('road')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark asphalt base
    ctx.fillStyle = '#232528';
    ctx.fillRect(0, 0, 512, 512);

    // Grain noise
    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.floor(25 + Math.random() * 35);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Yellow center divider line
    ctx.fillStyle = '#eab308';
    ctx.fillRect(250, 0, 12, 512);

    // White edge lines
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(24, 0, 8, 512);
    ctx.fillRect(480, 0, 8, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set('road', texture);
    return texture;
  }

  /**
   * Sidewalk Concrete Tiles
   */
  public static getSidewalkTexture(): THREE.CanvasTexture {
    if (this.cache.has('sidewalk')) return this.cache.get('sidewalk')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 256, 256);

    // Tile grid
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
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

    // Speckle
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#cbd5e1' : '#64748b';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set('sidewalk', texture);
    return texture;
  }

  /**
   * Realistic Brick Wall with mortar
   */
  public static getBrickTexture(brickColor: string = '#852b24', mortarColor: string = '#d1d5db'): THREE.CanvasTexture {
    const key = `brick_${brickColor}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Mortar base
    ctx.fillStyle = mortarColor;
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const rowHeight = 512 / rows;
    const brickWidth = 64;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 0) ? 0 : brickWidth / 2;
      for (let x = -brickWidth; x < 512 + brickWidth; x += brickWidth) {
        // Brick variations
        const variation = (Math.random() - 0.5) * 20;
        ctx.fillStyle = brickColor;
        ctx.fillRect(x + offsetX + 2, r * rowHeight + 2, brickWidth - 4, rowHeight - 4);

        // Brick surface noise
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
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
   * Multi-story Glass & Steel Building Facade
   */
  public static getBuildingFacadeTexture(): THREE.CanvasTexture {
    if (this.cache.has('facade')) return this.cache.get('facade')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Exterior stone panel
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 512);

    // Windows
    for (let floor = 0; floor < 8; floor++) {
      for (let col = 0; col < 8; col++) {
        const wx = col * 64 + 10;
        const wy = floor * 64 + 10;

        // Window frame
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wx - 2, wy - 2, 48, 48);

        // Window glass (random illuminated rooms)
        const lit = Math.random() > 0.4;
        ctx.fillStyle = lit ? '#fef08a' : '#38bdf8';
        ctx.fillRect(wx, wy, 44, 44);

        // Reflection highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 25, wy);
        ctx.lineTo(wx, wy + 25);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set('facade', texture);
    return texture;
  }

  /**
   * Polished Wood Grain for Estate Doors & Benches
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
