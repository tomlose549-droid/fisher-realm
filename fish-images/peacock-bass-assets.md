# 孔雀鲈素材说明

- 用户原图：`peacock-bass.png`，保留原始字节（1448×1086 RGB）。
- 透明展示图：`cutouts/peacock-bass.png`，1448×1086 RGBA，内置 image_gen 仅去白底，保留鱼鳍、尾斑、条纹、原色与比例。
- 内置工具提示：background-extraction only; remove white background with true transparent alpha; preserve this exact left-facing fish, complete mouth/head/eye/body outline, every dorsal spine, all fins and complete tail; preserve yellow/olive-green body, black vertical stripes, orange/red fins, yellow-ringed black tail spot and photographic detail; no redesign, redraw, recolor, stretch, stylize, crop, shadows, text, added objects or white halo.
- 展示图 alpha 为0–255，alpha≥8 的包围框为 (6, 204, 1431, 896)。只处理一次背景，先检查透明度，再在 indigo 实际背包底色上检视边缘。
- 缩略图：`thumbnails/cutouts/peacock-bass.webp`，仅运行 `python scripts/build-inventory-thumbnails.py --fish PEACOCK_BASS --crop-transparent` 生成，保持比例、原色和透明度。
- 随图提交 `.webp.meta.json`，记录展示源图/缩略图的 SHA-256 及裁剪、缩放设置；不处理任何旧鱼图片。
