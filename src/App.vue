<script setup lang="ts">
const confirm = window.confirm.bind(window)
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Building2,
  BriefcaseBusiness,
  Users,
  Megaphone,
  Settings2,
  Cloud,
  Bell,
  ArrowUpRight,
  ChevronRight,
  Menu,
  X,
  CheckCircle2,
  RefreshCw,
  LogOut,
} from 'lucide-vue-next'
import { useOffice, errorMessage } from './lib/store'
import { prettyDate } from './lib/types'
import OfficeView from './components/OfficeView.vue'
import OrderBoard from './components/OrderBoard.vue'
import TeamView from './components/TeamView.vue'
import MarketingView from './components/MarketingView.vue'
import SettingsView from './components/SettingsView.vue'
import Modal from './components/Modal.vue'
import OrderForm from './components/OrderForm.vue'
import OrderDetail from './components/OrderDetail.vue'
import Workstation from './components/Workstation.vue'
const store = useOffice(),
  w = computed(() => store.workspace),
  view = ref('office'),
  sidebar = ref(false),
  desktop = ref(''),
  order = ref(''),
  newOrder = ref(false),
  cloudDialog = ref(false),
  notificationDialog = ref(false),
  email = ref(''),
  password = ref(''),
  authBusy = ref(false),
  authError = ref(''),
  currentTime = ref(new Date())
const toastTarget = ref<Element | string>('body')
function updateToastTarget() {
  toastTarget.value =
    document.fullscreenElement ?? document.querySelector('[data-office-fullscreen]') ?? 'body'
}
const nav = [
  { id: 'office', title: 'Kantor', icon: Building2 },
  { id: 'orders', title: 'Pesanan', icon: BriefcaseBusiness },
  { id: 'team', title: 'Tim & role', icon: Users },
  { id: 'marketing', title: 'Pemasaran', icon: Megaphone },
  { id: 'settings', title: 'Pengaturan', icon: Settings2 },
]
const dateLabel = computed(() =>
    new Intl.DateTimeFormat('id-ID', {
      timeZone: w.value.settings.timezone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(currentTime.value),
  ),
  timeLabel = computed(() =>
    new Intl.DateTimeFormat('id-ID', {
      timeZone: w.value.settings.timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(currentTime.value),
  )
let timer: ReturnType<typeof setInterval>, toastTimer: ReturnType<typeof setTimeout>
watch(
  () => store.toast,
  (text) => {
    clearTimeout(toastTimer)
    if (text)
      toastTimer = setTimeout(() => {
        store.toast = ''
      }, 8000)
  },
)
watch(
  () => w.value.settings,
  (s) => {
    document.documentElement.dataset.theme = s.theme
    document.documentElement.style.setProperty('--primary', s.primary)
    document.documentElement.style.setProperty('--accent', s.accent)
    document.title = `${s.company} / Virtual Office`
  },
  { deep: true, immediate: true },
)
function navigate(id: string) {
  view.value = id
  sidebar.value = false
  desktop.value = ''
  window.scrollTo({ top: 0 })
}
function openOrder(id: string) {
  desktop.value = ''
  newOrder.value = false
  order.value = id
}
async function run(fn: () => unknown | Promise<unknown>) {
  authBusy.value = true
  authError.value = ''
  try {
    await fn()
  } catch (e) {
    authError.value = errorMessage(e)
    store.notify(authError.value)
  } finally {
    authBusy.value = false
  }
}
onMounted(() => {
  timer = setInterval(() => (currentTime.value = new Date()), 30000)
  void store.connect()
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('fullscreenchange', updateToastTarget)
  document.addEventListener('rn-fullscreen-change', updateToastTarget)
})
function beforeUnload() {
  store.persist()
}
onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(toastTimer)
  window.removeEventListener('beforeunload', beforeUnload)
  document.removeEventListener('fullscreenchange', updateToastTarget)
  document.removeEventListener('rn-fullscreen-change', updateToastTarget)
})
</script>
<template>
  <div class="app-shell">
    <button v-if="sidebar" class="nav-scrim" aria-label="Tutup menu" @click="sidebar = false" />
    <aside class="sidebar" :class="{ open: sidebar }">
      <a href="#" class="brand" @click.prevent="navigate('office')"
        ><span class="brand-mark">{{ w.settings.logo }}</span>
        <div>
          <strong>{{ w.settings.company }}</strong
          ><small>VIRTUAL OFFICE</small>
        </div></a
      >
      <div class="sidebar-office-label">WORKSPACE <span>01</span></div>
      <nav class="main-nav">
        <button v-for="n in nav" :key="n.id" :class="{ active: view === n.id }" @click="navigate(n.id)">
          <component :is="n.icon" :size="19" :stroke-width="1.7" /><span>{{ n.title }}</span
          ><small v-if="n.id === 'orders' && store.outstanding.length">{{ store.outstanding.length }}</small
          ><ChevronRight v-if="view === n.id" :size="14" />
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="private-note">
          <i />
          <div>
            <strong>Ruang untuk bertumbuh</strong>
            <p>Satu orang, banyak kemampuan.</p>
          </div>
        </div>
        <button class="cloud-nav" @click="cloudDialog = true">
          <Cloud :size="18" />
          <div>
            <strong>{{ store.connected ? 'Supabase' : 'Mode lokal' }}</strong
            ><small>{{ store.connected ? store.cloudState : 'Tersimpan di browser ini' }}</small>
          </div>
          <ArrowUpRight :size="15" />
        </button>
        <div class="owner">
          <div class="avatar-initial">{{ w.roles.find((r) => r.kind === 'ceo')?.name[0] }}</div>
          <div>
            <strong>{{ w.roles.find((r) => r.kind === 'ceo')?.name }}</strong
            ><small>CEO / OWNER</small>
          </div>
          <span class="owner-dot" />
        </div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div>
          <button class="icon-button mobile-menu" aria-label="Menu" @click="sidebar = !sidebar">
            <Menu :size="21" /></button
          ><span class="breadcrumb"
            >Workspace <ChevronRight :size="13" />
            <strong>{{ nav.find((n) => n.id === view)?.title }}</strong></span
          >
        </div>
        <div class="topbar-actions">
          <span class="date-label"
            >{{ dateLabel }} <b>{{ timeLabel }}</b></span
          ><button class="save-state" @click="cloudDialog = true">
            <i :class="{ unsaved: !store.localSaved }" />{{
              store.localSaved
                ? store.connected && store.dirty
                  ? 'Lokal tersimpan / cloud belum'
                  : 'Lokal tersimpan'
                : 'Belum tersimpan'
            }}</button
          ><button
            v-if="w.settings.notifications"
            class="icon-button notification-button"
            aria-label="Notifikasi"
            @click="notificationDialog = true"
          >
            <Bell :size="18" /><i v-if="store.outstanding.length" />
          </button>
        </div>
      </header>
      <main :key="view" class="main-content">
        <div v-if="w.demo" class="demo-banner">
          <span><strong>Data contoh</strong> / Pelanggan fiktif. Role dikelola Anda sendiri.</span
          ><button class="text-button" @click="navigate('settings')">
            Mulai dengan data sendiri <ArrowUpRight :size="14" />
          </button>
        </div>
        <OfficeView
          v-if="view === 'office'"
          @select="desktop = $event"
          @new-order="newOrder = true"
        /><OrderBoard
          v-else-if="view === 'orders'"
          @select="openOrder"
          @new-order="newOrder = true"
        /><TeamView v-else-if="view === 'team'" @select="desktop = $event" /><MarketingView
          v-else-if="view === 'marketing'"
        /><SettingsView v-else @cloud="cloudDialog = true" />
        <footer class="app-footer">
          <span>{{ w.settings.company }} / {{ w.settings.tagline }}</span
          ><span>Built for a thoughtful beginning.</span>
        </footer>
      </main>
    </div>
  </div>
  <Modal
    v-if="desktop"
    :title="w.roles.find((r) => r.id === desktop)?.title ?? 'Komputer'"
    wide
    @close="desktop = ''"
    ><Workstation :role-id="desktop" @order="openOrder" @navigate="navigate" /></Modal
  ><Modal v-if="newOrder" title="Pesanan baru" @close="newOrder = false"
    ><OrderForm @created="openOrder" /></Modal
  ><Modal v-if="order" title="Detail pekerjaan" wide @close="order = ''"
    ><OrderDetail :id="order" @close="order = ''"
  /></Modal>
  <Modal v-if="cloudDialog" title="Koneksi Supabase" @close="cloudDialog = false"
    ><div class="cloud-status">
      <Cloud :size="25" />
      <div>
        <strong>{{ store.cloudState }}</strong>
        <p>{{ store.userEmail || 'Gunakan akun pemilik untuk menghubungkan data.' }}</p>
      </div>
    </div>
    <p class="form-note">
      Project: kviucybtwdinsdbbqvnc. Migrasi tersedia di folder supabase/migrations. Publishable key hanya
      menghubungkan aplikasi; akun tetap diperlukan.
    </p>
    <p v-if="authError" class="error-message" role="alert">{{ authError }}</p>
    <form v-if="!store.userEmail" class="form-grid" @submit.prevent="run(() => store.auth(email, password))">
      <label class="full">Email<input v-model="email" type="email" required autocomplete="username" /></label
      ><label class="full"
        >Password<input
          v-model="password"
          type="password"
          required
          minlength="8"
          autocomplete="current-password" /></label
      ><button class="primary" :disabled="authBusy">{{ authBusy ? 'Menghubungkan...' : 'Masuk' }}</button
      ><button
        type="button"
        :disabled="authBusy || !email || password.length < 8"
        @click="run(() => store.auth(email, password, true))"
      >
        Daftar akun pemilik
      </button>
    </form>
    <div v-else class="cloud-actions">
      <div v-if="store.cloudConflict" class="conflict-box">
        <h3>Pilih data untuk sesi ini</h3>
        <p>
          Data lokal dan cloud berbeda. Membuka cloud mengunduh cadangan lokal terlebih dahulu. Mengunggah
          lokal mengganti snapshot cloud pada revisi yang diperiksa.
        </p>
        <div class="button-row">
          <button @click="run(store.useCloudSnapshot)" :disabled="authBusy">Buka data cloud</button
          ><button
            @click="confirm('Ganti snapshot cloud dengan data lokal?') && run(store.publishLocal)"
            :disabled="authBusy"
          >
            Unggah data lokal
          </button>
        </div>
      </div>
      <button v-else-if="!store.connected" @click="run(store.connect)" :disabled="authBusy">
        <RefreshCw :size="16" /> Periksa koneksi</button
      ><button
        class="primary"
        v-if="store.connected && !store.cloudConflict"
        @click="run(store.sync)"
        :disabled="authBusy || store.busy"
      >
        <Cloud :size="17" /> Sinkronkan sekarang</button
      ><button @click="run(store.logout)" :disabled="authBusy"><LogOut :size="16" /> Keluar</button>
    </div>
    <p class="form-note">
      File cloud privat. Tidak ada pelanggan atau pekerja lain yang memperoleh akses lewat nama role.
    </p></Modal
  >
  <Modal v-if="notificationDialog" title="Aktivitas kantor" @close="notificationDialog = false"
    ><ol class="activity-list">
      <li v-for="l in w.logs.slice(0, 30)" :key="l.id">
        <i /><span
          >{{ l.message }}<small>{{ prettyDate(l.at, w.settings.timezone) }}</small></span
        >
      </li>
    </ol></Modal
  >
  <Teleport :to="toastTarget"
    ><div v-if="store.toast" class="toast" role="status">
      <CheckCircle2 :size="18" /><span>{{ store.toast }}</span
      ><button class="icon-button" aria-label="Tutup pemberitahuan" @click="store.toast = ''">
        <X :size="17" />
      </button></div
  ></Teleport>
</template>
