<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useOffice, errorMessage } from '../lib/store'
const emit = defineEmits<{ created: [id: string] }>(),
  store = useOffice(),
  w = computed(() => store.workspace)
const form = reactive({
  title: '',
  customer: '',
  contact: '',
  serviceId: w.value.services.find((s) => s.active)?.id ?? '',
  roleId: w.value.roles.find((r) => r.kind === 'documents' && r.active)?.id ?? 'ceo',
  due: '',
  priority: 'normal' as 'normal' | 'high',
  notes: '',
  price: w.value.services.find((s) => s.active)?.price ?? 0,
})
watch(
  () => form.serviceId,
  (id) => {
    form.price = w.value.services.find((s) => s.id === id)?.price ?? 0
    form.roleId =
      w.value.roles.find((r) => r.kind === (id === 'data' ? 'data' : 'documents') && r.active)?.id ?? 'ceo'
  },
)
function submit() {
  try {
    const o = store.createOrder(form)
    emit('created', o.id)
  } catch (e) {
    store.notify(errorMessage(e))
  }
}
</script>
<template>
  <form class="form-grid" @submit.prevent="submit">
    <label class="full"
      >Judul pekerjaan<input
        v-model="form.title"
        required
        maxlength="200"
        placeholder="Contoh: Rapikan CV untuk lamaran" /></label
    ><label>Nama pelanggan<input v-model="form.customer" required maxlength="200" /></label
    ><label>Kontak<input v-model="form.contact" maxlength="200" placeholder="WhatsApp atau email" /></label
    ><label
      >Layanan<select v-model="form.serviceId">
        <option v-for="s in w.services.filter((s) => s.active)" :value="s.id">{{ s.name }}</option>
      </select></label
    ><label
      >Penanggung jawab<select v-model="form.roleId">
        <option v-for="r in w.roles.filter((r) => r.active)" :value="r.id">
          {{ r.name }} / {{ r.title }}
        </option>
      </select></label
    ><label>Tenggat<input v-model="form.due" type="datetime-local" /></label
    ><label
      >Harga (Rp)<input v-model.number="form.price" type="number" min="0" max="10000000000" required /></label
    ><label
      >Prioritas<select v-model="form.priority">
        <option value="normal">Normal</option>
        <option value="high">Tinggi</option>
      </select></label
    ><label class="full"
      >Lingkup dan kebutuhan<textarea
        v-model="form.notes"
        rows="3"
        maxlength="12000"
        placeholder="Sumber, hasil yang diminta, batas revisi..."
      />
    </label>
    <p class="form-note full">{{ w.services.find((s) => s.id === form.serviceId)?.scope }}</p>
    <button class="primary full" type="submit">Buat pesanan</button>
  </form>
</template>
