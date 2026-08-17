import * as THREE from "three";
import { surfaceHeightAt } from "../world/collision.js";

/**
 * Следы на реголите. Кольцевой буфер инстансов: старые следы переиспользуются,
 * поэтому цена постоянная независимо от длины прогулки.
 */
export function createFootprints(scene, max = 260) {
  const geo = new THREE.PlaneGeometry(0.28, 0.4);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({
    color: 0x3a3833,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  // Прячем все инстансы до первого шага
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < max; i++) mesh.setMatrixAt(i, hidden);
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  let cursor = 0;
  let side = 1;

  return {
    mesh,
    /** Ставит пару следов под игроком, чередуя левую и правую ногу. */
    step(position, facing) {
      const offset = side * 0.17;
      side *= -1;

      const x = position.x + Math.cos(facing) * offset;
      const z = position.z - Math.sin(facing) * offset;

      dummy.position.set(x, surfaceHeightAt(x, z) + 0.03, z);
      dummy.rotation.set(0, facing, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();

      mesh.setMatrixAt(cursor, dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      cursor = (cursor + 1) % max;
    },
  };
}
