// ImageData no navegador e no Node (o Node não tem ImageData): só `width`, `height` e `data` são usados.
export function createImage(width = 256, height = 224): ImageData {
  if (typeof ImageData !== 'undefined') return new ImageData(width, height);
  return { width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' } as ImageData;
}
