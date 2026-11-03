# 守望谷 | Development Roadmap

## v0.1 — Living Valley (archive)

- [x] Bright Low-poly island prototype, orbital camera and resident routine
- [x] One-shot bridge/garden guardian choice; local save and chronicle
- [x] 7 logic tests and GitHub Actions build

## v0.2 — 江湖初现 / The Mountain Tavern

- [x] Design brief, scene art specification, first causal story design
- [x] Procedural Chinese timber-and-tile buildings, tavern with wine banner, lanterns, bamboo, practice ground, bridge, mountain path
- [x] Named wuxia villagers, training animation, traveler and merchant visibility
- [x] Story system: visitor, guardian choice, sword study, departure, rumor, return, and branching building outcomes
- [x] Autonomous fallback when the player ignores the invitation
- [x] New save namespace; no destruction of v0.1 progress
- [x] Story-specific UI and fast-forward, chronicle and resident details
- [x] Deterministic simulation regression tests
- [ ] Finish CI TypeScript/Vite build and Pages release verification
- [ ] Capture active-play browser screenshots, test both branches visually, check touch layouts and frame budget

## v0.3 — 江湖因缘 (next)

1. Replace one-off plot with **composable storylets**: visitor occupation, personality, intention, relation and world tension act as inputs.
2. Expand resident relationships and return-from-travel state, without making every resident a legendary hero.
3. Add a repeatable tavern traveler loop; one visitor can influence later visits and word-of-mouth.
4. Introduce gradual visible growth of facilities based on social/use conditions, rather than stat-only unlocks.
5. Add simple path graph / non-intersecting routes and resident conversations.
6. Begin long-horizon lightweight choices: shelter, rumors, safety and scarcity, with warning/recovery rather than destructive idle punishment.

## Design guardrail

Maintain the visual center: an ordinary tavern and ordinary lives. No elaborate martial arts combat, distant open-world rendering, AI API or faction simulator until the first life arc is enjoyable to **watch**.
