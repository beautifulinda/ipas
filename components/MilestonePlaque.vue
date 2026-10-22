<script setup lang="ts">
// 城堡、插旗、燈塔的里程碑匾額：皇冠徽章、旋轉的光芒、金色匾額與緞帶，點一下就關閉
defineProps<{ text: string; ribbon: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <button type="button" class="plaque" @click="emit('close')">
    <span class="rays" aria-hidden="true" />
    <svg class="crown" viewBox="0 0 74 58" aria-hidden="true">
      <path d="M6 50 L2 14 L20 30 L37 4 L54 30 L72 14 L68 50 Z" fill="#ffcf3a" stroke="#6b4a1f" stroke-width="4" stroke-linejoin="round" />
      <rect x="6" y="44" width="62" height="10" rx="3" fill="#f2b630" stroke="#6b4a1f" stroke-width="4" />
      <circle cx="37" cy="30" r="5" fill="#e84a4a" stroke="#6b4a1f" stroke-width="3" />
      <circle cx="2" cy="14" r="4" fill="#fff4c2" stroke="#6b4a1f" stroke-width="3" />
      <circle cx="37" cy="4" r="4" fill="#fff4c2" stroke="#6b4a1f" stroke-width="3" />
      <circle cx="72" cy="14" r="4" fill="#fff4c2" stroke="#6b4a1f" stroke-width="3" />
    </svg>
    <span class="medal">
      <span class="label">里程碑達成</span>
      <span class="text">{{ text }}</span>
      <span class="stars" aria-hidden="true">★ ★ ★</span>
    </span>
    <span class="ribbon">{{ ribbon }}</span>
  </button>
</template>

<style scoped>
.plaque {
  position: relative;
  display: grid;
  justify-items: center;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
  animation: plaque-in 0.9s cubic-bezier(0.16, 1.6, 0.3, 1) both;
}

.rays {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 340px;
  height: 340px;
  margin: -190px 0 0 -170px;
  background: repeating-conic-gradient(from 0deg, rgba(255, 226, 120, 0.55) 0deg 9deg, rgba(255, 226, 120, 0) 9deg 22deg);
  -webkit-mask: radial-gradient(circle, #000 25%, transparent 68%);
  mask: radial-gradient(circle, #000 25%, transparent 68%);
  pointer-events: none;
  animation: spin 9s linear infinite;
}

.crown {
  position: relative;
  z-index: 2;
  width: 74px;
  height: 58px;
  margin-bottom: -16px;
  filter: drop-shadow(0 4px 0 rgba(61, 42, 12, 0.45));
  animation: bob 1.4s ease-in-out 0.9s infinite;
}

.medal {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 2px;
  justify-items: center;
  min-width: min(19rem, 82vw);
  padding: 1.4rem 1.8rem 1.1rem;
  border: 4px solid #6b4a1f;
  border-radius: 18px;
  background:
    linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.75) 48%, transparent 60%) -200% 0 / 250% 100% no-repeat,
    linear-gradient(#fff1b8, #f7cf5c 45%, #e3a72f);
  box-shadow:
    inset 0 0 0 3px #fff6d4,
    inset 0 -6px 0 rgba(150, 95, 20, 0.35),
    0 10px 0 rgba(43, 38, 51, 0.45),
    0 0 40px rgba(255, 210, 63, 0.75);
  color: #3d2a0c;
  text-align: center;
  animation: shine 1.6s ease-out 0.6s both;
}

.label {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.35em;
}

.text {
  font-size: 1.25rem;
  font-weight: 900;
  text-wrap: balance;
}

.stars {
  color: #b8741a;
  font-size: 0.9rem;
  letter-spacing: 0.3em;
}

.ribbon {
  position: relative;
  margin-top: 4px;
  padding: 6px 30px 8px;
  background: #d94848;
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.2);
  clip-path: polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.plaque:focus-visible .medal {
  outline: 3px solid #2b2633;
  outline-offset: 4px;
}

@keyframes plaque-in {
  0% { transform: scale(0.2) rotate(-8deg); opacity: 0; }
  60% { opacity: 1; }
}

@keyframes shine {
  to { background-position: 200% 0, 0 0; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes bob {
  50% { transform: translateY(-5px); }
}

/* 減少動態效果：匾額照常出現，只是不動 */
@media (prefers-reduced-motion: reduce) {
  .plaque,
  .rays,
  .crown,
  .medal {
    animation: none;
  }
}
</style>
