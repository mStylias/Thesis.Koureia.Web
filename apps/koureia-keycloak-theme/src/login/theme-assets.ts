export function themeAssetUrl(resourcesPath: string, publicPath: string): string {
  const basePath = resourcesPath.replace(/\/+$/, '');
  const assetPath = publicPath.replace(/^\/+/, '');

  return `${basePath}/dist/${assetPath}`;
}
