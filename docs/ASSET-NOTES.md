# 角色素材说明

素材授权范围见 [LICENSING.md](LICENSING.md)；本文件记录生成来源和处理过程，不将收款码归为角色素材。

`src/renderer/assets/whale-girl.png` 是为本项目新生成的原创角色素材，不是 DeepSeek 官方角色或 Logo。

生成方式：Codex 内置图像生成工具；先生成纯洋红键背景，再通过本地 `remove_chroma_key.py` 抠成透明 PNG。

最终生成提示词：

```text
Use case: stylized-concept
Asset type: Windows desktop-pet character sprite, project-bound
Primary request: Create one original chibi deep-sea whale girl mascot for a desktop pet. She is a tiny friendly ocean spirit with a rounded whale-tail hair ornament, small fin-shaped sleeves, and subtle glowing data-stream motifs. The design may evoke an intelligent deep-sea assistant but must not copy DeepSeek's logo, mascot, branding, or any existing character.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal
Subject: one full-body character only, centered, front three-quarter view, floating pose, cheerful gentle expression; oversized head and compact body; crisp silhouette; no loose flyaway hair strands
Style/medium: premium 2D anime game sprite, clean cel shading, polished mobile-game character art, cute but restrained
Composition/framing: full body fully visible, generous even padding on all sides, no cropping, no props detached from the character
Lighting/mood: soft cool ocean glow contained entirely within the character
Color palette: deep navy #0B1F3A, cyan #39D9FF, soft white #EAFBFF, a small amount of warm coral accent; do not use magenta or pink-purple anywhere in the character
Materials/textures: smooth hair, soft fabric, pearlescent whale details, tiny bubble highlights
Constraints: background must be one uniform #ff00ff color with no shadows, gradients, texture, reflections, floor plane, glow spill, or lighting variation; subject edges crisp and clearly separated; no cast shadow; no contact shadow; no reflection; no text; no logo; no watermark; exactly one character
Avoid: DeepSeek trademark or logo, realistic human proportions, sexualized clothing, weapons, clutter, extra characters, purple gradient SaaS aesthetic
```

抠图统计：透明像素 `1,136,649 / 1,572,516`，半透明像素 `10,245 / 1,572,516`。已人工检查透明边缘和主体覆盖范围。

## 0.2.0 性格状态素材

状态素材均以 `whale-girl.png` 作为唯一角色与服装参考，通过 Codex 内置图像生成工具逐张生成；没有把外部参考图直接提交给生成模型，也没有复制外部角色、构图、文字或水印。

共同提示词要求：严格保留现有角色的深海蓝短发与青色发梢、鲸尾发饰、白色侧鳍、蓝青眼睛、深蓝鳍袖与电路纹、白色鲸浪裙片、珍珠胸针、珊瑚色小点和鲸尾；保持 Q 版全身游戏立绘、清晰轮廓和充足留白；使用统一纯色 `#FF00FF` 背景；禁止文字、Logo、水印、投影、地面与洋红色主体细节。

- `states/hungry.png`：期待吃饭的开心表情；一手端带原创小鲸图案的白瓷饭碗和满满白饭，另一手拿筷子，尾巴兴奋上扬。
- `states/sleepy.png`：穿原服装趴卧打盹；双臂垫在脸下、闭眼微笑、嘴边一个浅青透明睡泡，尾巴向后弯起。
- `states/thinking.png`：坐姿托腮认真推理；身边仅有三只表情不同的原创圆润小鲸水灵，禁止问号和文字。
- `states/working.png`：自信拿任务板和青色触控笔；任务板仅含三个抽象复选框与短横线，不出现可读文字或数字。

生成后使用显式键色 `#FF00FF`、软遮罩阈值 `32/96`、去色溢出和 1 px 边缘收缩转换为透明 PNG；已逐张检查主体完整性，其中趴睡素材针对肤色与背景的近似色重新收窄阈值后通过。

## 0.3.0 鲸鱼少年素材

男主采用项目内选定的原创鲸鱼少年概念图 `design/boy-concepts/01b-deep-sea-whale-cadet-soft-build.png` 作为严格身份与服装锚点：圆润童颜、深蓝短发与鲸尾呆毛、白色侧鳍、蓝色眼睛、略有肉感的健康体型、深蓝水手短装、披肩、短裤、装饰短靴和鲸尾。所有画面均保持完整着装、健康可爱且无性化表达。

- `whale-boy.png`：敬礼待机姿势，保留少量独立气泡。
- `states/boy/hungry.png`：端白饭碗与筷子，星星眼期待吃饭。
- `states/boy/sleepy.png`：横向趴睡、闭眼、鼻尖睡泡和抬起的鲸尾。
- `states/boy/thinking.png`：跪坐托腮，周围仅三只原创圆润小鲸。
- `states/boy/working.png`：手持任务板与青色发光笔，任务板只有抽象勾选框和短横线。

四套状态以对应女主状态图作为动作和构图参考，以男主概念图作为身份参考；生成提示明确禁止复制女主身份、发型和服装。全部先生成纯洋红键背景，再使用 `remove_chroma_key.py` 的边框自动取色、软遮罩与去色溢出转换为 1254 × 1254 透明 PNG。

透明像素 / 半透明像素检查结果：待机 `1,148,217 / 8,447`，饿了 `1,161,816 / 8,083`，困倦 `1,138,241 / 7,280`，思考 `1,129,300 / 9,391`，工作 `1,154,265 / 8,577`；五张图四角 Alpha 均为 0，并已逐张完成视觉检查。

## Windows 应用图标

`build/icon-v3.png` 是面向桌面快捷方式、开始菜单和安装包的新应用图标。旧版 `build/icon.png` 直接复用了女主全身立绘，缩小后识别度不足，因此新图标改为不区分角色性别的“鲸尾 + 珍珠 + 声呐环”近景徽记；`icon-v2.png` 保留第一版圆角背景草稿，打包配置使用四角处理更干净的 `icon-v3.png`。

从 0.7.4 起，打包时还会把该图复制到 `resources/app-icon.png`，运行中的窗口与 Windows 系统托盘均直接读取这张 PNG，避免 SVG Data URL 在部分 Windows 环境中显示为空白。

生成方式：Codex 内置图像生成工具；以男女主待机图作为项目配色与鲸尾纹样参考，生成 1254 × 1254 的方形 RGB PNG。

最终生成提示词：

```text
Use case: logo-brand
Asset type: Windows desktop application icon, square raster PNG, project-bound
Primary request: Create a premium, compact app icon emblem for the original Chinese desktop pet “深海鲸灵”. Derive only the established visual motifs and polished cel-shaded finish from the two reference character sprites: a symmetrical luminous whale tail rising from a round pearl, with one small cyan sonar ring and two tiny bubble highlights. Do not include either full character, any face, body, hands, clothing, or text.
Scene/backdrop: full-bleed deep abyss navy rounded-square icon field, subtle radial ocean glow; no transparency required
Style/medium: crisp hand-polished 2D game icon, simplified bold silhouette, clean cel shading, restrained detail, not photorealistic
Composition/framing: perfectly centered close-up emblem, whale tail and pearl occupy about 70% of canvas, generous safe margin, strong silhouette readable at 16 px and 32 px
Lighting/mood: luminous cyan edge light, calm intelligent deep-sea atmosphere
Color palette: deep navy #071A2F, ocean blue #0E4F87, cyan #39D9FF, soft white #EAFBFF, one tiny coral #FF8B7A accent only
Constraints: square 1:1; no letters, no Chinese characters, no logo text, no watermark, no mockup, no border outside the square; do not copy any third-party logo or branding; preserve the project’s original whale-tail-and-pearl identity
Avoid: full-body mascot, human face, tiny intricate linework, crowded bubbles, purple gradient, neon cyberpunk clutter, glossy 3D plastic, illegible micro-details
```

第二轮只针对第一版四角做了编辑，提示词如下：

```text
Use case: precise-object-edit
Asset type: Windows desktop application icon, square raster PNG, project-bound
Input images: Image 1 is the edit target and must remain visually identical except for the four corners
Primary request: Replace only the near-black corner wedges outside the rounded navy icon field with a seamless continuation of the same deep abyss navy background, so the entire 1:1 square canvas is filled edge-to-edge with the navy background. Remove the visible rounded-square boundary at the outer corners.
Constraints: change only the four outer corner/background areas; keep the luminous whale tail, pearl, small fin accents, sonar rings, bubbles, lighting, colors, linework, proportions, placement, and sharpness unchanged; keep 1:1 composition; no new objects; no text; no watermark; no transparency
Avoid: black corner wedges, corner vignette, rounded outer mask, cropping, changing the emblem, changing the cyan glow, adding borders
```
