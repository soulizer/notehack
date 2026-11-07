import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one } from '../db.js';
import { requireAuth } from '../auth.js';
import { errors } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireWorkspace } from '../services/workspaces.js';
import { listingNotes } from '../services/notes.js';

const tagColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();

export default async function tagRoutes(app: FastifyInstance) {
  app.get('/api/tags', async (request) => {
    const auth = requireAuth(request);
    const { workspaceId } = parse(z.object({ workspaceId: z.string().uuid() }), request.query);
    await requireWorkspace(auth.user.id, workspaceId, 'read');
    const rows = await many<{
      id: string;
      workspace_id: string;
      name: string;
      color: string | null;
      created_at: Date;
      note_count: string;
    }>(
      `SELECT t.*, (
         SELECT count(*)::text FROM note_tags nt JOIN notes n ON n.id = nt.note_id
         WHERE nt.tag_id = t.id AND n.trashed_at IS NULL AND n.deleted_at IS NULL
       ) AS note_count
       FROM tags t WHERE t.workspace_id = $1 ORDER BY lower(t.name) ASC`,
      [workspaceId],
    );
    return {
      tags: rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        color: row.color,
        noteCount: Number(row.note_count),
        createdAt: row.created_at.toISOString(),
      })),
    };
  });

  app.post('/api/tags', async (request) => {
    const auth = requireAuth(request);
    const body = parse(
      z.object({ workspaceId: z.string().uuid(), name: z.string().trim().min(1).max(80), color: tagColor }),
      request.body,
    );
    await requireWorkspace(auth.user.id, body.workspaceId, 'write');
    const existing = await one<{ id: string; workspace_id: string; name: string; color: string | null; created_at: Date }>(
      'SELECT * FROM tags WHERE workspace_id = $1 AND lower(name) = lower($2)',
      [body.workspaceId, body.name],
    );
    if (existing) {
      return {
        tag: {
          id: existing.id,
          workspaceId: existing.workspace_id,
          name: existing.name,
          color: existing.color,
          noteCount: 0,
          createdAt: existing.created_at.toISOString(),
        },
      };
    }
    const row = await one<{ id: string; workspace_id: string; name: string; color: string | null; created_at: Date }>(
      'INSERT INTO tags (workspace_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [body.workspaceId, body.name, body.color ?? null],
    );
    return {
      tag: {
        id: row!.id,
        workspaceId: row!.workspace_id,
        name: row!.name,
        color: row!.color,
        noteCount: 0,
        createdAt: row!.created_at.toISOString(),
      },
    };
  });

  app.patch('/api/tags/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    const tag = await one<{ workspace_id: string }>('SELECT workspace_id FROM tags WHERE id = $1', [id]);
    if (!tag) throw errors.notFound('标签不存在');
    await requireWorkspace(auth.user.id, tag.workspace_id, 'write');
    const body = parse(
      z.object({ name: z.string().trim().min(1).max(80).optional(), color: tagColor.nullable().optional() }),
      request.body,
    );
    const row = await one<{ id: string; workspace_id: string; name: string; color: string | null; created_at: Date }>(
      `UPDATE tags SET name = COALESCE($2, name), color = CASE WHEN $3 THEN $4 ELSE color END WHERE id = $1 RETURNING *`,
      [id, body.name ?? null, body.color !== undefined, body.color ?? null],
    );
    return {
      tag: {
        id: row!.id,
        workspaceId: row!.workspace_id,
        name: row!.name,
        color: row!.color,
        createdAt: row!.created_at.toISOString(),
      },
    };
  });

  app.delete('/api/tags/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    const tag = await one<{ workspace_id: string }>('SELECT workspace_id FROM tags WHERE id = $1', [id]);
    if (!tag) throw errors.notFound('标签不存在');
    await requireWorkspace(auth.user.id, tag.workspace_id, 'write');
    await one('DELETE FROM tags WHERE id = $1 RETURNING id', [id]);
    return { ok: true };
  });

  app.get('/api/tags/:id/notes', async (request) => {
    const auth = requireAuth(request);
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    const tag = await one<{ workspace_id: string; name: string }>('SELECT workspace_id, name FROM tags WHERE id = $1', [id]);
    if (!tag) throw errors.notFound('标签不存在');
    const params = parse(
      z.object({ limit: z.coerce.number().min(1).max(100).default(40), offset: z.coerce.number().min(0).default(0) }),
      request.query,
    );
    const result = await listingNotes({
      workspaceId: tag.workspace_id,
      userId: auth.user.id,
      filter: 'tag',
      tagId: id,
      limit: params.limit,
      offset: params.offset,
    });
    return { ...result, tag: { id, name: tag.name } };
  });
}
