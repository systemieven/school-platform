# Attendance sound presets

The Attendance module plays one of the four notification sounds below when
the visitor's ticket is called on the public page (`/atendimento`).

Required files (exact names):

- `attendance-bell.mp3`    — preset key: `bell`
- `attendance-chime.mp3`   — preset key: `chime`
- `attendance-ding.mp3`    — preset key: `ding`
- `attendance-buzzer.mp3`  — preset key: `buzzer`

Characteristics:

- Short (≤ 2s), ~80–120 kbps, mono MP3.
- Public-domain / royalty-free. Good sources: mixkit.co, freesound.org (CC0),
  notificationsounds.com.
- Should be audible over a phone speaker and non-alarming.

These are loaded via `<Audio>` from `/sounds/attendance-<preset>.mp3` — the path
is hard-coded in `AttendanceSettingsPanel.tsx` and `AtendimentoPublico.tsx`.
