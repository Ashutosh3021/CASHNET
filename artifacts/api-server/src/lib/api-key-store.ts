/**
 * API Key Store
 *
 * Manages API key generation, validation, rotation, and revocation
 * for external consumers of the CASHNET Intelligence API.
 *
 * MVP: in-memory store. Interface defined for DB-backed persistence later.
 */

import { randomBytes, createHash } from "crypto";

export interface ApiKeyRecord {
  id: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  tier: "free" | "standard" | "enterprise";
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  permissions: string[];
  metadata: Record<string, unknown>;
}

export interface ApiKeyLimits {
  requestsPerMinute: number;
  burst: number;
}

const TIER_LIMITS: Record<string, ApiKeyLimits> = {
  free: { requestsPerMinute: 10, burst: 20 },
  standard: { requestsPerMinute: 100, burst: 200 },
  enterprise: { requestsPerMinute: 1000, burst: 2000 },
};

// In-memory store
const keys = new Map<string, ApiKeyRecord>();

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): string {
  const raw = randomBytes(32).toString("hex");
  return `cn_${raw}`;
}

function getKeyPrefix(hashedKey: string): string {
  // We store the prefix separately at generation time
  return "";
}

/**
 * Generate a new API key. Returns the raw key (shown once) and the record.
 */
export function generateKey(options: {
  name: string;
  tier?: string;
  permissions?: string[];
  expiresInDays?: number;
}): { rawKey: string; record: ApiKeyRecord } {
  const rawKey = generateApiKey();
  const keyHash = hashKey(rawKey);
  const id = `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 86400000).toISOString()
    : null;

  const record: ApiKeyRecord = {
    id,
    keyHash,
    keyPrefix: rawKey.slice(0, 7),
    name: options.name,
    tier: (options.tier as any) || "free",
    createdAt: now,
    expiresAt,
    revokedAt: null,
    lastUsedAt: null,
    permissions: options.permissions || ["read"],
    metadata: {},
  };

  keys.set(id, record);
  return { rawKey, record };
}

/**
 * Validate an API key. Returns the record if valid, null if not.
 */
export function validateApiKey(rawKey: string): ApiKeyRecord | null {
  const keyHash = hashKey(rawKey);
  for (const record of keys.values()) {
    if (record.keyHash === keyHash) {
      if (record.revokedAt) return null;
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) return null;
      record.lastUsedAt = new Date().toISOString();
      return record;
    }
  }
  return null;
}

/**
 * Get rate limit tier for a key.
 */
export function getTierLimits(tier: string): ApiKeyLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

/**
 * Revoke an API key.
 */
export function revokeKey(keyId: string): boolean {
  const record = keys.get(keyId);
  if (!record) return false;
  record.revokedAt = new Date().toISOString();
  return true;
}

/**
 * Rotate an API key. Revokes the old one, generates a new one.
 */
export function rotateKey(keyId: string): { rawKey: string; record: ApiKeyRecord } | null {
  const old = keys.get(keyId);
  if (!old || old.revokedAt) return null;
  old.revokedAt = new Date().toISOString();
  return generateKey({
    name: old.name,
    tier: old.tier,
    permissions: old.permissions,
  });
}

/**
 * List all keys (masks the hash, shows prefix only).
 */
export function listKeys(): Array<Omit<ApiKeyRecord, "keyHash"> & { keyPreview: string }> {
  return Array.from(keys.values()).map((r) => ({
    ...r,
    keyHash: "***",
    keyPreview: r.keyPrefix + "***",
  }));
}

/**
 * Get key record by ID.
 */
export function getKeyById(keyId: string): ApiKeyRecord | undefined {
  return keys.get(keyId);
}

// Seed a demo key for testing
const demo = generateKey({ name: "demo-key", tier: "standard", permissions: ["read"] });
keys.get(demo.record.id)!.createdAt = new Date(2026, 0, 1).toISOString();
