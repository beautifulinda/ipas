import * as THREE from 'three'
import type { Theme3D } from '~/utils/scene/palette'

// 低多邊形模型：原點在底部中央，y 軸朝上。全部用平面著色（flatShading）做出面感

const materials = new Map<string, THREE.MeshLambertMaterial>()
export function mat(color: string, options: THREE.MeshLambertMaterialParameters = {}) {
  const key = `${color}:${JSON.stringify(options)}`
  let material = materials.get(key)
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, flatShading: true, ...options })
    materials.set(key, material)
  }
  return material
}

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, y = 0) {
  const m = new THREE.Mesh(geometry, material)
  m.position.y = y
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// 讓錐體、球體的頂點稍微隨機偏移，看起來比較自然
function jitter(geometry: THREE.BufferGeometry, amount: number, random: () => number, keepTop = true) {
  const position = geometry.getAttribute('position')
  const box = new THREE.Box3().setFromBufferAttribute(position as THREE.BufferAttribute)
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    if (keepTop && y >= box.max.y - 0.01) continue
    if (y <= box.min.y + 0.01) continue
    position.setX(i, position.getX(i) + (random() - 0.5) * amount)
    position.setZ(i, position.getZ(i) + (random() - 0.5) * amount)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function makeTree(theme: Theme3D, random: () => number) {
  const group = new THREE.Group()
  const scale = 0.85 + random() * 0.35
  group.add(mesh(new THREE.CylinderGeometry(0.9, 1.2, 5, 5), mat('#8a5a34'), 2.5))
  group.add(mesh(jitter(new THREE.IcosahedronGeometry(5, 0), 1.2, random, false), mat(theme.crown), 8.5))
  group.add(mesh(new THREE.IcosahedronGeometry(2.6, 0), mat(theme.crownLight), 11.2))
  group.scale.setScalar(scale)
  group.rotation.y = random() * Math.PI
  return group
}

export function makePine(theme: Theme3D, random: () => number) {
  const group = new THREE.Group()
  const scale = 0.85 + random() * 0.35
  group.add(mesh(new THREE.CylinderGeometry(0.8, 1, 4, 5), mat('#7a4f2e'), 2))
  group.add(mesh(new THREE.ConeGeometry(5, 9, 6), mat(theme.pine), 7.5))
  group.add(mesh(new THREE.ConeGeometry(3.8, 7, 6), mat(theme.pine), 12))
  group.scale.setScalar(scale)
  group.rotation.y = random() * Math.PI
  return group
}

// 卡通化的大山：刻意比例誇張，山頂有積雪
export function makeMountain(theme: Theme3D, random: () => number) {
  const group = new THREE.Group()
  const height = 52 + random() * 18
  const radius = height * 0.48
  group.add(mesh(jitter(new THREE.ConeGeometry(radius, height, 7, 2), radius * 0.18, random), mat(theme.mountain), height / 2))
  const capHeight = height * 0.32
  group.add(mesh(new THREE.ConeGeometry(radius * 0.34, capHeight, 7), mat('#ffffff'), height - capHeight / 2 + 0.3))
  group.rotation.y = random() * Math.PI
  return group
}

export function makeHill(theme: Theme3D, random: () => number) {
  const radius = 16 + random() * 8
  const geometry = jitter(new THREE.SphereGeometry(radius, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), radius * 0.12, random)
  const hill = mesh(geometry, mat(theme.hill))
  hill.scale.y = 0.75
  return hill
}

// 地區完成時插上的旗子；布面會隨風擺動（名稱 cloth）
export function makeFlag() {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(0.5, 0.6, 26, 6), mat('#5a4a3a'), 13))
  const cloth = new THREE.Group()
  cloth.name = 'cloth'
  cloth.position.y = 22
  const fabric = mesh(new THREE.BoxGeometry(10, 6.5, 0.3), mat('#ff5a5a'))
  fabric.position.x = 5
  cloth.add(fabric)
  group.add(cloth)
  group.add(mesh(new THREE.SphereGeometry(1, 6, 4), mat('#ffd23f'), 26.3))
  return group
}

// 燈塔：島上所有地區都插旗後亮起，光束會旋轉
export function makeLighthouse() {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(6, 7, 4, 8), mat('#b9b2a6'), 2))
  for (let i = 0; i < 4; i++) {
    const r0 = 4.6 - i * 0.35
    const r1 = 4.6 - (i + 1) * 0.35
    group.add(mesh(new THREE.CylinderGeometry(r1, r0, 6, 8), mat(i % 2 ? '#ffffff' : '#e2564a'), 7 + i * 6))
  }
  const lamp = mesh(new THREE.CylinderGeometry(3.2, 3.2, 4.5, 8), mat('#7d8a99'), 30)
  lamp.name = 'lamp'
  group.add(lamp)
  group.add(mesh(new THREE.ConeGeometry(4.2, 4.5, 8), mat('#e2564a'), 34.5))

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(12, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff3a8', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
  )
  beam.rotation.z = Math.PI / 2
  beam.position.x = 30
  const beamPivot = new THREE.Group()
  beamPivot.name = 'beam'
  beamPivot.position.y = 30
  beamPivot.add(beam)
  beamPivot.visible = false
  group.add(beamPivot)

  const light = new THREE.PointLight('#ffe9a0', 0, 160, 1.5)
  light.name = 'light'
  light.position.y = 30
  group.add(light)
  return group
}

export function setLighthouseLit(lighthouse: THREE.Object3D, lit: boolean) {
  const lamp = lighthouse.getObjectByName('lamp') as THREE.Mesh
  lamp.material = lit ? mat('#fff1a0', { emissive: '#ffd23f', emissiveIntensity: 1 }) : mat('#7d8a99')
  lighthouse.getObjectByName('beam')!.visible = lit
  ;(lighthouse.getObjectByName('light') as THREE.PointLight).intensity = lit ? 3 : 0
}

// 雲霧：幾顆半透明的低多邊形雲團
export function makeCloud(random: () => number) {
  // 扁平、半透明，看得出底下的地形與工地；不寫入深度，後面的建築不會被雲整個遮掉
  const group = new THREE.Group()
  const material = new THREE.MeshLambertMaterial({
    color: '#ffffff',
    flatShading: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  })
  const count = 2 + Math.floor(random() * 2)
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + random() * 3, 1), material)
    puff.position.set((random() - 0.5) * 14, random() * 2, (random() - 0.5) * 8)
    puff.scale.y = 0.45
    group.add(puff)
  }
  return group
}

// 選到的城鎮上方上下跳動的箭頭
export function makeMarker() {
  const marker = mesh(new THREE.ConeGeometry(3, 6, 4), mat('#ffd23f', { emissive: '#ffb800', emissiveIntensity: 0.4 }))
  marker.rotation.x = Math.PI
  return marker
}

// 升級演出的特效：每格畫面呼叫 update，回傳 false 代表結束，可以移除
export interface Effect {
  object: THREE.Object3D
  update: (dt: number) => boolean
  dispose: () => void
}

// 粒子爆發：往四面八方噴出，受重力落下並淡出；drag 是空氣阻力，數字越大停得越快
function burst(
  origin: THREE.Vector3,
  random: () => number,
  options: { count: number; colors: string[]; speed: number; life: number; size: number; drag: number },
): Effect {
  const { count, speed, life, size, drag } = options
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const velocities: THREE.Vector3[] = []
  const palette = options.colors.map((c) => new THREE.Color(c))
  for (let i = 0; i < count; i++) {
    positions.set([origin.x, origin.y, origin.z], i * 3)
    const color = palette[Math.floor(random() * palette.length)]
    colors.set([color.r, color.g, color.b], i * 3)
    const direction = new THREE.Vector3(random() - 0.5, random() * 0.9 + 0.3, random() - 0.5).normalize()
    velocities.push(direction.multiplyScalar(speed * (0.5 + random() * 0.5)))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false })
  let age = 0
  return {
    object: new THREE.Points(geometry, material),
    update(dt) {
      age += dt
      const attr = geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < count; i++) {
        velocities[i].y -= 40 * dt
        velocities[i].multiplyScalar(1 - Math.min(1, dt * drag))
        attr.setXYZ(i, attr.getX(i) + velocities[i].x * dt, attr.getY(i) + velocities[i].y * dt, attr.getZ(i) + velocities[i].z * dt)
      }
      attr.needsUpdate = true
      material.opacity = Math.max(0, 1 - age / life)
      return age < life
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

// 煙火：一發 220 顆粒子
export function makeFireworks(origin: THREE.Vector3, random: () => number) {
  return burst(origin, random, { count: 220, colors: ['#ffd23f', '#fff4c2', '#ff5a5a', '#4f8cff', '#ff9af0'], speed: 70, life: 2.4, size: 3.2, drag: 0.6 })
}

// 金色星星：慢慢往上飄、閃一下就消失
export function makeStarBurst(origin: THREE.Vector3, random: () => number, count: number) {
  return burst(origin, random, { count, colors: ['#ffd23f', '#fff4c2', '#ffe066'], speed: 28, life: 1.6, size: 2.6, drag: 2.4 })
}

// 衝天光柱：從建築中心往上長，再淡出縮小
export function makeLightPillar(base: THREE.Vector3): Effect {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffe066',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const coreMaterial = material.clone()
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 120, 16, 1, true), material)
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 120, 12, 1, true), coreMaterial)
  outer.position.y = core.position.y = 60
  const group = new THREE.Group()
  group.position.copy(base)
  group.add(outer, core)
  let age = 0
  const life = 1.8
  return {
    object: group,
    update(dt) {
      age += dt
      const k = age / life
      group.scale.set(1 - k * 0.5, Math.min(1, age / 0.35), 1 - k * 0.5)
      material.opacity = (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 0.5
      coreMaterial.opacity = Math.min(1, material.opacity * 1.6)
      return age < life
    },
    dispose() {
      outer.geometry.dispose()
      core.geometry.dispose()
      material.dispose()
      coreMaterial.dispose()
    },
  }
}

// 揚起的塵土：建築換代時，地面一圈往外擴散的白色小煙團
export function makeDustRing(center: THREE.Vector3, radius: number): Effect {
  const material = new THREE.MeshLambertMaterial({ color: '#f4eee2', transparent: true, opacity: 0.9, flatShading: true, depthWrite: false })
  const geometry = new THREE.IcosahedronGeometry(1.4, 0)
  const group = new THREE.Group()
  group.position.copy(center)
  const puffs = Array.from({ length: 14 }, (_, i) => {
    const puff = new THREE.Mesh(geometry, material)
    const a = (i / 14) * Math.PI * 2
    puff.userData.direction = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    group.add(puff)
    return puff
  })
  let age = 0
  const life = 0.9
  return {
    object: group,
    update(dt) {
      age += dt
      const k = Math.min(1, age / life)
      for (const puff of puffs) {
        puff.position.copy(puff.userData.direction).multiplyScalar(radius * (0.6 + k * 0.8))
        puff.position.y = 0.8 + k * 1.5
        puff.scale.setScalar(0.6 + k * 1.2)
      }
      material.opacity = 0.9 * (1 - k)
      return age < life
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
