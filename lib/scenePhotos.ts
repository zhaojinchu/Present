import { Image } from 'react-native';

/** Bundled lecture-hall stills, shot from a seat in the room. */
const SCENES: Record<string, number> = {
  'scene/riley-122': require('../assets/scenes/lecture-ghc-mid.jpg'),
  'scene/sam-122': require('../assets/scenes/lecture-ghc-side.jpg'),
  'scene/jordan-127': require('../assets/scenes/lecture-doherty.jpg'),
  'scene/jordan-old': require('../assets/scenes/lecture-wean.jpg'),
  'scene/sample': require('../assets/scenes/lecture-ghc-mid.jpg'),
};

export function bundledSceneSource(path: string | null | undefined): number | null {
  if (!path) return null;
  return SCENES[path] ?? (path.startsWith('scene/') || path.includes('back') ? SCENES['scene/sample'] : null);
}

export function bundledSceneUri(path: string | null | undefined): string | null {
  const mod = bundledSceneSource(path);
  if (mod == null) return null;
  if (typeof mod === 'string') return mod;
  if (typeof mod === 'object' && mod && 'uri' in mod) return String((mod as { uri: string }).uri);
  const resolve = (Image as { resolveAssetSource?: (m: unknown) => { uri?: string } | null }).resolveAssetSource;
  return typeof resolve === 'function' ? (resolve(mod)?.uri ?? null) : null;
}
