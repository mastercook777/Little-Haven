# Vendored Three.js Game Skills

This repo includes the upstream [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) Codex skill pack under `.agents/skills/` so that contributors and coding agents can use a **project-pinned** copy.

- Upstream license: MIT (see `THIRD_PARTY_NOTICES.md`).
- Upstream source revision: `8286774b22a2566bf894dbc825825c16921866af` (tree of `main`, inspected 2026-11-03).
- Skill entrypoint: `.agents/skills/threejs-game-director/SKILL.md` (Codex can invoke `$threejs-game-director`).
- Companion skills: gameplay systems, graphics, UI, debugging, release QA, optional 3D/image/audio generators.
- Installing these skills **does not change** the Vite game runtime. They guide developer agents, not the player's browser.

## Usage
Open this repository as the Codex project and ask:

```
Use $threejs-game-director and the relevant sibling skills to implement the
v0.2 Jianghu tavern life-arc prototype. Follow the wuxia scene and story
briefs in docs/V02_*.md and the guardrails in AGENTS.md. Keep the simulated
Jianghu independent from Three.js, add tests, and verify both endings visually.
```

If your Codex environment does not automatically discover repository-local skills, the upstream-supported global installation is:

```bash
npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a codex -g -y
```

Use the vendored copy as the reference version for this project; only upgrade it deliberately, after checking upstream changes and third-party licensing. Optional model/image/audio generation steps may require separate provider API keys and are **not** needed for local game development.

Note: Upstream `threejs-aaa-graphics-builder` supplies three sample JPG scorecard reference images. If they are not present in the vendored package, follow the text `references/visual-scorecard.md` or obtain the optional anchors from upstream for manual visual review.
