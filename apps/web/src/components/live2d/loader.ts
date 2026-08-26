import { Model3Json, Expression3Json } from './types';

declare global {
  interface Window {
    Live2DCubismCore?: any;
  }
}

/**
 * Dynamically loads the official Live2D Cubism Core script into the browser.
 */
export async function loadCubismCore(
  scriptUrl: string = '/live2d/live2dcubismcore.min.js',
): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Cubism Core can only be loaded in a browser environment');
  }

  if (window.Live2DCubismCore) {
    return window.Live2DCubismCore;
  }

  return new Promise((resolve, reject) => {
    // Check if script is already present in document
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      if (window.Live2DCubismCore) {
        return resolve(window.Live2DCubismCore);
      }
      existingScript.addEventListener('load', () => resolve(window.Live2DCubismCore));
      existingScript.addEventListener('error', (e) =>
        reject(new Error(`Failed to load Cubism Core from ${scriptUrl}: ${e}`)),
      );
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      if (window.Live2DCubismCore) {
        resolve(window.Live2DCubismCore);
      } else {
        reject(new Error('Live2DCubismCore global not found after script load'));
      }
    };
    script.onerror = () => {
      // Try fallback to remote CDN if local file fails
      const fallbackUrl = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
      console.warn(`[Live2D] Failed to load local Cubism Core, attempting fallback: ${fallbackUrl}`);
      const fallbackScript = document.createElement('script');
      fallbackScript.src = fallbackUrl;
      fallbackScript.async = true;
      fallbackScript.onload = () => {
        if (window.Live2DCubismCore) {
          resolve(window.Live2DCubismCore);
        } else {
          reject(new Error('Live2DCubismCore global not found after fallback load'));
        }
      };
      fallbackScript.onerror = (err) =>
        reject(new Error(`Failed to load Cubism Core from both local and remote sources: ${err}`));
      document.head.appendChild(fallbackScript);
    };

    document.head.appendChild(script);
  });
}

export interface LoadedModelAssets {
  model3: Model3Json;
  mocBuffer: ArrayBuffer;
  textures: HTMLImageElement[];
  expressions: Map<string, Expression3Json>;
  basePath: string;
}

/**
 * Loads all static files associated with a .model3.json manifest.
 */
export async function loadModelAssets(modelJsonUrl: string): Promise<LoadedModelAssets> {
  const lastSlash = modelJsonUrl.lastIndexOf('/');
  const basePath = lastSlash !== -1 ? modelJsonUrl.slice(0, lastSlash + 1) : '';

  // 1. Fetch model3.json
  const res = await fetch(modelJsonUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch model manifest from ${modelJsonUrl} (${res.status})`);
  }
  const model3: Model3Json = await res.json();

  if (!model3.FileReferences || !model3.FileReferences.Moc) {
    throw new Error(`Invalid model3.json: missing Moc file reference in ${modelJsonUrl}`);
  }

  // 2. Fetch .moc3 binary
  const mocUrl = basePath + model3.FileReferences.Moc;
  const mocRes = await fetch(mocUrl);
  if (!mocRes.ok) {
    throw new Error(`Failed to fetch .moc3 file from ${mocUrl} (${mocRes.status})`);
  }
  const mocBuffer = await mocRes.arrayBuffer();

  // 3. Load all textures in parallel
  const textureUrls = (model3.FileReferences.Textures || []).map((t) => basePath + t);
  const textures = await Promise.all(
    textureUrls.map((url) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load texture from ${url}`));
        img.src = url;
      });
    }),
  );

  // 4. Fetch expressions in parallel
  const expressions = new Map<string, Expression3Json>();
  if (model3.FileReferences.Expressions && model3.FileReferences.Expressions.length > 0) {
    await Promise.all(
      model3.FileReferences.Expressions.map(async (exprRef) => {
        try {
          const exprUrl = basePath + exprRef.File;
          const exprRes = await fetch(exprUrl);
          if (exprRes.ok) {
            const exprJson: Expression3Json = await exprRes.json();
            expressions.set(exprRef.File, exprJson);
            if (exprRef.Name) {
              expressions.set(exprRef.Name, exprJson);
            }
          }
        } catch {
          // Non-fatal: missing expression files will fall back gracefully
        }
      }),
    );
  }

  return {
    model3,
    mocBuffer,
    textures,
    expressions,
    basePath,
  };
}
