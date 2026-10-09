<script setup lang="ts">
import { computed, ref } from 'vue'
import { Monitor, FolderOpen, CheckSquare, Activity, ArrowUpRight } from 'lucide-vue-next'
import { useOffice } from '../lib/store'
import { money, prettyDate } from '../lib/types'
import { roleOrders, actionOrders } from '../lib/roleSummary'
const props = defineProps<{ roleId: string }>(),
  emit = defineEmits<{ order: [id: string]; navigate: [view: string] }>(),
  store = useOffice(),
  w = computed(() => store.workspace),
  role = computed(() => w.value.roles.find((r) => r.id === props.roleId)!),
  tab = ref('tasks')
const orders = computed(() => roleOrders(w.value, role.value)),
  files = computed(() => orders.value.flatMap((o) => o.files.map((f) => ({ ...f, title: o.title })))),
  logs = computed(() =>
    w.value.logs
      .filter((l) => l.roleId === role.value.id || orders.value.some((o) => o.id === l.orderId))
      .slice(0, 30),
  )
</script>
<template>
  <div class="desktop-banner">
    <div class="avatar-initial large" :style="{ background: role.shirt }">{{ role.name[0] }}</div>
    <div>
      <span class="eyebrow">KOMPUTER / {{ role.title }}</span>
      <h2>{{ role.name }}'s workspace</h2>
      <p>{{ role.responsibility }}</p>
    </div>
    <Monitor :size="36" />
  </div>
  <div v-if="role.kind === 'ceo'" class="desktop-metrics">
    <div>
      <small>Pemasukan tercatat</small><strong>{{ money(store.income) }}</strong>
    </div>
    <div>
      <small>Menunggu CEO</small><strong>{{ actionOrders(w, role).length }}</strong>
    </div>
    <div>
      <small>Belum selesai</small><strong>{{ store.outstanding.length }}</strong>
    </div>
  </div>
  <div class="tabs">
    <button :class="{ active: tab === 'tasks' }" @click="tab = 'tasks'">
      <CheckSquare :size="16" /> Tugas</button
    ><button :class="{ active: tab === 'files' }" @click="tab = 'files'">
      <FolderOpen :size="16" /> File & hasil</button
    ><button :class="{ active: tab === 'activity' }" @click="tab = 'activity'">
      <Activity :size="16" /> Aktivitas
    </button>
  </div>
  <div v-if="tab === 'tasks'">
    <div v-if="role.kind === 'marketing'" class="desktop-callout">
      <div>
        <h3>Promosi tanpa modal iklan</h3>
        <p>
          {{ w.leads.length }} calon pelanggan / {{ w.campaigns.length }} draf promosi. Siapkan materi dan
          salin saat siap.
        </p>
      </div>
      <button class="primary" @click="emit('navigate', 'marketing')">
        Buka pemasaran <ArrowUpRight :size="16" />
      </button>
    </div>
    <button v-for="o in orders" :key="o.id" class="task-row" @click="emit('order', o.id)">
      <span class="task-marker" />
      <div>
        <strong>{{ o.title }}</strong
        ><small>{{ o.customer }} / {{ prettyDate(o.due, w.settings.timezone) }}</small>
      </div>
      <span class="badge">{{ w.workflows.find((f) => f.id === o.statusId)?.label }}</span
      ><ArrowUpRight :size="17" />
    </button>
    <div v-if="!orders.length" class="empty-state">
      <CheckSquare :size="30" />
      <h3>Meja sedang tenang</h3>
      <p>Belum ada tugas untuk role ini. Karakter bisa beristirahat.</p>
    </div>
  </div>
  <div v-if="tab === 'files'">
    <button v-for="f in files" :key="f.id" class="task-row" @click="emit('order', f.orderId)">
      <FolderOpen :size="20" />
      <div>
        <strong>{{ f.name }}</strong
        ><small>{{ f.title }} / {{ f.category === 'source' ? 'Sumber' : 'Hasil' }}</small>
      </div>
      <ArrowUpRight :size="17" />
    </button>
    <div v-if="!files.length" class="empty-small">File muncul setelah diunggah melalui pesanan.</div>
  </div>
  <ol v-if="tab === 'activity'" class="activity-list">
    <li v-for="l in logs" :key="l.id">
      <i /><span
        >{{ l.message }}<small>{{ prettyDate(l.at, w.settings.timezone) }}</small></span
      >
    </li>
    <li v-if="!logs.length">Belum ada aktivitas tercatat.</li>
  </ol>
  <p class="desktop-note">
    Desktop virtual berisi data aplikasi. Seluruh role dikelola pemilik; avatar tidak mengerjakan file
    otomatis.
  </p>
</template>
