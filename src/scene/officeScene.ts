import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createChibi } from './chibi'
import { surfaceTexture } from './textures'
import type { Role, Workspace, Furniture, Vec2, ActivityState } from '../lib/types'
import { RoutineSystem } from './routines'
import { distance } from './navigation'

export interface SceneLabel {
  id: string
  x: number
  y: number
  state: ActivityState
  visible: boolean
}
type Person = {
  group: T.Group
  model: T.Object3D
  mixer: T.AnimationMixer
  actions: Map<string, T.AnimationAction>
  current: string
  previous: Vec2
  bones: Map<string, T.Bone>
  cup: T.Object3D
  book: T.Object3D
  dispose: () => void
}
export class OfficeScene {
  scene = new T.Scene()
  renderer: T.WebGLRenderer
  camera: T.OrthographicCamera
  controls: OrbitControls
  routines: RoutineSystem
  private room = new T.Group()
  private people = new Map<string, Person>()
  private geometries = new Set<T.BufferGeometry>()
  private materials = new Set<T.Material>()
  private textures = new Set<T.Texture>()
  private wood?: T.Texture
  private frame = 0
  private last = performance.now()
  private disposed = false
  private observer: ResizeObserver
  private ray = new T.Raycaster()
  private pointer = new T.Vector2()
  private down = { x: 0, y: 0 }
  private signature = ''
  private clock = 0
  private keys = new Set<string>()
  constructor(
    private el: HTMLElement,
    private getWorkspace: () => Workspace,
    private onLabels: (labels: SceneLabel[]) => void,
    private onSelect: (id: string) => void,
    private onMessage: (text: string) => void,
    private onFloor?: (point: Vec2) => boolean,
  ) {
    this.routines = new RoutineSystem(getWorkspace)
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, getWorkspace().settings.quality === 'low' ? 1 : 1.6),
    )
    this.renderer.shadowMap.enabled = getWorkspace().settings.quality === 'high'
    this.renderer.shadowMap.type = T.PCFSoftShadowMap
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.el.append(this.renderer.domElement)
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Kantor 3D. Gunakan daftar role untuk akses keyboard.',
    )
    this.renderer.domElement.setAttribute('role', 'img')
    this.camera = new T.OrthographicCamera(-14, 14, 10, -10, 0.1, 140)
    this.camera.position.set(22, 25, 29)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.2, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minZoom = 0.25
    this.controls.maxZoom = 2.2
    this.controls.maxPolarAngle = Math.PI / 2.7
    this.controls.minPolarAngle = 0.3
    this.controls.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE }
    this.controls.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_ROTATE }
    this.controls.update()
    this.controls.saveState()
    this.scene.add(new T.HemisphereLight('#faf8ed', '#919fa3', 2.2))
    const sun = new T.DirectionalLight('#fff5df', 2.8)
    sun.position.set(-7, 20, 9)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 1, far: 50 })
    sun.shadow.normalBias = 0.04
    this.scene.add(sun)
    this.scene.add(this.room)
    this.rebuild()
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(el)
    this.resize()
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown)
    this.renderer.domElement.addEventListener('pointerup', this.pointerUp)
    this.renderer.domElement.addEventListener('contextmenu', this.contextMenu)
    window.addEventListener('keydown', this.keyDown)
    window.addEventListener('keyup', this.keyUp)
    window.addEventListener('blur', this.clearKeys)
    this.animate()
  }
  private mat(color: string, options: T.MeshStandardMaterialParameters = {}) {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.8, ...options })
    this.materials.add(m)
    return m
  }
  private box(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: T.Material,
  ) {
    const geo = new T.BoxGeometry(w, h, d)
    this.geometries.add(geo)
    const m = new T.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  private cyl(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    rt: number,
    rb: number,
    h: number,
    material: T.Material,
    n = 16,
  ) {
    const geo = new T.CylinderGeometry(rt, rb, h, n)
    this.geometries.add(geo)
    const m = new T.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  private canvasTexture(text: string, subtitle = '', screen = false) {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const ctx = c.getContext('2d')!
    ctx.fillStyle = screen ? '#e7eeeb' : '#ece8e0'
    ctx.fillRect(0, 0, 512, 256)
    ctx.fillStyle = screen ? '#2d716d' : '#d5c3a8'
    ctx.fillRect(0, 0, 512, screen ? 45 : 12)
    ctx.fillStyle = '#303a3b'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText(text.slice(0, 24), 30, 113)
    ctx.font = '23px sans-serif'
    ctx.fillStyle = '#62666d'
    ctx.fillText(subtitle.slice(0, 36), 30, 157)
    if (screen) {
      ctx.fillStyle = '#c1cec8'
      for (let i = 0; i < 3; i++) ctx.fillRect(30, 181 + i * 18, 350 - i * 60, 7)
    }
    const texture = new T.CanvasTexture(c)
    texture.colorSpace = T.SRGBColorSpace
    this.textures.add(texture)
    return texture
  }
  private cup(parent: T.Object3D, x: number, y: number, z: number) {
    const g = new T.Group()
    parent.add(g)
    g.position.set(x, y, z)
    this.cyl(g, 0, 0.05, 0, 0.075, 0.055, 0.12, this.mat('#f7f4eb'), 12)
    this.cyl(g, 0, 0.113, 0, 0.056, 0.056, 0.003, this.mat('#55382d'), 12)
    const geo = new T.TorusGeometry(0.04, 0.012, 5, 12)
    this.geometries.add(geo)
    const handle = new T.Mesh(geo, this.mat('#f7f4eb'))
    handle.position.set(0.077, 0.05, 0)
    g.add(handle)
    return g
  }
  private plant(parent: T.Object3D) {
    this.cyl(parent, 0, 0.27, 0, 0.27, 0.2, 0.5, this.mat('#f0eee6'))
    this.cyl(parent, 0, 0.52, 0, 0.24, 0.24, 0.035, this.mat('#665543'))
    const stem = this.mat('#5b704d'),
      leaf = this.mat('#54826a')
    this.cyl(parent, 0, 0.95, 0, 0.026, 0.025, 0.9, stem, 7)
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4,
        geo = new T.SphereGeometry(1, 7, 5)
      this.geometries.add(geo)
      const l = new T.Mesh(geo, leaf)
      l.scale.set(0.16, 0.4, 0.07)
      l.position.set(Math.cos(angle) * 0.24, 0.9 + (i % 3) * 0.2, Math.sin(angle) * 0.24)
      l.rotation.set(Math.cos(angle) * 0.6, angle, Math.sin(angle) * 0.7)
      l.castShadow = true
      parent.add(l)
    }
  }
  private chair(parent: T.Object3D, x: number, z: number) {
    const g = new T.Group()
    g.position.set(x, 0, z)
    parent.add(g)
    const m = this.mat('#3e4245')
    this.box(g, 0, 0.53, 0, 0.68, 0.12, 0.65, m)
    this.box(g, 0, 0.9, 0.28, 0.65, 0.72, 0.1, m)
    this.cyl(g, 0, 0.28, 0, 0.05, 0.06, 0.5, this.mat('#43484d'))
    for (let i = 0; i < 5; i++) {
      const b = this.box(g, 0, 0.07, 0, 0.6, 0.05, 0.07, this.mat('#43484d'))
      b.rotation.y = (i * Math.PI) / 2.5
    }
  }
  private furniture(o: Furniture) {
    const g = new T.Group()
    g.position.set(o.x, 0, o.z)
    g.rotation.y = o.rotation
    this.room.add(g)
    g.userData.objectId = o.id
    const oak = this.mat('#ffffff', { map: this.wood }),
      charcoal = this.mat('#4d5258')
    if (o.type === 'desk') {
      const ceo = this.getWorkspace().roles.find((r) => r.id === o.roleId)?.kind === 'ceo',
        w = ceo ? 3.2 : 2.5
      g.userData.roleId = o.roleId
      this.box(g, 0, 0.92, 0, w, 0.12, 1.25, oak)
      for (const x of [-w / 2 + 0.18, w / 2 - 0.18])
        for (const z of [-0.48, 0.48]) this.cyl(g, x, 0.45, z, 0.085, 0.065, 0.9, oak)
      if (ceo) {
        this.box(g, -w / 2 + 0.44, 0.53, -0.03, 0.54, 0.73, 0.76, oak)
        for (const y of [0.32, 0.57, 0.79]) this.box(g, -w / 2 + 0.44, y, 0.365, 0.16, 0.025, 0.024, charcoal)
      }
      const laptop = new T.Group()
      laptop.position.set(0, 0.997, 0.1)
      g.add(laptop)
      this.box(laptop, 0, 0, 0, 0.91, 0.037, 0.58, charcoal)
      this.box(laptop, 0, 0.023, 0.07, 0.76, 0.008, 0.25, this.mat('#23262a'))
      this.box(laptop, 0, 0.024, 0.22, 0.27, 0.007, 0.11, this.mat('#64696a'))
      const lid = new T.Group()
      lid.position.set(0, 0.024, -0.29)
      lid.rotation.x = -0.18
      laptop.add(lid)
      const monitor = this.box(lid, 0, 0.29, 0, 0.93, 0.58, 0.035, this.mat('#30363b'))
      const screenGeo = new T.PlaneGeometry(0.83, 0.47)
      this.geometries.add(screenGeo)
      const role = this.getWorkspace().roles.find((r) => r.id === o.roleId)
      const sm = new T.MeshBasicMaterial({
        map: this.canvasTexture(role?.title ?? 'Bekerja', 'RN GROUP / workspace', true),
      })
      this.materials.add(sm)
      const screen = new T.Mesh(screenGeo, sm)
      screen.position.set(0, 0.29, 0.02)
      lid.add(screen)
      this.box(g, -0.8, 1.006, 0.3, 0.25, 0.045, 0.37, this.mat('#9aa9a5'))
      this.cup(g, 0.93, 0.99, -0.04)
      this.chair(g, 0, 1.2)
      this.cyl(g, -1, 1.12, -0.4, 0.018, 0.018, 0.28, charcoal)
      this.cyl(g, -1, 1.29, -0.4, 0.14, 0.1, 0.14, this.mat('#e6e3d9'))
      monitor.userData.roleId = o.roleId
    } else if (o.type === 'plant') this.plant(g)
    else if (o.type === 'sofa') {
      const upholstery = this.mat(o.room === 'ceo' ? '#8d9996' : '#aaa9a3')
      this.box(g, 0, 0.38, 0, 3.2, 0.64, 1.1, upholstery)
      this.box(g, 0, 0.91, -0.5, 3.2, 0.72, 0.22, upholstery)
      this.box(g, -1.47, 0.7, 0, 0.28, 0.62, 1.2, upholstery)
      this.box(g, 1.47, 0.7, 0, 0.28, 0.62, 1.2, upholstery)
      for (const x of [-0.9, 0, 0.9]) this.box(g, x, 0.73, 0.04, 0.87, 0.15, 0.82, this.mat('#bbbcb3'))
      this.box(g, -1, 1, -0.24, 0.48, 0.46, 0.18, this.mat('#718c83'))
      this.box(g, 1, 1, -0.24, 0.48, 0.46, 0.18, this.mat('#dac7a9'))
    } else if (o.type === 'coffee') {
      this.box(g, 0, 0.51, 0, 2.4, 1, 0.85, oak)
      this.box(g, 0, 1.03, 0, 2.5, 0.08, 0.94, this.mat('#e8e7e1'))
      this.box(g, -0.57, 1.35, 0, 0.6, 0.56, 0.48, charcoal)
      this.box(g, -0.57, 1.37, 0.25, 0.31, 0.2, 0.04, this.mat('#20282c'))
      this.cup(g, -0.57, 1.08, 0.21)
      this.cup(g, 0.7, 1.08, 0.1)
      this.cyl(g, 0.22, 1.26, -0.07, 0.1, 0.1, 0.32, this.mat('#c1ac8d'))
    } else if (o.type === 'shelf') {
      this.box(g, 0, 1.16, 0, 0.65, 2.3, 2, charcoal)
      for (let n = 0; n < 3; n++) {
        this.box(g, 0.35, 0.55 + n * 0.62, 0, 0.06, 0.06, 1.85, oak)
        for (let k = 0; k < 6; k++)
          this.box(
            g,
            0.36,
            0.76 + n * 0.62,
            -0.75 + k * 0.25,
            0.3,
            0.4,
            0.17,
            this.mat(['#8d9b8b', '#c2ae8b', '#ad8070', '#667b7b'][k % 4]),
          )
      }
    } else {
      this.box(g, 0, 0.8, 0, 0.1, 1.6, 0.1, charcoal)
      const a = this.box(g, 0, 1.5, 0, 1.1, 0.8, 0.06, oak)
      a.rotation.y = 0.3
    }
  }
  rebuild() {
    this.room.clear()
    for (const g of this.geometries) g.dispose()
    this.geometries.clear()
    for (const m of this.materials) m.dispose()
    this.materials.clear()
    for (const t of this.textures) t.dispose()
    this.textures.clear()
    this.wood = surfaceTexture('wood')
    const stone = surfaceTexture('stone')
    this.textures.add(this.wood)
    this.textures.add(stone)
    const floor = this.mat('#ffffff', { map: stone, roughness: 0.96 })
    this.box(this.room, 0, -0.14, 0, 20.2, 0.24, 14.2, this.mat('#dedbd3'))
    this.box(this.room, 0, -0.01, 0, 20, 0.08, 14, floor)
    const wall = this.mat('#e0dfd8')
    this.box(this.room, 0, 1.25, -7, 20.1, 2.6, 0.18, wall)
    this.box(this.room, -10, 0.74, 0, 0.18, 1.6, 14, wall)
    const frame = this.mat('#303638'),
      glass = this.mat('#d7e5e1', { transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.12 })
    for (const [z, d] of [
      [-5.45, 2.9],
      [-1.25, 1.5],
    ]) {
      this.box(this.room, -2.8, 1.2, z, 0.07, 2.4, d, glass)
      this.box(this.room, -2.8, 2.4, z, 0.1, 0.08, d, frame)
      for (const edge of [-d / 2, d / 2]) this.box(this.room, -2.8, 1.2, z + edge, 0.09, 2.4, 0.08, frame)
    }
    this.box(this.room, -2.8, 2.4, -3, 0.1, 0.08, 1.8, frame)
    this.box(this.room, -6.4, 0.52, -0.5, 7.2, 1.03, 0.09, glass)
    this.box(this.room, -6.4, 1.06, -0.5, 7.2, 0.06, 0.1, frame)
    this.box(this.room, -6.5, 1.3, -6.87, 5.8, 2.6, 0.07, this.mat('#9d988e'))
    for (let x = -9.1; x < -3.5; x += 0.18)
      this.box(this.room, x, 1.3, -6.81, 0.045, 2.5, 0.04, this.mat('#ffffff', { map: this.wood }))
    const logoGeo = new T.PlaneGeometry(3.8, 1.9)
    this.geometries.add(logoGeo)
    const logoMat = new T.MeshBasicMaterial({
      map: this.canvasTexture(this.getWorkspace().settings.company, 'Rapi. Jelas. Siap dipakai.'),
    })
    this.materials.add(logoMat)
    const sign = new T.Mesh(logoGeo, logoMat)
    sign.position.set(-6.3, 1.66, -6.75)
    this.room.add(sign)
    this.box(this.room, -6.5, 0.05, 2.55, 5.2, 0.03, 3.4, this.mat('#e6e3db'))
    this.box(this.room, -7.65, 0.05, -1.9, 3.7, 0.03, 1.9, this.mat('#d7dcd4'))
    this.cyl(this.room, -6.5, 0.5, 4, 0.65, 0.65, 0.08, this.mat('#e9e5da'))
    this.cyl(this.room, -6.5, 0.25, 4, 0.17, 0.22, 0.5, this.mat('#797d7b'))
    this.cup(this.room, -6.5, 0.55, 4)
    this.box(this.room, -6.7, 0.56, 4.2, 0.3, 0.04, 0.4, this.mat('#798d84'))
    // Wall art and daylight windows decorate the cutaway without covering workstations.
    for (const x of [2.9, 7]) {
      this.box(this.room, x, 1.7, -6.85, 2.6, 1.4, 0.06, frame)
      this.box(
        this.room,
        x,
        1.7,
        -6.8,
        2.4,
        1.25,
        0.07,
        this.mat('#c6d8d9', { emissive: '#9daeb4', emissiveIntensity: 0.18 }),
      )
      this.box(this.room, x, 1.7, -6.72, 0.06, 1.25, 0.04, this.mat('#f6f5ef'))
    }
    this.box(this.room, -0.8, 1.56, -6.8, 1.6, 1.15, 0.1, this.mat('#a1b5aa'))
    for (let i = 0; i < 4; i++)
      this.box(
        this.room,
        -1.3 + i * 0.31,
        1.55,
        -6.72,
        0.21,
        0.4 + 0.17 * Math.sin(i),
        0.02,
        this.mat('#e5e6da'),
      )
    for (const o of this.getWorkspace().objects) this.furniture(o)
  }
  private addPerson(r: Role) {
    const rig = createChibi(r),
      group = new T.Group()
    group.userData.roleId = r.id
    group.add(rig.model)
    this.scene.add(group)
    const mixer = new T.AnimationMixer(rig.model),
      actions = new Map<string, T.AnimationAction>()
    for (const clip of rig.clips) actions.set(clip.name, mixer.clipAction(clip))
    const person: Person = {
      group,
      model: rig.model,
      mixer,
      actions,
      bones: rig.bones,
      cup: rig.cup,
      book: rig.book,
      dispose: rig.dispose,
      current: '',
      previous: { ...r.home },
    }
    this.people.set(r.id, person)
    this.setAction(person, 'Idle_Neutral')
  }
  private setAction(p: Person, name: string) {
    if (p.current === name) return
    p.actions.get(p.current)?.fadeOut(0.25)
    p.actions.get(name)?.reset().fadeIn(0.25).play()
    p.current = name
  }
  private aim(bone: T.Bone | undefined, child: T.Bone | undefined, target: T.Vector3) {
    if (!bone || !child) return
    const origin = bone.getWorldPosition(new T.Vector3()),
      current = child.getWorldPosition(new T.Vector3()).sub(origin).normalize(),
      desired = target.clone().sub(origin).normalize()
    const rotation = new T.Quaternion().setFromUnitVectors(current, desired),
      world = bone.getWorldQuaternion(new T.Quaternion())
    world.premultiply(rotation)
    const parent = bone.parent!.getWorldQuaternion(new T.Quaternion()).invert()
    bone.quaternion.copy(parent.multiply(world))
    bone.updateWorldMatrix(false, true)
  }
  private pose(p: Person, state: ActivityState, reduced: boolean, atDesk = false) {
    const sit = atDesk || state === 'working' || state === 'resting' || state === 'reading'
    p.model.position.y = sit ? (atDesk || state === 'working' ? -0.17 : -0.03) : 0
    p.group.updateWorldMatrix(true, true)
    const forward = new T.Vector3(0, 0, 1).applyQuaternion(p.group.quaternion)
    if (sit)
      for (const side of ['L', 'R']) {
        const upper = p.bones.get(`UpperLeg.${side}`),
          lower = p.bones.get(`LowerLeg.${side}`),
          foot = p.bones.get(`Foot.${side}`)
        if (upper && lower) {
          const hip = upper.getWorldPosition(new T.Vector3()),
            knee = hip.clone().addScaledVector(forward, 0.33)
          knee.y -= 0.03
          this.aim(upper, lower, knee)
          const ankle = knee.clone()
          ankle.y -= 0.33
          this.aim(lower, foot, ankle)
        }
      }
    if (state === 'working' || state === 'reading' || state === 'coffee')
      for (const side of ['L', 'R']) {
        const upper = p.bones.get(`UpperArm.${side}`),
          lower = p.bones.get(`LowerArm.${side}`),
          hand = p.bones.get(`Wrist.${side}`)
        if (!upper || !lower || !hand) continue
        const shoulder = upper.getWorldPosition(new T.Vector3()),
          elbow = shoulder.clone().addScaledVector(forward, 0.14)
        elbow.y -= 0.14
        this.aim(upper, lower, elbow)
        const wrist = elbow.clone().addScaledVector(forward, 0.22)
        wrist.y +=
          state === 'coffee' && side === 'R'
            ? 0.22
            : 0.16 + (reduced ? 0 : Math.sin(this.clock * 7 + (side === 'R' ? 2 : 0)) * 0.015)
        this.aim(lower, hand, wrist)
      }
    p.cup.visible = state === 'coffee'
    p.book.visible = state === 'reading'
    if (p.cup.visible) {
      const hand = p.bones.get('Wrist.R')
      if (hand) {
        const pos = hand.getWorldPosition(new T.Vector3())
        p.model.worldToLocal(pos)
        p.cup.position.copy(pos)
      }
    }
    if (p.book.visible) p.book.position.set(0, 0.95, 0.36)
  }
  private animate = () => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.animate)
    const now = performance.now()
    if (now - this.last < 32) return
    const dt = Math.min((now - this.last) / 1000, 0.06)
    this.last = now
    if (document.hidden || document.querySelector('[role="dialog"]')) return
    const w = this.getWorkspace(),
      reduced =
        w.settings.reducedMotion ||
        !w.settings.animation ||
        matchMedia('(prefers-reduced-motion: reduce)').matches
    this.clock += dt
    this.routines.step(dt, new Date(), reduced)
    const signature = JSON.stringify(w.roles.map((r) => [r.id, r.active, r.model, r.skin, r.shirt, r.hair]))
    if (signature !== this.signature) {
      for (const [id, p] of this.people) {
        this.scene.remove(p.group)
        p.mixer.stopAllAction()
        p.mixer.uncacheRoot(p.model)
        p.dispose()
        this.people.delete(id)
      }
      this.signature = signature
    }
    for (const r of w.roles.filter((r) => r.active)) if (!this.people.has(r.id)) this.addPerson(r)
    const ceo = w.roles.find((r) => r.kind === 'ceo')!,
      runtime = this.routines.characters.get(ceo.id)
    if (runtime && this.keys.size) {
      const move = {
        x:
          (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
          (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0),
        z:
          (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
          (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0),
      }
      if (move.x || move.z)
        this.routines.moveCEO({
          x: runtime.position.x + move.x * 0.45,
          z: runtime.position.z + move.z * 0.45,
        })
    }
    const labels: SceneLabel[] = []
    for (const [id, c] of this.routines.characters) {
      const p = this.people.get(id)
      if (p) {
        const dx = c.position.x - p.previous.x,
          dz = c.position.z - p.previous.z
        if (Math.hypot(dx, dz) > 0.001) {
          const angle = Math.atan2(dx, dz)
          p.group.rotation.y +=
            T.MathUtils.euclideanModulo(angle - p.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI
        } else if (
          ['working', 'idle', 'off'].includes(c.state) &&
          distance(c.position, w.roles.find((r) => r.id === id)!.home) < 0.2
        )
          p.group.rotation.y =
            (w.objects.find((o) => o.type === 'desk' && o.roleId === id)?.rotation ?? 0) + Math.PI
        else if (['resting', 'reading'].includes(c.state)) p.group.rotation.y = 0
        else if (c.state === 'coffee') p.group.rotation.y = 0
        const lounge = ['resting', 'reading'].includes(c.state),
          atHome = distance(c.position, w.roles.find((r) => r.id === id)!.home) < 0.2
        p.previous = { ...c.position }
        p.group.position.set(c.position.x, 0, c.position.z - (lounge ? 0.8 : 0))
        const action =
          c.state === 'walking'
            ? 'Walk'
            : w.settings.social &&
                c.state === 'idle' &&
                !atHome &&
                Math.sin(this.clock * 0.13 + id.length) > 0.99
              ? 'Wave'
              : 'Idle_Neutral'
        this.setAction(p, action)
        p.mixer.update(reduced ? 0 : dt)
        this.pose(p, c.state, reduced, atHome && ['working', 'idle', 'off'].includes(c.state))
      }
      const pos = new T.Vector3(
          c.position.x,
          ['working', 'idle', 'off'].includes(c.state) &&
            distance(c.position, w.roles.find((r) => r.id === id)!.home) < 0.2
            ? 2.05
            : 2.3,
          c.position.z,
        ).project(this.camera),
        bounds = this.el.getBoundingClientRect()
      labels.push({
        id,
        x: ((pos.x + 1) / 2) * bounds.width,
        y: ((-pos.y + 1) / 2) * bounds.height,
        visible: Math.abs(pos.x) < 0.98 && Math.abs(pos.y) < 0.95,
        state: c.state,
      })
    }
    if (Math.floor(this.clock * 12) !== Math.floor((this.clock - dt) * 12)) this.onLabels(labels)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
  private resize() {
    const { width, height } = this.el.getBoundingClientRect()
    if (!height || !width) return
    const size = 11.2,
      aspect = width / height
    this.camera.left = -size * aspect
    this.camera.right = size * aspect
    this.camera.top = size
    this.camera.bottom = -size
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.fit()
  }
  private fit() {
    const { width, height } = this.el.getBoundingClientRect()
    this.camera.zoom = Math.min(1, width / height / 1.25)
    this.camera.updateProjectionMatrix()
  }
  private pointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY }
  }
  private pointerUp = (e: PointerEvent) => {
    if (e.button !== 0 || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return
    const b = this.el.getBoundingClientRect()
    this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, (-(e.clientY - b.top) / b.height) * 2 + 1)
    this.ray.setFromCamera(this.pointer, this.camera)
    const floor = this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3())
    if (floor && this.onFloor?.({ x: floor.x, z: floor.z })) return
    for (const hit of this.ray.intersectObjects(
      [...this.room.children, ...[...this.people.values()].map((p) => p.group)],
      true,
    )) {
      let o: T.Object3D | null = hit.object
      while (o) {
        if (o.userData.roleId) {
          this.onSelect(o.userData.roleId)
          return
        }
        o = o.parent
      }
      if (hit.object instanceof T.Mesh && (hit.object.material as T.MeshStandardMaterial).transparent)
        continue
      break
    }
    if (floor && !this.routines.moveCEO({ x: floor.x, z: floor.z }))
      this.onMessage('Pilih lantai kosong. Furnitur dan partisi tidak dapat dilewati.')
  }
  private contextMenu = (e: Event) => e.preventDefault()
  private keyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest('input,textarea,select,dialog,[role=dialog]')) return
    if (
      ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())
    ) {
      e.preventDefault()
      this.keys.add(e.key.toLowerCase())
    }
  }
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
  private clearKeys = () => this.keys.clear()
  reset() {
    this.controls.reset()
    this.fit()
  }
  zoom(amount: number) {
    this.camera.zoom = T.MathUtils.clamp(this.camera.zoom + amount, 0.25, 2.2)
    this.camera.updateProjectionMatrix()
  }
  rotate(amount: number) {
    const offset = this.camera.position.clone().sub(this.controls.target)
    offset.applyAxisAngle(new T.Vector3(0, 1, 0), amount)
    this.camera.position.copy(this.controls.target).add(offset)
    this.controls.update()
  }
  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.controls.dispose()
    this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.pointerUp)
    this.renderer.domElement.removeEventListener('contextmenu', this.contextMenu)
    window.removeEventListener('keydown', this.keyDown)
    window.removeEventListener('keyup', this.keyUp)
    window.removeEventListener('blur', this.clearKeys)
    for (const p of this.people.values()) {
      p.mixer.stopAllAction()
      p.mixer.uncacheRoot(p.model)
      p.dispose()
    }
    for (const g of this.geometries) g.dispose()
    for (const m of this.materials) m.dispose()
    for (const t of this.textures) t.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
