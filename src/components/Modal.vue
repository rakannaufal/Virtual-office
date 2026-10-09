<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
defineProps<{ title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>(),
  panel = ref<HTMLElement>(),
  target = ref<Element | string>(
    document.fullscreenElement ?? document.querySelector('[data-office-fullscreen]') ?? 'body',
  ),
  previousOverflow = document.body.style.overflow,
  previous = document.activeElement as HTMLElement | null
function updateTarget() {
  target.value = document.fullscreenElement ?? document.querySelector('[data-office-fullscreen]') ?? 'body'
}
function key(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'Tab') {
    const items = [
      ...panel.value!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
      ),
    ].filter((el) => el.getClientRects().length)
    const first = items[0],
      last = items.at(-1)
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }
}
onMounted(async () => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', key)
  document.addEventListener('fullscreenchange', updateTarget)
  document.addEventListener('rn-fullscreen-change', updateTarget)
  await nextTick()
  panel.value?.querySelector<HTMLElement>('input,button')?.focus()
})
onUnmounted(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', key)
  document.removeEventListener('fullscreenchange', updateTarget)
  document.removeEventListener('rn-fullscreen-change', updateTarget)
  previous?.focus()
})
</script>
<template>
  <Teleport :to="target"
    ><div class="modal-backdrop" @click.self="emit('close')">
      <section
        ref="panel"
        class="modal"
        :class="{ wide }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="modal-heading">
          <div>
            <small class="eyebrow">RN GROUP / WORKSPACE</small>
            <h2>{{ title }}</h2>
          </div>
          <button class="icon-button" aria-label="Tutup" @click="emit('close')"><X :size="20" /></button>
        </header>
        <div class="modal-content"><slot /></div>
      </section></div
  ></Teleport>
</template>
