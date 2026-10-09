import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { seed } from './seed'
import { uid, type Order, type Phase, type Workspace, type FileRecord } from './types'
import { phaseOf, transitionError, validateWorkspace, sameWorkspace } from './domain'
import { cloud, loadCloud, saveCloud } from './cloud'
import { getBlob, putBlob, deleteBlob, backup, download, readBackup } from './files'
import { dateISO } from './dates'

const LOCAL_KEY = 'rn-group.workspace.v1'
export const useOffice = defineStore('office', () => {
  let initial = seed(),
    loadError = ''
  try {
    const s = localStorage.getItem(LOCAL_KEY)
    if (s) initial = validateWorkspace(JSON.parse(s))
    const fixedSofa = initial.objects.find((o) => o.id === 'sofa-ceo')
    if (fixedSofa?.x === -8.3 && !fixedSofa.movable) fixedSofa.x = -8.1
  } catch {
    loadError =
      'Data lokal tidak dapat dibaca. Data contoh dibuka; data sebelumnya belum ditimpa. Ekspor/pulihkan cadangan sebelum menyimpan.'
  }
  const workspace = ref<Workspace>(initial),
    toast = ref(loadError),
    localSaved = ref(!loadError),
    cloudState = ref('Belum terhubung'),
    userEmail = ref(''),
    userId = ref(''),
    connected = ref(false),
    dirty = ref(false),
    busy = ref(false),
    revision = ref(0),
    cloudConflict = ref(false),
    recoveryAvailable = ref(false)
  void getBlob('rn-recovery-zip')
    .then((blob) => (recoveryAvailable.value = !!blob))
    .catch(() => {})
  let persistTimer: ReturnType<typeof setTimeout>,
    suppress = false
  watch(
    workspace,
    () => {
      if (suppress) return
      dirty.value = true
      localSaved.value = false
      clearTimeout(persistTimer)
      persistTimer = setTimeout(persist, 300)
    },
    { deep: true },
  )
  function notify(message: string) {
    toast.value = message
    if (workspace.value.settings.sound) {
      try {
        const ctx = new AudioContext(),
          osc = ctx.createOscillator(),
          gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        gain.gain.setValueAtTime(0.025, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.frequency.value = 650
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
        osc.onended = () => ctx.close()
      } catch {}
    }
  }
  function persist() {
    if (loadError) return
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(workspace.value))
      localSaved.value = true
    } catch {
      notify('Penyimpanan lokal penuh atau diblokir. Unduh cadangan.')
      localSaved.value = false
    }
  }
  function log(message: string, orderId?: string, roleId?: string) {
    workspace.value.logs.unshift({ id: uid('log'), at: new Date().toISOString(), message, orderId, roleId })
    workspace.value.logs = workspace.value.logs.slice(0, 500)
  }
  persist()
  const activeOrders = computed(() => workspace.value.orders.filter((o) => !o.archived))
  const outstanding = computed(() => activeOrders.value.filter((o) => phaseOf(workspace.value, o) !== 'done'))
  const income = computed(() => workspace.value.orders.reduce((s, o) => s + o.paid, 0))
  function setPhase(o: Order, statusId: string) {
    const flow = workspace.value.workflows.find((f) => f.id === statusId)
    if (!flow || !flow.active) throw Error('Tahapan tidak tersedia.')
    const error = transitionError(workspace.value, o, flow.phase)
    if (error) throw Error(error)
    if (flow.phase !== 'done' && flow.phase !== 'review') {
      o.qcApproved = false
      o.ceoApproved = false
    }
    o.statusId = statusId
    touch(o)
    log(`${o.title}: ${flow.label}`, o.id, o.roleId)
  }
  function touch(o: Order) {
    o.updatedAt = new Date().toISOString()
  }
  function invalidate(o: Order) {
    o.qcApproved = false
    o.ceoApproved = false
    if (phaseOf(workspace.value, o) === 'done') {
      o.statusId = workspace.value.workflows.find((f) => f.phase === 'revision')!.id
      log('Pesanan dibuka ulang karena hasil berubah.', o.id)
    }
    touch(o)
  }
  function createOrder(input: {
    title: string
    customer: string
    contact: string
    serviceId: string
    roleId: string
    due: string
    priority: 'normal' | 'high'
    notes: string
    price: number
  }) {
    if (!input.title.trim() || !input.customer.trim()) throw Error('Judul dan nama pelanggan wajib diisi.')
    const service = workspace.value.services.find((s) => s.id === input.serviceId && s.active),
      role = workspace.value.roles.find((r) => r.id === input.roleId && r.active)
    if (!service || !role) throw Error('Pilih layanan dan role aktif.')
    if (!Number.isFinite(input.price) || input.price < 0) throw Error('Harga tidak valid.')
    const now = new Date().toISOString(),
      o: Order = {
        ...input,
        due: dateISO(input.due, workspace.value.settings.timezone),
        id: uid('order'),
        statusId: workspace.value.workflows.find((f) => f.phase === 'new')!.id,
        paid: 0,
        checklist: service.checklist.map((label) => ({ id: uid('check'), label, done: false })),
        revisions: [],
        files: [],
        createdAt: now,
        updatedAt: now,
        archived: false,
        qcApproved: false,
        ceoApproved: false,
      }
    workspace.value.orders.unshift(o)
    log(`Pesanan baru: ${o.title}`, o.id, o.roleId)
    return o
  }
  function approve(o: Order, kind: 'quality' | 'ceo') {
    if (
      phaseOf(workspace.value, o) !== 'review' ||
      !o.checklist.every((c) => c.done) ||
      o.revisions.some((r) => !r.resolved) ||
      !o.files.some((f) => f.category === 'result')
    )
      throw Error('Pemeriksaan membutuhkan checklist selesai, revisi tuntas, dan file hasil.')
    if (kind === 'ceo' && !o.qcApproved) throw Error('Quality Control harus menyetujui dahulu.')
    if (kind === 'ceo') o.ceoApproved = true
    else o.qcApproved = true
    touch(o)
    log(`${kind === 'ceo' ? 'CEO' : 'Quality Control'} menyetujui ${o.title}`, o.id)
  }
  async function upload(o: Order, file: File, category: FileRecord['category']) {
    if (file.size > 20 * 1024 * 1024) throw Error('Maksimal 20 MB per file.')
    const allowed = /\.(pdf|docx|doc|xlsx|xls|csv|tsv|pptx|txt|png|jpe?g|webp)$/i
    if (!allowed.test(file.name))
      throw Error('Format: PDF, Word, spreadsheet, PowerPoint, teks, atau gambar.')
    const f: FileRecord = {
      id: uid('file'),
      orderId: o.id,
      name: file.name.slice(0, 200),
      size: file.size,
      type: file.type,
      category,
      backend: 'local',
      createdAt: new Date().toISOString(),
    }
    await putBlob(f.id, file)
    if (connected.value && cloud) {
      f.path = `${userId.value}/${o.id}/${f.id}`
      const result = await cloud.storage.from('rn-files').upload(f.path, file, { upsert: false })
      if (result.error) {
        await deleteBlob(f.id)
        throw result.error
      }
      f.backend = 'cloud'
    }
    o.files.push(f)
    invalidate(o)
    log(`File ${category === 'source' ? 'sumber' : 'hasil'}: ${f.name}`, o.id)
  }
  async function blobFor(id: string): Promise<Blob | undefined> {
    const f = workspace.value.orders.flatMap((o) => o.files).find((f) => f.id === id)
    const cached = await getBlob(id).catch(() => undefined)
    if (cached) return cached
    if (f?.backend === 'cloud' && f.path && cloud) {
      const { data, error } = await cloud.storage.from('rn-files').download(f.path)
      if (error) throw error
      await putBlob(id, data).catch(() => {})
      return data
    }
    return getBlob(id)
  }
  async function removeFile(o: Order, f: FileRecord) {
    if (f.backend === 'cloud' && f.path && cloud) {
      const r = await cloud.storage.from('rn-files').remove([f.path])
      if (r.error) throw r.error
    }
    await deleteBlob(f.id)
    o.files = o.files.filter((x) => x.id !== f.id)
    invalidate(o)
    log(`File dihapus: ${f.name}`, o.id)
  }
  async function exportBackup(automatic = true) {
    const data = await backup(JSON.parse(JSON.stringify(workspace.value)), blobFor)
    if (automatic) download(data, `RN-GROUP-${new Date().toISOString().slice(0, 10)}.zip`)
    notify('Cadangan ZIP siap beserta seluruh file.')
    return data
  }
  async function preserveRecovery() {
    const data = await exportBackup()
    await putBlob('rn-recovery-zip', data)
    recoveryAvailable.value = true
  }
  async function importBackup(file: File) {
    if (connected.value) throw Error('Keluar dari cloud sebelum mengimpor cadangan lokal.')
    const incoming = await readBackup(file)
    await preserveRecovery()
    // Fresh IDs keep old file blobs intact until the complete import is saved.
    for (const o of incoming.workspace.orders)
      for (const f of o.files) {
        const blob = incoming.blobs.get(f.id)!
        f.id = uid('file')
        await putBlob(f.id, blob)
      }
    loadError = ''
    workspace.value = incoming.workspace
    persist()
    notify('Cadangan dipulihkan. Pemulihan data sebelumnya tersedia.')
  }
  async function restoreRecovery() {
    if (connected.value) throw Error('Keluar dari cloud sebelum memulihkan data lokal.')
    const blob = await getBlob('rn-recovery-zip')
    if (!blob) throw Error('Cadangan pemulihan tidak tersedia.')
    await importBackup(new File([blob], 'recovery.zip'))
  }
  async function auth(email: string, password: string, register = false) {
    if (!cloud) throw Error('Konfigurasi Supabase tidak ada.')
    const r = register
      ? await cloud.auth.signUp({ email, password })
      : await cloud.auth.signInWithPassword({ email, password })
    if (r.error) throw r.error
    if (register && !r.data.session) {
      notify('Periksa email untuk konfirmasi akun.')
      return
    }
    await connect()
  }
  async function connect() {
    if (!cloud) return
    const {
      data: { user },
    } = await cloud.auth.getUser()
    if (!user) return
    connected.value = false
    userId.value = user.id
    userEmail.value = user.email ?? ''
    cloudState.value = 'Memeriksa cloud'
    try {
      const snapshot = await loadCloud()
      if (snapshot) {
        // Never replace unsynced local work automatically on login/reload.
        const localOwner = localStorage.getItem('rn-group.cloud-owner')
        if (localOwner !== user.id || !sameWorkspace(snapshot.data, workspace.value)) {
          cloudConflict.value = true
          cloudState.value = 'Pilih data cloud atau lokal'
          revision.value = snapshot.revision
          return
        }
        revision.value = snapshot.revision
      } else revision.value = 0
      connected.value = true
      dirty.value = !snapshot
      cloudConflict.value = false
      cloudState.value = snapshot ? 'Cloud siap' : 'Cloud kosong; siap diunggah'
    } catch (e) {
      cloudState.value = 'Migrasi / koneksi belum siap'
      notify(errorMessage(e))
    }
  }
  async function useCloudSnapshot() {
    if (!cloud) return
    await preserveRecovery()
    const snapshot = await loadCloud()
    if (!snapshot) throw Error('Cloud kosong.')
    suppress = true
    workspace.value = snapshot.data
    revision.value = snapshot.revision
    await Promise.resolve()
    suppress = false
    loadError = ''
    persist()
    connected.value = true
    dirty.value = false
    cloudConflict.value = false
    localStorage.setItem('rn-group.cloud-owner', userId.value)
    cloudState.value = 'Tersinkron'
    notify('Data cloud dibuka. Cadangan lokal diunduh dahulu.')
  }
  async function publishLocal() {
    connected.value = true
    cloudConflict.value = false
    await sync()
  }
  async function sync() {
    if (!connected.value || !cloud) throw Error('Masuk dan hubungkan cloud dahulu.')
    if (busy.value) return
    busy.value = true
    cloudState.value = 'Menyinkronkan'
    try {
      for (const o of workspace.value.orders)
        for (const f of o.files)
          if (f.backend === 'local') {
            const blob = await getBlob(f.id)
            if (!blob) throw Error(`File lokal tidak ditemukan: ${f.name}`)
            const path = `${userId.value}/${o.id}/${f.id}`
            const r = await cloud.storage.from('rn-files').upload(path, blob, { upsert: true })
            if (r.error) throw r.error
            f.path = path
            f.backend = 'cloud'
          }
      const serialized = JSON.stringify(workspace.value)
      revision.value = await saveCloud(JSON.parse(serialized), revision.value)
      dirty.value = JSON.stringify(workspace.value) !== serialized
      persist()
      cloudState.value = dirty.value ? 'Perubahan baru belum tersinkron' : 'Tersinkron'
      localStorage.setItem('rn-group.cloud-owner', userId.value)
      notify('Data tersimpan di Supabase.')
    } catch (e) {
      const message = errorMessage(e)
      cloudState.value = 'Sinkronisasi gagal'
      if (message.includes('RN_CONFLICT')) {
        cloudConflict.value = true
        await connect()
      }
      throw e
    } finally {
      busy.value = false
    }
  }
  async function logout() {
    if (cloud) await cloud.auth.signOut()
    connected.value = false
    userEmail.value = ''
    userId.value = ''
    cloudConflict.value = false
    cloudState.value = 'Mode lokal'
    localStorage.removeItem('rn-group.cloud-owner')
  }
  function toggleRole(id: string, active: boolean) {
    const r = workspace.value.roles.find((r) => r.id === id)!
    if (r.kind === 'ceo' && !active) throw Error('CEO harus tetap aktif.')
    if (!active && outstanding.value.some((o) => o.roleId === id))
      throw Error('Pindahkan pesanan aktif sebelum menonaktifkan role.')
    r.active = active
    log(`${r.title}: ${active ? 'aktif' : 'nonaktif'}`, undefined, id)
  }
  function clearDemo() {
    if (!workspace.value.demo) return
    workspace.value.orders = workspace.value.orders.filter((o) => !o.id.startsWith('sample-'))
    workspace.value.leads = workspace.value.leads.filter((x) => x.id !== 'lead-example')
    workspace.value.demo = false
    log('Data contoh dihapus. Kantor siap menerima pesanan.')
  }
  return {
    workspace,
    toast,
    notify,
    log,
    localSaved,
    cloudState,
    cloudConflict,
    userEmail,
    userId,
    connected,
    dirty,
    busy,
    activeOrders,
    outstanding,
    income,
    setPhase,
    touch,
    invalidate,
    createOrder,
    approve,
    upload,
    blobFor,
    removeFile,
    exportBackup,
    recoveryAvailable,
    restoreRecovery,
    importBackup,
    auth,
    connect,
    useCloudSnapshot,
    publishLocal,
    sync,
    logout,
    toggleRole,
    clearDemo,
    persist,
  }
})
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useOffice, import.meta.hot))
export function errorMessage(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === 'object' && e && 'message' in e
      ? String(e.message)
      : String(e)
}
