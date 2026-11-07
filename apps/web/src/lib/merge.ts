import { diff3Merge } from 'node-diff3';

/**
 * Line-level three-way merge. Returns null when the merge has a real conflict
 * or cannot be represented safely. The caller must keep a conflict copy instead
 * of overwriting.
 */
export function mergeText(local: string, base: string, remote: string): string | null {
  if (local === remote) return remote;
  if (base === local) return remote;
  if (base === remote) return local;
  const a = local.replace(/\r\n/g, '\n').split('\n');
  const o = base.replace(/\r\n/g, '\n').split('\n');
  const b = remote.replace(/\r\n/g, '\n').split('\n');
  const regions = diff3Merge(a, o, b, { excludeFalseConflicts: true });
  if (regions.some((region) => region.conflict)) return null;
  return regions.flatMap((region) => region.ok ?? []).join('\n');
}
