// 梯次入口的轉場（GSAP）：由首頁 <Transition> 的 enter／leave 呼叫，直接拿入口的 DOM 元素
// 減少動態效果時不播，直接切換
import gsap from 'gsap'

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 從地圖回到入口：整頁淡入，梯次由上往下依序浮上來
export function entryEnter(el: Element, done: () => void) {
  if (reduceMotion()) return done()
  gsap
    .timeline({ onComplete: done })
    .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out' })
    .fromTo(el.querySelectorAll('.row, .all'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, 0.1)
}

// 選了考卷：其他考卷往下淡出，選到的那份放大一下，再整頁淡出露出地圖（地圖同時飛到那一科的島）
export function entryLeave(el: Element, picked: string | undefined, done: () => void) {
  if (reduceMotion()) return done()
  const card = picked ? el.querySelector(`[data-paper="${picked}"]`) : null
  const others = [...el.querySelectorAll('.cell, .session, .all, .intro')].filter((node) => node !== card)
  const timeline = gsap.timeline({ onComplete: done })
  timeline.to(others, { y: 16, autoAlpha: 0, duration: 0.25, stagger: 0.015, ease: 'power1.in' }, 0)
  if (card) timeline.to(card, { scale: 1.08, duration: 0.3, ease: 'back.out(2)' }, 0)
  timeline.to(el, { autoAlpha: 0, duration: 0.35, ease: 'power1.in' }, card ? 0.3 : 0.15)
}
