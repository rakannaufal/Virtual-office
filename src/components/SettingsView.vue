<script setup lang="ts">
const confirm = window.confirm.bind(window)
import { computed, ref, onUnmounted } from 'vue'
import { Check, Download, Upload, Plus, Database, ShieldCheck, RotateCcw } from 'lucide-vue-next'
import { useOffice, errorMessage } from '../lib/store'
import { workspaceSchema, validateWorkspace } from '../lib/domain'
import { seed } from '../lib/seed'
import { uid, type Service, type Settings } from '../lib/types'
const emit = defineEmits<{ cloud: [] }>(),
  store = useOffice(),
  tab = ref('identity'),
  w = computed(() => store.workspace),
  settings = ref<Settings>(JSON.parse(JSON.stringify(w.value.settings))),
  services = ref<Service[]>(JSON.parse(JSON.stringify(w.value.services))),
  flows = ref(JSON.parse(JSON.stringify(w.value.workflows))),
  busy = ref(false)
const backupHref = ref(''),
  backupName = `RN-GROUP-${new Date().toISOString().slice(0, 10)}.zip`
async function prepareBackup() {
  await run(async () => {
    const blob = await store.exportBackup(false)
    if (backupHref.value) URL.revokeObjectURL(backupHref.value)
    backupHref.value = URL.createObjectURL(blob)
  })
}
onUnmounted(() => {
  if (backupHref.value) URL.revokeObjectURL(backupHref.value)
})
const tabs = [
  { id: 'identity', label: 'Identitas & tampilan' },
  { id: 'routines', label: 'Rutinitas manusia' },
  { id: 'services', label: 'Layanan & alur' },
  { id: 'data', label: 'Data & cloud' },
]
async function run(fn: () => unknown | Promise<unknown>) {
  busy.value = true
  try {
    await fn()
  } catch (e) {
    store.notify(errorMessage(e))
  } finally {
    busy.value = false
  }
}
function save() {
  try {
    for (const flow of flows.value)
      if (
        !flow.active &&
        (['new', 'working', 'review', 'revision', 'done'].includes(flow.phase) ||
          w.value.orders.some((o) => !o.archived && o.statusId === flow.id))
      )
        throw Error('Tahapan utama atau yang masih dipakai tidak boleh dinonaktifkan.')
    const next = validateWorkspace({
      ...JSON.parse(JSON.stringify(w.value)),
      settings: settings.value,
      services: services.value,
      workflows: flows.value,
    })
    w.value.settings = next.settings
    w.value.services = next.services
    w.value.workflows = next.workflows
    store.log('Pengaturan kantor diperbarui.')
    store.notify('Pengaturan disimpan.')
  } catch (e) {
    store.notify(errorMessage(e))
  }
}
function addService() {
  services.value.push({
    id: uid('service'),
    name: 'Layanan baru',
    scope: '',
    price: 0,
    revisions: 1,
    active: true,
    checklist: ['Isi sesuai sumber', 'Hasil akhir diperiksa'],
  })
}
function updateChecklist(s: Service, e: Event) {
  s.checklist = (e.target as HTMLTextAreaElement).value
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean)
}
async function importFile(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  if (
    file &&
    confirm('Ganti data lokal dengan cadangan ini? Data saat ini akan diunduh sebagai cadangan dahulu.')
  )
    await run(() => store.importBackup(file))
  input.value = ''
  settings.value = JSON.parse(JSON.stringify(w.value.settings))
  services.value = JSON.parse(JSON.stringify(w.value.services))
  flows.value = JSON.parse(JSON.stringify(w.value.workflows))
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">PREFERENCES / YOUR OFFICE</span>
      <h1>Sesuai cara<br /><span>Anda bekerja.</span></h1>
      <p>Ubah identitas, rutinitas, dan layanan tanpa mengubah kode.</p>
    </div>
    <button class="primary" @click="save" v-if="tab !== 'data'">
      <Check :size="17" /> Simpan pengaturan
    </button>
  </div>
  <div class="settings-layout">
    <nav class="settings-nav">
      <button v-for="t in tabs" :class="{ active: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
    </nav>
    <div class="settings-panel">
      <section v-if="tab === 'identity'">
        <h2>Identitas kantor</h2>
        <div class="form-grid">
          <label>Nama kantor<input v-model="settings.company" maxlength="200" /></label
          ><label>Logo teks<input v-model="settings.logo" maxlength="10" /></label
          ><label class="full">Tagline<input v-model="settings.tagline" maxlength="200" /></label
          ><label class="full"
            >Kontak usaha<input
              v-model="settings.contact"
              maxlength="200"
              placeholder="WhatsApp / email" /></label
          ><label>Primary / graphite<input type="color" v-model="settings.primary" /></label
          ><label>Accent / teal<input type="color" v-model="settings.accent" /></label
          ><label
            >Tema<select v-model="settings.theme">
              <option value="light">Terang</option>
              <option value="dark">Gelap</option>
            </select></label
          ><label
            >Kualitas 3D<select v-model="settings.quality">
              <option value="high">Tinggi</option>
              <option value="low">Ringan</option>
            </select></label
          ><label
            >Ukuran label<input v-model.number="settings.labelSize" type="number" min="10" max="18" /></label
          ><label
            >Kecepatan berjalan<input
              v-model.number="settings.speed"
              type="number"
              min=".5"
              max="3"
              step=".1"
          /></label>
        </div>
        <h3>Nama ruangan</h3>
        <div class="form-grid">
          <label v-for="(value, key) in settings.roomNames" :key="key"
            >{{ key }}<input v-model="settings.roomNames[key]" maxlength="200"
          /></label>
        </div>
        <h3>Preferensi</h3>
        <label class="check-row"
          ><input type="checkbox" v-model="settings.notifications" /> Pusat notifikasi aktivitas</label
        ><label class="check-row"
          ><input type="checkbox" v-model="settings.sound" /> Bunyi singkat saat pemberitahuan</label
        ><label class="check-row"
          ><input type="checkbox" v-model="settings.requireApproval" /> Wajib persetujuan CEO sebelum
          selesai</label
        >
        <p class="form-note">
          Kualitas 3D diterapkan saat membuka ulang halaman Kantor. Pengaturan nama dan warna langsung
          tersimpan.
        </p>
      </section>
      <section v-if="tab === 'routines'">
        <h2>Rutinitas manusia</h2>
        <p class="form-note">
          Rutinitas bersifat visual. Tugas yang siap dikerjakan menghentikan istirahat; progres pesanan tetap
          diubah manual.
        </p>
        <div class="form-grid">
          <label class="check-row"><input type="checkbox" v-model="settings.animation" /> Animasi aktif</label
          ><label class="check-row"
            ><input type="checkbox" v-model="settings.reducedMotion" /> Kurangi gerakan</label
          ><label class="check-row"><input type="checkbox" v-model="settings.coffee" /> Ngopi</label
          ><label class="check-row"
            ><input type="checkbox" v-model="settings.resting" /> Bersantai di sofa</label
          ><label class="check-row"><input type="checkbox" v-model="settings.reading" /> Membaca</label
          ><label class="check-row"><input type="checkbox" v-model="settings.social" /> Gestur menyapa</label
          ><label class="check-row full"
            ><input type="checkbox" v-model="settings.autoCEO" /> CEO mengikuti rutinitas otomatis</label
          ><label
            >Durasi istirahat (detik)<input
              v-model.number="settings.coffeeDuration"
              type="number"
              min="5"
              max="300" /></label
          ><label
            >Jeda saat kosong (detik)<input
              v-model.number="settings.idleDuration"
              type="number"
              min="5"
              max="300" /></label
          ><label
            >Jeda antarkopi (detik)<input
              v-model.number="settings.coffeeCooldown"
              type="number"
              min="10"
              max="1800"
          /></label>
        </div>
        <h3>Jam kantor</h3>
        <label class="check-row"
          ><input type="checkbox" v-model="settings.workHours" /> Ikuti jam dan hari kerja</label
        >
        <div class="form-grid">
          <label>Mulai kerja<input v-model="settings.workStart" type="time" /></label
          ><label>Selesai kerja<input v-model="settings.workEnd" type="time" /></label
          ><label>Mulai istirahat<input v-model="settings.breakStart" type="time" /></label
          ><label
            >Durasi istirahat (menit)<input
              v-model.number="settings.breakDuration"
              type="number"
              min="0"
              max="240" /></label
          ><label class="full"
            >Zona waktu<select v-model="settings.timezone">
              <option>Asia/Jakarta</option>
              <option>Asia/Makassar</option>
              <option>Asia/Jayapura</option>
              <option>UTC</option>
            </select></label
          >
        </div>
        <div class="workdays">
          <label v-for="(d, i) in ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']"
            ><input type="checkbox" :value="i" v-model="settings.workDays" /> {{ d }}</label
          >
        </div>
      </section>
      <section v-if="tab === 'services'">
        <div class="section-heading">
          <h2>Layanan</h2>
          <button @click="addService"><Plus :size="16" /> Layanan</button>
        </div>
        <article v-for="s in services" :key="s.id" class="service-editor">
          <div class="form-grid">
            <label>Nama<input v-model="s.name" maxlength="200" /></label
            ><label
              >Harga awal (Rp)<input
                v-model.number="s.price"
                type="number"
                min="0"
                max="10000000000" /></label
            ><label class="full">Lingkup<textarea v-model="s.scope" maxlength="12000" /></label
            ><label
              >Putaran revisi<input v-model.number="s.revisions" type="number" min="0" max="100" /></label
            ><label class="check-row"><input type="checkbox" v-model="s.active" /> Layanan ditawarkan</label
            ><label class="full"
              >Checklist (satu per baris)<textarea
                :value="s.checklist.join('\n')"
                rows="4"
                @change="updateChecklist(s, $event)"
              />
            </label>
          </div>
        </article>
        <h2>Tahapan pekerjaan</h2>
        <div v-for="f in flows" :key="f.id" class="workflow-editor">
          <span class="eyebrow">{{ f.phase }}</span
          ><input v-model="f.label" maxlength="200" aria-label="Nama tahapan" /><input
            type="color"
            v-model="f.color"
            aria-label="Warna tahapan"
          /><label class="check-inline"><input type="checkbox" v-model="f.active" /> Aktif</label>
        </div>
        <p class="form-note">
          Perubahan checklist berlaku untuk pesanan baru. Pesanan sebelumnya menyimpan checklist yang sudah
          disepakati.
        </p>
      </section>
      <section v-if="tab === 'data'">
        <h2>Data & cloud</h2>
        <article class="data-card">
          <Database :size="28" />
          <div>
            <h3>Supabase privat</h3>
            <p>
              {{ store.cloudState }}<span v-if="store.userEmail"> / {{ store.userEmail }}</span>
            </p>
            <p class="form-note">
              Auth, database dengan RLS, dan Storage privat. Sinkronkan setelah perubahan; mode lokal tetap
              bisa dipakai.
            </p>
          </div>
          <button @click="emit('cloud')">Kelola koneksi</button>
        </article>
        <article class="data-card">
          <Download :size="28" />
          <div>
            <h3>Cadangan lengkap</h3>
            <p>ZIP berisi metadata dan seluruh file pekerjaan. Simpan secara berkala.</p>
          </div>
          <button :disabled="busy" @click="prepareBackup">Siapkan ZIP</button>
          <a v-if="backupHref" class="primary download-link" :href="backupHref" :download="backupName"
            >Unduh ZIP siap</a
          >
        </article>
        <article class="data-card">
          <Upload :size="28" />
          <div>
            <h3>Pulihkan cadangan</h3>
            <p>Data diperiksa sebelum diimpor. Cadangan data saat ini diunduh terlebih dahulu.</p>
          </div>
          <label class="upload-button"
            >Pilih ZIP<input
              type="file"
              accept=".zip"
              :disabled="busy || store.connected"
              @change="importFile"
          /></label>
        </article>
        <article v-if="store.recoveryAvailable" class="data-card">
          <RotateCcw :size="28" />
          <div>
            <h3>Pemulihan otomatis</h3>
            <p>
              Salinan lengkap sebelum impor atau membuka cloud. Tetap tersedia jika unduhan browser diblokir.
            </p>
          </div>
          <button
            :disabled="busy || store.connected"
            @click="
              confirm('Pulihkan salinan data sebelumnya? Data saat ini dicadangkan dahulu.') &&
              run(store.restoreRecovery)
            "
          >
            Pulihkan sebelumnya
          </button>
        </article>
        <article v-if="w.demo" class="data-card">
          <ShieldCheck :size="28" />
          <div>
            <h3>Mulai dengan data sendiri</h3>
            <p>Hapus pesanan dan calon pelanggan contoh. Pesanan yang Anda buat tetap tersimpan.</p>
          </div>
          <button @click="confirm('Hapus data contoh fiktif?') && store.clearDemo()">Hapus contoh</button>
        </article>
        <p class="form-note">
          File lokal tersimpan di browser ini. Jangan menghapus data situs sebelum mengunduh cadangan. Cloud
          baru aktif setelah migrasi database dan login berhasil.
        </p>
      </section>
    </div>
  </div>
</template>
