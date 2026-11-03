# 守望谷 / Little Haven — instructions for coding agents

## Product definition

An observation-first **wuxia micro-world idle game**. The player is an unseen 守谷人; residents live and make choices independently. The visible 3D game is a small mountain tavern village; the surrounding 江湖 exists as a rules-driven offscreen story world. **Discoverable character relationships and visible consequences beat currencies and clicks.**

## Source of truth

1. `docs/V02_JIANGHU_BRIEF.md`: current product promise and scope.
2. `docs/V02_SCENE_PLAN.md`: wuxia diorama art direction and camera composition.
3. `docs/V02_STORY_SYSTEM.md`: first life-arc causal event chain, threshold contract and tests.
4. `ROADMAP.md`: priorities, v0.2 implementation and v0.3 non-goals.
5. `src/simulation/world.ts`: authoritative testable story and citizen state; no Three.js here.
6. `src/graphics/`: purely visual representation; no decision rules, save or clock mutation.

## Hard rules

- Preserve the established bright miniature island and orthographic readability. Buildings are simplified Chinese mountain houses, not realistic temples or a UI-only reskin.
- `Wuxia story → world state → scene/model presentation`. Every major event must leave a visible trace.
- Resident autonomy: absence of player choice must resolve to a coherent path instead of blocking world growth.
- Keep offline time bounded and save data versioned. v0.2 uses a new localStorage key; the v0.1 save is intentionally untouched.
- Prefer deterministic, rule-driven content. Do not require live LLM inference, API keys, servers, or paid models.
- Never imply visiting travelers are permanent population. Use stage-dependent visibility.
- Optimize for browser and mobile; don't cover the miniature world with large panels.
- Maintain regression tests for `host`, `observe`, automated default, fast forward, and persistence.

## Skills

Read `.agents/skills/threejs-game-director/SKILL.md` and relevant siblings under `.agents/skills/` when making substantial changes. For 0.2 the most relevant are `threejs-gameplay-systems`, `threejs-aaa-graphics-builder` (authoring recipes, technical art), `threejs-game-ui-designer` and `threejs-qa-release`. See `docs/SKILLS.md` for provenance. Runtime needs none of these skills.

## Verification / PR checklist

- `npm run test:sim`
- `npm run check`
- `npm run build:pages`
- Real desktop/browser smoke: initial vista, visitor arrival, player choice, both ending buildings, persistence/reload, no canvas blank/error. Mobile viewport when possible.
- Avoid commits of `node_modules`, `dist`, generated reports, or credentials. Document unverified items plainly.
