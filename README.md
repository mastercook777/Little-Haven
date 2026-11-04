# 守望谷 | Little Haven — v0.3 经典观察 / v0.4 开荒预览

> 山外是江湖，山里有故人。守望一座以无名酒肆为中心的微缩武侠山谷，看看它如何悄悄生出故事。

这是一个基于 **Three.js + TypeScript + Vite** 的观察型武侠放置网页游戏原型。程序化 Low-poly 中国山居、酒肆、竹林、练武坪、石桥；居民会按照作息行动，一名少年和一位旅人拥有可见的两结局故事链。**无需账号、素材生成 API 或后端服务器。**

## v0.4 开荒纪元 · Phase A + B 公测（独立模式）

**后续开发文档**：[第 4 年实玩反馈与 v0.4.x 打磨计划](docs/V04X_PIONEER_POLISH_PLAN.md) · [v0.5 村落成长树草案](docs/V05_SETTLEMENT_GROWTH_TREE.md)（均为规划，未实施）。

- 正式页面上线后可通过首页按钮或 [开荒纪元](https://mastercook777.github.io/Little-Haven/pioneer.html) 进入。旧谷观察模式仍在主页，v3 存档不会被覆盖。
- 从「三人一火，零永久屋舍」开始：梁伯拾柴、陆娘取水、阿禾采食；自主选址搭建第一间棚屋，材料由真实、有限且季节再生的资源点供给。
- Phase B：屋舍与粮食需求继续推动菜圃、山居、木作棚以及旧屋修补。新居民带着姓名和工作真实入住空屋，不是单独上调人口数字。
- 每座设施都要有需求、工单、屋檐防碰撞选址、实材、工时和日志。真实可走路网由居民工作的通勤路径产生，从踩踏路逐步成为土径，建造与人物路线不加载旧村预制路网。
- 支持观察优先、有限的三种发展建议、1×/4×/12×/流年、四季晴雨雾、各自独立的两组开荒存档、v4 JSON 导入导出和离线时间上限。
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
