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
Use $threejs-game-director with threejs-gameplay-systems, threejs-aaa-graphics-builder,
threejs-game-ui-designer and threejs-qa-release to implement the next *small*
v0.3 slice described in docs/V03_*.md and ROADMAP.md. First write pure tests
for calendar/season and deterministic boundary advances, then implement one
building lifecycle and visible worksite. Preserve v0.2 behavior, do not overwrite
existing saves, and verify active-play desktop/mobile screenshots before merge.
```

If your Codex environment does not automatically discover repository-local skills, the upstream-supported global installation is:

```bash
npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a codex -g -y
```

Use the vendored copy as the reference version for this project; only upgrade it deliberately, after checking upstream changes and third-party licensing. Optional model/image/audio generation steps may require separate provider API keys and are **not** needed for local game development.

Note: Upstream `threejs-aaa-graphics-builder` supplies three sample JPG scorecard reference images. If they are not present in the vendored package, follow the text `references/visual-scorecard.md` or obtain the optional anchors from upstream for manual visual review.

## v0.3 任务路由

| 工程任务 | 优先使用的 Skill |
| --- | --- |
| 三层时间、季节边界、建筑状态、机缘与测试 | `threejs-gameplay-systems` + `threejs-game-director` |
| 酒肆/民居 Kit、四季、天气、旧化和渲染优化 | `threejs-aaa-graphics-builder`（`authoring-recipes.md`、`technical-art.md`） |
| 流年选择、守望录、季节提示与移动端可读性 | `threejs-game-ui-designer` |
| 桌面与移动端截图、性能指标、Pages 构建 | `threejs-qa-release` |

**当前不需要** Tripo/Gemini/ElevenLabs 的外部素材生成能力；先完成程序化 Low-poly 美术切片。文档仅为开发约定，不能替代真实浏览器测试。
