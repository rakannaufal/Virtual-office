import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Workspace } from './types'
import { validateWorkspace } from './domain'

const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const cloud: SupabaseClient | null =
  import.meta.hot?.data.cloud ?? (url && key ? createClient(url, key) : null)
if (import.meta.hot) import.meta.hot.data.cloud = cloud
export async function loadCloud(): Promise<{ data: Workspace; revision: number } | null> {
  if (!cloud) throw Error('Konfigurasi Supabase belum tersedia.')
  const { data, error } = await cloud.from('rn_workspaces').select('data, revision').maybeSingle()
  if (error) throw error
  return data ? { data: validateWorkspace(data.data), revision: data.revision } : null
}
export async function saveCloud(data: Workspace, revision: number): Promise<number> {
  if (!cloud) throw Error('Konfigurasi Supabase belum tersedia.')
  const result = await cloud.rpc('rn_save_workspace', { snapshot: data, expected_revision: revision })
  if (result.error) throw result.error
  return result.data as number
}
