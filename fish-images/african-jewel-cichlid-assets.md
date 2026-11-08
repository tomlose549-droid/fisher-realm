# 非洲宝石慈鲷素材说明

- 用户原图：`african-jewel-cichlid.png`，保留原始字节（1448×1086 RGB）。
- 透明展示图：`cutouts/african-jewel-cichlid.png`，1448×1086 RGBA，内置 image_gen 仅去白底，保留鳍尾、红色鱼身、蓝色斑点、原色及比例。
- 内置工具提示：background-extraction only; remove white background with true transparent alpha; preserve this exact left-facing fish, full mouth/head/eye/body silhouette, every dorsal spine, pectoral/ventral fins and complete tail, original vivid red/orange body, blue/turquoise speckles, dark spots and photographic skin/fin details; no redraw, redesign, recolor, stretch, stylize, crop, shadows, text, added objects or white halo.
- 展示图 alpha 为0–255，alpha≥8 的包围框为 (12, 157, 1436, 932)。只处理一次背景，先检查透明度，再在 blue 实际背包底色上检视边缘。
- 轻量缩略图：`thumbnails/cutouts/african-jewel-cichlid.webp`，仅运行 `python scripts/build-inventory-thumbnails.py --fish AFRICAN_JEWEL_CICHLID --crop-transparent`，保持比例、原色和透明度。
- 随图提交 `.webp.meta.json`，记录展示源图/缩略图的 SHA-256 及裁剪、缩放设置；不处理任何旧鱼图片。
