<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Coffee,
  Armchair,
  Monitor,
  Move,
  LoaderCircle,
  LayoutGrid,
  Check,
  X,
  Maximize2,
  Minimize2,
  Clock3,
  ArrowUpRight,
} from 'lucide-vue-next'
import { useOffice } from '../lib/store'
import { OfficeScene, type SceneLabel } from '../scene/officeScene'
import { activities } from '../scene/routines'
import { layoutError } from '../scene/navigation'
import type { Furniture, Vec2 } from '../lib/types'
import { prettyDate } from '../lib/types'
import { roleSummary } from '../lib/roleSummary'
const emit = defineEmits<{ select: [id: string]; newOrder: [] }>(),
  store = useOffice(),
  host = ref<HTMLElement>(),
  viewport = ref<HTMLElement>(),
  fullscreen = ref(false),
  fallbackFullscreen = ref(false),
  now = ref(new Date()),
  labels = ref<SceneLabel[]>([]),
  error = ref(''),
  loading = ref(true),
  editing = ref(false),
  selectedObject = ref(''),
  draft = ref<Furniture[]>([])
let engine: OfficeScene | undefined
let clockTimer: ReturnType<typeof setInterval>
let previousOverflow = ''
const w = computed(() => store.workspace),
  activeRoles = computed(() => w.value.roles.filter((r) => r.active)),
  summaries = computed(() => w.value.roles.map((r) => roleSummary(w.value, r, now.value))),
  pendingApproval = computed(() => summaries.value.find((s) => s.role.kind === 'ceo')?.actions.length ?? 0)
function updateFullscreen() {
  fullscreen.value = document.fullscreenElement === viewport.value || fallbackFullscreen.value
  if (fullscreen.value) viewport.value?.setAttribute('data-office-fullscreen', '')
  else viewport.value?.removeAttribute('data-office-fullscreen')
  document.dispatchEvent(new Event('rn-fullscreen-change'))
}
async function toggleFullscreen() {
  if (fullscreen.value) {
    if (document.fullscreenElement === viewport.value) await document.exitFullscreen()
    if (fallbackFullscreen.value) {
      fallbackFullscreen.value = false
      document.body.style.overflow = previousOverflow
    }
    updateFullscreen()
    return
  }
  try {
    if (!document.fullscreenEnabled || !viewport.value?.requestFullscreen)
      throw Error('Fullscreen API tidak tersedia')
    await viewport.value.requestFullscreen()
  } catch {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    fallbackFullscreen.value = true
  }
  updateFullscreen()
}
function fullscreenKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && fallbackFullscreen.value && !document.querySelector('[role="dialog"]'))
    void toggleFullscreen()
}
function routine(id: string) {
  const role = w.value.roles.find((r) => r.id === id)
  if (!role?.active) return 'Nonaktif'
  const state = labels.value.find((l) => l.id === id)?.state
  return state ? activities[state] : 'Menyiapkan avatar'
}
function select(id: string) {
  emit('select', id)
}
function place(p: Vec2) {
  if (!editing.value) return false
  const obj = draft.value.find((o) => o.id === selectedObject.value)
  if (obj) {
    obj.x = Math.round(p.x * 2) / 2
    obj.z = Math.round(p.z * 2) / 2
    engine?.rebuild()
  }
  return true
}
function editLayout() {
  draft.value = JSON.parse(JSON.stringify(w.value.objects))
  selectedObject.value = draft.value.find((o) => o.movable)?.id ?? ''
  editing.value = true
}
function finishLayout(save: boolean) {
  if (save) {
    const problem = layoutError(draft.value, w.value.roles)
    if (problem) return store.notify(problem)
    w.value.objects = JSON.parse(JSON.stringify(draft.value))
    store.log('Tata letak dekorasi disimpan.')
  }
  editing.value = false
  engine?.rebuild()
}
function action(intent: 'home' | 'coffee' | 'rest') {
  const id = w.value.roles.find((r) => r.kind === 'ceo')!.id
  const success =
    intent === 'home'
      ? engine?.routines.home(id)
      : engine?.routines.leisure(id, intent === 'coffee' ? 'coffee' : 'sofa1')
  if (!success) store.notify('Tempat sedang dipakai atau akses terhalang.')
}
onMounted(() => {
  clockTimer = setInterval(() => (now.value = new Date()), 30000)
  document.addEventListener('fullscreenchange', updateFullscreen)
  document.addEventListener('keydown', fullscreenKey)
  try {
    engine = new OfficeScene(
      host.value!,
      () => (editing.value ? { ...w.value, objects: draft.value } : w.value),
      (value) => {
        labels.value = value
        loading.value = false
      },
      select,
      store.notify,
      place,
    )
  } catch {
    error.value = 'WebGL tidak tersedia. Gunakan daftar role untuk membuka pekerjaan.'
    loading.value = false
  }
})
watch(
  () => JSON.stringify([w.value.objects, w.value.settings.company, w.value.roles.map((r) => r.title)]),
  () => engine?.rebuild(),
)
onBeforeUnmount(() => {
  clearInterval(clockTimer)
  document.removeEventListener('fullscreenchange', updateFullscreen)
  document.removeEventListener('keydown', fullscreenKey)
  if (fallbackFullscreen.value) document.body.style.overflow = previousOverflow
  if (document.fullscreenElement === viewport.value) void document.exitFullscreen()
  engine?.dispose()
})
</script>
<template>
  <section class="office-intro">
    <div>
      <div class="eyebrow">YOUR WORK, IN ONE PLACE</div>
      <h1>Kantor yang hidup.<br /><span>Pekerjaan yang tertata.</span></h1>
      <p>{{ w.settings.tagline }} Enam role, satu kendali.</p>
    </div>
    <div class="intro-side">
      <span class="status-pill"><i /> Kantor pribadi</span>
      <p>CEO / {{ w.roles.find((r) => r.kind === 'ceo')?.name }}</p>
      <button class="primary" @click="emit('newOrder')">+ Pesanan baru</button>
    </div>
  </section>
  <div class="office-summary">
    <div>
      <strong>{{ store.outstanding.length }}</strong
      ><span>pesanan aktif</span>
    </div>
    <div>
      <strong>{{ pendingApproval }}</strong
      ><span>persetujuan CEO</span>
    </div>
    <div>
      <strong>{{ activeRoles.length }}</strong
      ><span>role tersedia</span>
    </div>
    <div><strong>Rp0</strong><span>biaya API / aset</span></div>
  </div>
  <div
    ref="viewport"
    class="office-viewport"
    :class="{ 'is-fullscreen': fullscreen, 'fullscreen-fallback': fallbackFullscreen }"
  >
    <section class="scene-card">
      <div class="scene-top">
        <div class="scene-caption">
          <span class="tiny-square" /> <strong>{{ w.settings.company }}</strong
          ><span>Virtual headquarters</span>
        </div>
        <div class="scene-actions">
          <button class="text-button" @click="editLayout" :disabled="editing">
            <LayoutGrid :size="15" /> Atur dekorasi</button
          ><button class="fullscreen-button" :aria-pressed="fullscreen" @click="toggleFullscreen">
            <component :is="fullscreen ? Minimize2 : Maximize2" :size="16" />
            {{ fullscreen ? 'Keluar layar penuh' : 'Layar penuh' }}
          </button>
        </div>
      </div>
      <div class="scene-wrap">
        <div ref="host" class="scene-canvas" />
        <div v-if="loading" class="scene-loading">
          <LoaderCircle class="spin" :size="28" /> Menyiapkan kantor...
        </div>
        <div v-if="error" class="scene-error">{{ error }}</div>
        <div class="scene-labels">
          <button
            v-for="l in labels.filter((l) => l.visible)"
            :key="l.id"
            class="character-label"
            :class="{ ceo: l.id === 'ceo' }"
            :style="{ left: l.x + 'px', top: l.y + 'px', fontSize: w.settings.labelSize + 'px' }"
            @click="select(l.id)"
          >
            <span
              >{{ w.roles.find((r) => r.id === l.id)?.name }}
              <small>{{ w.roles.find((r) => r.id === l.id)?.title }}</small></span
            ><em :class="l.state">{{ activities[l.state] }}</em>
          </button>
        </div>
        <div class="room-label ceo-room">{{ w.settings.roomNames.ceo }}</div>
        <div class="room-label production">{{ w.settings.roomNames.production }}</div>
        <div class="room-label lounge">{{ w.settings.roomNames.lounge }}</div>
        <div class="room-label reception-room">{{ w.settings.roomNames.reception }}</div>
        <div class="camera-tools">
          <button class="icon-button" @click="engine?.zoom(0.15)" aria-label="Perbesar">
            <ZoomIn :size="18" /></button
          ><button class="icon-button" @click="engine?.zoom(-0.15)" aria-label="Perkecil">
            <ZoomOut :size="18" /></button
          ><span /><button class="icon-button" @click="engine?.rotate(-Math.PI / 8)" aria-label="Putar kiri">
            <RotateCcw :size="18" /></button
          ><button class="icon-button" @click="engine?.rotate(Math.PI / 8)" aria-label="Putar kanan">
            <RotateCw :size="18" /></button
          ><button class="icon-button" @click="engine?.reset()" aria-label="Reset kamera">
            <Move :size="18" />
          </button>
        </div>
        <div v-if="editing" class="layout-toolbar">
          <label
            >Dekorasi<select v-model="selectedObject">
              <option v-for="o in draft.filter((o) => o.movable)" :value="o.id">
                {{ o.type }} / {{ o.room }}
              </option>
            </select></label
          ><span>Klik lantai untuk memindahkan.</span
          ><button class="primary small" @click="finishLayout(true)"><Check :size="15" /> Simpan</button
          ><button class="icon-button" aria-label="Batal tata letak" @click="finishLayout(false)">
            <X :size="18" />
          </button>
        </div>
      </div>
      <footer class="scene-bottom">
        <span>Klik komputer: buka pekerjaan. Klik lantai: gerakkan CEO.</span
        ><span>Geser / scroll / klik kanan untuk kamera</span>
      </footer>
    </section>
    <section class="ceo-controls">
      <div><span class="eyebrow">KENDALI CEO</span><span>WASD atau klik lantai</span></div>
      <button @click="action('home')"><Monitor :size="16" /> Ke meja</button
      ><button @click="action('coffee')"><Coffee :size="16" /> Ngopi</button
      ><button @click="action('rest')"><Armchair :size="16" /> Santai</button>
    </section>
  </div>
  <div class="section-heading">
    <h2>Orang di balik pekerjaan</h2>
    <span>{{ w.roles.length }} role / rincian pekerjaan dan rutinitas</span>
  </div>
  <p class="role-section-note">
    Kesiapan mengikuti data pesanan. Rutinitas menunjukkan gerakan avatar.
    {{ w.demo ? 'Pesanan yang ditandai contoh adalah data fiktif.' : '' }}
  </p>
  <div class="role-detail-grid">
    <article
      v-for="s in summaries"
      :key="s.role.id"
      class="role-detail-card"
      :class="{ inactive: !s.role.active }"
    >
      <header class="role-detail-header">
        <div class="role-initial" :style="{ color: s.role.shirt, backgroundColor: s.role.shirt + '18' }">
          {{ s.initials }}
        </div>
        <div>
          <h3>{{ s.role.name }}</h3>
          <p>{{ s.role.title }}</p>
        </div>
        <button class="icon-button" :aria-label="'Buka komputer ' + s.role.name" @click="select(s.role.id)">
          <ArrowUpRight :size="18" />
        </button>
      </header>
      <div class="role-readiness" :class="{ actionable: s.ready && s.actions.length, unavailable: !s.ready }">
        <i /><strong>{{ s.status }}</strong>
      </div>
      <p class="role-responsibility">{{ s.role.responsibility }}</p>
      <dl class="role-metrics">
        <div v-for="m in s.metrics" :key="m.label">
          <dt>{{ m.label }}</dt>
          <dd>{{ m.value }}</dd>
        </div>
      </dl>
      <div class="role-next-task">
        <small>{{ s.next ? 'Prioritas berikutnya' : 'Antrean tindakan' }}</small>
        <strong>{{
          s.next?.title ??
          (s.role.kind === 'marketing'
            ? 'Tinjau calon pelanggan dan draf promosi'
            : 'Belum ada tugas siap diproses')
        }}</strong>
        <span v-if="s.next"
          >{{ s.next.checklist.filter((c) => c.done).length }}/{{ s.next.checklist.length }} checklist
          selesai</span
        >
        <span v-else-if="s.waiting">{{ s.waiting }} pesanan menunggu bahan</span>
      </div>
      <div class="role-timing">
        <Clock3 :size="14" /><span>{{
          s.due ? 'Tenggat terdekat: ' + prettyDate(s.due, w.settings.timezone) : 'Belum ada tenggat'
        }}</span
        ><b v-if="s.overdue">{{ s.overdue }} terlambat</b>
      </div>
      <div class="role-last-record">
        <small>Catatan terakhir terkait</small>
        <p>{{ s.last?.message ?? 'Belum ada aktivitas tercatat.' }}</p>
        <time v-if="s.last" :datetime="s.last.at"
          >{{ prettyDate(s.last.at, w.settings.timezone) }} / {{ w.settings.timezone }}</time
        >
      </div>
      <footer class="role-detail-footer">
        <span
          >Rutinitas: <b>{{ routine(s.role.id) }}</b></span
        ><button class="text-button" @click="select(s.role.id)"><Monitor :size="14" /> Buka komputer</button>
      </footer>
    </article>
  </div>
</template>
