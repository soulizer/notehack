-- Legacy conflict copies were stored as ordinary notes with a title suffix.
-- Move their content into note_versions(reason='conflict') and remove the
-- duplicate note. This migration is idempotent: on a clean instance the loop
-- has no rows. Notes without a matching base note are left untouched.
DO $$
DECLARE
  conflict record;
  target_id uuid;
  target_version integer;
  target_title text;
  next_version integer;
BEGIN
  FOR conflict IN
    SELECT id, workspace_id, title, content_md, created_by, created_at
    FROM notes
    WHERE deleted_at IS NULL
      AND title LIKE '%（冲突副本 %）'
  LOOP
    target_title := regexp_replace(conflict.title, '（冲突副本 [^）]*）$', '');
    target_id := NULL;

    SELECT n.id, n.version
      INTO target_id, target_version
    FROM notes n
    WHERE n.workspace_id = conflict.workspace_id
      AND n.title = target_title
      AND n.id <> conflict.id
      AND n.deleted_at IS NULL
    ORDER BY n.created_at ASC
    LIMIT 1;

    IF target_id IS NOT NULL THEN
      SELECT GREATEST(target_version, COALESCE(MAX(v.version), 0)) + 1
        INTO next_version
      FROM note_versions v
      WHERE v.note_id = target_id;

      INSERT INTO note_versions (note_id, version, title, content_md, reason, created_by, created_at)
      VALUES (target_id, next_version, conflict.title, conflict.content_md, 'conflict', conflict.created_by, conflict.created_at);

      DELETE FROM notes WHERE id = conflict.id;
    END IF;
  END LOOP;
END $$;
