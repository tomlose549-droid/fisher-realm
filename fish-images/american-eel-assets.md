美洲鳗鲡素材

- `american-eel.png`：用户提供的白底原图，原样保留。
- `cutouts/american-eel.png`：使用内置 image_gen 的 background-extraction 编辑模式生成透明底展示素材。
- `thumbnails/cutouts/american-eel.webp`：经用户之前授权的本地 Python/Pillow 缩略图流程生成，512×61，无损WebP。仅取alpha≥8像素的包围范围以忽略近透明空白，再等比缩小；鱼体不拉伸。原图和透明底大图不被修改。

最终编辑提示：仅移除白底和非自然的红黄色边缘，保留原图美洲鳗鲡向左、全身平直的姿态、身体比例、鳍尾、原色和摄影纹理；输出透明背景，无文字、无新增物体。使用内置工具，未使用CLI/API后备路径。
