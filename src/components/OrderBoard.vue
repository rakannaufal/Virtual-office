<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Plus, LayoutList, Columns3, Clock } from 'lucide-vue-next'
import { useOffice } from '../lib/store'
import { money, prettyDate } from '../lib/types'
const emit = defineEmits<{ select: [id: string]; newOrder: [] }>(),
  store = useOffice(),
  w = computed(() => store.workspace),
  search = ref(''),
  role = ref(''),
  mode = ref<'board' | 'list'>('board'),
  archived = ref(false)
const filtered = computed(() =>
  w.value.orders.filter(
    (o) =>
      o.archived === archived.value &&
      (!role.value || o.roleId === role.value) &&
      `${o.title} ${o.customer}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
</script>
<template>
  <div class="page-heading">
    <div>
      <small class="eyebrow">WORKFLOW / OPERATIONS</small>
      <h1>Semua pekerjaan.<br /><span>Jelas arahnya.</span></h1>
      <p>Dari bahan masuk sampai hasil siap dikirim.</p>
    </div>
    <button class="primary" @click="emit('newOrder')"><Plus :size="18" /> Pesanan baru</button>
  </div>
  <div class="toolbar">
    <label class="search-input"
      ><Search :size="17" /><input
        v-model="search"
        placeholder="Cari pekerjaan atau pelanggan"
        aria-label="Cari pesanan" /></label
    ><select v-model="role" aria-label="Filter role">
      <option value="">Semua role</option>
      <option v-for="r in w.roles" :value="r.id">{{ r.title }}</option></select
    ><label class="check-inline"><input type="checkbox" v-model="archived" /> Arsip</label>
    <div class="view-toggle">
      <button :class="{ selected: mode === 'board' }" aria-label="Papan" @click="mode = 'board'">
        <Columns3 :size="17" /></button
      ><button :class="{ selected: mode === 'list' }" aria-label="Daftar" @click="mode = 'list'">
        <LayoutList :size="17" />
      </button>
    </div>
  </div>
  <div v-if="mode === 'board'" class="kanban">
    <section v-for="f in w.workflows.filter((f) => f.active)" :key="f.id" class="kanban-column">
      <header>
        <i :style="{ background: f.color }" />
        <h3>{{ f.label }}</h3>
        <span>{{ filtered.filter((o) => o.statusId === f.id).length }}</span>
      </header>
      <button
        v-for="o in filtered.filter((o) => o.statusId === f.id)"
        :key="o.id"
        class="order-card"
        @click="emit('select', o.id)"
      >
        <span class="service-tag"
          >{{ w.services.find((s) => s.id === o.serviceId)?.name
          }}<b v-if="o.priority === 'high'">Prioritas</b></span
        >
        <h4>{{ o.title }}</h4>
        <p>{{ o.customer }}</p>
        <div class="progress-track">
          <i
            :style="{
              width:
                (o.checklist.length
                  ? (o.checklist.filter((c) => c.done).length / o.checklist.length) * 100
                  : 0) + '%',
            }"
          />
        </div>
        <div class="card-footer">
          <span>{{ w.roles.find((r) => r.id === o.roleId)?.name }}</span
          ><small><Clock :size="12" />{{ prettyDate(o.due, w.settings.timezone) }}</small>
        </div>
      </button>
      <div v-if="!filtered.some((o) => o.statusId === f.id)" class="kanban-empty">Belum ada pekerjaan</div>
    </section>
  </div>
  <div v-else class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Pekerjaan / pelanggan</th>
          <th>Role</th>
          <th>Tahapan</th>
          <th>Tenggat</th>
          <th>Harga</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in filtered" :key="o.id">
          <td>
            <strong>{{ o.title }}</strong
            ><small>{{ o.customer }}</small>
          </td>
          <td>{{ w.roles.find((r) => r.id === o.roleId)?.title }}</td>
          <td>
            <span class="badge">{{ w.workflows.find((f) => f.id === o.statusId)?.label }}</span>
          </td>
          <td>{{ prettyDate(o.due, w.settings.timezone) }}</td>
          <td>{{ money(o.price) }}</td>
          <td><button class="text-button" @click="emit('select', o.id)">Buka</button></td>
        </tr>
      </tbody>
    </table>
    <div v-if="!filtered.length" class="empty-small">Belum ada pesanan pada filter ini.</div>
  </div>
</template>
