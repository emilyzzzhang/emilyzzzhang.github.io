import { Suspense, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { sceneColors } from '../../config/theme';
import { materials, paperFinish } from './materials';
import { drawArt, drawCorkboard, useCanvasTexture } from './textures';

interface FrameProps {
  position: [number, number, number];
  size: [number, number];
  artIndex: number;
  /** Painting in public/, e.g. 'images/art/mountain-lake.jpg'. The procedural print shows while it loads. */
  image: string;
  frameMaterial: keyof typeof materials;
}

/** Crops a texture to fill a w × h opening without stretching, like CSS object-fit: cover. */
function cover(texture: Texture, w: number, h: number) {
  const { width, height } = texture.image as { width: number; height: number };
  const opening = w / h;
  const picture = width / height;
  const [sx, sy] = picture > opening ? [opening / picture, 1] : [1, picture / opening];
  texture.repeat.set(sx, sy);
  texture.offset.set((1 - sx) / 2, (1 - sy) / 2);
}

function Painting({ url, w, h }: { url: string; w: number; h: number }) {
  const loaded = useLoader(TextureLoader, `${import.meta.env.BASE_URL}${url}`);
  const texture = useMemo(() => {
    loaded.colorSpace = SRGBColorSpace;
    loaded.anisotropy = 8;
    cover(loaded, w, h);
    loaded.needsUpdate = true;
    return loaded;
  }, [loaded, w, h]);
  return <PrintSurface map={texture} w={w} h={h} />;
}

function ProceduralPrint({ artIndex, w, h }: { artIndex: number; w: number; h: number }) {
  const art = useCanvasTexture(drawArt[artIndex], 384, 480);
  return <PrintSurface map={art} w={w} h={h} />;
}

function PrintSurface({ map, w, h }: { map: Texture; w: number; h: number }) {
  return (
    <mesh position-z={0.064}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} {...paperFinish(0.85)} />
    </mesh>
  );
}

function Frame({ position, size: [w, h], artIndex, image, frameMaterial }: FrameProps) {
  return (
    <group position={position}>
      <RoundedBox args={[w + 0.12, h + 0.12, 0.06]} radius={0.025} position-z={0.03} material={materials[frameMaterial]} />
      <mesh position-z={0.062}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={sceneColors.warmWhite} {...paperFinish(0.9)} />
      </mesh>
      <Suspense fallback={<ProceduralPrint artIndex={artIndex} w={w - 0.14} h={h - 0.14} />}>
        <Painting url={image} w={w - 0.14} h={h - 0.14} />
      </Suspense>
    </group>
  );
}

/** Three framed paintings above the desk — one per internship. Local origin: centre on the wall. */
export function GalleryFrames() {
  return (
    <group>
      <Frame position={[-0.98, 0.02, 0]} size={[0.72, 0.9]} artIndex={0} image="images/art/mountain-lake.jpg" frameMaterial="wood" />
      <Frame position={[0, 0.14, 0]} size={[0.8, 1.0]} artIndex={1} image="images/art/campus-gates.jpg" frameMaterial="white" />
      <Frame position={[0.98, -0.06, 0]} size={[0.72, 0.9]} artIndex={2} image="images/art/city-street.jpg" frameMaterial="woodLight" />
    </group>
  );
}

export function Corkboard({ position }: { position: [number, number, number] }) {
  const cork = useCanvasTexture(drawCorkboard, 512, 384);
  const w = 1.25;
  const h = 0.94;
  return (
    <group position={position}>
      <RoundedBox args={[w + 0.1, h + 0.1, 0.05]} radius={0.02} position-z={0.025} material={materials.woodLight} />
      <mesh position-z={0.052}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={cork} roughness={1} />
      </mesh>
    </group>
  );
}
