import { EngagementType } from '@prisma/client';

/**
 * Maps each engagement type to the frontend field name that carries its rich
 * JSONB payload (osintData / webData / domainData / ...).
 */
export const ENGAGEMENT_DATA_KEY: Record<EngagementType, string> = {
  osint: 'osintData',
  website: 'webData',
  domain: 'domainData',
  infrastructure: 'infraData',
  person: 'personData',
  organization: 'orgData',
  social_profile: 'socialData',
  leak: 'leakData',
};

/**
 * Merges an engagement row + its EngagementData JSONB into the shape the
 * frontend expects, e.g. `{ ...eng, osintData: {...} }`.
 */
export function serializeEngagement<T extends { type: EngagementType }>(
  engagement: T & { data?: { data: unknown } | null },
): Record<string, unknown> {
  const { data, ...rest } = engagement as T & {
    data?: { data: unknown } | null;
  };
  const result: Record<string, unknown> = { ...rest };
  if (data?.data != null) {
    result[ENGAGEMENT_DATA_KEY[engagement.type]] = data.data;
  }
  return result;
}
