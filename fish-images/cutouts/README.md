# 鱼图片透明底版本

使用内置 image_gen 编辑工具制作，仅用于背包、鱼堆与拖动预览。仓库中的原图保留在上一级目录；可运行 ZIP 只包含游戏实际使用的透明底版本。

输出：tilapia.png（罗非鱼）、bluegill.png（蓝鳃太阳鱼）、redear.png（红耳太阳鱼）、blackberry.png（黑莓鲈）、shiner.png（金色闪光鲦）。

每张图分别使用对应同名原图作为编辑目标，transparent_background=true。共同提示词如下，NAME 替换为对应英文文件名：

> Use case: background-extraction. Edit target: the single supplied NAME fish image. For a game inventory icon, remove ONLY the white background and replace it with actual transparent alpha. Preserve the exact fish silhouette, anatomy, proportions, scales, markings, eye, fins, tail, facing-left pose, original colors and lighting. Do not redraw, stylize, recolor, stretch, crop any part of the fish, or add shadows or outlines. Keep the whole fish visible with a small transparent margin, tightly framed so it scales up clearly in inventory slots. White and pale regions that belong to the fish must stay opaque. Output one isolated fish on a truly transparent background, no other elements, no text.

显示时使用 object-fit: contain，关闭背景混色；格子底色与图片分别绘制。

罗非鱼最终版本的定向修正提示词：

> Use case: background-extraction. Edit target: the supplied original tilapia image. Remove the white background completely to alpha=0, right up to the fish silhouette. Keep the actual fish opaque, with its existing colors and anatomy. Output a clean transparent PNG cutout of this exact original fish, facing left, full head fins and tail intact, original 3:2 aspect ratio and proportional anatomy. This is an inventory sprite; absolutely NO cast shadow, NO glow, NO halo, NO gradient, NO blur, NO colored backdrop or residue, NO ghosted silhouette. Empty space must be completely transparent and the fish must remain opaque. Preserve the source image; edit only the background.
