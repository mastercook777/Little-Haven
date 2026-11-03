# 江湖初现 v0.2 进度报告

## 本次目标

保留 v0.1 清新可俯视的微缩岛屿，重塑为武侠山谷酒肆聚落。构建一条「少年阿青 × 江湖客沈问舟」人生故事链，使无选择时村庄也能发展，玩家选择会生成不同地景。

## 已完成

- 三份设计规格：`docs/V02_JIANGHU_BRIEF.md`、`docs/V02_SCENE_PLAN.md`、`docs/V02_STORY_SYSTEM.md`。
- 新程序化建筑：带翘檐的灰瓦木构酒肆和民居、手写酒牌、红灯笼、竹林、石桥、山门、药圃、练武坪与木剑架。
- 角色武侠服饰，阿青木剑挥动；江湖客斗笠/佩剑，旅人沿山道抵达酒馆。
- Deterministic story events: visitor, guardian choice (`host|observe`), apprenticeship/self-study, departure, rumor, return and two distinct scene ending buildings.
- Automatic `observe` outcome if player ignores the event; no blocking story path.
- New save key `little-haven-jianghu-v02` retaining v0.1 key untouched; offline step bounded.
- UI relabelled to 江湖风闻 / 守望录 and 48× 流年快进.

## 运行验证

- Node 22 simulation: 9/9 tests passed locally.
- DOM ID/reference scan: no missing referenced elements.
- npm dependency install unavailable in current isolated workspace; Vite/TypeScript production build delegated to GitHub Actions CI before merging.
- Active WebGL screenshots / desktop and mobile manual input should be confirmed after publishing. Cannot honestly claim they were inspected in this workspace.

## Remaining risks / v0.3

- Visual composition and 3D performance need browser evidence.
- Shortest-path graph and collision avoidance are not yet implemented, only deterministic route waypoints.
- This is one branching story, not an infinitely recombining jianghu simulator.
- Art remains a procedural low-poly prototype and should be tuned based on actual browser screenshots instead of chasing AAA fidelity now.
