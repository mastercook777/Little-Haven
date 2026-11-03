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

**目标：** 从“数日走完一生的剧情切片”发展为“拥有四季、天气、建筑生命周期和长期机缘的微缩武侠世界”。**Sprint 1–6 已在 `main` 上线。Sprint 7 的独立分支正在验证空间碰撞、路水净空和人口驱动的地块扩张；只有模拟和浏览器验收通过才合并。专业绑定 GLB 角色仍为后续独立美术生产工作。**

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

### Sprint 7 · 安全地块与有需求的长期生长（当前实验分支）

- [x] [地块规划与防穿模设计](docs/V07_SPATIAL_GROWTH_PLANNING.md)：建筑屋檐保护、道路通行、河岸/浮岛边界和旧村扩建不再各自凭固定坐标
- [x] 共享溪流、道路、松树和竹林地理数据，避免模拟层与场景布局脱节
- [x] 新增旋转矩形 SAT 建筑碰撞、净空和可达道路搜索；地块不足明确返回“不可建”
- [x] 由人口与资源触发新居民地块，种子决定房屋位置，存档保存位置，分地基/梁架/落成阶段呈现
- [x] 旧房扩建检测实际建模的屋顶、门廊包围盒，新碰撞会延后替换而不是继续穿模
- [ ] 最新变更 40+ 模拟单测、桌面和移动浏览器中新生成房屋可见性、四季/原剧情、CI 整体验收
- [ ] 真正道路连接施工、树木清理、扩建选址回退、居民逐户入住行为、全村原有屋舍碰撞自动修复
- [ ] 生产级绑定 GLB、真正手工关键帧动作和低端 GPU 性能认证，另行推进

### Sprint 6 · 形体优先的美术重构（已上线，持续审美验收）

- [x] [美术方向与验收设计](docs/V06_ART_REBUILD.md)：明确不再使用盒子＋加装装饰的旧工作流
- [x] 酒肆、五座核心民居从原建筑工厂**完整重制**，一体曲面檐顶、统一木构与不同体量
- [x] 人物胸背矩形装饰改成连续衣襟、披布、围裙、下摆和软质包袱，保留阿青关键帧动画
- [x] 现有酒肆和五座民居分阶段重建，原始村庄中枢随劳动日和选择改变，而不仅是边角增加新区
- [x] 公共石铺/乡路随经济成熟分阶段成长，且分商路、渡口、田园有不同材料语言
- [x] 商埠、旅舍重新选址，避免压住河流/桥及超出岛缘，增加可验证地块边界
- [x] 冬季积雪贴合新屋顶真实曲面，修正原烟囱与新屋体之间的漂浮感；秋季落叶减少并集中树下
- [ ] 最新 CI 的截图/移动端/四季/长期演化审核、合并以及 Pages 验证（合并后关闭）
- [ ] 独立高品质绑定 GLB 角色与专业逐帧动作美术、低端移动设备 GPU 性能、可无上限生长的聚落规划

### Sprint 5 · 真正活着的村庄（完成可玩版）

- [x] [规则与验收设计](docs/V05_LIVING_VILLAGE_VERTICAL_SLICE.md)，把用户反馈「不要堆积木、要有村庄成长」上升为产品原则
- [x] 轻度模拟经营：村民按日积累木料/食物/交流资源，自主施工，有住屋/人口/繁荣变化
- [x] 水脉三路分支：石桥商埠 / 河畔渡口 / 果园田舍，留白和大体量建筑/道路轮廓不同
- [x] 选择一次生效、逾期自动转田园，分阶段建造、新旧档兼容
- [x] 河流地形高度场随共享河道曲线下切，水面低于周边草地
- [x] 采用 CloudAI-X Three.js Animation Skill 的 Clip/Mixer/Crossfade 实现阿青 idle / walk / sword-form 试制
- [ ] 三分支两年截图的像素和建筑差异、桌面/手机与旧故事回归、CI 验收和 Pages 上线
- [ ] **未完成：** 原创高品质绑定 GLB 模型、专业关键帧动作手工精修、全村 A* 人群避让和低端安卓性能

### Sprint 4 · 水脉修复与模型动画质感（完成）

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
