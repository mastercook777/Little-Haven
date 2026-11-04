# 守望谷 / Little Haven — instructions for coding agents

## Product definition

An observation-first **wuxia micro-world idle game**. The player is an unseen 守谷人; residents live and make choices independently. **Canon product direction: 江湖中的村庄 (A)**: everyday village life and autonomous growth remain the center, with the surrounding jianghu influencing migrants, livelihoods and human fates. An exceptional branch toward a martial community (B) can emerge only after sustained character-specific causal conditions and never becomes a mandatory progression path. **Discoverable character relationships and visible consequences beat currencies, combat and clicks.**

## Source of truth

1. `ROADMAP.md`: release phases, priorities and acceptance criteria.
2. `docs/WORLD_BIBLE_V1.md`: **authoritative world/product canon** for Southern Song late-period backdrop, village-first wuxia identity and rare optional martial outcomes.
3. `docs/LIVING_FATES_SYSTEM_V1.md`: **design-only implementation contract** for seeded characters, public/private identity, evidence-driven relationships, fate arcs and persistent real-world effects.
4. `docs/V04_PIONEER_ERA.md`: v0.4 Phase A+B live-mode design baseline for independent zero-building pioneer mode; it supersedes prebuilt-town assumptions only in pioneer mode.
5. `docs/V04X_PIONEER_POLISH_PLAN.md`: **next implementation backlog** grounded in a user's four-year browser playtest; fix model geometry, click-to-inspect, life behaviors, resource scarcity, forestry and opening land before scaling content.
6. `docs/V05_SETTLEMENT_GROWTH_TREE.md`: future **design draft**, not shipped technology tree, for production branches, milestones, reputation and migration.
7. `docs/V03_WORLD_FRAMEWORK.md`: planned calendar, season, weather and save contracts (**design only**).
8. `docs/V03_VILLAGE_GROWTH.md`: planned building state, plots and growth contracts (**design only**).
9. `docs/V03_PLAYER_AGENCY.md`: planned guardian interventions and replay safety (**design only**).
10. `docs/V03_ART_DIRECTION.md`: planned art, animation and performance contracts (**design only**).
11. `docs/V02_*.md`: current shipped v0.2 brief, scene and story baseline.
12. `src/simulation/world.ts`: authoritative testable current state; no Three.js here.
13. `src/graphics/`: visuals only; no save/clock/decision mutations.

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
- Pioneer Phase A+B and v0.4.1/0.4.2/0.4.3 core slices **have shipped in PR #10–13**. v0.4.4 Living Fates and v0.5 livelihood-tree documents are **design specifications, not shipped systems**. Never mark a feature implemented because prose exists.
- Pioneer mode must initialize with **no permanent buildings**, exactly three founders and a temporary campfire; legacy v0.3 must stay independently playable with untouched save slots.
- Do not hide a prebuilt village and call it construction. A new permanent structure must have a causal resident need, materials, workers, a collision-safe reachable parcel, visible construction and durable IDs.
- Tavern/dojo/wuxia storylets in pioneer mode are conditioned on real facilities and people; never use old v0.3 hardcoded initial minutes or phantom `inn-001` references for the new mode.
- The 3 pioneer founders 梁伯、陆娘、阿禾 are stable canon; never reroll existing people's names, roles, home assignments or stored history when adding Living Fates.
- Every fate reveal and role ability requires earned, observable conditions. Hidden past must not leak through ordinary UI. A person's ability must influence existing labor/relationship/plot/road/resource state under real time and inventory constraints.
- Historical anchor (design proposal): 1268 CE start, 1273 Xiangyang, 1276 Lin'an, 1279 end of Song. External pressure can be dated, but no scripted historical year may force the user's valley into faction play or a game-over ending.
- Living Fates must be deterministic across seeds, save reloads, offline catchup and speed differences; reuse numeric resident IDs, unique event/effect IDs and bounded relationship graphs. Do not create a second authoritative population count.

## Skills

Read `.agents/skills/threejs-game-director/SKILL.md` and relevant siblings under `.agents/skills/` when making substantial changes. For v0.3 the most relevant are `threejs-gameplay-systems`, `threejs-aaa-graphics-builder` (authoring recipes, technical art), `threejs-game-ui-designer` and `threejs-qa-release`. See `docs/SKILLS.md` for provenance. Runtime needs none of these skills.

## Verification / PR checklist

- `npm run test:sim`
- `npm run check`
- `npm run build:pages`
- Real desktop/browser smoke: initial vista, visitor arrival, player choice, both ending buildings, persistence/reload, no canvas blank/error. Mobile viewport when possible.
- For v0.3: verify season/year boundaries, building wear/repair, guardian opportunities, migrations and representative real-browser captures.
- For v0.4 Phase A+B: run tests/pioneer.test.mts and tests/pioneer-browser-smoke.mjs; inspect generated year-three building registry, A* walk paths and real WebGL; test pioneer zero-building initial state, resident resources/tasks, legitimate first shelter, dynamic routes, safe plots, season fast-forward equivalence, old/new save isolation, and actual desktop/mobile WebGL progression.
- Avoid commits of `node_modules`, `dist`, generated reports, or credentials. Document unverified items plainly.
