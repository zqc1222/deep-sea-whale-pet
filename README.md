# 深海鲸灵 · Windows 桌宠

一个原创的“深海鲸灵”桌面宠物原型，内置鲸鱼少女与鲸鱼少年两位主角。它采用 Electron + React + TypeScript 构建，支持透明置顶窗口、拖拽、点击反馈、聊天、专注计时、设置持久化和系统托盘。

> 这是非官方同人概念原型，与 DeepSeek 官方无隶属、授权或背书关系。项目没有使用 DeepSeek Logo、官方角色素材或复制的品牌视觉。

## 已实现

- 透明、无边框、始终置顶的桌宠窗口
- 鼠标拖拽与多显示器工作区边界保护，位置自动保存
- 透明空白区域动态点击穿透，不挡住后面的桌面图标与窗口
- 待机持续漂浮与呼吸、动态阴影、多节奏气泡、随机眨眼和偶发轻微偏头
- 保留主立绘，并随机切换“想吃白饭、趴睡、认真思考、任务板工作”四种性格状态
- 设置页可在鲸鱼少女与鲸鱼少年之间切换；两位角色各自拥有待机、饿了、困倦、思考和工作五套完整素材
- 每次进入新状态时自动显示贴合情境的随机短句，并用状态标签和颜色区分饭点、休眠、思考与专注
- 聊天时显示思考形态，进入专注面板时显示任务板工作形态
- 长对话使用独立消息滚动区，输入框、底部导航和左侧角色始终留在窗口内
- 右侧快捷栏平时自动隐藏，靠近角色时浮现；星光按钮可手动轮播状态
- 点击开心、连续点击晕乎、拖拽和专注完成庆祝状态
- 单击随机气泡、双击聊天、右键原生菜单
- 本地陪伴聊天，无需密钥即可体验
- OpenAI-compatible 模型适配器
- 设置页可在本地陪伴与 API 模式之间显式切换，切回本地不会删除已加密的模型配置
- 桌宠大小支持输入 50%–200% 的任意整数比例，并提供常用尺寸快捷值
- 25 分钟专注计时
- 音效、减少动画、开机启动、80% / 100% / 120% 缩放
- Windows 系统托盘：显示/隐藏、聊天、专注、设置、退出
- 浏览器演示模式，方便不启动 Electron 时检查界面与交互

## 开发运行

环境建议：Node.js 22+，Windows 10/11。

```powershell
npm install
npm run dev
```

常用操作：

- 单击角色：随机气泡互动
- 双击角色：打开聊天面板
- 拖动角色：移动到桌面任意位置
- 右键角色：打开功能菜单
- 靠近角色：显示右侧快捷栏；点击星光按钮轮播状态
- 托盘图标：显示或隐藏桌宠

## 浏览器演示

浏览器模式会模拟桌面背景和主要交互，但不会连接外部模型，也不会保存 API Key。

```powershell
npm run demo
```

然后打开终端显示的本地地址，默认通常是 `http://127.0.0.1:5173`。

## 检查与构建

```powershell
# TypeScript 严格检查
npm run typecheck

# 构建 Electron 主进程、预加载和渲染页面
npm run build

# 生成 Windows NSIS 安装包与 portable 版本
npm run package
```

打包产物默认写入 `dist/`。

当前输出：

- `DeepSeaWhalePet-Setup-0.3.0-x64.exe`：可选择安装目录的 Windows 安装版
- `DeepSeaWhalePet-Portable-0.3.0-x64.exe`：无需安装的便携版

项目没有配置商业代码签名证书，因此 Windows SmartScreen 可能显示“未知发布者”。源码和 SHA-256 校验值都随项目提供；正式公开分发前建议购买并配置 Authenticode 代码签名证书。

默认 `npm run package` 使用镜像下载 Electron 打包组件；网络可直接访问官方 GitHub Releases 时，也可以使用 `npm run package:direct`。

## 模型设置与安全

设置页接受 OpenAI-compatible 的 Base URL、模型名和 API Key。

- 渲染页面通过白名单 preload API 与主进程通信。
- `contextIsolation` 已开启，`nodeIntegration` 已关闭，sandbox 已开启。
- API Key 不会返回给渲染页面，不会写进项目仓库，也不会输出到日志。
- 在 Electron 模式下，Key 使用系统 `safeStorage` 加密后保存在应用数据目录。
- 所有模型请求都由主进程发出，并设有消息长度、数量和响应超时限制。

建议把 Base URL 填到版本级路径，例如：

```text
https://api.example.com/v1
```

程序会自动补上 `/chat/completions`。

## 目录

```text
src/
  main/          Electron 主进程、窗口、托盘、安全存储、模型请求
  preload/       contextBridge 白名单 API
  renderer/      React 界面、动画、聊天、计时与设置
  shared/        主进程和渲染进程共享类型
work/imagegen/   角色素材的抠图中间文件（被 gitignore 忽略）
docs/            角色素材来源与生成说明
```

## 替换角色素材

女主待机素材为 `src/renderer/assets/whale-girl.png`，男主待机素材为 `src/renderer/assets/whale-boy.png`。女主状态素材位于 `src/renderer/assets/states/`，男主状态素材位于 `src/renderer/assets/states/boy/`。

替换时建议保留：

- 正方形透明 PNG 或 WebP
- 角色完整、四周有留白
- 主体颜色避免与桌面常见背景完全融在一起
- 文件名保持不变，或同步修改 `src/renderer/src/App.tsx` 的导入路径

## 设计方向

界面采用“深海观测站里的小精灵”概念：深海蓝为主体，青色声呐线和珊瑚色小点作强调；面板使用不规则圆角、细网格与数据深度刻度，避免常见的通用 SaaS 卡片风格。
