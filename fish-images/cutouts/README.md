# 鱼图片透明底版本

使用内置 image_gen 编辑工具制作，仅用于背包、鱼堆与拖动预览。仓库中的原图保留在上一级目录；可运行 ZIP 只包含游戏实际使用的透明底版本。

输出：tilapia.png（罗非鱼）、bluegill.png（蓝鳃太阳鱼）、redear.png（红耳太阳鱼）、blackberry.png（黑莓鲈）、shiner.png（金色闪光鲦）。

每张图分别使用对应同名原图作为编辑目标，transparent_background=true。共同提示词如下，NAME 替换为对应英文文件名：

> Use case: background-extraction. Edit target: the single supplied NAME fish image. For a game inventory icon, remove ONLY the white background and replace it with actual transparent alpha. Preserve the exact fish silhouette, anatomy, proportions, scales, markings, eye, fins, tail, facing-left pose, original colors and lighting. Do not redraw, stylize, recolor, stretch, crop any part of the fish, or add shadows or outlines. Keep the whole fish visible with a small transparent margin, tightly framed so it scales up clearly in inventory slots. White and pale regions that belong to the fish must stay opaque. Output one isolated fish on a truly transparent background, no other elements, no text.

显示时使用 object-fit: contain，关闭背景混色；格子底色与图片分别绘制。

罗非鱼最终版本的定向修正提示词：

> Use case: background-extraction. Edit target: the supplied original tilapia image. Remove the white background completely to alpha=0, right up to the fish silhouette. Keep the actual fish opaque, with its existing colors and anatomy. Output a clean transparent PNG cutout of this exact original fish, facing left, full head fins and tail intact, original 3:2 aspect ratio and proportional anatomy. This is an inventory sprite; absolutely NO cast shadow, NO glow, NO halo, NO gradient, NO blur, NO colored backdrop or residue, NO ghosted silhouette. Empty space must be completely transparent and the fish must remain opaque. Preserve the source image; edit only the background.

## 欧洲河鲈补图 · V0.16

使用内置 image_gen 编辑工具（transparent_background=true），以 ../european-perch.png 为编辑目标，输出 european-perch.png。原图单独保留。

提示词：
Use case: background-extraction. Edit target: the single provided European perch fish image. Remove ONLY its white background to genuinely transparent alpha=0. Preserve this exact fish's shape, original proportions, facing-left pose, colors, scales, markings, pale opaque fish belly, complete head, all fins, and tail. No redraw or stylization. No shadow, glow, halo, gradient, colored background, or white rectangle. Keep the entire fish visible with a small transparent margin for an inventory icon. Fish stays opaque, empty space completely transparent.

## 斑点叉尾鮰和白鮰 · V0.17

内置 image_gen 编辑工具，transparent_background=true。分别以 ../channel-catfish.png、../white-catfish.png 为编辑目标，输出 channel-catfish.png、white-catfish.png，原图保留。

提示词：
Use case: background-extraction. Edit target: the single supplied fish photo. Remove ONLY the white background to completely transparent alpha=0, keep fish opaque including pale belly. Preserve the exact source fish silhouette, all delicate whiskers/barbels, fins and complete tail, natural proportions, scales/spots, original colors and lighting, facing left. Do not redraw or stylize. No shadow, glow, halo, gradient or white rectangle. Entire fish with small transparent margin, no cropping, for an inventory icon.

## 大口黑鲈与链纹狗鱼 · V0.20

内置 image_gen 编辑工具，transparent_background=true。分别以 ../largemouth-bass.png、../chain-pickerel.png 为编辑目标，输出 largemouth-bass.png、chain-pickerel.png。原图保留。

提示词：
Use case: background-extraction. Edit target: the single supplied fish image. Remove ONLY the white background to genuinely transparent alpha=0; keep pale fish belly and entire fish opaque. Preserve exact silhouette, anatomy, original proportions, full head/mouth, all fins and complete tail, scales and markings, source colors and lighting, facing left. No redraw, no stylization, no stretching or cropping. No white rectangle, shadows, glow, halo, gradient or background residue. Entire fish visible with a small transparent margin for an inventory icon.

## 豹纹翼甲鲶 · V0.22

内置 image_gen 编辑工具，transparent_background=true。以 ../leopard-pleco.png 为编辑目标，输出 leopard-pleco.png。原图保留。

提示词：
Use case: background-extraction. Edit target: the single provided leopard pleco fish image. Remove ONLY the white background to genuinely transparent alpha=0; keep the entire fish opaque including pale areas. Preserve the exact source fish silhouette, anatomy, original proportions, leopard markings and colors, full head, all delicate small appendages, large dorsal fin, other fins and complete tail, original lighting and facing-left pose. Do not redraw, stylize, recolor, stretch or crop. No shadows, glow, halo, gradients or white rectangle. Entire fish visible with a small transparent margin, for a game inventory icon.

## 长吻雀鳝 · V0.23

内置 image_gen 编辑工具，transparent_background=true。以 ../longnose-gar.png 为编辑目标，保存为 longnose-gar.png，原图保留。

提示词：
Use case: background-extraction. Asset type: fishing-game inventory sprite. Input image: edit target, provided 长吻雀鳝 fish. Remove only the white background and output true transparent alpha. Keep the entire original fish silhouette, anatomy, pose, all fins, mouth, eye, tail, scales, markings, original colors and proportions unchanged. Fish itself must stay opaque including pale belly and fin details. Center the whole fish with a small transparent margin, no clipping, no stretching, no added lighting, no shadow, no glow, no white halo, no text or new objects.

## 玛雅慈鲷 · V0.23

内置 image_gen 编辑工具，transparent_background=true。以 ../mayan-cichlid.png 为编辑目标，保存为 mayan-cichlid.png，原图保留。

提示词：
Use case: background-extraction. Asset type: fishing-game inventory sprite. Input image: edit target, provided 玛雅慈鲷 fish. Remove only the white background and output true transparent alpha. Keep the entire original fish silhouette, anatomy, pose, all fins, mouth, eye, tail, scales, markings, original colors and proportions unchanged. Fish itself must stay opaque including pale belly and fin details. Center the whole fish with a small transparent margin, no clipping, no stretching, no added lighting, no shadow, no glow, no white halo, no text or new objects.

## 地图鱼 · V0.24

内置 image_gen 编辑工具，transparent_background=true。原图 ../oscar.png，成品 oscar.png。

提示词：
Use case: background-extraction. Edit target: supplied Oscar fish image. Remove ONLY white background to true transparent alpha. Preserve exact entire fish silhouette, anatomy, natural proportions, orange markings, original colors and lighting, pale opaque areas, full head, all fins and complete tail. No stretching, cropping, recoloring, stylization, shadows, glow, halo, text or white rectangle. Fish opaque, empty space transparent; small transparent margin for inventory sprite.

## 黄鲶 · V0.25

内置 image_gen 编辑工具，transparent_background=true。原图 ../yellow-bullhead.png，成品 yellow-bullhead.png。

提示词：
Use case: background-extraction. Edit target: supplied 黄鲶 fish. Remove ONLY white background to true transparent alpha. Keep entire original fish opaque including pale belly and delicate fins. Preserve exact anatomy, proportions, colors, lighting, markings, full head, all whiskers/barbels if present, all fins and complete tail. No redraw, cropping, stretching, recoloring, shadow, halo, glow or white rectangle. Whole fish centered with small transparent margin for inventory sprite.

## 弓鳍鱼 · V0.25

内置 image_gen 编辑工具，transparent_background=true。原图 ../bowfin.png，成品 bowfin.png。

提示词：
Use case: background-extraction. Edit target: supplied 弓鳍鱼 fish. Remove ONLY white background to true transparent alpha. Keep entire original fish opaque including pale belly and delicate fins. Preserve exact anatomy, proportions, colors, lighting, markings, full head, all whiskers/barbels if present, all fins and complete tail. No redraw, cropping, stretching, recoloring, shadow, halo, glow or white rectangle. Whole fish centered with small transparent margin for inventory sprite.


## V0.25.1 加载优化

黄鲶 yellow-bullhead.webp（1007688 字节）和弓鳍鱼 bowfin.webp（1378322 字节）由已有 PNG 无损重新编码，尺寸和逐像素 RGBA 完全一致，不修改图像内容；原始 PNG 与上方内置工具提示词保留。
