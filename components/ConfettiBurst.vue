<script setup lang="ts">
// 彩帶：從畫面兩側噴出、受重力落下的紙片，畫在一張全螢幕的 2D canvas 上；沒有彩帶時不重畫
const canvasEl = ref<HTMLCanvasElement>()
const COLORS = ['#ffd23f', '#ff5a5a', '#4f8cff', '#7fdc5a', '#ff9af0', '#fff4c2']
const LIFE = 200

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  size: number
  color: string
  age: number
}
let pieces: Piece[] = []
let frame = 0

function burst(count: number) {
  const canvas = canvasEl.value
  if (!canvas) return
  const ratio = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * ratio
  canvas.height = window.innerHeight * ratio
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0
    pieces.push({
      x: left ? 0 : canvas.width,
      y: canvas.height * 0.75,
      vx: (left ? 1 : -1) * (6 + Math.random() * 12) * ratio,
      vy: -(14 + Math.random() * 14) * ratio,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      size: (6 + Math.random() * 6) * ratio,
      color: COLORS[i % COLORS.length],
      age: 0,
    })
  }
  if (!frame) frame = requestAnimationFrame(draw)
}

function draw() {
  const canvas = canvasEl.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const ratio = window.devicePixelRatio || 1
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const p of pieces) {
    p.vy += 0.45 * ratio
    p.vx *= 0.985
    p.x += p.vx
    p.y += p.vy
    p.angle += p.spin
    p.age += 1
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    ctx.globalAlpha = Math.max(0, 1 - p.age / LIFE)
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.age * 0.15)) + 1)
    ctx.restore()
  }
  pieces = pieces.filter((p) => p.age < LIFE && p.y < canvas.height + 40)
  frame = pieces.length ? requestAnimationFrame(draw) : 0
  if (!frame) ctx.clearRect(0, 0, canvas.width, canvas.height)
}

onBeforeUnmount(() => cancelAnimationFrame(frame))
defineExpose({ burst })
</script>

<template>
  <canvas ref="canvasEl" class="confetti" aria-hidden="true" />
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  z-index: 65;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
