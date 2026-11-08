# ADR-010: Mobile uses the drawer, not a bottom tab bar

- Status: accepted
- Date: 2026-11-08

## Context

The mobile shell briefly used a four-item bottom bar (notes, search, favorites, settings). The list already exposes search at the top, the drawer already exposes favorites, spaces and settings, and the bar consumed the bottom of every list screen. It also duplicated actions that existed elsewhere and made the UI feel like two navigation systems. The settings entry additionally needed to preserve the note the user came from.

## Decision

1. Remove the mobile bottom tab bar entirely. The shell is a stack: drawer → note list → full-screen editor.
2. Keep search in the list header and creation in the search row. Favorites, spaces and settings live in the drawer footer/navigation.
3. The mobile settings page is a flat, one-screen 3×3 grid of all settings sections (admin adds a tenth). No nested settings drawer.
4. Settings navigation carries `location.state.from`; the back arrow returns to the originating note or list, not unconditionally to `/app`.
5. The mobile settings header never shows both an arrow and a text “返回笔记” button.
6. Content scrolls independently under the settings header/nav; bottom padding includes the safe area.

## Consequences

- No duplicated navigation and 58px of vertical space returned to the note list.
- Settings is two taps from the list (drawer → settings), then one tap to any section; returning to the note is one tap.
- Fast capture remains available from the list top button and PWA shortcuts.
- Future mobile navigation additions must fit the drawer/stack model rather than reintroducing a tab bar.
