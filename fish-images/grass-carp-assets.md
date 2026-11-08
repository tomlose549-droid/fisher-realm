# 草鱼素材说明

- 用户原图：`grass-carp.png`，保留原始字节（1448×1086 RGB）。
- 透明展示图：`cutouts/grass-carp.png`，使用内置 image_gen 仅移除白底，保持鱼的朝向、完整轮廓、比例与原有颜色。
- 内置工具提示：background-extraction only; remove the white background with true transparent alpha; preserve this exact left-facing fish, head, mouth, scales, original olive/silver colors, eye, all fins and entire forked tail; no redesign, reshape, stretch, stylize, recolor, shadows, text or white halo; keep the entire fish uncropped.
- 展示图 alpha 为 0–255，alpha≥8 的包围框为 (15,293)–(1435,830)。预览中疑似黄色边缘像素 alpha 最大仅4；先检查透明度，无需重复抠图，最终在浅绿色实际背包底色上验收。
- 轻量缩略图：`thumbnails/cutouts/grass-carp.webp`，仅此鱼使用 `python scripts/build-inventory-thumbnails.py --fish GRASS_CARP --crop-transparent` 生成，保持比例、原色及透明度。
- 随图提交 `.webp.meta.json`，记录展示源图及缩略图的 SHA-256、裁剪和缩放设置；不处理任何旧鱼图片。
