# Little Haven (守望谷) — Instructions for coding agents

## Product vision
Little Haven is a calm, observation-first **living diorama idle game**. The player is a guardian who occasionally chooses how to help; villagers are autonomous. The reward is seeing visible, causal world changes, not farming arbitrary currencies or clicking buildings repeatedly.

## Source of truth
- `docs/DESIGN.md`: current v0.1 design, first-session promise and limitations.
- `ROADMAP.md`: prioritized next vertical slice.
- `docs/QA.md`: verified checks and remaining browser QA.
- `src/simulation/world.ts`: authoritative deterministic world state; `src/graphics/*` are presentation.
- `docs/SKILLS.md`: local Three.js skills usage and provenance.

## Important decisions
1. Preserve the current bright, clean, pastel miniature aesthetic until gameplay has been validated. Avoid unrelated visual redesigns.
2. Keep world simulation independent of Three.js; renderers must never own save state or game logic.
3. Prefer reproducible, seeded behavior, explicit time-step handling and bounded offline progress.
4. A guardian choice must leave **visible** consequences in the world, resident behaviors and/or the chronicle.
5. Don't add AI API calls, accounts, paid assets or servers to the core game without approval.
6. Maintain desktop mouse and mobile touch support. Avoid hiding the diorama beneath interface panels.
7. Never commit keys, node_modules, dist or generated test artifacts.

## Skills for Codex
Begin broad game changes with `$threejs-game-director`; find the vendored skills in `.agents/skills/`. Consult `threejs-gameplay-systems`, `threejs-aaa-graphics-builder`, `threejs-game-ui-designer`, `threejs-debug-profiler`, and `threejs-qa-release` as relevant. 3D/image/audio generation skills are optional and should degrade gracefully without API keys. Read each skill's actual `SKILL.md`, rather than assuming it was executed. See `docs/SKILLS.md`.

## Definition of done
For gameplay changes, run `npm run test:sim`, `npm run check`, `npm run build` when dependencies are available; perform real browser interactions and screenshot checks when feasible. Document what passed and what could not be verified; do not confuse a compiling scene with playable systems. New state fields need save/load compatibility and tests.

## First follow-up milestone
Make the village self-growing instead of introducing more decorative models: need -> proposal -> guardian response -> construction -> new resident behavior -> follow-up need.
