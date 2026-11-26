# 首页夜景素材

使用 Codex 内置 ImageGen 生成两张无文字图片，再分别压缩为 WebP。桌面素材是 `frontend/visuals/aurora-desktop.webp`，移动素材是 `frontend/visuals/aurora-mobile.webp`。

首屏 Canvas 在独立素材上实时绘制流动极光、沿阶梯移动的光点和水面反光。动效自动播放。系统启用减少动态效果时展示静态场景，首屏滚出或标签页隐藏时暂停绘制。

## 桌面提示

> Use case: stylized-concept. Generate a photorealistic, original cinematic ENVIRONMENT ONLY for the desktop hero background of a Chinese creator's own portfolio. Ultra-wide 16:9 composition, no text, no web UI, no graphics. A cold almost-black navy sea at night, low distant horizon at 72% height with a little faint warm dusk on the right, delicate real starfield. On the RIGHT HALF a series of broad floating weathered slate slabs with thin warm amber light on their leading edges, near steps starting in the lower right, receding upward and curving gently toward the mid-right high in the sky. One small clearly recognizable person in dark coat stands on the steps in the right third at 68% height, back to us. Natural faint emerald aurora curtains sweep from the upper center to the right, with some translucent tendrils draping down to the stairs. The LEFT 44 percent stays low contrast near-black marine blue across the full height, no objects or bright spots, reserved for separately overlaid white Chinese typography. Carefully restrained light, cold navy and muted emerald with gold highlights, subtle film texture, a real night photo feeling rather than glossy CG. Distinct camera composition, natural coastal ocean surface and physically atmospheric depth. No letters, no logotype, no borders, no buttons. Wide landscape.

## 手机提示

> Use case: stylized-concept. Generate an original portrait 2:3 cinematic background photograph for a MOBILE website hero, environment only. Nearly black marine blue above for a full 42 percent of the composition, without bright objects, so white Chinese text can be overlaid separately. A low dark sea horizon in the bottom quarter, thin warm reflection on water. In the lower right and middle right place a curved chain of slate steps, slender gold highlights on edges, rising from the bottom right toward the right-center. A single tiny human silhouette stands around two-thirds down the frame. A wispy, restrained emerald aurora runs up the right side over the stairs, with very dim star texture outside. Black, cold blue, muted emerald, subtle honey gold. Soft atmospheric film photography, plausible water, uncluttered, moody. The focus of the image belongs in the lower half, readable dark negative space above and at upper left. No text, no logos, no web UI, no frame. Portrait.

## 栏目横幅

使用内置 ImageGen 分别生成四张摄影风格横幅，输出为 1720 像素宽的 WebP。素材位于 `frontend/visuals/`。

共同提示为超宽构图，主体位于画面右侧，中等高度保留手机裁切余量。左侧留出墨蓝色暗部以承载网站文字。使用低饱和青色阴影、暖色高光和写实材质，画面内不放文字或标识。

| 栏目 | 素材 | 主体提示 |
| --- | --- | --- |
| 项目 | `projects-banner.webp` | AI 服务器板上的陶瓷处理器、铜触点与内存模块，侧光强调工业细节 |
| 课程 | `courses-banner.webp` | 台灯照亮打开的笔记本、抽象图示、钢笔和参考书 |
| 旅拍 | `videos-banner.webp` | 川西意象，高山河谷、S 形公路、晨光和薄雾 |
| 开箱 | `unboxing-banner.webp` | 深色桌面上的包装盒、石墨色手机和无线耳机，低机位侧视 |
