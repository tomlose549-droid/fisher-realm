# 杰克登普西慈鲷素材说明

- 用户原图：`jack-dempsey.png`，保留原始字节（1448×1086 RGB）。
- 透明展示图：`cutouts/jack-dempsey.png`，1448×1086 RGBA，内置 image_gen 仅去白底，保留完整鳍刺、蓝绿色斑点、鱼体比例及原色。
- 内置工具提示：background-extraction only; remove white background with true transparent alpha; preserve this exact left-facing fish, full mouth/head/eye/body silhouette, every dorsal spine, pectoral/ventral fins, complete tail, original dark olive/brown base colors and all blue/turquoise speckles and skin details; no redraw, redesign, recolor, stretch, stylize, crop, shadows, text, objects or white halo.
- 展示图 alpha 为0–255，alpha≥8 的包围框为 (9, 156, 1440, 952)。只处理一次背景，先检查透明度，再在 indigo 实际背包底色上检视边缘。
- 轻量缩略图：`thumbnails/cutouts/jack-dempsey.webp`，仅运行 `python scripts/build-inventory-thumbnails.py --fish JACK_DEMPSEY --crop-transparent`，保持比例、原色和透明度。
- 随图提交 `.webp.meta.json`，保存展示源图及缩略图的 SHA-256 与裁剪、缩放设置；不处理任何旧鱼图片。
