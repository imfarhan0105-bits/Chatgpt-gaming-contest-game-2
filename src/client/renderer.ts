import * as THREE from 'three';

export class GameRenderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  // Particle systems
  public windLeafParticles: THREE.Points | null = null;
  private leafPositions: Float32Array | null = null;
  private fountainSpray: THREE.Points | null = null;
  private sprayPositions: Float32Array | null = null;
  private sprayVelocities: Float32Array | null = null;

  // Wind simulation state
  public windTime: number = 0;
  public windVector: THREE.Vector3 = new THREE.Vector3(1.2, 0, 0.4);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc); // Vivid Mediterranean sky
    this.scene.fog = new THREE.FogExp2(0xbfe0f7, 0.007); // Soft atmospheric aerial perspective

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 450);
    this.camera.position.set(0, 1.7, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Cinematic ACES Filmic Tone Mapping & Soft Shadows
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupAtmosphericLighting();
    this.setupSkyDome();
    this.setupWindParticles();
    this.setupFountainWaterParticles();
    this.handleResize();
  }

  private setupAtmosphericLighting() {
    // 1. Natural Sky Hemisphere Light (Azure sky bounce with warm earth ambient)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x14532d, 0.75);
    this.scene.add(hemiLight);

    // 2. Main Golden Sun Directional Light
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    sunLight.position.set(55, 85, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 240;

    const d = 110;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.radius = 2.5; // Soft shadow edges
    this.scene.add(sunLight);

    // 3. Central Plaza Warm Accent Light
    const plazaAccent = new THREE.PointLight(0xfde047, 0.8, 60);
    plazaAccent.position.set(0, 10, 0);
    this.scene.add(plazaAccent);
  }

  private setupSkyDome() {
    // Procedural sky dome
    const skyGeo = new THREE.SphereGeometry(380, 24, 24);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#0284c7'); // Deep sky blue at zenith
    grad.addColorStop(0.65, '#7dd3fc');
    grad.addColorStop(1, '#fed7aa'); // Warm golden sunset glow at horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Fluffy cloud puffs
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 18; i++) {
      const cx = Math.random() * 256;
      const cy = 60 + Math.random() * 90;
      ctx.beginPath();
      ctx.arc(cx, cy, 25 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }

    const skyTex = new THREE.CanvasTexture(canvas);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyMesh);
  }

  private setupWindParticles() {
    // 600 swirling autumn leaves & flower petals drifting in the wind
    const count = 600;
    const geo = new THREE.BufferGeometry();
    this.leafPositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.leafPositions[i * 3] = (Math.random() - 0.5) * 220;
      this.leafPositions[i * 3 + 1] = 0.5 + Math.random() * 12;
      this.leafPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.leafPositions, 3));

    // Particle texture for leaves/petals
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(16, 16, 12, 6, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.45,
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    this.windLeafParticles = new THREE.Points(geo, mat);
    this.scene.add(this.windLeafParticles);
  }

  private setupFountainWaterParticles() {
    // Central Fountain water spray
    const count = 250;
    const geo = new THREE.BufferGeometry();
    this.sprayPositions = new Float32Array(count * 3);
    this.sprayVelocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.sprayPositions[i * 3] = 0;
      this.sprayPositions[i * 3 + 1] = 3.5;
      this.sprayPositions[i * 3 + 2] = 25; // Fountain is at z = 25

      // Upward cone velocity
      const angle = Math.random() * Math.PI * 2;
      const spread = 0.8 + Math.random() * 1.5;
      this.sprayVelocities[i * 3] = Math.cos(angle) * spread;
      this.sprayVelocities[i * 3 + 1] = 4.5 + Math.random() * 4.0;
      this.sprayVelocities[i * 3 + 2] = Math.sin(angle) * spread;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.28,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });

    this.fountainSpray = new THREE.Points(geo, mat);
    this.scene.add(this.fountainSpray);
  }

  public updateVisualEffects(delta: number) {
    this.windTime += delta;

    // 1. Wind Leaf Particles Animation
    if (this.windLeafParticles && this.leafPositions) {
      const count = this.leafPositions.length / 3;
      const windSpeedX = (1.5 + Math.sin(this.windTime * 0.8) * 0.8);
      const windSpeedZ = (0.8 + Math.cos(this.windTime * 0.6) * 0.5);

      for (let i = 0; i < count; i++) {
        this.leafPositions[i * 3] += windSpeedX * delta;
        this.leafPositions[i * 3 + 1] -= (0.4 + Math.sin(this.windTime * 2 + i) * 0.2) * delta;
        this.leafPositions[i * 3 + 2] += windSpeedZ * delta;

        // Wrap around town bounds
        if (this.leafPositions[i * 3] > 120) this.leafPositions[i * 3] = -120;
        if (this.leafPositions[i * 3 + 2] > 120) this.leafPositions[i * 3 + 2] = -120;
        if (this.leafPositions[i * 3 + 1] < 0.2) this.leafPositions[i * 3 + 1] = 8 + Math.random() * 6;
      }
      this.windLeafParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 2. Fountain Water Spray Physics
    if (this.fountainSpray && this.sprayPositions && this.sprayVelocities) {
      const count = this.sprayPositions.length / 3;
      for (let i = 0; i < count; i++) {
        this.sprayPositions[i * 3] += this.sprayVelocities[i * 3] * delta;
        this.sprayPositions[i * 3 + 1] += this.sprayVelocities[i * 3 + 1] * delta;
        this.sprayPositions[i * 3 + 2] += this.sprayVelocities[i * 3 + 2] * delta;

        // Gravity
        this.sprayVelocities[i * 3 + 1] -= 9.8 * delta;

        // Reset when falling back into pool
        if (this.sprayPositions[i * 3 + 1] < 1.3) {
          this.sprayPositions[i * 3] = (Math.random() - 0.5) * 0.6;
          this.sprayPositions[i * 3 + 1] = 3.5;
          this.sprayPositions[i * 3 + 2] = 25 + (Math.random() - 0.5) * 0.6;

          const angle = Math.random() * Math.PI * 2;
          const spread = 0.8 + Math.random() * 1.5;
          this.sprayVelocities[i * 3] = Math.cos(angle) * spread;
          this.sprayVelocities[i * 3 + 1] = 4.5 + Math.random() * 4.0;
          this.sprayVelocities[i * 3 + 2] = Math.sin(angle) * spread;
        }
      }
      this.fountainSpray.geometry.attributes.position.needsUpdate = true;
    }
  }

  private handleResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }
}
