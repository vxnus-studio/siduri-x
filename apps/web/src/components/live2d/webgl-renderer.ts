import { LoadedModelAssets } from './loader';
import { Live2DStateController } from './controller';
import { mapSemanticExpression } from './controller';

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
uniform mat4 u_matrix;
varying vec2 v_texCoord;
void main() {
  gl_Position = u_matrix * vec4(a_position.x, a_position.y, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_opacity;
varying vec2 v_texCoord;
void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  gl_FragColor = color * u_opacity;
}
`;

const MASK_FRAGMENT_SHADER_SRC = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texCoord;
void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  if (color.a < 0.1) {
    discard;
  }
  gl_FragColor = vec4(1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${info}`);
  }
  return shader;
}

export class Live2DWebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private maskProgram: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private uvBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;

  private aPositionLocation = -1;
  private aTexCoordLocation = -1;
  private uMatrixLocation: WebGLUniformLocation | null = null;
  private uTextureLocation: WebGLUniformLocation | null = null;
  private uOpacityLocation: WebGLUniformLocation | null = null;

  private maskAPositionLocation = -1;
  private maskATexCoordLocation = -1;
  private maskUMatrixLocation: WebGLUniformLocation | null = null;
  private maskUTextureLocation: WebGLUniformLocation | null = null;

  private textures: WebGLTexture[] = [];
  private moc: any = null;
  private model: any = null;
  private core: any = null;

  private paramIndices: Map<string, number> = new Map();
  private isDisposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  private modelBounds = {
    minX: -0.39,
    maxX: 0.40,
    minY: -0.98,
    maxY: 0.18,
    width: 0.79,
    height: 1.16,
    centerX: 0.006,
    centerY: -0.40,
  };

  public initialize(core: any, assets: LoadedModelAssets): void {
    this.core = core;
    const glOptions: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: true,
      stencil: true,
    };
    const gl = (this.canvas.getContext('webgl', glOptions) ||
      this.canvas.getContext('experimental-webgl', glOptions) ||
      this.canvas.getContext('webgl2', glOptions)) as WebGLRenderingContext | null;

    if (!gl) {
      throw new Error('WebGL is not supported in this browser environment');
    }
    this.gl = gl;

    // 1. Compile Main Shaders & Link Program
    const vert = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create WebGL program');

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }

    this.program = program;
    this.aPositionLocation = gl.getAttribLocation(program, 'a_position');
    this.aTexCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    this.uMatrixLocation = gl.getUniformLocation(program, 'u_matrix');
    this.uTextureLocation = gl.getUniformLocation(program, 'u_texture');
    this.uOpacityLocation = gl.getUniformLocation(program, 'u_opacity');

    // 1b. Compile Mask Shader & Link Mask Program
    const maskFrag = createShader(gl, gl.FRAGMENT_SHADER, MASK_FRAGMENT_SHADER_SRC);
    const maskProg = gl.createProgram();
    if (!maskProg) throw new Error('Failed to create Mask WebGL program');

    gl.attachShader(maskProg, vert);
    gl.attachShader(maskProg, maskFrag);
    gl.linkProgram(maskProg);

    if (!gl.getProgramParameter(maskProg, gl.LINK_STATUS)) {
      throw new Error(`Mask Program link error: ${gl.getProgramInfoLog(maskProg)}`);
    }

    this.maskProgram = maskProg;
    this.maskAPositionLocation = gl.getAttribLocation(maskProg, 'a_position');
    this.maskATexCoordLocation = gl.getAttribLocation(maskProg, 'a_texCoord');
    this.maskUMatrixLocation = gl.getUniformLocation(maskProg, 'u_matrix');
    this.maskUTextureLocation = gl.getUniformLocation(maskProg, 'u_texture');

    // 2. Create Buffers
    this.vertexBuffer = gl.createBuffer();
    this.uvBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();

    // 3. Upload Textures with Premultiplied Alpha for WebGL
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    this.textures = assets.textures.map((img) => {
      const tex = gl.createTexture();
      if (!tex) throw new Error('Failed to create WebGL texture');
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      return tex;
    });

    // 4. Instantiate Cubism Moc & Model
    this.moc = core.Moc.fromArrayBuffer(assets.mocBuffer);
    if (!this.moc) throw new Error('Failed to create Live2D Moc from ArrayBuffer');

    this.model = core.Model.fromMoc(this.moc);
    if (!this.model) throw new Error('Failed to create Live2D Model from Moc');

    // Index parameter IDs for fast access
    const paramIds = this.model.parameters.ids;
    for (let i = 0; i < paramIds.length; i++) {
      this.paramIndices.set(paramIds[i], i);
    }

    // Explicitly initialize mouth parameters to neutral closed resting state
    this.initializeNeutralMouth();

    // Measure model bounds from initial geometry update
    this.model.update();
    this.calculateModelBounds();
  }

  /**
   * Initializes all mouth parameters to their neutral closed resting values
   * before the first visible animation or render frame.
   */
  public initializeNeutralMouth(): void {
    if (!this.model) return;
    this.setParamDirect('ParamMouthOpenY', 0.0);
    this.setParamDirect('ParamMouthForm', 0.0);
  }

  private setParamDirect(id: string, value: number): void {
    const idx = this.paramIndices.get(id);
    if (idx !== undefined && this.model) {
      const min = this.model.parameters.minimumValues[idx];
      const max = this.model.parameters.maximumValues[idx];
      this.model.parameters.values[idx] = Math.max(min, Math.min(max, value));
    }
  }

  private calculateModelBounds(): void {
    if (!this.model) return;
    const drawables = this.model.drawables;
    const count = drawables.count;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < count; i++) {
      const positions = drawables.vertexPositions[i];
      if (!positions || positions.length === 0) continue;
      for (let j = 0; j < positions.length; j += 2) {
        const x = positions[j];
        const y = positions[j + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (minX !== Infinity && maxX !== -Infinity && minY !== Infinity && maxY !== -Infinity) {
      this.modelBounds = {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      };
    }
  }

  public getModelBounds() {
    return { ...this.modelBounds };
  }

  public setParam(id: string, value: number, weight: number = 1.0): void {
    const idx = this.paramIndices.get(id);
    if (idx !== undefined && this.model) {
      const current = this.model.parameters.values[idx];
      const min = this.model.parameters.minimumValues[idx];
      const max = this.model.parameters.maximumValues[idx];
      const target = Math.max(min, Math.min(max, value));
      this.model.parameters.values[idx] = current + (target - current) * weight;
    }
  }

  public render(controller: Live2DStateController, nowMs: number = Date.now()): void {
    if (this.isDisposed || !this.gl || !this.model || !this.program) return;
    const gl = this.gl;

    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width === 0 || height === 0) return;

    // 1. Calculate animated parameters
    const params = controller.calculateFrameParameters(nowMs);

    // Apply standard parameters
    this.setParam('ParamAngleX', params.angleX, 0.2);
    this.setParam('ParamAngleY', params.angleY, 0.2);
    this.setParam('ParamAngleZ', params.angleZ, 0.2);
    this.setParam('ParamBodyAngleX', params.bodyAngleX, 0.15);
    this.setParam('ParamBreath', params.breath, 0.3);
    this.setParam('ParamEyeLOpen', params.eyeOpenL, 0.4);
    this.setParam('ParamEyeROpen', params.eyeOpenR, 0.4);
    this.setParam('ParamMouthOpenY', params.mouthOpenY, 0.35);

    // Apply active expression parameters
    const exprFile = mapSemanticExpression(controller.expression);
    if (exprFile === 'face_aozame.exp3.json') {
      this.setParam('Param10', 1.0, 0.2); // Blue pale face
      this.setParam('Param9', 0.0, 0.15);
      this.setParam('Param11', 0.0, 0.15);
      this.setParam('Param12', 0.0, 0.15);
    } else if (exprFile === 'eyes_zetubou.exp3.json') {
      this.setParam('Param9', 1.0, 0.2); // Despair dark eyes
      this.setParam('Param10', 0.0, 0.15);
      this.setParam('Param11', 0.0, 0.15);
      this.setParam('Param12', 0.0, 0.15);
    } else if (exprFile === 'hair_open.exp3.json') {
      this.setParam('Param11', 1.0, 0.2); // Open hair/smile
      this.setParam('Param10', 0.0, 0.15);
      this.setParam('Param9', 0.0, 0.15);
      this.setParam('Param12', 0.0, 0.15);
    } else if (exprFile === 'eye_color.exp3.json') {
      this.setParam('Param12', 1.0, 0.2); // Eye color
      this.setParam('Param10', 0.0, 0.15);
      this.setParam('Param9', 0.0, 0.15);
      this.setParam('Param11', 0.0, 0.15);
    } else {
      // Return custom expression parameters to 0
      this.setParam('Param10', 0.0, 0.15);
      this.setParam('Param9', 0.0, 0.15);
      this.setParam('Param11', 0.0, 0.15);
      this.setParam('Param12', 0.0, 0.15);
    }

    // 2. Update model internal geometry
    this.model.update();

    // 3. Setup WebGL viewport & clear
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    // Calculate full-body projection matrix fitted within canvas bounds
    // We scale the model based on its actual bounding box with a margin for safety/motion
    const canvasAspect = width / height;
    const modelWidth = this.modelBounds.width;
    const modelHeight = this.modelBounds.height;
    const modelCenterX = this.modelBounds.centerX;
    const modelCenterY = this.modelBounds.centerY;

    // Safety margin (e.g. 92% of viewport) to avoid clipping hair/feet during sway animations
    const fitFactor = 1.84;
    const scaleXForWidth = fitFactor / modelWidth;
    const scaleYForHeight = fitFactor / modelHeight;

    // Fit entirely within the canvas while preserving aspect ratio
    let baseScale: number;
    if (canvasAspect >= modelWidth / modelHeight) {
      // Canvas is wider than model aspect ratio: fit to height
      baseScale = scaleYForHeight;
    } else {
      // Canvas is narrower than model aspect ratio: fit to width
      baseScale = scaleXForWidth * canvasAspect;
    }

    // Ensure scale respects canvas aspect ratio in NDC space:
    // NDC X goes from -1 to 1, NDC Y goes from -1 to 1.
    // To maintain square pixels on a non-square canvas:
    const scaleX = baseScale / canvasAspect;
    const scaleY = baseScale;

    // Center model at NDC (0, 0)
    const transX = -modelCenterX * scaleX;
    const transY = -modelCenterY * scaleY;

    const matrix = new Float32Array([
      scaleX, 0, 0, 0,
      0, scaleY, 0, 0,
      0, 0, 1, 0,
      transX, transY, 0, 1,
    ]);

    gl.uniformMatrix4fv(this.uMatrixLocation, false, matrix);
    gl.uniform1i(this.uTextureLocation, 0);

    // 4. Draw model drawables in sorted render order with stencil mask support
    const drawables = this.model.drawables;
    const count = drawables.count;
    const renderOrders = drawables.renderOrders;

    // Create sorted index array
    const sortedIndices: number[] = [];
    for (let i = 0; i < count; i++) sortedIndices.push(i);
    sortedIndices.sort((a, b) => renderOrders[a] - renderOrders[b]);

    gl.enableVertexAttribArray(this.aPositionLocation);
    gl.enableVertexAttribArray(this.aTexCoordLocation);

    const drawSingleMesh = (idx: number, opacityOverride?: number) => {
      const opacity = opacityOverride !== undefined ? opacityOverride : drawables.opacities[idx];
      if (opacity <= 0.001) return;

      const texIndex = drawables.textureIndices[idx];
      const tex = this.textures[texIndex];
      if (!tex) return;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1f(this.uOpacityLocation, opacity);

      // Bind positions
      const positions = drawables.vertexPositions[idx];
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.aPositionLocation, 2, gl.FLOAT, false, 0, 0);

      // Bind UVs
      const uvs = drawables.vertexUvs[idx];
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

      // Bind Indices and Draw
      const indices = drawables.indices[idx];
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    };

    const drawMaskMesh = (idx: number) => {
      if (!this.maskProgram) return;
      gl.useProgram(this.maskProgram);
      gl.uniformMatrix4fv(this.maskUMatrixLocation, false, matrix);
      gl.uniform1i(this.maskUTextureLocation, 0);

      gl.enableVertexAttribArray(this.maskAPositionLocation);
      gl.enableVertexAttribArray(this.maskATexCoordLocation);

      const texIndex = drawables.textureIndices[idx];
      const tex = this.textures[texIndex];
      if (!tex) return;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      const positions = drawables.vertexPositions[idx];
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.maskAPositionLocation, 2, gl.FLOAT, false, 0, 0);

      const uvs = drawables.vertexUvs[idx];
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.maskATexCoordLocation, 2, gl.FLOAT, false, 0, 0);

      const indices = drawables.indices[idx];
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      // Switch back to main program
      gl.useProgram(this.program);
      gl.enableVertexAttribArray(this.aPositionLocation);
      gl.enableVertexAttribArray(this.aTexCoordLocation);
    };

    let currentMaskDrawableIndex = -1;

    for (const idx of sortedIndices) {
      const opacity = drawables.opacities[idx];
      if (opacity <= 0.001) continue;

      const maskCount = drawables.maskCounts[idx];

      if (maskCount > 0) {
        const maskDrawableIdx = drawables.masks[idx][0];
        if (maskDrawableIdx !== currentMaskDrawableIndex) {
          currentMaskDrawableIndex = maskDrawableIdx;

          // Render mask into stencil buffer
          gl.enable(gl.STENCIL_TEST);
          gl.stencilMask(0xff);
          gl.clear(gl.STENCIL_BUFFER_BIT);

          // Write 1 to stencil where mask drawable is rendered with alpha >= 0.1
          gl.stencilFunc(gl.ALWAYS, 1, 0xff);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
          gl.colorMask(false, false, false, false); // Don't write to color buffer

          drawMaskMesh(maskDrawableIdx);

          gl.colorMask(true, true, true, true);
        }

        // Draw masked drawable only where stencil value is 1
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        drawSingleMesh(idx);
      } else {
        if (currentMaskDrawableIndex !== -1) {
          gl.disable(gl.STENCIL_TEST);
          currentMaskDrawableIndex = -1;
        }
        drawSingleMesh(idx);
      }
    }

    if (currentMaskDrawableIndex !== -1) {
      gl.disable(gl.STENCIL_TEST);
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.gl) {
      for (const tex of this.textures) {
        this.gl.deleteTexture(tex);
      }
      this.textures = [];

      if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer);
      if (this.uvBuffer) this.gl.deleteBuffer(this.uvBuffer);
      if (this.indexBuffer) this.gl.deleteBuffer(this.indexBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
    }

    if (this.model && typeof this.model.release === 'function') {
      this.model.release();
    }
    if (this.moc && typeof this.moc.release === 'function') {
      this.moc.release();
    }

    this.model = null;
    this.moc = null;
    this.gl = null;
  }
}
