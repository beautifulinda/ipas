import * as THREE from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { TownLevel } from '~/utils/progression'
import { mat, mesh } from '~/utils/scene/models'

// 城鎮建築：依熟練度從工地、帳篷、房子升級到城堡（作者 2026-10-22 定案，預覽見 CLAUDE.md）
// 每棟建築由上百個小零件組成，蓋好後把不會動的零件依材質合併，一棟只剩十幾次繪製，手機才跑得動。
// 會動的零件（旗子、火焰、串燈、晾的衣服、吊鉤、光環）保留獨立，由 userData.tick 每格畫面更新

export type BuildingTick = (time: number, dt: number, motion: boolean) => void

const GOLD = mat('#ffcf3a', { emissive: '#ffb000', emissiveIntensity: 0.35 })
const WINDOW = new THREE.MeshBasicMaterial({ color: '#ffd47a' })
const FLAME = new THREE.MeshBasicMaterial({ color: '#ff9a2f' })
const FLAME_CORE = new THREE.MeshBasicMaterial({ color: '#ffe066' })

function at<T extends THREE.Object3D>(object: T, x: number, y: number, z: number) {
  object.position.set(x, y, z)
  return object
}
function basic(geometry: THREE.BufferGeometry, material: THREE.Material) {
  return new THREE.Mesh(geometry, material)
}
function rock(radius: number, color = '#a8a29a') {
  return mesh(new THREE.DodecahedronGeometry(radius, 0), mat(color))
}
// 燕尾三角小旗
function pennant(color: string, scale = 1) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(3.2, -0.7)
  shape.lineTo(2.2, -1.1)
  shape.lineTo(3.2, -1.6)
  shape.lineTo(0, -2.2)
  const flag = basic(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }))
  flag.scale.setScalar(scale)
  return flag
}
// 會飄的旗面：分段的平面，依時間位移頂點
function wavingFlag(width: number, height: number, color: string) {
  const geometry = new THREE.PlaneGeometry(width, height, 10, 3)
  geometry.translate(width / 2, 0, 0)
  const base = (geometry.getAttribute('position').array as Float32Array).slice()
  const flag = basic(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true }))
  flag.castShadow = true
  const wave = (time: number, on: boolean) => {
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const x = base[i * 3]
      position.setZ(i, on ? Math.sin(x * 0.9 - time * 5) * 0.35 * x : 0)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
  }
  return { flag, wave }
}
// 凸多邊形：四坡屋頂（底部長方形、頂端一條屋脊）與上窄下寬的裙頂
function hipRoof(hx: number, hz: number, h: number, ridge: number, material: THREE.Material) {
  const points = [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-ridge, h, 0], [ridge, h, 0]]
  return mesh(new ConvexGeometry(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), material)
}
function frustum(hx: number, hz: number, tx: number, tz: number, h: number, material: THREE.Material) {
  const points = [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-tx, h, -tz], [tx, h, -tz], [tx, h, tz], [-tx, h, tz]]
  return mesh(new ConvexGeometry(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), material)
}

// 把建築裡不會動的網格依材質合併；keep 裡的物件（含子孫）維持獨立
function bake(group: THREE.Group, keep: THREE.Object3D[]) {
  group.updateMatrixWorld(true)
  const inverse = group.matrixWorld.clone().invert()
  const kept = new Set<THREE.Object3D>()
  for (const object of keep) object.traverse((o) => kept.add(o))
  const buckets = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; shadow: boolean }>()
  const removed: THREE.Mesh[] = []
  group.traverse((object) => {
    const m = object as THREE.Mesh
    if (!m.isMesh || kept.has(m) || Array.isArray(m.material)) return
    // 統一成無索引、只留位置與法線，不同形狀的幾何才能合併
    let geometry = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
    for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld))
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    const bucket = buckets.get(m.material) ?? { geometries: [], shadow: false }
    bucket.geometries.push(geometry)
    bucket.shadow ||= m.castShadow
    buckets.set(m.material, bucket)
    removed.push(m)
  })
  for (const m of removed) {
    m.removeFromParent()
    m.geometry.dispose()
  }
  // 拿掉零件後只剩空殼的群組也一併移除
  const empties: THREE.Object3D[] = []
  group.traverse((o) => o !== group && !kept.has(o) && o.type === 'Group' && o.children.length === 0 && empties.push(o))
  for (const o of empties) o.removeFromParent()
  for (const [material, { geometries, shadow }] of buckets) {
    const merged = mesh(mergeGeometries(geometries)!, material)
    merged.castShadow = shadow
    group.add(merged)
    for (const g of geometries) g.dispose()
  }
  return group
}

function finish(group: THREE.Group, keep: THREE.Object3D[], tick?: BuildingTick) {
  bake(group, keep)
  if (tick) group.userData.tick = tick
  return group
}

// 工地：打好的地基與半面牆、鷹架、黃色吊車（吊鉤擺動）、藍圖告示牌、木材與石堆、三角錐。
// 比其他建築大一些（1.5 倍），還沒練習的地方在地圖上才看得到
function makeSite() {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(8, 8.4, 0.6, 8), mat('#b98a5a'), 0.3))
  group.add(mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.3, 8), mat('#a3794d'), 0.7))
  group.add(at(mesh(new THREE.BoxGeometry(7, 0.8, 5.5), mat('#cfc6b8')), 0, 0.9, -0.5))
  group.add(at(mesh(new THREE.BoxGeometry(7, 2.6, 0.7), mat('#e2dccf')), 0, 2.6, -2.9))
  group.add(at(mesh(new THREE.BoxGeometry(0.7, 1.6, 4), mat('#e2dccf')), -3.2, 2.1, -1))
  const wood = mat('#9a6a3e')
  for (const [x, z] of [[-4.2, -3.8], [4.2, -3.8], [-4.2, 1.8], [4.2, 1.8]]) group.add(at(mesh(new THREE.BoxGeometry(0.35, 7, 0.35), wood), x, 3.8, z))
  for (const y of [3.4, 6.6]) {
    group.add(at(mesh(new THREE.BoxGeometry(8.8, 0.3, 0.3), wood), 0, y, -3.8))
    group.add(at(mesh(new THREE.BoxGeometry(0.3, 0.3, 5.9), wood), 4.2, y, -1))
  }
  group.add(at(mesh(new THREE.BoxGeometry(8.8, 0.25, 1.4), mat('#c9955e')), 0, 6.8, -3.1))
  // 吊車
  const crane = at(new THREE.Group(), -6, 0, -4.5)
  crane.add(at(mesh(new THREE.BoxGeometry(0.6, 13, 0.6), mat('#ffb21f')), 0, 6.5, 0))
  crane.add(at(mesh(new THREE.BoxGeometry(10, 0.5, 0.5), mat('#ffb21f')), 3.5, 13, 0))
  crane.add(at(mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), mat('#2b2633')), -1.8, 12.4, 0))
  const hook = at(new THREE.Group(), 7.5, 12.8, 0)
  hook.add(at(basic(new THREE.CylinderGeometry(0.05, 0.05, 6, 3), mat('#2b2633')), 0, -3, 0))
  hook.add(at(mesh(new THREE.BoxGeometry(1.8, 0.9, 1.2), mat('#c9955e')), 0, -6.3, 0))
  crane.add(hook)
  group.add(crane)
  // 告示牌：黃底加藍圖
  group.add(at(mesh(new THREE.BoxGeometry(0.6, 5.5, 0.6), mat('#8a5a34')), 5.2, 2.75, 4.6))
  group.add(at(mesh(new THREE.BoxGeometry(5.2, 3.4, 0.5), mat('#ffd23f')), 5.2, 5.3, 4.6))
  group.add(at(mesh(new THREE.BoxGeometry(3.8, 2.2, 0.2), mat('#3d63c9')), 5.2, 5.3, 4.92))
  for (const [x, y, w, h] of [[4.4, 5.8, 1.6, 0.18], [5.6, 4.9, 1.6, 0.18], [4.5, 4.8, 0.18, 1.2]]) {
    group.add(at(basic(new THREE.BoxGeometry(w, h, 0.1), WINDOW), x, y, 5.05))
  }
  // 三角錐（白色反光帶）
  for (const [x, z] of [[-3.5, 5.6], [0, 6.4], [2.3, 6.2]]) {
    group.add(at(mesh(new THREE.ConeGeometry(1.2, 2.8, 6), mat('#ff7a2f')), x, 1.4, z))
    group.add(at(mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.45, 6), mat('#ffffff')), x, 1.5, z))
  }
  // 木材與石堆
  for (let i = 0; i < 3; i++) {
    group.add(at(mesh(new THREE.BoxGeometry(4.2, 0.6, 0.8), mat(i % 2 ? '#c9955e' : '#b5804a')), 6.6 - 0.2 * i, 0.9 + i * 0.6, -1 + (i % 2) * 0.3))
  }
  for (const [x, z, r] of [[-6.4, 2.6, 1], [-5.4, 3.6, 0.8], [-6.8, 3.9, 0.7], [-5.9, 2.9, 0.6]]) group.add(at(rock(r), x, 0.9 + r * 0.4, z))
  group.scale.setScalar(1.5)
  return finish(group, [hook], (time, _dt, motion) => {
    hook.rotation.z = motion ? Math.sin(time * 1.4) * 0.12 : 0
    hook.rotation.x = motion ? Math.sin(time * 1.1) * 0.06 : 0
  })
}

// 帳篷：豪華露營鐘型帳（米白帆布、短圓牆加圓錐屋頂、前門捲起透出暖光、側面紗窗、屋頂通風窗），
// 營繩與地釘、圓形木平台、暖色串燈、營火、圓木椅、提燈
function makeTent() {
  const group = new THREE.Group()
  const canvas = mat('#efe3c8')
  const inside = new THREE.MeshBasicMaterial({ color: '#d39a52', side: THREE.DoubleSide })
  const screen = mat('#3b3a3a')
  const WALL_R = 6.6
  const WALL_H = 3.2
  const ROOF_R = 7.4
  const ROOF_H = 7
  // 12 邊形的面到中心距離 ÷ 半徑
  const FACE = Math.cos(Math.PI / 12)
  const top = 0.6 + WALL_H

  group.add(mesh(new THREE.CylinderGeometry(9.6, 9.8, 0.6, 12), mat('#c99a64'), 0.3))
  for (const r of [4.5, 7.2]) {
    const seam = at(basic(new THREE.TorusGeometry(r, 0.06, 3, 24), mat('#9a6a3e')), 0, 0.62, 0)
    seam.rotation.x = Math.PI / 2
    group.add(seam)
  }
  // 旋轉半格，讓正面是平的一面
  const wall = mesh(new THREE.CylinderGeometry(WALL_R, WALL_R, WALL_H, 12), canvas, 0.6 + WALL_H / 2)
  wall.rotation.y = Math.PI / 12
  group.add(wall)
  const roof = mesh(new THREE.ConeGeometry(ROOF_R, ROOF_H, 12), mat('#e6d6b4'), top + ROOF_H / 2)
  roof.rotation.y = Math.PI / 12
  group.add(roof)
  const eave = mesh(new THREE.CylinderGeometry(ROOF_R + 0.05, ROOF_R + 0.05, 0.35, 12), mat('#d8c59c'), top + 0.1)
  eave.rotation.y = Math.PI / 12
  group.add(eave)

  // 前門：牆面的長方形開口＋屋頂上的三角形開口
  const slope = Math.atan2(ROOF_R * FACE, ROOF_H)
  group.add(at(basic(new THREE.BoxGeometry(3.6, WALL_H, 0.1), inside), 0, 0.6 + WALL_H / 2, WALL_R * FACE + 0.02))
  const doorShape = new THREE.Shape()
  doorShape.moveTo(-1.8, 0)
  doorShape.lineTo(1.8, 0)
  doorShape.lineTo(0, 5.2)
  doorShape.lineTo(-1.8, 0)
  const doorTop = at(basic(new THREE.ShapeGeometry(doorShape), inside), 0, top, ROOF_R * FACE + 0.06)
  doorTop.rotation.x = -slope
  group.add(doorTop)
  for (const side of [-1, 1]) {
    group.add(at(mesh(new THREE.CylinderGeometry(0.38, 0.38, WALL_H + 0.6, 6), mat('#e9dbbb')), side * 2.15, 0.6 + (WALL_H + 0.6) / 2, WALL_R * FACE + 0.3))
    group.add(at(mesh(new THREE.BoxGeometry(0.8, 0.15, 0.85), mat('#8a5a34')), side * 2.15, 0.6 + WALL_H * 0.6, WALL_R * FACE + 0.3))
  }
  group.add(at(mesh(new THREE.BoxGeometry(3.4, 0.08, 1.6), mat('#c0583f')), 0, 0.66, WALL_R * FACE - 0.6))

  // 側面紗窗與捲起的窗簾
  for (const a of [Math.PI / 3, -Math.PI / 3, (2 * Math.PI) / 3, (-2 * Math.PI) / 3]) {
    const r = WALL_R * FACE + 0.04
    const win = at(mesh(new THREE.BoxGeometry(2, 1.2, 0.08), screen), Math.sin(a) * r, 0.6 + WALL_H * 0.5, Math.cos(a) * r)
    win.rotation.y = a
    group.add(win)
    const roll = at(mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 6), mat('#e9dbbb')), Math.sin(a) * (r + 0.15), 0.6 + WALL_H * 0.5 + 0.85, Math.cos(a) * (r + 0.15))
    roll.rotation.set(0, a, Math.PI / 2, 'YXZ')
    group.add(roll)
  }
  // 屋頂通風窗
  const ventA = Math.PI / 3
  const ventR = ROOF_R * FACE * (1 - 4 / ROOF_H) + 0.08
  const vent = at(mesh(new THREE.BoxGeometry(1.3, 0.8, 0.1), screen), Math.sin(ventA) * ventR, top + 4, Math.cos(ventA) * ventR)
  vent.rotation.set(0, ventA, 0, 'YXZ')
  vent.rotateX(-slope)
  group.add(vent)

  // 頂端：中柱、金球、三角小旗
  group.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 5), mat('#5a4a3a'), top + ROOF_H + 0.6))
  group.add(mesh(new THREE.SphereGeometry(0.45, 8, 6), GOLD, top + ROOF_H + 1.7))
  const flag = at(pennant('#ffd23f', 0.75), 0, top + ROOF_H + 1.5, 0)
  group.add(flag)

  // 營繩與地釘（門前不拉繩）
  const ropePoints: number[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    if (Math.abs(Math.sin(a)) < 0.4 && Math.cos(a) > 0) continue
    ropePoints.push(Math.sin(a) * (ROOF_R - 0.2), top + 0.15, Math.cos(a) * (ROOF_R - 0.2), Math.sin(a) * 11.5, 0.15, Math.cos(a) * 11.5)
    group.add(at(mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), mat('#7a5a3a')), Math.sin(a) * 11.5, 0.2, Math.cos(a) * 11.5))
  }
  const ropeGeometry = new THREE.BufferGeometry()
  ropeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ropePoints, 3))
  const ropes = new THREE.LineSegments(ropeGeometry, new THREE.LineBasicMaterial({ color: '#8a7a62' }))
  group.add(ropes)

  // 暖色串燈：從屋簷拉到左前方的木柱
  const from = new THREE.Vector3(Math.sin(-Math.PI / 4) * ROOF_R, top + 0.2, Math.cos(-Math.PI / 4) * ROOF_R)
  const to = new THREE.Vector3(-9.5, 5.5, 8.5)
  group.add(at(mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.6, 5), mat('#7a5a3a')), to.x, 2.8, to.z))
  const wire: THREE.Vector3[] = []
  const bulbs: THREE.Mesh[] = []
  const bulbColors = ['#ffd47a', '#ffb36b', '#fff1b8'].map((color) => new THREE.MeshBasicMaterial({ color }))
  for (let i = 0; i <= 10; i++) {
    const k = i / 10
    const p = from.clone().lerp(to, k)
    p.y -= Math.sin(k * Math.PI) * 1.2
    wire.push(p)
    if (i > 0 && i < 10) {
      const bulb = at(basic(new THREE.SphereGeometry(0.28, 6, 4), bulbColors[i % 3]), p.x, p.y - 0.25, p.z)
      bulb.userData.phase = i
      bulbs.push(bulb)
      group.add(bulb)
    }
  }
  const wireLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: '#4a3a2a' }))
  group.add(wireLine)

  // 營火
  const fire = at(new THREE.Group(), 7.2, 0.4, 7.4)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    fire.add(at(rock(0.55, '#8e8a84'), Math.cos(a) * 1.6, 0.3, Math.sin(a) * 1.6))
  }
  for (const r of [0.5, -0.5]) {
    const log = mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.8, 5), mat('#7a4a28'), 0.5)
    log.rotation.set(Math.PI / 2, r, 0)
    fire.add(log)
  }
  const flame = at(basic(new THREE.ConeGeometry(0.9, 2.6, 5), FLAME), 0, 1.9, 0)
  const core = at(basic(new THREE.ConeGeometry(0.5, 1.6, 5), FLAME_CORE), 0, 1.6, 0)
  fire.add(flame, core)
  group.add(fire)
  const seat = at(mesh(new THREE.CylinderGeometry(0.55, 0.55, 3, 6), mat('#9a6a3e')), 7.2, 0.7, 10.4)
  seat.rotation.z = Math.PI / 2
  group.add(seat)
  group.add(at(mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), mat('#5a4a3a')), 3.4, 2.4, 8.4))
  group.add(at(basic(new THREE.BoxGeometry(0.8, 1, 0.8), WINDOW), 3.4, 4.5, 8.4))

  return finish(group, [flag, flame, core, ropes, wireLine, ...bulbs], (time, _dt, motion) => {
    const f = motion ? 1 + Math.sin(time * 13) * 0.12 + Math.sin(time * 7.3) * 0.08 : 1
    flame.scale.set(1, f, 1)
    core.scale.set(1, 2 - f, 1)
    flag.rotation.y = motion ? Math.sin(time * 2.2) * 0.5 : 0
    for (const bulb of bulbs) bulb.scale.setScalar(motion ? 1 + Math.sin(time * 3 + bulb.userData.phase) * 0.18 : 1)
  })
}

// 房子：日式兩層透天。一樓較寬、二樓較窄，深藍灰四坡屋頂、奶油色牆；二樓欄杆陽台晾著衣服、藍色玻璃拉窗，
// 木門加氣窗、門燈、落水管；右側半場籃球場（籃框裝在側牆）；門前石砌門柱與藍信箱、黃色矮牆、綠籬。
// 參考圖是《蠟筆小新》野原家，作者決定改得比較不像（拿掉車棚、木格柵、紅屋頂與紅磚）
function makeHouse() {
  const group = new THREE.Group()
  const wall = mat('#f6efe0')
  const roofMat = mat('#4f6f8f')
  const eaveMat = mat('#3b556f')
  const glass = mat('#a9d8ee', { emissive: '#5aa9d6', emissiveIntensity: 0.25 })
  const frame = mat('#ffffff')
  const stone = mat('#b9b4aa')
  const GF = { w: 12, d: 10.3, h: 4.8, y: 0.6 }
  const F2 = { w: 8, d: 6.6, h: 4.4, y: GF.y + GF.h }
  const front = GF.d / 2

  group.add(mesh(new THREE.BoxGeometry(GF.w + 0.6, 0.6, GF.d + 0.6), mat('#9a9aa4'), 0.3))
  group.add(mesh(new THREE.BoxGeometry(GF.w, GF.h, GF.d), wall, GF.y + GF.h / 2))
  group.add(mesh(new THREE.BoxGeometry(F2.w, F2.h, F2.d), wall, F2.y + F2.h / 2))
  group.add(at(mesh(new THREE.BoxGeometry(0.05, F2.h, F2.d), mat('#e6dcc6')), F2.w / 2 + 0.03, F2.y + F2.h / 2, 0))

  // 一樓屋簷（四坡裙頂）與二樓四坡屋頂
  group.add(at(frustum(GF.w / 2 + 0.9, GF.d / 2 + 0.9, F2.w / 2 + 0.15, F2.d / 2 + 0.15, 1.7, roofMat), 0, F2.y - 0.55, 0))
  group.add(at(mesh(new THREE.BoxGeometry(GF.w + 1.8, 0.25, GF.d + 1.8), eaveMat), 0, F2.y - 0.65, 0))
  group.add(at(hipRoof(F2.w / 2 + 0.8, F2.d / 2 + 0.8, 3.4, 0.8, roofMat), 0, F2.y + F2.h + 0.15, 0))
  group.add(at(mesh(new THREE.BoxGeometry(F2.w + 1.6, 0.3, F2.d + 1.6), eaveMat), 0, F2.y + F2.h + 0.05, 0))

  // 二樓陽台：白色底座與整排欄杆，晾著三件衣服
  const bx = -0.6
  const bz = F2.d / 2 + 0.95
  group.add(at(mesh(new THREE.BoxGeometry(5.6, 1.2, 1.9), frame), bx, F2.y + 0.6, bz))
  for (const side of [-1, 1]) group.add(at(mesh(new THREE.BoxGeometry(0.25, 1.3, 1.9), frame), bx + side * 2.68, F2.y + 1.85, bz))
  group.add(at(mesh(new THREE.BoxGeometry(5.4, 0.18, 0.18), frame), bx, F2.y + 2.45, bz + 0.85))
  for (let i = 0; i < 10; i++) group.add(at(mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), frame), bx - 2.45 + i * 0.545, F2.y + 1.85, bz + 0.85))
  const laundry: THREE.Group[] = []
  for (const [x, color] of [[bx + 0.3, '#ff9ab0'], [bx + 1.3, '#7fc4ff'], [bx + 2.1, '#ffe27a']] as const) {
    const cloth = at(new THREE.Group(), x, F2.y + 2.5, bz + 0.95)
    cloth.add(at(mesh(new THREE.BoxGeometry(0.75, 1, 0.08), mat(color)), 0, -0.5, 0))
    cloth.userData.phase = x
    laundry.push(cloth)
    group.add(cloth)
  }
  // 二樓窗戶
  group.add(at(mesh(new THREE.BoxGeometry(3.2, 2.2, 0.12), glass), bx + 0.7, F2.y + 2, F2.d / 2 + 0.03))
  group.add(at(mesh(new THREE.BoxGeometry(0.12, 2.2, 0.16), frame), bx + 0.7, F2.y + 2, F2.d / 2 + 0.06))
  group.add(at(mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), mat('#e3e5ee')), bx - 1.6, F2.y + 2, F2.d / 2 + 0.1))
  group.add(at(mesh(new THREE.BoxGeometry(1, 1.8, 0.12), glass), 2.8, F2.y + 2.4, F2.d / 2 + 0.03))
  for (const z of [-1.6, 1.4]) group.add(at(mesh(new THREE.BoxGeometry(0.12, 1.8, 1.3), glass), F2.w / 2 + 0.03, F2.y + 2.3, z))

  // 一樓：大窗與鐵捲門盒、木門加氣窗、門把、門燈、門前踏階、落水管
  group.add(at(mesh(new THREE.BoxGeometry(3.6, 2, 0.12), glass), -3.4, GF.y + 2.2, front + 0.03))
  group.add(at(mesh(new THREE.BoxGeometry(0.12, 2, 0.16), frame), -3.4, GF.y + 2.2, front + 0.06))
  group.add(at(mesh(new THREE.BoxGeometry(1.3, 1.8, 0.3), mat('#e3e5ee')), -5.25, GF.y + 2.1, front + 0.1))
  group.add(at(mesh(new THREE.BoxGeometry(1.8, 3.2, 0.2), mat('#d49a5a')), 1.2, GF.y + 1.6, front + 0.06))
  group.add(at(mesh(new THREE.BoxGeometry(1.8, 0.6, 0.12), glass), 1.2, GF.y + 3.6, front + 0.04))
  group.add(at(mesh(new THREE.SphereGeometry(0.16, 6, 4), GOLD), 1.85, GF.y + 1.6, front + 0.2))
  group.add(at(basic(new THREE.BoxGeometry(0.35, 0.5, 0.3), WINDOW), -0.1, GF.y + 2.8, front + 0.18))
  group.add(at(mesh(new THREE.BoxGeometry(1.4, 0.35, 1.4), mat('#b8b8c0')), 1.2, 0.75, front + 0.8))
  for (const [x, z, h, y] of [[GF.w / 2 + 0.1, front + 0.1, GF.h, GF.y + GF.h / 2], [F2.w / 2 + 0.1, F2.d / 2 + 0.1, F2.h, F2.y + F2.h / 2]]) {
    group.add(at(mesh(new THREE.CylinderGeometry(0.13, 0.13, h, 5), eaveMat), x, y, z))
  }

  // 右側半場籃球場：水泥地與罰球線，籃框裝在側牆上，地上一顆球
  group.add(at(mesh(new THREE.BoxGeometry(5.4, 0.12, 8.6), mat('#c9c6c0')), GF.w / 2 + 3.1, 0.06, 0.4))
  for (const z of [-1, 1]) group.add(at(mesh(new THREE.BoxGeometry(2.6, 0.02, 0.12), mat('#ffffff')), GF.w / 2 + 1.6, 0.14, 0.4 + z * 1.2))
  group.add(at(mesh(new THREE.BoxGeometry(0.12, 0.02, 2.5), mat('#ffffff')), GF.w / 2 + 2.9, 0.14, 0.4))
  group.add(at(mesh(new THREE.BoxGeometry(0.6, 0.3, 0.3), mat('#5a5a62')), GF.w / 2 + 0.3, GF.y + 3.6, 0.4))
  group.add(at(mesh(new THREE.BoxGeometry(0.15, 2, 3), mat('#ffffff')), GF.w / 2 + 0.65, GF.y + 3.9, 0.4))
  group.add(at(mesh(new THREE.BoxGeometry(0.06, 0.9, 1.2), mat('#e2564a')), GF.w / 2 + 0.75, GF.y + 3.6, 0.4))
  const rim = at(mesh(new THREE.TorusGeometry(0.7, 0.09, 4, 12), mat('#ff7a2f')), GF.w / 2 + 1.5, GF.y + 3.1, 0.4)
  rim.rotation.x = Math.PI / 2
  group.add(rim)
  const net = at(
    basic(new THREE.CylinderGeometry(0.7, 0.45, 0.9, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, wireframe: true })),
    GF.w / 2 + 1.5,
    GF.y + 2.6,
    0.4,
  )
  group.add(net)
  group.add(at(mesh(new THREE.IcosahedronGeometry(0.5, 1), mat('#e8772e')), GF.w / 2 + 3.6, 0.62, 2.4))

  // 門前：綠籬、黃色矮牆、石砌門柱與藍信箱、木門扇
  const fz = front + 2.6
  for (let x = -6.4; x <= -3.4; x += 1.3) group.add(at(mesh(new THREE.IcosahedronGeometry(1.1, 0), mat(x < -5 ? '#4fae4a' : '#5cbf55')), x, 1, fz))
  group.add(at(mesh(new THREE.BoxGeometry(1.8, 1.6, 0.8), mat('#e8d27a')), -2, 0.8, fz))
  for (const x of [-0.6, 3]) {
    group.add(at(mesh(new THREE.BoxGeometry(1.1, 2.4, 1.1), stone), x, 1.2, fz))
    for (const y of [0.6, 1.2, 1.8]) group.add(at(mesh(new THREE.BoxGeometry(1.14, 0.06, 1.14), mat('#9d988f')), x, y, fz))
  }
  group.add(at(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.5), mat('#3d6fb0')), -0.6, 2.7, fz))
  group.add(at(mesh(new THREE.BoxGeometry(1.4, 1.6, 0.15), mat('#b98a4a')), 0.4, 0.8, fz))
  for (let x = 4.2; x <= 6.8; x += 1.3) group.add(at(mesh(new THREE.IcosahedronGeometry(1, 0), mat(x > 5 ? '#4fae4a' : '#5cbf55')), x, 0.9, fz))
  group.add(at(mesh(new THREE.IcosahedronGeometry(1.8, 0), mat('#5cbf55')), -7.6, 1.6, 3))
  group.add(at(mesh(new THREE.IcosahedronGeometry(1.4, 0), mat('#4fae4a')), -7.4, 1.4, -2))

  return finish(group, [net, ...laundry], (time, _dt, motion) => {
    for (const cloth of laundry) cloth.rotation.x = motion ? -0.15 - Math.abs(Math.sin(time * 2.4 + cloth.userData.phase)) * 0.35 : 0
  })
}

// 城堡：石砌基座、主樓、四座塔（城垛、藍色尖頂、金邊、金球、燕尾小旗）、中央高塔與飄動的大旗、
// 拱門與閘門、發光窗戶、地面緩慢旋轉的金色光環與上升的金粉
function crenelRing(radius: number, y: number, count: number, size: number) {
  const group = new THREE.Group()
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    group.add(at(mesh(new THREE.BoxGeometry(size, size * 1.1, size), mat('#e8e2d6')), Math.cos(a) * radius, y, Math.sin(a) * radius))
  }
  return group
}
function crenelSquare(half: number, y: number, size: number) {
  const group = new THREE.Group()
  for (let p = -half; p <= half + 0.01; p += size * 2) {
    for (const [x, z] of [[p, -half], [p, half], [-half, p], [half, p]]) {
      group.add(at(mesh(new THREE.BoxGeometry(size, size * 1.1, size), mat('#e8e2d6')), x, y, z))
    }
  }
  return group
}
function makeCastle() {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(13, 14.5, 1.6, 8), mat('#b7aea0'), 0.8))
  group.add(mesh(new THREE.CylinderGeometry(11.5, 12.5, 1.4, 8), mat('#cfc6b8'), 2.3))
  // 基座以上的部分抬高 3
  const body = at(new THREE.Group(), 0, 3, 0)
  group.add(body)
  body.add(mesh(new THREE.BoxGeometry(12, 11, 12), mat('#efe9dc'), 5.5))
  const corners = [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]
  for (const [x, z] of corners) {
    body.add(at(mesh(new THREE.CylinderGeometry(2.8, 3.1, 15, 8), mat('#e2dccf')), x, 7.5, z))
    body.add(at(mesh(new THREE.CylinderGeometry(3.4, 3.4, 1, 8), mat('#cfc8ba')), x, 15.5, z))
    body.add(at(mesh(new THREE.ConeGeometry(3.6, 6.5, 8), mat('#3d63c9')), x, 19.2, z))
    const ring = crenelRing(3.2, 16.4, 8, 1)
    ring.position.set(x, 0, z)
    body.add(ring)
  }
  body.add(at(mesh(new THREE.BoxGeometry(4, 4.5, 0.6), mat('#5a3b22')), 0, 2.25, 6.1))
  const arch = at(mesh(new THREE.CylinderGeometry(2, 2, 0.6, 10, 1, false, 0, Math.PI), mat('#5a3b22')), 0, 4.5, 6.1)
  arch.rotation.set(Math.PI / 2, 0, Math.PI / 2)
  body.add(arch)
  for (const x of [-1.2, 0, 1.2]) body.add(at(mesh(new THREE.BoxGeometry(0.25, 5.6, 0.2), mat('#3a2716')), x, 3, 6.45))
  body.add(crenelSquare(5.4, 11.6, 1.2))

  // 中央高塔與大旗
  body.add(mesh(new THREE.CylinderGeometry(3.4, 3.8, 14, 8), mat('#f4efe4'), 16))
  body.add(mesh(new THREE.CylinderGeometry(4.2, 4.2, 1.2, 8), mat('#cfc8ba'), 23.4))
  body.add(crenelRing(4, 24.6, 10, 1.1))
  body.add(mesh(new THREE.ConeGeometry(4.4, 9, 8), mat('#2f4fb0'), 28.5))
  body.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 5), mat('#5a4a3a'), 35.5))
  const bigFlag = wavingFlag(6, 3.6, '#e84a4a')
  body.add(at(bigFlag.flag, 0.2, 37, 0))

  // 金色裝飾
  const pennants: THREE.Mesh[] = []
  corners.forEach(([x, z], i) => {
    body.add(at(mesh(new THREE.SphereGeometry(0.9, 8, 6), GOLD), x, 23, z))
    const trim = at(mesh(new THREE.TorusGeometry(3.5, 0.28, 4, 16), GOLD), x, 16.1, z)
    trim.rotation.x = Math.PI / 2
    body.add(trim)
    body.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 4), mat('#5a4a3a')), x, 24.8, z))
    const p = at(pennant('#ffcf3a'), x, 26.2, z)
    p.userData.phase = i * 1.7
    pennants.push(p)
    body.add(p)
  })
  body.add(at(mesh(new THREE.SphereGeometry(1.2, 8, 6), GOLD), 0, 33.6, 0))
  const keepTrim = at(mesh(new THREE.TorusGeometry(4.3, 0.3, 4, 16), GOLD), 0, 24.1, 0)
  keepTrim.rotation.x = Math.PI / 2
  body.add(keepTrim)
  body.add(at(mesh(new THREE.BoxGeometry(3, 1.2, 0.3), GOLD), 0, 8.2, 6.2))

  // 發光窗戶
  for (const x of [-3.2, 3.2]) body.add(at(basic(new THREE.BoxGeometry(1.4, 2, 0.2), WINDOW), x, 7.5, 6.05))
  for (const z of [-3, 3]) {
    body.add(at(basic(new THREE.BoxGeometry(0.2, 2, 1.4), WINDOW), 6.05, 7.5, z))
    body.add(at(basic(new THREE.BoxGeometry(0.2, 2, 1.4), WINDOW), -6.05, 7.5, z))
  }
  for (const [x, z] of corners) {
    const out = new THREE.Vector3(x, 0, z).normalize()
    const w = at(basic(new THREE.BoxGeometry(1, 1.6, 0.2), WINDOW), x + out.x * 2.95, 11, z + out.z * 2.95)
    w.lookAt(x + out.x * 10, 11, z + out.z * 10)
    body.add(w)
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const w = at(basic(new THREE.BoxGeometry(1, 1.8, 0.2), WINDOW), Math.cos(a) * 3.6, 19, Math.sin(a) * 3.6)
    w.lookAt(Math.cos(a) * 10, 19, Math.sin(a) * 10)
    body.add(w)
  }

  // 等級光環與金粉
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  const ring = at(basic(new THREE.RingGeometry(15.5, 17, 40, 1, 0, Math.PI * 1.7), ringMaterial), 0, 1.2, 0)
  ring.rotation.x = -Math.PI / 2
  const ring2 = at(basic(new THREE.RingGeometry(18, 18.6, 40, 1, 0, Math.PI * 1.2), ringMaterial), 0, 1.1, 0)
  ring2.rotation.x = -Math.PI / 2
  group.add(ring, ring2)
  const DUST = 40
  const dustPositions = new Float32Array(DUST * 3)
  for (let i = 0; i < DUST; i++) {
    const a = (i / DUST) * Math.PI * 2 * 7
    const r = 10 + ((i * 37) % 80) / 10
    dustPositions.set([Math.cos(a) * r, ((i * 53) % 300) / 10, Math.sin(a) * r], i * 3)
  }
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#ffe27a', size: 0.9, transparent: true, opacity: 0.85, depthWrite: false }))
  group.add(dust)

  return finish(group, [bigFlag.flag, ...pennants, ring, ring2, dust], (time, dt, motion) => {
    bigFlag.wave(time, motion)
    for (const p of pennants) p.rotation.y = motion ? Math.sin(time * 2 + p.userData.phase) * 0.5 : 0
    if (!motion) return
    ring.rotation.z += dt * 0.35
    ring2.rotation.z -= dt * 0.22
    ringMaterial.opacity = 0.45 + Math.sin(time * 2) * 0.15
    const position = dustGeometry.getAttribute('position')
    for (let i = 0; i < DUST; i++) position.setY(i, (position.getY(i) + dt * 3) % 32)
    position.needsUpdate = true
  })
}

const BUILDERS: Record<TownLevel, () => THREE.Group> = { 0: makeSite, 1: makeTent, 2: makeHouse, 3: makeCastle }

export function makeBuilding(level: TownLevel) {
  return BUILDERS[level]()
}
