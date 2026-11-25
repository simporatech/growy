import type { UserProfile } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type CloudSyncStatus = 'local_only' | 'synced' | 'syncing' | 'offline';

interface UserVaultRow {
  user_id: string;
  payload: Partial<UserProfile> | null;
  updated_at: string;
}

const SYNC_TS_PREFIX = 'growy_cloud_sync_at_';

export function getLastSyncedAt(userId: string): string | null {
  try {
    return localStorage.getItem(`${SYNC_TS_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export function setLastSyncedAt(userId: string, isoTimestamp: string): void {
  try {
    localStorage.setItem(`${SYNC_TS_PREFIX}${userId}`, isoTimestamp);
  } catch {
    // ignore storage quota errors
  }
}

export function hasLocalFinancialData(profile: UserProfile): boolean {
  const d = profile.data;
  return (
    d.accounts.length > 0 ||
    d.transactions.length > 0 ||
    d.budgets.length > 0 ||
    d.subscriptions.length > 0 ||
    (d.loans?.length ?? 0) > 0
  );
}

export async function fetchCloudVault(
  userId: string
): Promise<{ payload: Partial<UserProfile>; updatedAt: string } | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('user_vaults')
    .select('user_id, payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle<UserVaultRow>();

  if (error || !data || !data.payload) {
    if (error) throw error;
    return null;
  }

  return {
    payload: data.payload,
    updatedAt: data.updated_at,
  };
}

export async function pushCloudVault(profile: UserProfile): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('user_vaults')
    .upsert(
      {
        user_id: profile.id,
        payload: profile,
      },
      { onConflict: 'user_id' }
    )
    .select('updated_at')
    .single<{ updated_at: string }>();

  if (error) throw error;
  const updatedAt = data?.updated_at ?? new Date().toISOString();
  setLastSyncedAt(profile.id, updatedAt);
  return updatedAt;
}

export async function deleteCloudVault(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('user_vaults').delete().eq('user_id', userId);
}

export async function reconcileCloudAndLocal(
  localProfile: UserProfile
): Promise<{
  action: 'hydrated_from_cloud' | 'migrated_to_cloud' | 'up_to_date';
  payload?: Partial<UserProfile>;
  updatedAt?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { action: 'up_to_date' };
  }

  const cloud = await fetchCloudVault(localProfile.id);
  const localSyncedAt = getLastSyncedAt(localProfile.id);

  if (cloud) {
    const cloudMs = Date.parse(cloud.updatedAt) || 0;
    const localMs = localSyncedAt ? Date.parse(localSyncedAt) || 0 : 0;

    if (!localSyncedAt || cloudMs > localMs) {
      setLastSyncedAt(localProfile.id, cloud.updatedAt);
      return {
        action: 'hydrated_from_cloud',
        payload: cloud.payload,
        updatedAt: cloud.updatedAt,
      };
    }

    return { action: 'up_to_date', updatedAt: localSyncedAt };
  }

  // First-time migration from local-only to cloud
  if (hasLocalFinancialData(localProfile)) {
    const pushedAt = await pushCloudVault(localProfile);
    return {
      action: 'migrated_to_cloud',
      updatedAt: pushedAt ?? undefined,
    };
  }

  // Brand-new account: seed empty vault in cloud
  const pushedAt = await pushCloudVault(localProfile);
  return {
    action: 'migrated_to_cloud',
    updatedAt: pushedAt ?? undefined,
  };
}

