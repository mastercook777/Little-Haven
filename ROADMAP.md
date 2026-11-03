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

**目标：** 从“数日走完一生的剧情切片”发展为“拥有四季、天气、建筑生命周期和长期机缘的微缩武侠世界”。**Sprint 1–3 已在 `main` 上线；Sprint 4 正在修复雨水倒流与原有河道不显，并把建筑和人物从简单模型推进至分层 Kit 和可控关节。全村地块重排、完整 A* 避让仍为后续迭代。**

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

- [x] 酒馆和一间民居的建筑 ID、地块、使用/磨损/修葺/施工状态
- [x] 居民劳动→柴堆、晾衣、长凳施工、修屋及可见因果
- [x] 雨夜留客与修缮援助两种可复用机缘；无操作可自动回应并保守修屋
- [x] 建筑/人物详情可追溯原因；多槽位/新开档支持重玩分支

### Sprint 3 · 美术大改与动作（P1）

- [ ] 酒肆、院落、练武坪、竹林、山道与桥头的整体空间重构（已加职业工作场景与路径分流，尚未完成总布局重排）
- [ ] 可组合中式建筑 Kit 全量标准化（原有酒肆/民居/施工变体保留，仍需统一瓦脊、门窗和围院样式）
- [x] 角色走停、扫地、搬柴、招呼、采集、织布、钓鱼与分段练剑的可观察动作（程序化动作层）
- [x] 四季独立树冠/落叶/收获/积雪 + 雨幕/檐滴/积水/雾 + 静态几何合批与移动端降级
- [ ] 桌面/移动截图矩阵、浏览器实测与 Pages 验收（PR 实测已建立；合并上线后关闭）

### Sprint 4 · 水脉修复与模型动画质感（当前 P0）

- [x] [设计和验收文档](docs/V04_MODEL_MOTION_RIVER.md)（先于代码提交）
- [x] 雨线由 `+Y` 更正为 `-Y`，增加逐帧世界坐标检查与回卷单测
- [x] 连续河床、河岸斜坡、岸石、芦苇与动水纹，河道经过石桥并与岛边相接
- [x] 酒馆与民居屋脊/支撑木构/格窗/门扇/门廊 Kit 及身份化外观
- [x] 职业人物衣饰/帽饰/背包差异、头部/上半身/膝关节与动作分相
- [ ] 桌面与手机、旋转镜头、三帧落雨和角色动作、四季双分支完整视觉验收；CI/Pages 发布
- [ ] 真正的河床地形切削与完整地块重新排布；A* 与 NPC 双向避让（后续深化）

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
