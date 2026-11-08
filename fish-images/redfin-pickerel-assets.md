# 红鳍狗鱼素材

- `redfin-pickerel.png`：用户提供的白底原图，1448×1086，原样保留。
- `cutouts/redfin-pickerel.png`：内置 image_gen 的 background-extraction 编辑输出，2172×724，真实透明背景；保留向左姿态、全身、红橙色鱼鳍和原有斑纹。
- `thumbnails/cutouts/redfin-pickerel.webp`：仅为本鱼运行已授权的 Python/Pillow 缩略图工具，按 alpha≥8 的可见包围框裁去透明留白，再等比缩小，512×136，无损 WebP，85,258字节。
- 对应 `.webp.meta.json` 记录展示源图/缩略图内容哈希与处理设置。背包、鱼堆、图鉴列表使用缩略图，展开图鉴后加载透明底大图。

编辑目标仅为用户新提供的红鳍狗鱼图片。提示要求只去白底，保留鱼体比例、原色、鳞片、眼、嘴、完整鱼鳍与尾巴，不重画、不拉伸、不加阴影或描边。生成后先检查透明度；预览中部分鲜红边缘像素的 alpha 仅1–5/255，未因其单独重复抠图，最终在实际靛蓝色背包底色上核对效果。

生成命令：`python scripts/build-inventory-thumbnails.py --fish REDFIN_PICKEREL --crop-transparent`。旧鱼图片及其缩略图未处理。
