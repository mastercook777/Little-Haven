# 守望谷 / Little Haven — instructions for coding agents

## Product definition

An observation-first **wuxia micro-world idle game**. The player is an unseen 守谷人; residents live and make choices independently. The visible 3D game is a small mountain tavern village; the surrounding 江湖 exists as a rules-driven offscreen story world. **Discoverable character relationships and visible consequences beat currencies and clicks.**

## Source of truth

1. `ROADMAP.md`: release phases, priorities and acceptance criteria.
2. `docs/V04_PIONEER_ERA.md`: **v0.4 Phase A feature-branch implementation specification** for an independent zero-building pioneer mode; it supersedes prebuilt-town assumptions only inside this new mode.
3. `docs/V03_WORLD_FRAMEWORK.md`: planned calendar, season, weather and save contracts (**design only**).
4. `docs/V03_VILLAGE_GROWTH.md`: planned building state, plots and growth contracts (**design only**).
5. `docs/V03_PLAYER_AGENCY.md`: planned guardian interventions and replay safety (**design only**).
6. `docs/V03_ART_DIRECTION.md`: planned art, animation and performance contracts (**design only**).
7. `docs/V02_*.md`: current shipped v0.2 brief, scene and story baseline.
8. `src/simulation/world.ts`: authoritative testable current state; no Three.js here.
9. `src/graphics/`: visuals only; no save/clock/decision mutations.

## Hard rules

- Preserve the established bright miniature island and orthographic readability. Buildings are simplified Chinese mountain houses, not realistic temples or a UI-only reskin.
- `Wuxia story → world state → scene/model presentation`. Every major event must leave a visible trace.
- Resident autonomy: absence of player choice must resolve to a coherent path instead of blocking world growth.
- Keep offline time bounded and save data versioned. v0.2 uses a new localStorage key; the v0.1 save is intentionally untouched.
- Prefer deterministic, rule-driven content. Do not require live LLM inference, API keys, servers, or paid models.
- Never imply visiting travelers are permanent population. Use stage-dependent visibility.
- Optimize for browser and mobile; don't cover the miniature world with large panels.
- Maintain regression tests for `host`, `observe`, automated default, fast forward, and persistence.
- v0.3: one authoritative clock, stable building IDs, causal player opportunities, recoverable offline hazards.
- v0.3: distinguish day-scale activity from multi-year life milestones; do not regress to the v0.2 four-day life arc.
- Treat all v0.3 markdown as planned contracts, not as code already in production; develop substantial changes on feature branches.
- v0.4 Pioneer Era is **not shipped to main until its Phase A PR passes review/QA**. The feature branch implements a first playable slice; do not claim it is released solely because the design document or branch exists.
- Pioneer mode must initialize with **no permanent buildings**, exactly three founders and a temporary campfire; legacy v0.3 must stay independently playable with untouched save slots.
- Do not hide a prebuilt village and call it construction. A new permanent structure must have a causal resident need, materials, workers, a collision-safe reachable parcel, visible construction and durable IDs.
- Tavern/dojo/wuxia storylets in pioneer mode are conditioned on real facilities and people; never use old v0.3 hardcoded initial minutes or phantom `inn-001` references for the new mode.

## Skills

Read `.agents/skills/threejs-game-director/SKILL.md` and relevant siblings under `.agents/skills/` when making substantial changes. For v0.3 the most relevant are `threejs-gameplay-systems`, `threejs-aaa-graphics-builder` (authoring recipes, technical art), `threejs-game-ui-designer` and `threejs-qa-release`. See `docs/SKILLS.md` for provenance. Runtime needs none of these skills.

## Verification / PR checklist

- `npm run test:sim`
- `npm run check`
- `npm run build:pages`
- Real desktop/browser smoke: initial vista, visitor arrival, player choice, both ending buildings, persistence/reload, no canvas blank/error. Mobile viewport when possible.
- For v0.3: verify season/year boundaries, building wear/repair, guardian opportunities, migrations and representative real-browser captures.
- For v0.4: run tests/pioneer.test.mts and tests/pioneer-browser-smoke.mjs; test pioneer zero-building initial state, resident resources/tasks, legitimate first shelter, dynamic routes, safe plots, season fast-forward equivalence, old/new save isolation, and actual desktop/mobile WebGL progression.
- Avoid commits of `node_modules`, `dist`, generated reports, or credentials. Document unverified items plainly.
