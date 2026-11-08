# ADR-009: Conflict snapshots live in version history, never in the note list

- Status: accepted
- Date: 2026-11-08
- Supersedes: the “create a conflict copy note” part of ADR-003

## Context

ADR-003 kept real conflicts as a new note titled `Title（冲突副本 time）`. In practice this polluted the note list, produced duplicate search hits, and made conflict history hard to find. Users expect conflict copies to be a recovery artefact, not a second document.

## Decision

When a save cannot be merged cleanly:

1. The editor keeps the server version as the canonical note.
2. The local content is written to `note_versions` with `reason='conflict'` and `created_by` set to the author.
3. The editor opens the right-side **历史** panel and shows a banner explaining that local content is preserved.
4. No note is created, moved, indexed, or shown in the note list.
5. Legacy conflict-copy notes are migrated into `note_versions` (`reason='conflict'`) and then deleted from `notes`.

`addConflictVersion` enforces workspace write permission, caps history at 60 snapshots, and audits `note.conflict.save`.

## Consequences

- The note list stays clean and search does not return duplicate conflict documents.
- Conflict recovery is colocated with ordinary version history and restore.
- Conflict snapshots do not consume a note quota or folder position.
- The history entry is labelled **冲突副本** in the UI; it has no version number displayed because it is not a contiguous note version.
