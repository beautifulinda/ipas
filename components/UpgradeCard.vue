<script setup lang="ts">
import { TOWN_LEVEL_NAMES, upgradeCardTitle, type TownLevel } from '~/utils/progression'

// 升級為帳篷、房子時，畫面上方跳出的升級卡：等級圖示、標題、恭喜訊息，以及標出目前位置的升級路線
const props = defineProps<{ kind: 'tent' | 'house'; text: string }>()
const ICONS = { tent: '⛺', house: '🏠' }
const current: TownLevel = props.kind === 'tent' ? 1 : 2
const steps = ([0, 1, 2, 3] as TownLevel[]).map((level) => ({ level, name: TOWN_LEVEL_NAMES[level] }))
</script>

<template>
  <div class="card" :class="kind" role="status">
    <span class="icon" aria-hidden="true">{{ ICONS[kind] }}</span>
    <strong class="title">{{ upgradeCardTitle(kind) }}</strong>
    <span class="sub">{{ text }}</span>
    <!-- 升級路線只給眼睛看；報讀軟體只唸標題與恭喜訊息，不唸「工地 帳篷 房子 城堡」 -->
    <ol class="track" aria-hidden="true">
      <li v-for="step in steps" :key="step.level" :class="{ done: step.level < current, now: step.level === current }">
        {{ step.name }}
      </li>
    </ol>
    <span v-for="n in 4" :key="n" class="sparkle" :class="`s${n}`" aria-hidden="true">✦</span>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 2px 14px;
  min-width: min(20rem, 88vw);
  padding: 12px 18px 12px 12px;
  border: 3px solid #2b2633;
  border-radius: 18px;
  background: #fffdf4;
  color: #2b2633;
  box-shadow:
    0 5px 0 rgba(43, 38, 51, 0.35),
    0 0 0 6px rgba(255, 233, 168, 0.8);
  animation: card-in 0.7s cubic-bezier(0.16, 1.7, 0.3, 1) both;
}

.icon {
  grid-row: span 3;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 3px solid #2b2633;
  border-radius: 14px;
  background: radial-gradient(circle at 35% 30%, #fff6d4, #ffd23f 70%);
  font-size: 1.9rem;
  animation: wiggle 0.6s ease-in-out 0.5s 2;
}

.house .icon {
  background: radial-gradient(circle at 35% 30%, #e3ecf7, #7fa6d6 70%);
}

.title {
  font-size: 1.15rem;
  font-weight: 900;
  line-height: 1.3;
}

.sub {
  color: #6b4a1f;
  font-size: 0.85rem;
  font-weight: 700;
}

.track {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: #6b6474;
  font-size: 0.72rem;
  font-weight: 700;
}

.track li + li::before {
  display: inline-block;
  width: 12px;
  height: 4px;
  margin-right: 4px;
  border-radius: 2px;
  background: #d8d0c0;
  vertical-align: middle;
  content: '';
}

.track li.done {
  color: #2b2633;
}

.track li.now {
  padding: 0 6px;
  border-radius: 999px;
  background: #2b2633;
  color: #fff;
}

.sparkle {
  position: absolute;
  color: #ffb800;
  font-size: 1.1rem;
  animation: twinkle 1s ease-out both;
}

.s1 { top: -10px; left: -8px; animation-delay: 0.3s; }
.s2 { top: -14px; right: -6px; animation-delay: 0.45s; }
.s3 { right: -10px; bottom: -8px; animation-delay: 0.6s; }
.s4 { bottom: -12px; left: -6px; animation-delay: 0.75s; }

@keyframes card-in {
  0% { transform: translateY(-30px) scale(0.5); opacity: 0; }
  55% { opacity: 1; }
}

@keyframes wiggle {
  25% { transform: rotate(-10deg) scale(1.1); }
  75% { transform: rotate(10deg) scale(1.1); }
}

@keyframes twinkle {
  0% { transform: scale(0); opacity: 0; }
  40% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(0.6) translateY(-12px); opacity: 0; }
}

/* 減少動態效果：卡片照常出現，只是不動 */
@media (prefers-reduced-motion: reduce) {
  .card,
  .icon {
    animation: none;
  }

  .sparkle {
    display: none;
  }
}
</style>
