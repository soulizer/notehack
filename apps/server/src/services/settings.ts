import { one } from '../db.js';
import { config } from '../config.js';
import { decryptString, encryptString } from '../lib/crypto.js';

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  providerLabel: string;
}

export async function getSetting<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const row = await one<{ value: T }>('SELECT value FROM instance_settings WHERE key = $1', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: Record<string, unknown>): Promise<void> {
  await one(
    `INSERT INTO instance_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING key`,
    [key, JSON.stringify(value)],
  );
}

export async function getAiConfig(): Promise<AiConfig> {
  const stored = await getSetting<{ enabled?: boolean; baseUrl?: string; model?: string; apiKeyEnc?: string; providerLabel?: string }>('ai');
  if (stored) {
    return {
      enabled: Boolean(stored.enabled),
      baseUrl: stored.baseUrl ?? '',
      model: stored.model ?? '',
      apiKey: stored.apiKeyEnc ? decryptString(stored.apiKeyEnc, 'instance:ai') : '',
      providerLabel: stored.providerLabel ?? 'OpenAI-compatible',
    };
  }
  return {
    enabled: config.ai.enabled,
    baseUrl: config.ai.baseUrl,
    model: config.ai.model,
    apiKey: config.ai.apiKey,
    providerLabel: 'OpenAI-compatible',
  };
}

export async function saveAiConfig(input: {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
  providerLabel?: string;
}): Promise<void> {
  const existing = await getSetting<{ apiKeyEnc?: string }>('ai');
  const apiKey = input.apiKey !== undefined && input.apiKey !== '' ? input.apiKey : undefined;
  await setSetting('ai', {
    enabled: input.enabled,
    baseUrl: input.baseUrl,
    model: input.model,
    providerLabel: input.providerLabel ?? 'OpenAI-compatible',
    apiKeyEnc: apiKey ? encryptString(apiKey, 'instance:ai') : existing?.apiKeyEnc ?? '',
  });
}
