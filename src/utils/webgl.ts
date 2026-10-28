/** three.js (r163+) requires WebGL 2. */
export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return typeof WebGL2RenderingContext !== 'undefined' && canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
