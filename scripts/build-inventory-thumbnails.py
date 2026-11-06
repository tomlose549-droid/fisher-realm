"""Generate prebuilt, lossless WebP inventory thumbnails; original assets stay intact.
Development tool only: Python + Pillow and Node.js. Run from any directory.
"""
import json, subprocess
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent.parent
records=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {FISH_DATA} from './fish-data.js';console.log(JSON.stringify(FISH_DATA.map(f=>f.inventory.image).filter(Boolean)))"],cwd=root,text=True,encoding='utf-8'))
source_bytes=target_bytes=0
for name in dict.fromkeys(records):
 source=(root/'fish-images'/name).resolve()
 if not source.is_relative_to((root/'fish-images').resolve()): raise ValueError('Asset outside fish-images')
 target=root/'fish-images/thumbnails'/Path(name).with_suffix('.webp')
 target.parent.mkdir(parents=True,exist_ok=True)
 with Image.open(source) as image:
  image=image.convert('RGBA');image.thumbnail((512,384),Image.Resampling.LANCZOS)
  image.save(target,'WEBP',lossless=True,method=6,exact=True)
 source_bytes+=source.stat().st_size;target_bytes+=target.stat().st_size
 print(json.dumps({'source':name,'thumbnail':str(target.relative_to(root)), 'bytes':target.stat().st_size,'size':image.size},ensure_ascii=False))
print(json.dumps({'count':len(set(records)),'sourceBytes':source_bytes,'thumbnailBytes':target_bytes,'reductionPercent':round((1-target_bytes/source_bytes)*100,1)}))
