# 守望谷 / Little Haven — instructions for coding agents

## Product definition

An observation-first **wuxia micro-world idle game**. The player is an unseen 守谷人; residents live and make choices independently. **Canon product direction: 江湖中的村庄 (A)**: everyday village life and autonomous growth remain the center, with the surrounding jianghu influencing migrants, livelihoods and human fates. An exceptional branch toward a martial community (B) can emerge only after sustained character-specific causal conditions and never becomes a mandatory progression path. **Discoverable character relationships and visible consequences beat currencies, combat and clicks.**

## Source of truth

1. `ROADMAP.md`: release phases, priorities and acceptance criteria.
2. `docs/WORLD_BIBLE_V1.md`: **authoritative world/product canon** for Southern Song late-period backdrop, village-first wuxia identity and rare optional martial outcomes.
3. `docs/LIVING_FATES_SYSTEM_V1.md`: **design-only implementation contract** for seeded characters, public/private identity, evidence-driven relationships, fate arcs and persistent real-world effects.
4. `docs/V04_PIONEER_ERA.md`: v0.4 Phase A+B live-mode design baseline for independent zero-building pioneer mode; it supersedes prebuilt-town assumptions only in pioneer mode.
5. `docs/V04X_PIONEER_POLISH_PLAN.md`: **next implementation backlog** grounded in a user's four-year browser playtest; fix model geometry, click-to-inspect, life behaviors, resource scarcity, forestry and opening land before scaling content.
6. `docs/V05_SETTLEMENT_GROWTH_TREE.md`: **partially implemented design baseline**; v0.5 fishing/wood/grain and v0.5.1 visitor/trade are actual narrow slices, the full six-branch tech tree is still design-only.
6a. `docs/V051_VISITORS_TEA_STOP.md`: factual implementation/QA contract for saved nonresident visitors, a paid road tea hut, genuine road access, balanced barter and resident clearing before settlement growth.
6b. `docs/V052_FAMILIAR_ROADS.md`: implemented v0.5.2 with real residents staffing tea-hour shifts and logged named returning visitors; merged in PR #20, full QA #41948530936. Old anonymous v0.5.1 visits never gain synthetic hosts.
6c. `docs/V053_FISH_HAUL.md`: v0.5.3 river fish cargo escrow, a separate exclusive carrying hour, persistent delivery ledger and visible baskets; PR #21 merged with full green CI #41954573323. Wood, crops and multi-hour transport remain planned.
6d. `docs/V054_PIONEER_HERITAGE_ART.md`: v0.5.4 pioneer heritage asset reuse merged in PR #22 with 115/115 tests and desktop/mobile Chromium CI #41963981991: reused classic curved roofs, fabrics, protected seasonal crowns and audited winter snow. Artistic multi-angle human review and low-end Android FPS remain open.
6e. `docs/V055_PIONEER_SEASONS_WEATHER.md`: v0.5.5 seasons/rain shared with classic renderer, real protected-tree leaf/petal/snow sites, actual paid-building roof drips; PR #23 merged with 120/120 tests and desktop/mobile Chromium CI #42004577737. Android GPU and manual visual close-up still open.
6f. `docs/V056_PIONEER_ARCHETYPES_ECOLOGY.md`: **design-only** v0.5.6 target for pioneer building archetypes, actual rendered creek/shore vegetation exclusion, stable protected parcel anchors and save migration, neighborhood layouts and screenshot/QA gates. No implementation or verification has shipped.
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
- Pioneer Phase A+B and v0.4.1/0.4.2/0.4.3 core slices **have shipped in PR #10–13**. v0.4.4-A/B personality, seeded identities, real work relationships and permanent memories have shipped in **PR #15**. v0.4.4-C's first genuine seed-field fate shipped in **PR #16**; v0.4.5's visible observation chapters, real-stock crops and woodpile and resident focus shipped in **PR #17** after 94/94 simulation tests and desktop/mobile browser smoke. v0.5's first truthful livelihood slice (reachable fishing, seasonal finite fish, paid granary, paid woodcraft, 12-person housing with paid loft fallback, durable milestones and four council directions) shipped in **PR #18** after 99/99 tests and real desktop/mobile Chromium QA. C's other fate arcs, v0.4.4-D standalone cargo transactions, and the **remaining v0.5 six-industry economy** are not shipped. Never mark a feature implemented because prose exists.
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
