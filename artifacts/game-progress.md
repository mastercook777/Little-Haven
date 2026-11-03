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


---

# 山谷有岁月 v0.3 · Sprint 1 实施记录（2026-11-03）

## 范围与产品原则
- 观察优先的武侠微缩村庄；新系统必须留下长期可见痕迹，未选择也能自治。
- 先建立世界时间、跨年剧情和四季画面，再实施建筑与可复用机缘，不提前宣布 v0.3 正式发布。

## 已提交到 PR #3
- 单一 world.minutes：12 游戏日/季，48 游戏日/年；1× 对应每日 8 分钟。
- 流年按钮改为跨至下季并保留当日观察时间，而非持续 48× 倍率。
- 阿青第一年修习、第二年出游、第三年风闻、第四年归乡；剑庐/茶亭分支保留。
- 种子 + 日历确定天气；四季草地/竹林/河水配色，屋顶薄霜、雨天水洼/低成本雨点与雾天能见度。
- v3 两槽本地存档、v0.2 不覆盖式迁移、导入/导出 JSON 与离线上限 4 个游戏日。
- 11 项纯模拟回归，覆盖跨季/跨年、天气、剧情、不同步进粒度、旧档迁移与非法存档。

## 验证状态
- GitHub Actions 已出现 **11/11 测试通过、TypeScript/Vite 构建通过** 的 CI 结果。
- 当前无法在此环境对真实 WebGL 场景进行桌面/手机截图、性能测量、场景材质及遮挡验收；**不能据此宣布美术验收完成**。
- PR 保持 Draft，直到视觉与移动端输入通过检查。

## Sprint 2/3 待落实
1. Plot/Building 稳定 ID，酒馆与民居磨损/修葺及施工可视化；居民劳动影响道具。
2. 雨夜留客、修屋援助的重复机缘；自治兜底与 cause IDs。
3. 酒肆、院落、练武坪、山道空间打磨，职业/社交/习武动作层。
4. 四季 × 雨雾 × 日夜 × 移动端截图矩阵、控制台/画布非空、渲染预算与不同剧情结局。

## 风险
- 当前四季为首轮场景映射，不等于 v0.3 规划要求的完整美术重构。
- 年龄、社会前提与长期普通事件链尚未建立，主线目前主要依赖跨年阶段。
- 两槽存档仅保存在当前浏览器，建议通过 JSON 备份保留关键经历。


---

# Sprint 2 实施记录（2026-11-03）

## 核心逻辑
- 新增 \`plots.ts\`：酒肆、柳下小屋、竹林练武坪、酒肆侧廊长凳四个稳定 Plot socket。
- 新增 \`buildings.ts\`：建筑语义状态（身份、屋龄、磨损、使用量、施工、修缮、道具、因果记录）。
- 每日温和磨损；柳下小屋会自发维修，可多次维修；长凳因酒肆繁忙按“规划→地基→施工→落成”逐日成型。
- 新增 \`opportunities.ts\`：每季雨夜留客、房檐修缮援助，分别提供三种有后果的选择；自动兜底不会使房屋直接毁灭。
- 机缘选择留下 \`guardianMemories\`，建筑记录 \`causeEventIds\`；角色与建筑点击详情能反查相关记录。
- v0.3 Sprint 1 JSON 安全兼容：缺少新字段时补充稳定初始建筑，不覆盖两槽旧存档。

## 场景
- 新增 \`buildingRenderer.ts\`：屋顶旧化、严重风化、修葺脚手架、新瓦、木料/柴堆/晾衣/茶杯/伞架/指路牌/排水槽等局部几何。
- 酒肆长凳有规划、地基、施工、落成四种独立形态；路网保持手工预留 socket，不提供任意建造编辑器。
- 点击任一跟踪建筑显示屋龄、完好度、阶段、进度和原因；人物详情补充与相关建筑的行动轨迹。

## 验收/风险
- 模拟自动回归新增 9 项建筑/机缘/迁移用例，覆盖无人干预、重复修屋、每日 vs 大步长、两分支不同视觉道具。
- Chromium 桌面/移动自动化集成在 GitHub Actions 中，截图上传为 artifact；最终结果以 CI 工作流为准。
- v0.3 Sprint 3 中的大型村庄重排、建筑 Kit 全量升级、五种以上职业动作仍未完成。

---

# Sprint 3：季相、风雨与村民生活（2026-11-03）

## 用户反馈 / 根因
- 夏秋区别不足：旧版只有草地和竹叶色；新增形态可读的树冠、晒场、落叶、遮荫与农事季相。
- 雨天辨识度不足：旧版 Point 粒子在正交视角太小；新增雨线、檐滴、积水、地面涟漪、云层调光。
- NPC 轨迹固定、聚集酒馆门口：旧版所有村民共享酒馆午间和夜间节点；按职业和日期编写互不依赖的日常路线。

## 实际加载的 Three.js Skills
- threejs-game-director：真实可玩、浏览器证据和最终发布。
- threejs-aaa-graphics-builder：visual-scorecard、authoring-recipes、technical-art、shader-cookbook；优先形态、道具、合批和低成本 VFX。
- threejs-debug-profiler：debug-playbook；对比相同视口渲染调用、几何、纹理和截图。
- threejs-gameplay-systems、threejs-qa-release：确定性行为、移动端与视觉回归。
- threejs-3d-generator：已阅读；按项目既定程序化美术风格，本轮不调用付费外部模型服务。

## 实际落地
- src/simulation/routines.ts：按职业、日期、天气确定家/工位/午间杂事/回家；不再全员到酒馆门口集合。
- src/simulation/world.ts：NPC 活动语义和交互目标；保留江湖客过桥抵达酒馆的合理路线。
- src/graphics/people.ts：扫帚、茶盘、柴捆、茶药筐、织锭、鱼竿、冬季围巾和分段练剑，关节平滑过渡。
- src/graphics/seasonArt.ts：春花、夏荫和芦苇、秋叶和晒场、冬雪枯枝炉烟；物件按季切换，不是屏幕调色。
- src/graphics/weatherArt.ts：清雨雾三态、低成本雨线/檐滴/积水/低谷薄雾；移除过大的白色雨带及云团。
- src/graphics/lifeDetails.ts：木料工位、茶叶晒架、鱼篓/渔具、织机、酒架、院落踏石。
- src/graphics/batchStatic.ts：静态几何按组/材质合批，动画组、可点建筑保留；谨慎回收共享几何。
- src/main.ts：季节化天空/照明、雨天云层阴影、移动 DPR 降级、渲染诊断接口。
- tests：NPC 位置、全天职业路径、四季同天气像素差、晴雨雾差、桌面/手机和原主线回归。

## 可观测的图形进展（首轮 CI 测量，仍需最终复核）
- v0.3 Sprint2 单帧约 1176 draw calls；合批后约 416 春、471 夏、510 秋、461 冬。三角形约 3.4–4.2 万。
- 初轮四季像素差（含天气差异）14.9、34.9、47.4；后来已经把季节比较锁定相同晴天。
- 仍超出美术 Skills 建议的桌面 300、手机 150 起始 draw-call 预算，不能宣称已经达到高级性能目标。

## 未完成
- 住宅通用 Kit 与整村道路/地块大调整尚未全部完成，当前精修重点为酒肆周边、职业工位和季相。
- 路径仍是确定性的手工道路节点，而不是带精细碰撞和对向避让的 A* 寻路。
- 手机需要更多中低端设备真实帧率数据，Chromium 软件渲染不等于真机 GPU 性能。
---

# Sprint 4 · 修雨、复河与建筑/人物动作精修（2026-11-03）

## 执行顺序与用户要求
- 首先编写 docs/V04_MODEL_MOTION_RIVER.md（先于实现）；之后实施 H1/H2 和三项美术模型/动作的可玩升级。
- 不改 world.minutes、玩家两条分支、机缘、建筑 ID、localStorage 槽位与先前已通过的自动化验收。

## 发现的确定性问题
- weatherArt.ts 的雨条位置曾为 baseY + t*speed，导致纵向运动为 +Y，确实是在向上升。
- village.ts 旧河是 1.81 宽、地表附近的半透明窄 ribbon，河岸没有断面；旧线部分节点 x=8.5/z=±11.8 超出椭圆岛边缘，前景存在被裁剪/不明显的问题。

## 实施模块
- weatherMotion.ts：downward -Y 位移，落到底部后回卷；weatherArt.ts 调用统一位移计算并暴露世界 Y 取样供浏览器连续帧验证。
- riverArt.ts：重新取样中心曲线并调整南北端入/出岛位置，同步河床/坡岸/浅滩/石块/沿水纹（季相配色），桥下贯通；岛前缘增加落崖瀑流与泡沫。
- architectureKit.ts：复用屋脊、檐托、框窗/格栅、双扇木门、石阶、前廊，主酒馆和四类民居分别装配。
- characterKit.ts：职业背包/斗笠/衣袍分层和饰物，保持原角色职业和画面规模。
- characterMotion.ts：行走步态、双手劳动、搬运、采摘俯仰、织布、钓鱼收竿和分段练剑；关节动画以连续秒插值。
- people.ts：保留人物点击 ID，重建可分别旋转上身/头部/膝关节的摆件式关节模型；动作从模拟 activityId 派生，暂停时不自行推进。
- batchStatic.ts/people.ts/buildingRenderer.ts：给动态关节内部的静态几何合批，保持已被动画代码引用的 robe Mesh 独立，避免销毁共享 BufferGeometry。

## Skills 应用
- 按 .agents/skills/threejs-game-director、threejs-aaa-graphics-builder/references/authoring-recipes.md 和 technical-art.md 的剪影/用途优先原则构建。
- 应用 threejs-debug-profiler、threejs-qa-release/references/visual-test-harness.md 实际 WebGL 动态画面与调用计数检查。
- 读取 threejs-3d-generator 技能；本次保留原有程序化低多边形风格，不调用付费模型生成服务，也不引入不可复用的模型 URL。

## 首轮实测与已知不足
- 27 项纯逻辑测试已通过，类型构建通过；Playwright 验证河道点位在投影内/几何有交集、雨粒子连续三组中 10/12 与 10/12 在下降、阿青练剑手臂姿态差值约 0.36 弧度。
- 早期无优化模型约 784 draw calls，人物按关节组合批后春季约 626、夏季 679、秋季 696、冬季 667；细节变多带来的预算超额仍需持续改善（Graphics Skill 桌面建议 ≤300、手机 ≤150）。
- 视觉 H2 以小河水面和浅滩坡岸重绘为主，尚未使用布尔算法在整块地形中物理挖空；崖壁边缘用落水面表达。
- 当前人物是程序化铰链关节、非外部皮肤骨骼动画，低端安卓真机未实测；高级 NPC 双向避让/完整村庄重新排布仍不在本轮。

## 后续验收
- 以 Sprint4 最新一次 GitHub Actions 的桌面+390px 手机、四季/雨雾、河流旋转和动作连续帧 artifact 为准；任何失败必须修复，不以前序成功取代最新结果。