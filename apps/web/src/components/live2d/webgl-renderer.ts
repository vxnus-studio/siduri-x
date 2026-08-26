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
  private vertexBuffer: WebGLBuffer | null = null;
  private uvBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;

  private aPositionLocation = -1;
  private aTexCoordLocation = -1;
  private uMatrixLocation: WebGLUniformLocation | null = null;
  private uTextureLocation: WebGLUniformLocation | null = null;
  private uOpacityLocation: WebGLUniformLocation | null = null;

  private textures: WebGLTexture[] = [];
  private moc: any = null;
  private model: any = null;
  private core: any = null;

  private paramIndices: Map<string, number> = new Map();
  private isDisposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public initialize(core: any, assets: LoadedModelAssets): void {
    this.core = core;
    const glOptions: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: true,
    };
    const gl = (this.canvas.getContext('webgl', glOptions) ||
      this.canvas.getContext('experimental-webgl', glOptions) ||
      this.canvas.getContext('webgl2', glOptions)) as WebGLRenderingContext | null;

    if (!gl) {
      throw new Error('WebGL is not supported in this browser environment');
    }
    this.gl = gl;

    // 1. Compile Shaders & Link Program
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

    // 2. Create Buffers
    this.vertexBuffer = gl.createBuffer();
    this.uvBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();

    // 3. Upload Textures
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
    } else if (exprFile === 'eyes_zetubou.exp3.json') {
      this.setParam('Param9', 1.0, 0.2); // Despair dark eyes
    } else if (exprFile === 'hair_open.exp3.json') {
      this.setParam('Param7', 1.0, 0.2); // Open hair/smile
    } else {
      // Return custom expression parameters to 0
      this.setParam('Param10', 0.0, 0.15);
      this.setParam('Param9', 0.0, 0.15);
      this.setParam('Param7', 0.0, 0.15);
    }

    // 2. Update model internal geometry
    this.model.update();

    // 3. Setup WebGL viewport & blending
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    // Calculate projection matrix preserving model aspect ratio
    // Scale and position model nicely in center of canvas
    const aspect = width / height;
    let scaleX = 1.6;
    let scaleY = 1.6 * aspect;

    if (aspect > 1) {
      scaleX = 1.6 / aspect;
      scaleY = 1.6;
    }

    const offsetY = -0.3; // Center chest/head in avatar window

    const matrix = new Float32Array([
      scaleX, 0, 0, 0,
      0, scaleY, 0, 0,
      0, 0, 1, 0,
      0, offsetY, 0, 1,
    ]);

    gl.uniformMatrix4fv(this.uMatrixLocation, false, matrix);
    gl.uniform1i(this.uTextureLocation, 0);

    // 4. Draw model drawables in sorted render order
    const drawables = this.model.drawables;
    const count = drawables.count;
    const renderOrders = drawables.renderOrders;

    // Create sorted index array
    const sortedIndices: number[] = [];
    for (let i = 0; i < count; i++) sortedIndices.push(i);
    sortedIndices.sort((a, b) => renderOrders[a] - renderOrders[b]);

    gl.enableVertexAttribArray(this.aPositionLocation);
    gl.enableVertexAttribArray(this.aTexCoordLocation);

    for (const idx of sortedIndices) {
      const opacity = drawables.opacities[idx];
      if (opacity <= 0.001) continue;

      const texIndex = drawables.textureIndices[idx];
      const tex = this.textures[texIndex];
      if (!tex) continue;

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
