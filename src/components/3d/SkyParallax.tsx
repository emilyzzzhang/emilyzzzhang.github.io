import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Spherical } from 'three';
import { HOME_VIEW } from '../../config/camera';

/**
 * Lets the sky behind the canvas follow the camera: as the room is orbited, the daytime cloud
 * layers and the night stars slide the way a far-off sky would (nearer clouds further than distant
 * ones, for parallax). Publishes the camera's angle away from the overview, in radians, as CSS
 * variables on those elements, so the browser does the moving (see `.clouds__pan`, `.stars__pan`).
 */
const target = new Vector3(...HOME_VIEW.target);
const home = new Spherical().setFromVector3(new Vector3(...HOME_VIEW.position).sub(target));

export function SkyParallax() {
  const skies = useRef<HTMLElement[]>([]);
  const last = useRef({ x: NaN, y: NaN });
  const spherical = useRef(new Spherical());
  const offset = useRef(new Vector3());

  useFrame(({ camera }) => {
    if (!skies.current.length) skies.current = [...document.querySelectorAll<HTMLElement>('.clouds, .stars')];
    if (!skies.current.length) return;
    const s = spherical.current.setFromVector3(offset.current.copy(camera.position).sub(target));
    const x = s.theta - home.theta;
    const y = s.phi - home.phi;
    // Only touch the DOM when the view has actually turned.
    if (Math.abs(x - last.current.x) < 1e-4 && Math.abs(y - last.current.y) < 1e-4) return;
    last.current = { x, y };
    for (const el of skies.current) {
      el.style.setProperty('--sky-yaw', x.toFixed(4));
      el.style.setProperty('--sky-pitch', y.toFixed(4));
    }
  });

  return null;
}
