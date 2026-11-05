# 守望谷 | Little Haven — v0.3 经典观察 / v0.4 开荒预览

> 山外是江湖，山里有故人。守望一座以无名酒肆为中心的微缩武侠山谷，看看它如何悄悄生出故事。

**长期定位已确定：方向 A「江湖中的村庄」。** 居民自治、生活成长始终是主角；南宋末年作为外部历史压力背景。极少数人物在长年羁绊与事件中可能把村落发展成习武/护路之乡（方向 B），但那不是强制目标。v0.4.4-A/B 的人物起源、真实劳动羁绊与人生记忆已随 PR #15 进入主分支；「留下的种子」真实命运纵切片另见 [实施文档](docs/V044C_FIELD_SEED_FATE.md)。**完整江湖势力、武学传承与外部战乱系统仍未上线**。

这是一个基于 **Three.js + TypeScript + Vite** 的观察型武侠放置网页游戏原型。程序化 Low-poly 中国山居、酒肆、竹林、练武坪、石桥；居民会按照作息行动，一名少年和一位旅人拥有可见的两结局故事链。**无需账号、素材生成 API 或后端服务器。**

## v0.4 开荒纪元 · Phase A + B 公测（独立模式）

**v0.4.3 工程增量（PR #13）**：真实采木触发持久化倒树、可见伐木和树桩/再生，居民逐时清灌形成可调查的西侧外环用地；图形岛屿与导航/SAT 一起扩张，手机可双指平移。v4 旧档保留；正式上线以最新 CI 与 Pages 部署为准。仍需继续实现跨小时持久货运事务和更完整的伐木动作。

**v0.5.4 山居焕新（PR #22 已合入 main）**：真正重用经典观察版 `villageBuildings.ts` 的一体曲面瓦顶、`characterKit.ts` 的连续衣襟披布服饰，并把旧版山居纸窗、木构、门扇和自然四季树冠移植至**真实开荒建筑/人物**。地基与工地仍不提前显示成屋；外轮廓必须留在原地块净空内，三位创始居民、生产工时、存档和老村观察不更改。已加入静态立面合批、落成后的雪瓦贴合及新的建筑/服装验收，详情见 [山居焕新规格](docs/V054_PIONEER_HERITAGE_ART.md)。**[PR #22](https://github.com/mastercook777/Little-Haven/pull/22) 已合入 main，[最终 CI #41963981991](https://github.com/mastercook777/Little-Haven/actions/runs/41963981991) 通过 115/115 模拟、TS/Pages 及桌面、390px 手机 Chromium，另验证了冬季 4/4 曲面瓦顶积雪；正式线上以 Pages 部署为准。第五年密集村庄仍约 1063 draw calls，低端 Android 真机 FPS 和四方位人工审美尚未验收。**

**v0.5.3 一篓鱼，两段工（PR #21 已合入 main）**：河岸一小时捕鱼只形成渔棚待运鱼篓，不再瞬间增加粮食；真实常住乡邻另花一小时沿可达路径背回，送达才入村中口粮。库满或道路不通时鱼继续等待，渔棚、粮仓、人物动作和里程碑能追踪实际运输工时。旧档以前已入库的鱼不被重复记账。详情见 [运鱼规格](docs/V053_FISH_HAUL.md)。**[CI #41954573323](https://github.com/mastercook777/Little-Haven/actions/runs/41954573323) 已通过 111 项模拟、类型检查、Pages 构建、桌面与 390px 手机 Chromium 回归，PR #21 已合并到 main；线上可见以 Pages 部署成功为准。木材/农作物流仍未实现。**

**v0.5.2 山路故人（PR #20，已合入 main）**：只有真实常住居民走到茶棚、占用一小时劳动，才能为外来人完成货物交换或热茶招待；同一旅客和同一居民两次有代价的往来会留下熟客记忆，并让下一轮山路来访提早两日。没有额外商贸货币，没有免费增产或自动迁居，旧 v0.5.1 的匿名贸易史不会被伪装成新关系。规格见 [山路故人](docs/V052_FAMILIAR_ROADS.md)，[108 项模拟与桌面／390px 手机 Chromium、正式构建验收](https://github.com/mastercook777/Little-Haven/actions/runs/41948530936) 已全绿并合入主分支；正式网页更新以 Pages 部署为准。\n\n**v0.5.1 山谷有客（PR #19，完整技术验收通过）**：规划以可到达的茶棚、有限停留的独立过客和需要付出真实粮／木／水的交换及招待，延展四年后的村庄生活。新增长期方向「山路有客」，以及真正影响库存的待客方式。游客不是常住乡邻，故事从真实来访记录与场景人物上产生。已通过 [104 项模拟测试与桌面／390px 触摸 Chromium 验收](https://github.com/mastercook777/Little-Haven/actions/runs/41809209029)；主分支发布情况以 PR 合并记录和 Pages 部署为准。详情见 [山路与茶棚的实施规格](docs/V051_VISITORS_TEA_STOP.md)。

**v0.5 长年生计与村落议事（PR #18，已合入 main）**：针对第 2 年后成长停滞，乡邻会真实建出不同轮廓的**河岸渔棚**和**架高粮仓**：渔获要有人在河岸工作，鱼群随季节补充；粮仓扩大存粮上限但不产免费粮。木匠在木作棚耗费真木料、实际工作六小时才能做出锯台。人口可在真实住房／田地／粮水条件下由九人发展至十二人，中央无安全新地时，已有山居可真实付工添木阁。原三项生存建议保留，新增容易找到的**村落议事**入口，支持河岸、田园、木作、自治四种长期倾向，真实项目次序会改变。里程碑和镜头观察都链接到具体实体。最新完整 [99 项模拟 + 桌面和手机浏览器验收](https://github.com/mastercook777/Little-Haven/actions/runs/41790976485) 成功，见 [实施与未完成边界](docs/V05_LIVELIHOOD_IMPLEMENTATION.md)。**尚未实现**全套六行业、矿冶、商旅交易或连续运鱼物流。

**v0.4.5 看得见的村庄生活（PR #17，已合入 main）**：左侧根据真实建房、迁入和留种动态更新章节，点击「看这里」平滑定位实际人物/工地/田地；营地木堆与真实木材库存一致，菜圃的青苗随实际可采库存和四季增减。见 [体验契约](docs/V045_VISIBLE_LIFE_SLICE.md)。94 项模拟测试及桌面/手机浏览器 CI 已通过；实际 Pages 发布以部署任务结果为准。

**v0.4.4 人物命运纵切片（PR #15–16）**：新增六类确定性人物来历、实际共劳羁绊与永久手记，并首次让两位普通农人的真实共劳、留种代价和独占照料工时，在来季决定一块真实菜圃的永久产能（成功 +6%，失败无增益）。详情见 [留种试田的规则与验收](docs/V044C_FIELD_SEED_FATE.md)。尚未引入强制江湖门派或无条件高手奖励；低端设备、美术审计与物流仍需后续优化。

**v0.4.2 开发增量（PR #12）**：原始营地逐步升级为火塘、公共灶和村心广场，村民在真实三餐/晚间参与做饭、用餐和交谈；所有村心升级使用有限木材和居民工时。发布以 PR #12 CI 与 Pages 部署成功为准。

**v0.4.1 工程增量（PR #11）**：建模纠错、真实建筑点击/详情/设施运营、人口与农田联动和粮食收支提示。此前上线版为 Phase B；本增量须通过 PR CI、人工截图检查及 Pages 部署后才可视为正式更新。

**世界观与迭代规范（已实现的只是其中部分）**：[世界观圣经 v1 · 江湖中的村庄](docs/WORLD_BIBLE_V1.md) · [众生命运系统 v1](docs/LIVING_FATES_SYSTEM_V1.md) · [v0.4.x 打磨任务](docs/V04X_PIONEER_POLISH_PLAN.md) · [v0.5 村落成长树](docs/V05_SETTLEMENT_GROWTH_TREE.md)。

- 正式页面上线后可通过首页按钮或 [开荒纪元](https://mastercook777.github.io/Little-Haven/pioneer.html) 进入。旧谷观察模式仍在主页，v3 存档不会被覆盖。
- 从「三人一火，零永久屋舍」开始：梁伯拾柴、陆娘取水、阿禾采食；自主选址搭建第一间棚屋，材料由真实、有限且季节再生的资源点供给。
- Phase B：屋舍与粮食需求继续推动菜圃、山居、木作棚以及旧屋修补。新居民带着姓名和工作真实入住空屋，不是单独上调人口数字。
- 每座设施都要有需求、工单、屋檐防碰撞选址、实材、工时和日志。真实可走路网由居民工作的通勤路径产生，从踩踏路逐步成为土径，建造与人物路线不加载旧村预制路网。
- 支持观察优先、三项基础生存建议与四种长远村落议事方向、1×/4×/12×/流年、四季晴雨雾、各自独立的两组开荒存档、v4 JSON 导入导出和离线时间上限。
- 技术验收包括 3 个不同发展方向同种子/不同种子的第三年地图、空间净空、路可达、资源与人员守恒，以及实际 Chromium 桌面/390px 手机截图。浏览器 CI 通过不等于所有低端安卓设备性能已认证。
- **当前边界**：Phase C 酒肆和江湖人物需等待真实设施门槛，尚未接入；逐点行人互相避让、长期迁址以及专业绑定角色/高端美术仍需后续打磨。阶段名不代表这些内容已经完成。

## 本地运行

Node.js 22+，首次运行需要联网获取 npm 依赖：

```bash
npm install
npm run dev
```

访问 `http://localhost:5188/`。也可使用 Windows 的 `start-windows.bat` 或 macOS/Linux 的 `start-macos-linux.sh`。本地生产构建：`npm run build`。GitHub Pages 构建：`npm run build:pages`。

**在线版本**：[mastercook777.github.io/Little-Haven/](https://mastercook777.github.io/Little-Haven/) — 只有 GitHub Actions Pages 部署成功后才代表最新提交已经上线。

## 如何观察故事

- 拖动旋转 / 滚轮缩放；点击居民查看身份和活动。触屏可单指旋转和双指缩放。
- 初始阿青每天在练武坪练剑；稍后有佩剑客沈问舟沿山路走入酒肆。
- 在 **江湖风闻** 中选择 **留客一宿** 或 **顺其自然**，影响阿青的人生路线。
- 通过 1×、4×、12× 或 **流年（48×）** 观察少年习武、出山、风闻、归来和不同的最终建筑。
- 不选择也可以：旅人会继续上路，阿青依然会自行开启自己的故事。
- 打开 **守望录** 阅读重要变化；进度保存在本机浏览器，离线有上限地结算。

> v0.2 使用 `little-haven-jianghu-v02` 存档键，**不会覆盖之前的 v0.1 存档**。本次是新的江湖篇章，所以从第一天开始。

## 项目文件

```text
src/simulation/world.ts        无浏览器依赖的时钟、居民、武侠故事状态机、存档
src/graphics/village.ts        程序化微缩山谷、酒肆、山道、竹林、练武坪、结局建筑
src/graphics/people.ts         村民、少年、江湖客模型及运动/练武动画
src/main.ts                    Three.js 主循环、灯光、视角、UI 与点击交互
src/styles.css                 桌面/移动响应式风格
index.html                     游戏界面

docs/V02_JIANGHU_BRIEF.md      本轮设计 brief
docs/V02_SCENE_PLAN.md         山谷重构与布局规范
docs/V02_STORY_SYSTEM.md       第一条江湖故事链及测试合同
ROADMAP.md                     已完成和后续优先级
AGENTS.md                      Codex 等开发代理的约束
.agents/skills/                9 个仓库级 Three.js Game Skills
```

## 测试与开发技能

```bash
npm run test:sim      # v0.3 + v0.4 模拟层逻辑回归
npm run check         # TypeScript 类型检查
npm run build:pages   # Pages 生产构建（同时输出 index.html 和 pioneer.html）
```

使用已经放进仓库的 [threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) 时，从 `.agents/skills/threejs-game-director/SKILL.md` 开始，按实际需求使用 gameplay / graphics / UI / QA 同级能力。Skills 只用于帮助开发，不是玩家运行依赖，详见 `docs/SKILLS.md`。

浏览器开发调试：`window.__HAVEN_DEBUG__.getState()`、`.advance(seconds)`、`.choose('host'|'observe')`、`.getRendererInfo()`、`.reset()`。

## v0.3 规划：山谷有岁月

v0.2 仍是目前已上线的版本。**下面是下一阶段的开发规格，暂未实现**：

- [三层时间、四季天气与流年规则](docs/V03_WORLD_FRAMEWORK.md)
- [建筑老化、修葺、扩建及村民生活痕迹](docs/V03_VILLAGE_GROWTH.md)
- [守谷人机缘、庇护与多存档重玩](docs/V03_PLAYER_AGENCY.md)
- [中式微缩村庄空间、动画与渲染升级](docs/V03_ART_DIRECTION.md)

执行顺序参见 [ROADMAP](ROADMAP.md)，先完成小规模系统切片与可视验收，再扩展整村。

## 当前边界

v0.2 刻意只做一条双分支人生故事，不包括真实武功战斗、无穷江湖事件、复杂社会关系或完整自由路径规划。世界模拟与 Three.js 渲染分开，以便 v0.3 持续扩充人物和因果规则。详见 `docs/QA.md`。

## 许可与上游引用

Three.js 使用其开源许可。技能来源及引用见 `THIRD_PARTY_NOTICES.md`。项目本身的独立许可需由维护者确定。
