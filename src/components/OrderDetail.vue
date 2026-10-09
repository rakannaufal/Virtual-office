<script setup lang="ts">
import { computed, ref } from 'vue'
import { Upload, Download, Trash2, CheckCircle2, FileText, ShieldCheck, Archive, Eye } from 'lucide-vue-next'
import { useOffice, errorMessage } from '../lib/store'
import { money, prettyDate, uid, type FileRecord } from '../lib/types'
import { phaseOf } from '../lib/domain'
import { download } from '../lib/files'
import { dateInput, dateISO } from '../lib/dates'
const props = defineProps<{ id: string }>(),
  emit = defineEmits<{ close: [] }>(),
  store = useOffice(),
  w = computed(() => store.workspace),
  order = computed(() => w.value.orders.find((o) => o.id === props.id)!)
const confirm = window.confirm.bind(window)
const metadata = ref({
  title: order.value.title,
  customer: order.value.customer,
  contact: order.value.contact,
  roleId: order.value.roleId,
  priority: order.value.priority,
  due: dateInput(order.value.due, w.value.settings.timezone),
  notes: order.value.notes,
  price: order.value.price,
})
function beginEdit() {
  metadata.value = {
    title: order.value.title,
    customer: order.value.customer,
    contact: order.value.contact,
    roleId: order.value.roleId,
    priority: order.value.priority,
    due: dateInput(order.value.due, w.value.settings.timezone),
    notes: order.value.notes,
    price: order.value.price,
  }
  editing.value = true
}
function saveEdit() {
  const d = metadata.value
  if (
    !d.title.trim() ||
    !d.customer.trim() ||
    !Number.isFinite(d.price) ||
    d.price < order.value.paid ||
    d.price > 1e10
  )
    return store.notify(
      'Judul dan pelanggan wajib diisi. Harga harus minimal sebesar pembayaran yang sudah dicatat.',
    )
  try {
    Object.assign(order.value, d, { due: dateISO(d.due, w.value.settings.timezone) })
  } catch (e) {
    return store.notify(errorMessage(e))
  }
  store.invalidate(order.value)
  store.log('Detail pesanan diperbarui.', order.value.id, order.value.roleId)
  editing.value = false
}
const revision = ref(''),
  category = ref<'source' | 'result'>('source'),
  busy = ref(false),
  editing = ref(false)
const logs = computed(() => w.value.logs.filter((l) => l.orderId === props.id).slice(0, 20))
async function run(fn: () => unknown | Promise<unknown>) {
  try {
    await fn()
  } catch (e) {
    store.notify(errorMessage(e))
  }
}
function changePhase(e: Event) {
  void run(() => store.setPhase(order.value, (e.target as HTMLSelectElement).value))
  ;(e.target as HTMLSelectElement).value = order.value.statusId
}
function addRevision() {
  if (!revision.value.trim()) return
  order.value.revisions.unshift({
    id: uid('revision'),
    note: revision.value.trim(),
    createdAt: new Date().toISOString(),
    resolved: false,
  })
  revision.value = ''
  store.invalidate(order.value)
  const flow = w.value.workflows.find((f) => f.phase === 'revision')!
  store.setPhase(order.value, flow.id)
  store.log('Catatan revisi ditambahkan.', order.value.id)
}
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  busy.value = true
  await run(async () => {
    for (const file of input.files ?? []) await store.upload(order.value, file, category.value)
  })
  input.value = ''
  busy.value = false
}
async function openFile(f: FileRecord, preview = false) {
  await run(async () => {
    const blob = await store.blobFor(f.id)
    if (!blob) throw Error('File lokal tidak ditemukan. Pulihkan dari cadangan.')
    if (preview && /\.(pdf|png|jpe?g|webp)$/i.test(f.name)) {
      const safeType = /\.pdf$/i.test(f.name)
        ? 'application/pdf'
        : /\.png$/i.test(f.name)
          ? 'image/png'
          : /\.webp$/i.test(f.name)
            ? 'image/webp'
            : 'image/jpeg'
      const url = URL.createObjectURL(new Blob([blob], { type: safeType }))
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } else download(blob, f.name)
  })
}
function payment(e: Event) {
  const amount = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(amount) || amount < 0 || amount > order.value.price) {
    store.notify('Pembayaran harus antara Rp0 dan harga pesanan.')
    ;(e.target as HTMLInputElement).value = String(order.value.paid)
    return
  }
  order.value.paid = amount
  store.touch(order.value)
  store.log(`Pembayaran dicatat: ${money(amount)}`, order.value.id)
}
function archive() {
  if (!confirm('Arsipkan pesanan ini? File dan riwayat tetap tersimpan.')) return
  order.value.archived = true
  store.log(`Diarsipkan: ${order.value.title}`, order.value.id)
  emit('close')
}
</script>
<template>
  <div class="order-detail">
    <div class="detail-title">
      <div>
        <small
          >{{ order.id.slice(-8).toUpperCase() }} /
          {{ w.services.find((s) => s.id === order.serviceId)?.name }}</small
        >
        <h2>{{ order.title }}</h2>
        <p>
          {{ order.customer }} <span v-if="order.contact">/ {{ order.contact }}</span>
        </p>
      </div>
      <button class="text-button" @click="editing ? (editing = false) : beginEdit()">
        {{ editing ? 'Batal edit' : 'Edit detail' }}
      </button>
    </div>
    <div v-if="editing" class="form-grid inset">
      <label>Judul<input v-model="metadata.title" maxlength="200" /></label
      ><label>Pelanggan<input v-model="metadata.customer" maxlength="200" /></label
      ><label>Kontak<input v-model="metadata.contact" maxlength="200" /></label
      ><label>Tenggat<input v-model="metadata.due" type="datetime-local" /></label
      ><label
        >Penanggung jawab<select v-model="metadata.roleId">
          <option v-for="r in w.roles.filter((r) => r.active)" :value="r.id">
            {{ r.name }} / {{ r.title }}
          </option>
        </select></label
      ><label
        >Prioritas<select v-model="metadata.priority">
          <option value="normal">Normal</option>
          <option value="high">Tinggi</option>
        </select></label
      ><label class="full">Lingkup<textarea v-model="metadata.notes" maxlength="12000" /></label
      ><label
        >Harga (Rp)<input
          v-model.number="metadata.price"
          type="number"
          :min="order.paid"
          max="10000000000" /></label
      ><button class="primary full" @click="saveEdit">Simpan detail</button>
    </div>
    <div class="detail-meta">
      <label
        >Tahapan<select :value="order.statusId" @change="changePhase">
          <option v-for="f in w.workflows.filter((f) => f.active || f.id === order.statusId)" :value="f.id">
            {{ f.label }}
          </option>
        </select></label
      >
      <div>
        <small>Penanggung jawab</small><strong>{{ w.roles.find((r) => r.id === order.roleId)?.name }}</strong>
      </div>
      <div>
        <small>Tenggat</small><strong>{{ prettyDate(order.due, w.settings.timezone) }}</strong>
      </div>
      <div>
        <small>Harga</small><strong>{{ money(order.price) }}</strong>
      </div>
    </div>
    <p class="scope-note">{{ order.notes || 'Belum ada catatan lingkup.' }}</p>
    <div class="detail-columns">
      <section>
        <div class="section-heading">
          <h3>Checklist pekerjaan</h3>
          <span>{{ order.checklist.filter((c) => c.done).length }}/{{ order.checklist.length }}</span>
        </div>
        <label v-for="c in order.checklist" :key="c.id" class="check-row"
          ><input type="checkbox" v-model="c.done" @change="store.invalidate(order)" /><span>{{
            c.label
          }}</span></label
        >
        <div v-if="!order.checklist.length" class="empty-small">Layanan ini belum memiliki checklist.</div>
        <div class="section-heading">
          <h3>Revisi</h3>
          <span>{{ order.revisions.filter((r) => !r.resolved).length }} terbuka</span>
        </div>
        <label v-for="r in order.revisions" :key="r.id" class="check-row"
          ><input type="checkbox" v-model="r.resolved" @change="store.invalidate(order)" /><span
            >{{ r.note }}<small>{{ prettyDate(r.createdAt, w.settings.timezone) }}</small></span
          ></label
        >
        <form class="inline-form" @submit.prevent="addRevision">
          <input
            v-model="revision"
            maxlength="12000"
            placeholder="Catatan perbaikan..."
            aria-label="Catatan revisi"
          /><button type="submit">Tambah</button>
        </form>
        <div class="approval-box">
          <ShieldCheck :size="22" />
          <div>
            <strong>Pemeriksaan hasil</strong>
            <p>Checklist dan file hasil diperlukan untuk persetujuan.</p>
            <div class="approval-actions">
              <button :disabled="order.qcApproved" @click="run(() => store.approve(order, 'quality'))">
                {{ order.qcApproved ? 'QC disetujui' : 'Setujui sebagai QC' }}</button
              ><button
                :disabled="order.ceoApproved || !order.qcApproved"
                @click="run(() => store.approve(order, 'ceo'))"
              >
                {{ order.ceoApproved ? 'CEO disetujui' : 'Setujui sebagai CEO' }}
              </button>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div class="section-heading">
          <h3>File pekerjaan</h3>
          <span>Privat / maksimal 20 MB</span>
        </div>
        <div class="file-upload">
          <select v-model="category" aria-label="Kategori file">
            <option value="source">File sumber</option>
            <option value="result">File hasil</option></select
          ><label class="upload-button"
            ><Upload :size="16" /> {{ busy ? 'Mengunggah...' : 'Unggah file'
            }}<input
              type="file"
              multiple
              :disabled="busy"
              accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.tsv,.pptx,.txt,.png,.jpg,.jpeg,.webp"
              @change="upload"
          /></label>
        </div>
        <div v-for="f in order.files" :key="f.id" class="file-row">
          <FileText :size="20" />
          <div>
            <strong>{{ f.name }}</strong
            ><small
              >{{ f.category === 'source' ? 'Sumber' : 'Hasil' }} / {{ (f.size / 1024).toFixed(1) }} KB /
              {{ f.backend }}</small
            >
          </div>
          <button
            v-if="/\.(pdf|png|jpe?g|webp)$/i.test(f.name)"
            class="icon-button"
            aria-label="Pratinjau file"
            @click="openFile(f, true)"
          >
            <Eye :size="16" /></button
          ><button class="icon-button" aria-label="Unduh file" @click="openFile(f)">
            <Download :size="16" /></button
          ><button
            class="icon-button"
            aria-label="Hapus file"
            @click="confirm('Hapus file ini?') && run(() => store.removeFile(order, f))"
          >
            <Trash2 :size="15" />
          </button>
        </div>
        <div v-if="!order.files.length" class="empty-small">
          Belum ada file. Mulai dengan bahan dari pelanggan.
        </div>
        <div class="payment-box">
          <div>
            <small>Pembayaran diterima</small><strong>{{ money(order.paid) }}</strong
            ><span>Sisa {{ money(order.price - order.paid) }}</span>
          </div>
          <label
            >Catat nominal (Rp)<input
              :value="order.paid"
              type="number"
              min="0"
              :max="order.price"
              @change="payment"
          /></label>
        </div>
        <p class="form-note">Pencatatan manual. Pembayaran tidak ditagih otomatis.</p>
      </section>
    </div>
    <div class="section-heading">
      <h3>Riwayat pekerjaan</h3>
      <span>{{ prettyDate(order.updatedAt, w.settings.timezone) }}</span>
    </div>
    <ol class="activity-list">
      <li v-for="l in logs" :key="l.id">
        <i /><span
          >{{ l.message }}<small>{{ prettyDate(l.at, w.settings.timezone) }}</small></span
        >
      </li>
    </ol>
    <div class="detail-footer">
      <button class="text-button danger" @click="archive"><Archive :size="16" /> Arsipkan</button
      ><button
        class="primary"
        :disabled="phaseOf(w, order) === 'done'"
        @click="run(() => store.setPhase(order, w.workflows.find((f) => f.phase === 'done')!.id))"
      >
        <CheckCircle2 :size="17" /> Selesaikan pesanan
      </button>
    </div>
  </div>
</template>
