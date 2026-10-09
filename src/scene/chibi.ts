import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Role } from '../lib/types'

// Each joint owns its meshes, so poses remain consistent while walking or sitting.
export function createChibi(role: Role) {
  const model = new T.Group(),
    bones = new Map<string, T.Bone>()
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>()
  const material = (color: string, roughness = 0.88) => {
    const m = new T.MeshStandardMaterial({ color, roughness })
    materials.add(m)
    return m
  }
  const skin = material(role.skin),
    hair = material(role.hair),
    shirt = material(role.shirt)
  const dark = material('#303338'),
    white = material('#f3f0e7'),
    eyes = material('#25231f')
  function mesh(
    parent: T.Object3D,
    geometry: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) {
    geometries.add(geometry)
    const object = new T.Mesh(geometry, m)
    object.position.set(x, y, z)
    object.castShadow = object.receiveShadow = true
    parent.add(object)
    return object
  }
  function round(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    radius: number,
    m: T.Material,
  ) {
    return mesh(parent, new RoundedBoxGeometry(w, h, d, 3, radius), m, x, y, z)
  }
  function sphere(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: T.Material,
  ) {
    const object = mesh(parent, new T.SphereGeometry(1, 18, 12), m, x, y, z)
    object.scale.set(sx, sy, sz)
    return object
  }
  function joint(parent: T.Object3D, name: string, x: number, y: number, z: number) {
    const bone = new T.Bone()
    bone.name = name
    bone.position.set(x, y, z)
    bones.set(name.replace(/(L|R)$/, '.$1'), bone)
    parent.add(bone)
    return bone
  }
  round(model, 0, 0.98, 0, 0.57, 0.46, 0.37, 0.15, shirt)
  round(model, 0, 0.76, 0, 0.48, 0.17, 0.32, 0.07, dark)
  sphere(model, 0, 1.24, 0, 0.11, 0.14, 0.11, skin)
  const head = joint(model, 'Head', 0, 1.61, 0)
  round(head, 0, 0, 0, 0.8, 0.74, 0.71, 0.26, skin)
  for (const sign of [-1, 1]) {
    sphere(head, sign * 0.405, -0.03, 0, 0.066, 0.1, 0.068, skin)
    sphere(head, sign * 0.134, 0.014, 0.356, 0.021, 0.029, 0.015, eyes)
    sphere(head, sign * 0.13, 0.024, 0.368, 0.006, 0.007, 0.004, white)
    const brow = round(head, sign * 0.132, 0.093, 0.35, 0.087, 0.016, 0.015, 0.006, hair)
    brow.rotation.z = sign * -0.08
  }
  sphere(head, 0, -0.065, 0.365, 0.033, 0.034, 0.033, skin)
  const smile = mesh(head, new T.TorusGeometry(0.049, 0.009, 6, 14, Math.PI * 0.72), eyes, 0, -0.103, 0.357)
  smile.rotation.z = Math.PI * 1.14
  const cap = mesh(
    head,
    new T.SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.45),
    hair,
    0,
    0.09,
    -0.015,
  )
  cap.scale.set(0.437, 0.36, 0.397)
  const female = role.model.startsWith('female'),
    formal = /suit|formal/.test(role.model)
  for (let n = 0; n < 3; n++) {
    const fringe = sphere(head, -0.22 + n * 0.2, 0.25 - n * 0.013, 0.29, 0.17, 0.1, 0.1, hair)
    fringe.rotation.z = -0.28
  }
  if (female) {
    for (const sign of [-1, 1])
      sphere(head, sign * 0.35, -0.11, -0.1, 0.12, role.model === 'female-casual' ? 0.25 : 0.31, 0.26, hair)
    if (role.model === 'female-formal') sphere(head, 0.19, -0.12, -0.37, 0.14, 0.2, 0.15, hair)
  } else {
    round(head, 0, 0.04, -0.3, 0.65, 0.48, 0.18, 0.07, hair)
    for (const sign of [-1, 1]) sphere(head, sign * 0.355, 0.04, -0.12, 0.075, 0.19, 0.24, hair)
    const sweep = sphere(head, -0.12, 0.33, 0.14, 0.32, 0.12, 0.23, hair)
    sweep.rotation.z = -0.16
  }
  if (formal) {
    for (const sign of [-1, 1]) {
      const collar = round(model, sign * 0.065, 1.145, 0.182, 0.12, 0.14, 0.024, 0.014, white)
      collar.rotation.z = sign * 0.35
    }
    if (!female) round(model, 0, 1.04, 0.199, 0.045, 0.19, 0.02, 0.009, material('#b0a18a'))
  } else round(model, 0, 1.15, 0.05, 0.19, 0.038, 0.2, 0.016, white)
  for (const [side, sign] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    const arm = joint(model, `UpperArm${side}`, sign * 0.295, 1.11, 0)
    round(arm, 0, -0.105, 0, 0.19, 0.25, 0.22, 0.086, shirt)
    const forearm = joint(arm, `LowerArm${side}`, 0, -0.24, 0)
    round(forearm, 0, -0.085, 0, 0.15, 0.2, 0.16, 0.07, formal ? shirt : skin)
    const hand = joint(forearm, `Wrist${side}`, 0, -0.21, 0)
    sphere(hand, 0, -0.018, 0.018, 0.083, 0.09, 0.079, skin)
    const thigh = joint(model, `UpperLeg${side}`, sign * 0.135, 0.77, 0)
    round(thigh, 0, -0.16, 0, 0.205, 0.35, 0.23, 0.084, dark)
    const calf = joint(thigh, `LowerLeg${side}`, 0, -0.34, 0)
    round(calf, 0, -0.155, 0, 0.18, 0.33, 0.2, 0.072, dark)
    const foot = joint(calf, `Foot${side}`, 0, -0.33, 0)
    round(foot, 0, -0.027, 0.052, 0.215, 0.12, 0.32, 0.054, white)
  }
  const clips: T.AnimationClip[] = []
  const names = [...bones.values()].map((b) => b.name)
  for (const action of ['Idle_Neutral', 'Walk', 'Wave']) {
    const tracks: T.KeyframeTrack[] = []
    for (const name of names)
      for (const axis of ['x', 'y', 'z']) {
        let values = [0, 0, 0, 0, 0]
        const sign = name.endsWith('L') ? 1 : -1
        if (action === 'Walk' && axis === 'x') {
          if (name.startsWith('UpperLeg')) values = [0, 0.46 * sign, 0, -0.46 * sign, 0]
          if (name.startsWith('UpperArm')) values = [0, -0.28 * sign, 0, 0.28 * sign, 0]
          if (name.startsWith('LowerLeg')) values = [0.05, 0.2, 0.05, 0.2, 0.05]
        }
        if (action === 'Wave' && name === 'UpperArmR' && axis === 'z') values = [2.5, 2.7, 2.5, 2.7, 2.5]
        if (action === 'Wave' && name === 'LowerArmR' && axis === 'x') values = [-0.4, -0.8, -0.4, -0.8, -0.4]
        tracks.push(new T.NumberKeyframeTrack(`${name}.rotation[${axis}]`, [0, 0.3, 0.6, 0.9, 1.2], values))
      }
    clips.push(new T.AnimationClip(action, 1.2, tracks))
  }
  const cup = new T.Group(),
    book = new T.Group()
  cup.visible = book.visible = false
  model.add(cup, book)
  mesh(cup, new T.CylinderGeometry(0.072, 0.058, 0.13, 16), white, 0, 0.06, 0)
  mesh(cup, new T.CylinderGeometry(0.058, 0.058, 0.004, 16), material('#5a3d2e'), 0, 0.128, 0)
  mesh(cup, new T.TorusGeometry(0.04, 0.012, 6, 14), white, 0.076, 0.06, 0)
  round(book, 0, 0, 0, 0.36, 0.045, 0.27, 0.01, material('#7a978a'))
  round(book, 0, 0.026, 0, 0.33, 0.008, 0.24, 0.002, white)
  return {
    model,
    bones,
    clips,
    cup,
    book,
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
