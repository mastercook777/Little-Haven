# 守望谷 · Little Haven — Three.js Prototype v0.1

> 一座会自己生活的小小山谷。玩家不是市长，也不是上帝式建造者，而是一位偶尔回应村民愿望的守护者。

这是可在桌面或手机浏览器运行的 **Three.js + TypeScript + Vite** 原型，使用纯程序化 3D 模型，无需购买素材、配置 AI API 或搭建后端。

## 快速运行

要求：**Node.js 20.19+ / 22+**，首次安装依赖需要联网。

```bash
npm install
npm run dev
```

打开命令行显示的网址（默认 **http://localhost:5188/**）。Windows 用户也可以直接双击 `start-windows.bat`，首次运行会自动安装依赖；macOS/Linux 可执行 `./start-macos-linux.sh`。

生产构建：

```bash
npm run build
npm run preview
```

构建后的静态文件在 `dist/`。**请通过本地服务器打开**，不要直接双击源码 HTML；Vite 的模块资源需要正常的 HTTP 服务。

## 操作方式

| 操作 | 桌面浏览器 | 触屏设备 |
| --- | --- | --- |
| 旋转村庄 | 按住左键拖动 | 单指拖动 |
| 放大缩小 | 鼠标滚轮 / 工具栏 +/- | 双指缩放 / 工具栏 +/- |
| 查看居民 | 点击居民 | 轻点居民 |
| 守护者事件 | 在右侧信箱选择木桥或花园 | 同左 |
| 时间流速 | 工具栏 1× / 4× / 12× | 同左 |
| 暂停 | 工具栏 `Ⅱ` 或空格 | 工具栏 |
| 编年史 | 山谷手记「翻阅全部记录」 | 同左 |
| 重置存档 | 编年史底部「重新开始」 | 同左 |

## 原型已经实现

- 程序化微缩岛屿：地表、土层、村庄房屋、镇厅、风车、农田、集市、河流、树木、花草、路灯、绵羊与蝴蝶。
- 正交相机、OrbitControls 旋转/缩放，缩放上限和俯仰限制。
- 初始 8 位、最多 10 位居民：不同职业/装束/性格，基于游戏内时钟的工作、闲聊、散步、回家日程；点击查看档案。
- 昼夜变化：光照、天空渐变、窗灯、路灯和时间显示。
- 第一个真正有分支的守护者事件：**修建小桥 / 开辟花园**。施工进度改变 3D 模型，完成后影响人口、幸福感、居民活动区域与编年史。项目约需 43 秒（1×）或 11 秒（4×）。
- 山谷编年史，模拟状态与渲染分离，`localStorage` 自动存档（每五秒、切换后台、关闭页面），重新打开有离线进度结算。为控制跳跃，单次恢复最多推进 120 秒现实时间等价的模拟进度。
- 1×、4×、12× 时间倍率，暂停/继续、重置镜头和存档。
- 核心模拟无需 Three.js，支持 Node 自带测试运行器的自动化测试。

## 项目结构

```text
src/
  main.ts                 UI 交互、主循环、摄像机、灯光、射线拾取
  styles.css              响应式 HUD/美术风格
  simulation/world.ts     确定性的状态、时间、事件、居民日程与存档
  graphics/village.ts     程序化 3D 微缩岛屿与建设进度
  graphics/people.ts      居民 3D 模型与动画
tests/simulation.test.mts  7 项纯逻辑测试
docs/DESIGN.md            玩法设计、核心循环和非目标
docs/QA.md                本次可验证项目与限制
.github/workflows/deploy.yml  可选 GitHub Pages 发布
```

## 测试

```bash
npm run test:sim
npm run check
npm run build
```

其中 `npm run test:sim` 只需 Node.js 22+ 即可运行（使用实验性 TypeScript 类型剥离），不需要启动浏览器；`check` 和 `build` 需要先执行 `npm install`。

页面调试钩子 `window.__HAVEN_DEBUG__`：

```js
__HAVEN_DEBUG__.getState()            // 当前世界存档的拷贝
__HAVEN_DEBUG__.choose('bridge')      // 程序化触发守护者选择
__HAVEN_DEBUG__.advance(50)           // 推进 50 实际秒等效的模拟
__HAVEN_DEBUG__.getRendererInfo()     // 绘制调用和三角形数量
__HAVEN_DEBUG__.reset()               // 临时重置内存世界
```

## 可选：部署 GitHub Pages

完全不必现在部署。确定原型可玩后再建立自己的仓库即可。仓库如果命名为 `Little-Haven`：

1. 把本项目源码推送到 GitHub 仓库 `main` 分支。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 工作流 `.github/workflows/deploy.yml` 会自动运行模拟测试、执行 `npm run build:pages` 并发布 `dist/`。
4. 网页地址通常为 `https://<用户名>.github.io/Little-Haven/`。

**仓库名如果不是 `Little-Haven`，请把 `vite.config.ts` 里的 `/Little-Haven/` 改为实际仓库名**。GitHub Pages 只托管静态文件；目前存档保存在用户设备本地，不会同步到云端。

## Skill 工作流

参考 [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) 的开发分层：director → gameplay-systems → graphics-builder → game-ui-designer → qa-release。项目中实现了独立模拟、视觉脚本、调试钩子、自动化测试、设计简报和 QA 记录。**不需要装 Skills 才能运行游戏**。想让本机 Codex 自动调用该 Skill 包，可按上游 README 安装。

## 目前尚未实现

- 村民没有完整的碰撞/动态导航网格，日程路径采用位置插值；部分路线可能穿越建筑或河岸。
- 没有家庭、恋爱、代际更替，也没有完整经济生产/消耗和无限村庄扩张。
- 两个守护者分支只能选择其一，没有第二封信；这是用来验证「选择 → 可见建设 → 后续变化」的垂直切片。
- 音效仅有可选的实验性极轻背景音，不是完成版声音设计。
- 存档只在当前浏览器设备内有效；清理浏览器数据会丢失存档。
- 尚未完成性能分级或在实体手机上的 FPS 测试。

## License

此原型源码供个人研究与继续开发。Three.js 本身依据其开源协议授权。若用于公开发布，请添加你希望使用的完整项目许可。
