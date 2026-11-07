# ADR-003: Version check + line-based 3-way merge + conflict copies

- Status: accepted
- Date: 2026-11-07

## Context

Offline and multi-device editing creates conflicts. Reference projects: Trilium uses LWW (silent data loss risk); Joplin uses conflict copies + bounded 3-way merge; SilverBullet uses conflict copies; Standard Notes uses server detection and per-type strategies. NoteHack needs no silent overwrite, low complexity, and understandable UX.

## Decision

Every note has a monotonic `version`. Saves from the editor include `baseVersion`. On mismatch, the server returns 409 with the current note. The client uses the last server-confirmed content (`baseContent`) plus local and remote content to run `node-diff3` at line level:

- clean merge → save merged content at remote version;
- real conflict or missing base → create a conflict copy titled “Title（冲突副本 time）”, keep the remote version in the editor, show a banner.

Offline outbox items are merged per note, not replayed key-by-key. Version snapshots are separate from conflict handling.

## Consequences

- No silent overwrite; most non-overlapping edits merge automatically.
- Rare conflicts create an extra note; users see a banner and can open the copy.
- No CRDT/real-time collaboration (see ADR-007).
