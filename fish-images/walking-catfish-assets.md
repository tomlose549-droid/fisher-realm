# 行走鲶素材说明

- 用户原图：`walking-catfish.png`，保留原始字节（1448×1086 RGB）。
- 透明展示图：`cutouts/walking-catfish.png`，2152×731 RGBA，使用内置 image_gen 仅移除白底；保留完整鱼须、鳍尾、朝向、比例及原色。
- 内置工具提示：background-extraction only; remove the white background with true transparent alpha; preserve this exact left-facing fish, complete body outline, original brown/cream colors, mouth, eyes, ALL fine long barbels and their tips, long dorsal/ventral fins, pectoral fin and entire tail; no redraw, redesign, reshape, recolor, stretch, stylize, crop, added objects, shadows, text or white halo. Empty pixels must be transparent above the turquoise UI card.
- 展示图 alpha 为 0–255，alpha≥8 的包围框为 (9,68)–(2146,723)。预览中疑似红/黄色边缘像素 alpha 最大仅3；先检查透明度，不重复抠图，最终在实际青绿色背包底色上验收。
- 轻量缩略图：`thumbnails/cutouts/walking-catfish.webp`，仅对此鱼运行 `python scripts/build-inventory-thumbnails.py --fish WALKING_CATFISH --crop-transparent`，保持比例、原色及透明度。
- 随图提交 `.webp.meta.json`，记录展示源图及缩略图的 SHA-256、裁剪和缩放设置；不处理任何旧鱼图片。
