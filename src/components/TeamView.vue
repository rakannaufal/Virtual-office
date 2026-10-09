<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pencil, Monitor, Users, Check } from 'lucide-vue-next'
import { useOffice, errorMessage } from '../lib/store'
import type { Role } from '../lib/types'
import { models } from '../lib/seed'
import Modal from './Modal.vue'
const emit = defineEmits<{ select: [id: string] }>(),
  store = useOffice(),
  w = computed(() => store.workspace),
  draft = ref<Role | null>(null)
function edit(role: Role) {
  draft.value = JSON.parse(JSON.stringify(role))
}
function save() {
  const d = draft.value!
  if (!d.name.trim() || !d.title.trim()) return store.notify('Nama dan jabatan wajib diisi.')
  try {
    store.toggleRole(d.id, d.active)
    const r = w.value.roles.find((r) => r.id === d.id)!
    Object.assign(r, d, { name: d.name.trim(), title: d.title.trim() })
    store.log(`Profil ${r.name} diperbarui.`, undefined, r.id)
    draft.value = null
    store.notify('Role diperbarui. Pesanan tetap terhubung.')
  } catch (e) {
    store.notify(errorMessage(e))
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">PEOPLE / RESPONSIBILITIES</span>
      <h1>Tim virtual.<br /><span>Kendali tetap di tangan Anda.</span></h1>
      <p>Enam pembagian tugas. Mulai dengan satu orang: Anda sendiri.</p>
    </div>
    <span class="outline-pill"
      ><Users :size="17" /> {{ w.roles.filter((r) => r.active).length }} role aktif</span
    >
  </div>
  <div class="team-grid">
    <article v-for="r in w.roles" :key="r.id" class="team-card" :class="{ muted: !r.active }">
      <div class="team-card-top">
        <div class="avatar-portrait" :style="{ '--shirt': r.shirt, '--skin': r.skin, '--hair': r.hair }">
          <div class="portrait-head" />
          <div class="portrait-body" />
        </div>
        <span class="badge">{{ r.kind === 'ceo' ? 'Owner' : r.active ? 'Aktif' : 'Nonaktif' }}</span>
      </div>
      <span class="eyebrow">{{ r.title }}</span>
      <h2>{{ r.name }}</h2>
      <p>{{ r.responsibility }}</p>
      <div class="team-card-foot">
        <span>{{ store.outstanding.filter((o) => o.roleId === r.id).length }} tugas ditugaskan</span
        ><span>{{
          r.kind === 'ceo' ? 'Kendali Anda' : r.automatic ? 'Rutinitas aktif' : 'Rutinitas mati'
        }}</span>
      </div>
      <div class="button-row">
        <button @click="edit(r)"><Pencil :size="15" /> Edit role</button
        ><button class="text-button" @click="emit('select', r.id)">
          <Monitor :size="15" /> Buka komputer
        </button>
      </div>
    </article>
  </div>
  <Modal v-if="draft" :title="'Edit / ' + draft.title" @close="draft = null"
    ><form class="form-grid" @submit.prevent="save">
      <label>Nama<input v-model="draft.name" required maxlength="200" /></label
      ><label>Jabatan<input v-model="draft.title" required maxlength="200" /></label
      ><label class="full"
        >Tanggung jawab<textarea v-model="draft.responsibility" rows="3" maxlength="12000" /></label
      ><label class="full"
        >Gaya pakaian dan rambut chibi<select v-model="draft.model">
          <option v-for="m in models" :value="m">{{ m }}</option>
        </select></label
      ><label>Warna pakaian<input type="color" v-model="draft.shirt" /></label
      ><label>Warna kulit<input type="color" v-model="draft.skin" /></label
      ><label>Warna rambut<input type="color" v-model="draft.hair" /></label
      ><label class="check-inline"
        ><input type="checkbox" v-model="draft.automatic" :disabled="draft.kind === 'ceo'" /> Rutinitas
        otomatis</label
      ><label class="check-inline full"
        ><input type="checkbox" v-model="draft.active" :disabled="draft.kind === 'ceo'" /> Role aktif</label
      >
      <p class="form-note full">
        ID dan fungsi internal tetap stabil ketika nama diubah. CEO selalu aktif. Nonaktifkan role setelah
        memindahkan seluruh pesanan aktifnya.
      </p>
      <button class="primary full" type="submit"><Check :size="16" /> Simpan profil</button>
    </form></Modal
  >
</template>
