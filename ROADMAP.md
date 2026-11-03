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
- [x] CI TypeScript/Vite build and Pages release verified for v0.2
- [ ] Capture active-play browser screenshots, test both branches visually, check touch layouts and frame budget

## v0.3 — 山谷有岁月 / Living Valley (in progress)

**目标：** 从“数日走完一生的剧情切片”发展为“拥有四季、天气、建筑生命周期和长期机缘的微缩武侠世界”。**Sprint 1 世界时间/四季首版已提交（独立分支 / Draft PR），Sprint 2/3 与真实浏览器视觉验收仍未完成。**

### 设计规格（已完成）

- [x] [世界时间与四季天气](docs/V03_WORLD_FRAMEWORK.md)：同一模拟时钟、日/季/年、流年、离线与存档
- [x] [建筑生命周期与村庄生长](docs/V03_VILLAGE_GROWTH.md)：稳定地块/建筑 ID、施工、旧化、修葺、扩建、生活痕迹
- [x] [守谷人参与感](docs/V03_PLAYER_AGENCY.md)：机缘、庇护、无操作自治、风险预警与多存档
- [x] [美术与表现升级](docs/V03_ART_DIRECTION.md)：构图、房屋 Kit、角色动作、四季/天气渲染与性能标准

### Sprint 0 · 基线

- [x] 从 v0.2 代码确认剧情结局过快的原因（分钟阈值与单层时间）
- [x] 将玩法、场景、状态与验收写入以上文档
- [ ] 补齐 v0.2 桌面/手机实机截图、性能及旧存档回归基线

### Sprint 1 · 世界时间框架（P0）

- [x] 单一模拟时钟派生日、季、年；步进/流年/离线一致（纯模拟回归通过）
- [x] 故事主线改为跨年触发，避免 1× 数日内完成一生（更多社会条件仍属后续）
- [x] 存档 v3、旧档保留与新开档基础方案（两个槽位 + JSON 导入导出）
- [x] 四季 + 晴/雨/雾数据与基本场景映射（初版视觉，仍待截图审计）
- [x] 自动化测试与季节场景状态接入；浏览器实测尚未完成

### Sprint 2 · 村庄生长与玩家参与（P0）

- [ ] 酒馆和一间民居的建筑 ID、地块、使用/磨损/修葺/施工状态
- [ ] 居民劳动→添置道具、修缮或新增设施，形成可见因果
- [ ] 雨夜留客与修缮援助两种可复用机缘；无需玩家操作世界仍有发展
- [ ] 建筑/人物详情可追溯原因；多槽位/新开档支持重玩分支

### Sprint 3 · 美术大改与动作（P1）

- [ ] 酒肆、院落、练武坪、竹林、山道与桥头的空间重构
- [ ] 可组合中式建筑 Kit + 新旧修葺场景变体
- [ ] 角色走停、扫地、搬料、抱拳、练剑等可观察动作
- [ ] 春夏秋冬 + 天气效果、轻量渲染、移动端性能降级
- [ ] 桌面/移动截图矩阵、浏览器实测、CI 与 Pages 验收

### 延后至 v0.4

复杂门派生态、真实战斗、官府与匪患完整危机、广泛 storylets、大模型实时剧情；优先验证平凡生活能否留下痕迹。

### v0.3 验收门槛

1. 在 1× 观察 15 分钟不会走完阿青的一生；流年按季推进可预览。
2. 四季与晴/雨/雾有可见、可重复的场景差异。
3. 至少 1 间民居能老化并修葺，至少 1 项设施有可见施工/添置过程。
4. 守谷人出手/不出手都形成长期、可反查的因果变化。
5. 多倍率、离线恢复、存档迁移、场景性能、移动布局通过验收。

## Design guardrail

Maintain the visual center: an ordinary tavern and ordinary lives. No elaborate martial arts combat, distant open-world rendering, AI API or faction simulator until the first life arc is enjoyable to **watch**.
