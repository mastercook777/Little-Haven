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
