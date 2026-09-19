import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { AvatarExpression, AvatarAction, AvatarState } from '../live2d/types';

export interface VRMControllerConfig {
  lookAtMode?: 'camera' | 'cursor' | 'head' | 'none';
  specVersion?: '0.x' | '1.0' | 'auto';
}

/**
 * Maps Siduri canonical expressions to standard VRM expression presets.
 */
export function mapExpressionToVRMPreset(expression?: AvatarExpression | string): VRMExpressionPresetName | string {
  if (!expression) return 'neutral';
  const normalized = expression.toLowerCase().trim();

  switch (normalized) {
    case 'happy':
    case 'joy':
      return 'happy';
    case 'angry':
      return 'angry';
    case 'sad':
    case 'sorrow':
    case 'concerned':
      return 'sad';
    case 'relaxed':
    case 'thinking':
      return 'relaxed';
    case 'surprised':
      return 'surprised';
    case 'neutral':
    default:
      return 'neutral';
  }
}

/**
 * Dedicated controller for humanoid 3D VRM models.
 * Manages Three.js scene, camera, lighting, SpringBones, LookAt gaze, and facial blendshapes.
 */
export class VRMController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private currentVRM: VRM | null = null;
  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isDisposed = false;

  // Active state
  public expression: AvatarExpression = 'neutral';
  public action: AvatarAction = 'idle';
  public state: AvatarState = 'idle';
  public speechId?: string;
  public lipSyncValue = 0;
  public lookAtMode: 'camera' | 'cursor' | 'head' | 'none' = 'camera';

  // Procedural timers
  private lastBlinkTime = 0;
  private isBlinking = false;
  private blinkProgress = 0;

  constructor(private canvas: HTMLCanvasElement, config: VRMControllerConfig = {}) {
    this.lookAtMode = config.lookAtMode || 'camera';
    this.clock = new THREE.Clock();

    // 1. Initialize Scene
    this.scene = new THREE.Scene();

    // 2. Initialize Camera
    this.camera = new THREE.PerspectiveCamera(
      30.0,
      canvas.clientWidth / Math.max(canvas.clientHeight, 1),
      0.1,
      20.0
    );
    this.camera.position.set(0.0, 1.4, 1.3);

    // 3. Initialize Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    this.scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // 4. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  /**
   * Loads a .vrm file into the Three.js scene.
   */
  public async loadModel(url: string, onProgress?: (progress: number) => void): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          if (this.isDisposed) return;
          const vrm = gltf.userData.vrm as VRM;
          if (!vrm) {
            return reject(new Error('Loaded asset does not contain valid VRM metadata'));
          }

          // Optimize VRM performance & rotate for standard front-facing coordinate system
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);
          VRMUtils.rotateVRM0(vrm);

          // Position model comfortably in view
          if (this.currentVRM) {
            this.scene.remove(this.currentVRM.scene);
            VRMUtils.deepDispose(this.currentVRM.scene);
          }

          this.currentVRM = vrm;
          this.scene.add(vrm.scene);

          // Position camera to frame humanoid chest and head
          if (vrm.humanoid) {
            const head = vrm.humanoid.getNormalizedBoneNode('head');
            if (head) {
              const headPos = new THREE.Vector3();
              head.getWorldPosition(headPos);
              this.camera.position.set(headPos.x, headPos.y + 0.05, headPos.z + 0.85);
              this.camera.lookAt(headPos.x, headPos.y, headPos.z);
            }
          }

          resolve(vrm);
        },
        (progress) => {
          if (progress.total > 0 && onProgress) {
            onProgress(progress.loaded / progress.total);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Updates state parameters without recreating the WebGL pipeline.
   */
  public updateState(params: {
    expression?: AvatarExpression;
    action?: AvatarAction;
    state?: AvatarState;
    speechId?: string;
    lipSyncValue?: number;
    lookAtMode?: 'camera' | 'cursor' | 'head' | 'none';
  }): void {
    if (params.expression !== undefined) this.expression = params.expression;
    if (params.action !== undefined) this.action = params.action;
    if (params.state !== undefined) this.state = params.state;
    if (params.speechId !== undefined) this.speechId = params.speechId;
    if (params.lipSyncValue !== undefined) this.lipSyncValue = params.lipSyncValue;
    if (params.lookAtMode !== undefined) this.lookAtMode = params.lookAtMode;
  }

  /**
   * Resizes camera frustum and WebGL viewport.
   */
  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0 || this.isDisposed) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /**
   * Starts the continuous rendering and physics simulation loop.
   */
  public startLoop(): void {
    const loop = () => {
      if (this.isDisposed) return;
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Step a single frame: physics, blendshapes, lookAt, and draw.
   */
  public render(): void {
    const delta = this.clock.getDelta();
    const now = performance.now();

    if (this.currentVRM) {
      // 1. Gaze / LookAt behavior
      if (this.currentVRM.lookAt) {
        if (this.lookAtMode === 'camera') {
          this.currentVRM.lookAt.target = this.camera;
        } else {
          this.currentVRM.lookAt.target = null;
        }
      }

      // 2. Expressions & Blendshapes
      if (this.currentVRM.expressionManager) {
        const mgr = this.currentVRM.expressionManager;

        // Reset all baseline emotion blendshapes to 0
        ['happy', 'angry', 'sad', 'relaxed', 'surprised'].forEach((exp) => {
          mgr.setValue(exp, 0);
        });

        // Set target emotion
        const targetPreset = mapExpressionToVRMPreset(this.expression);
        if (targetPreset !== 'neutral') {
          mgr.setValue(targetPreset, 1.0);
        }

        // Procedural Eye Blinking (every 3.5 - 5 seconds)
        if (!this.isBlinking && now - this.lastBlinkTime > 3800) {
          this.isBlinking = true;
          this.blinkProgress = 0;
          this.lastBlinkTime = now;
        }

        if (this.isBlinking) {
          this.blinkProgress += delta * 7.5; // Quick 130ms blink
          if (this.blinkProgress >= Math.PI) {
            this.isBlinking = false;
            mgr.setValue('blink', 0);
          } else {
            mgr.setValue('blink', Math.sin(this.blinkProgress));
          }
        }

        // 3. Lip sync / Speaking Visemes (mapping to 'aa')
        if (this.state === 'speaking') {
          const mouthOpen = this.lipSyncValue > 0
            ? Math.min(1.0, this.lipSyncValue)
            : Math.max(0, Math.sin(now / 1000 * 14) * 0.5 + 0.3);
          mgr.setValue('aa', mouthOpen);
        } else {
          mgr.setValue('aa', 0);
        }

        mgr.update();
      }

      // 4. SpringBone physics & bone kinematics
      this.currentVRM.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Cleans up GPU buffers, WebGL context, and event loops.
   */
  public dispose(): void {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.currentVRM) {
      this.scene.remove(this.currentVRM.scene);
      VRMUtils.deepDispose(this.currentVRM.scene);
      this.currentVRM = null;
    }
    this.renderer.dispose();
  }
}
