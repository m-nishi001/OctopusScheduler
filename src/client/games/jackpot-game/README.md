# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## New Draw APIs (implemented)

This project now exposes application-level draw APIs used by the UI:

- `executeMemberDraw({ requestCount: number })`
  - Returns `{ drawId, winnerId, dummyIds }` where `winnerId` may be null when all members have already won.
  - Persists a partial draw result for the selected member.

- `executePrizeDraw({ memberId: string, requestCount: number })`
  - Returns `{ drawId, winnerPrizeId, dummyPrizeIds, isKakuhen?, reservedPrizeIds? }`.
  - If `isKakuhen` is true, the UI should run the kakuhen sequence (first auto-draw with dummy then after 2s call `executeKakuhenAssign`).

- `executeKakuhenAssign(memberId: string)`
  - Assigns one of the reserved prizes to the member and returns the assigned prize id.

- `getLastPrizeCount()`
  - Returns `{ total, remaining }`.

Data structures: `DrawResultDto` was extended to support optional `prize` and reservation/animation metadata.

Notes: The current implementation stores draw state in localStorage and reserves prizes as described in the spec. Animation timing and BGM playback are handled at the UI layer; the application layer provides necessary flags (isKakuhen/reservedPrizeIds) for the UI to orchestrate the visual sequence.
