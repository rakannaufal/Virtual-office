<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Plus, Copy, Trash2, Megaphone, ArrowUpRight, Pencil } from 'lucide-vue-next'
import { useOffice, errorMessage } from '../lib/store'
import { money, uid, type Lead, type Campaign } from '../lib/types'
import Modal from './Modal.vue'
const store = useOffice(),
  w = computed(() => store.workspace),
  tab = ref('leads'),
  lead = ref<Lead | null>(null),
  campaign = ref<Campaign | null>(null)
const stageLabels = { new: 'Baru', contacted: 'Dihubungi', interested: 'Tertarik', customer: 'Pelanggan' }
function newLead() {
  lead.value = { id: uid('lead'), name: '', business: '', contact: '', stage: 'new', notes: '' }
}
function saveLead() {
  if (!lead.value?.name.trim()) return
  const index = w.value.leads.findIndex((l) => l.id === lead.value!.id)
  if (index < 0) w.value.leads.unshift(lead.value)
  else w.value.leads[index] = lead.value
  store.log(`Calon pelanggan disimpan: ${lead.value.name}`)
  lead.value = null
}
function newCampaign() {
  campaign.value = {
    id: uid('campaign'),
    title: 'Penawaran jasa',
    channel: 'Status WhatsApp',
    body: `${w.value.settings.company} membantu merapikan CV, dokumen, dan spreadsheet.\n\n${w.value.services
      .filter((s) => s.active)
      .map((s) => `${s.name}: mulai ${money(s.price)}. ${s.scope}`)
      .join(
        '\n',
      )}\n\nHarga akhir setelah bahan diperiksa. Hubungi ${w.value.settings.contact || '[isi kontak Anda]'} untuk penawaran.`,
    createdAt: new Date().toISOString(),
  }
}
function saveCampaign() {
  if (!campaign.value?.title.trim() || !campaign.value.body.trim()) return
  const i = w.value.campaigns.findIndex((c) => c.id === campaign.value!.id)
  if (i < 0) w.value.campaigns.unshift(campaign.value)
  else w.value.campaigns[i] = campaign.value
  store.log(`Draf promosi disimpan: ${campaign.value.title}`)
  campaign.value = null
}
async function copy(body: string) {
  try {
    await navigator.clipboard.writeText(body)
    store.notify('Draf disalin. Kirim sendiri saat siap.')
  } catch (e) {
    store.notify('Clipboard diblokir. Buka edit, lalu salin teks secara manual.')
  }
}
function remove(kind: 'lead' | 'campaign', id: string) {
  if (!window.confirm('Hapus item ini?')) return
  if (kind === 'lead') w.value.leads = w.value.leads.filter((l) => l.id !== id)
  else w.value.campaigns = w.value.campaigns.filter((c) => c.id !== id)
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">CLIENTS / GROWTH</span>
      <h1>Mulai dikenal.<br /><span>Tanpa modal iklan.</span></h1>
      <p>Kelola calon pelanggan. Siapkan draf. Bagikan sendiri.</p>
    </div>
    <Megaphone :size="48" :stroke-width="1" />
  </div>
  <div class="tabs">
    <button :class="{ active: tab === 'leads' }" @click="tab = 'leads'">
      Calon pelanggan <span>{{ w.leads.length }}</span></button
    ><button :class="{ active: tab === 'drafts' }" @click="tab = 'drafts'">
      Draf promosi <span>{{ w.campaigns.length }}</span></button
    ><button :class="{ active: tab === 'portfolio' }" @click="tab = 'portfolio'">Contoh portofolio</button>
  </div>
  <section v-if="tab === 'leads'">
    <div class="section-heading">
      <h2>Jaringan yang bisa dimulai hari ini</h2>
      <button @click="newLead"><Plus :size="16" /> Calon pelanggan</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Usaha / kontak</th>
            <th>Tahapan</th>
            <th>Catatan</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in w.leads" :key="l.id">
            <td>
              <strong>{{ l.name }}</strong>
            </td>
            <td>
              {{ l.business }}<small>{{ l.contact || 'Kontak belum diisi' }}</small>
            </td>
            <td>
              <select v-model="l.stage" @change="store.log('Tahapan calon pelanggan diperbarui: ' + l.name)">
                <option v-for="(label, key) in stageLabels" :value="key">{{ label }}</option>
              </select>
            </td>
            <td>{{ l.notes }}</td>
            <td class="nowrap">
              <button
                class="icon-button"
                aria-label="Edit calon pelanggan"
                @click="lead = JSON.parse(JSON.stringify(l))"
              >
                <Pencil :size="15" /></button
              ><button class="icon-button" aria-label="Hapus calon pelanggan" @click="remove('lead', l.id)">
                <Trash2 :size="15" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!w.leads.length" class="empty-small">
        Mulai dari teman, pencari kerja, atau UMKM yang Anda kenal.
      </div>
    </div>
    <div class="promotion-guide">
      <h3>Rencana promosi pertama</h3>
      <ol>
        <li>Buat tiga contoh fiktif: CV, dokumen, spreadsheet.</li>
        <li>Tampilkan sebelum/sesudah pada status WhatsApp atau Instagram.</li>
        <li>Tawarkan pemeriksaan kebutuhan gratis; sepakati lingkup dan harga.</li>
        <li>Bagikan di komunitas yang mengizinkan promosi.</li>
        <li>Catat respons, tindak lanjuti secara personal, minta izin untuk testimoni.</li>
      </ol>
    </div>
  </section>
  <section v-if="tab === 'drafts'">
    <div class="section-heading">
      <h2>Materi siap dirapikan</h2>
      <button @click="newCampaign"><Plus :size="16" /> Buat draf</button>
    </div>
    <div class="campaign-grid">
      <article v-for="c in w.campaigns" :key="c.id" class="campaign-card">
        <span class="eyebrow">{{ c.channel }}</span>
        <h3>{{ c.title }}</h3>
        <p>{{ c.body }}</p>
        <div class="button-row">
          <button class="primary" @click="copy(c.body)"><Copy :size="15" /> Salin draf</button
          ><button @click="campaign = JSON.parse(JSON.stringify(c))">Edit</button
          ><button class="icon-button" aria-label="Hapus draf" @click="remove('campaign', c.id)">
            <Trash2 :size="15" />
          </button>
        </div>
      </article>
    </div>
    <p class="form-note">Teks hanya disimpan atau disalin. Tidak ada pesan yang dikirim otomatis.</p>
  </section>
  <section v-if="tab === 'portfolio'">
    <div class="portfolio-grid">
      <article class="portfolio-card">
        <span class="eyebrow">CONTOH FIKTIF / CV</span>
        <h3>Lebih mudah dibaca</h3>
        <div class="portfolio-comparison">
          <div>
            <small>SEBELUM</small>
            <p class="messy-text">
              NAMA CONTOH<br />pengalaman sekolah skill kontak<br />semua isi dalam satu paragraf tanpa jarak
              yang konsisten.
            </p>
          </div>
          <div>
            <small>SESUDAH</small>
            <h4>Nama Contoh</h4>
            <span>Administrasi / lulusan baru</span>
            <hr />
            <strong>Profil</strong>
            <p>Isi faktual disusun ringkas.</p>
            <strong>Pengalaman</strong>
            <p>Urutan dan tanggal konsisten.</p>
          </div>
        </div>
      </article>
      <article class="portfolio-card">
        <span class="eyebrow">CONTOH FIKTIF / DATA</span>
        <h3>Angka lebih tertata</h3>
        <div class="portfolio-comparison">
          <div>
            <small>SEBELUM</small>
            <p>
              Kopi , 10000<br />
              kopi, Rp 10.000<br />Teh, 7000
            </p>
          </div>
          <div>
            <small>SESUDAH</small>
            <table>
              <tr>
                <th>Produk</th>
                <th>Harga</th>
              </tr>
              <tr>
                <td>Kopi</td>
                <td>10.000</td>
              </tr>
              <tr>
                <td>Teh</td>
                <td>7.000</td>
              </tr>
            </table>
            <p>Duplikat ditandai; penghapusan menunggu konfirmasi.</p>
          </div>
        </div>
      </article>
      <article class="portfolio-card">
        <span class="eyebrow">CONTOH FIKTIF / DOKUMEN</span>
        <h3>Struktur yang konsisten</h3>
        <div class="portfolio-comparison">
          <div>
            <small>SEBELUM</small>
            <p>judul. isi...<br /><br />SUBjudul<br />spasi tidak seragam</p>
          </div>
          <div>
            <small>SESUDAH</small>
            <h4>Proposal Usaha</h4>
            <strong>01 / Pendahuluan</strong>
            <p>Gaya judul dan spasi seragam.</p>
            <strong>02 / Rencana</strong>
            <p>Tabel dan nomor halaman rapi.</p>
          </div>
        </div>
      </article>
    </div>
    <p class="form-note">
      Pratinjau contoh visual. Data pelanggan hanya boleh menjadi portofolio dengan izin mereka.
    </p>
  </section>
  <Modal v-if="lead" title="Calon pelanggan" @close="lead = null"
    ><form class="form-grid" @submit.prevent="saveLead">
      <label>Nama<input v-model="lead.name" required maxlength="200" /></label
      ><label>Usaha<input v-model="lead.business" maxlength="200" /></label
      ><label class="full">Kontak<input v-model="lead.contact" maxlength="200" /></label
      ><label class="full">Catatan<textarea v-model="lead.notes" maxlength="12000" /></label
      ><button class="primary full">Simpan</button>
    </form></Modal
  ><Modal v-if="campaign" title="Draf promosi" @close="campaign = null"
    ><form class="form-grid" @submit.prevent="saveCampaign">
      <label>Judul<input v-model="campaign.title" required maxlength="200" /></label
      ><label
        >Channel<select v-model="campaign.channel">
          <option>Status WhatsApp</option>
          <option>Instagram</option>
          <option>Komunitas</option>
          <option>Penawaran personal</option>
        </select></label
      ><label class="full"
        >Isi draf<textarea v-model="campaign.body" rows="10" required maxlength="12000" /></label
      ><button class="primary full">Simpan draf</button>
    </form></Modal
  >
</template>
