# 湖吸口鱼素材说明

- 用户原图：`lake-sucker.png`，保留原始字节（1448×1086 RGB）。
- 透明展示图：`cutouts/lake-sucker.png`，1448×1086 RGBA，内置 image_gen 仅去白底，保留浅色鱼鳍、鳞片、鳍尾、原色和比例。
- 内置工具提示：background-extraction only; remove white background with true transparent alpha; preserve this exact left-facing fish, proportions, full mouth/head/eye/body silhouette, dorsal/pectoral/ventral fins and complete tail, original bronze/olive-gold scales, dark lateral shading, pale cream belly and pale fins; do not remove pale fish parts together with the background; no redraw, redesign, recolor, stretch, stylize, crop, white halo, shadows, text or objects.
- 展示图 alpha 为0–255，alpha≥8 的包围框为 (10, 198, 1438, 847)。只处理一次背景，先检查透明度，再在 turquoise 实际背包底色上检视边缘。
- 缩略图：`thumbnails/cutouts/lake-sucker.webp`，仅运行 `python scripts/build-inventory-thumbnails.py --fish LAKE_SUCKER --crop-transparent`，保持比例、原色和透明度。
- 随图提交 `.webp.meta.json`，记录展示源图/缩略图 SHA-256 及裁剪、缩放设置；不处理任何旧鱼图片。
