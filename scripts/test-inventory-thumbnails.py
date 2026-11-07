"""Tool regression checks; uses tiny temporary images, never game assets."""
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name('build-inventory-thumbnails.py')
spec = importlib.util.spec_from_file_location('thumbs', SCRIPT)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class ThumbnailTests(unittest.TestCase):
    def test_selection_rejects_typos_and_preserves_catalog_order(self):
        records = [{'id': 'A', 'name': '甲'}, {'id': 'B', 'name': '乙'}]
        self.assertEqual(tool.select_fish(records, ['乙', 'A', 'A']), records)
        with self.assertRaisesRegex(ValueError, 'Unknown fish'):
            tool.select_fish(records, ['TYPO'])

    def test_crop_ignores_near_transparent_padding_and_keeps_proportions(self):
        image = Image.new('RGBA', (1200, 400), (255, 0, 0, 1))
        image.paste((0, 80, 0, 255), (100, 100, 1100, 300))
        self.assertEqual(tool.inspect(image)['visibleBounds'], (100, 100, 1100, 300))
        self.assertEqual(tool.thumbnail(image, True).size, (512, 102))
        self.assertEqual(image.size, (1200, 400))

    def test_validation_rejects_stretching_and_lost_alpha(self):
        source = Image.new('RGBA', (100, 50), (0, 0, 0, 0))
        source.paste((10, 30, 80, 255), (10, 10, 90, 40))
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'test.webp'
            source.save(target, 'WEBP', lossless=True, exact=True)
            self.assertEqual(tool.check_thumbnail(source, target), [100, 50])
            source.resize((100, 100)).save(target, 'WEBP', lossless=True)
            with self.assertRaisesRegex(ValueError, 'proportions'):
                tool.check_thumbnail(source, target)
            source.convert('RGB').save(target, 'WEBP', lossless=True)
            with self.assertRaisesRegex(ValueError, 'transparency'):
                tool.check_thumbnail(source, target)

    def test_paths_cannot_escape_asset_directories(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                tool.asset_paths(Path(folder), '../outside.png')

    def test_cli_only_writes_selected_thumbnail_and_check_is_read_only(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            shutil.copyfile(SCRIPT, root / 'scripts' / SCRIPT.name)
            (root / 'package.json').write_text('{"type":"module"}', encoding='utf-8')
            records = [{'id': key, 'name': name, 'inventory': {'image': f'{key}.png'}}
                       for key, name in [('A', '甲'), ('B', '乙')]]
            (root / 'fish-data.js').write_text('export const FISH_DATA=' + json.dumps(records), encoding='utf-8')
            assets = root / 'fish-images'
            assets.mkdir()
            for key in ['A', 'B']:
                Image.new('RGBA', (100, 50), (10, 30, 80, 255)).save(assets / f'{key}.png')
            original = (assets / 'A.png').read_bytes()
            command = [sys.executable, str(root / 'scripts' / SCRIPT.name), '--fish', '甲']
            subprocess.run(command, check=True, capture_output=True)
            target = assets / 'thumbnails' / 'A.webp'
            self.assertTrue(target.exists())
            self.assertFalse((assets / 'thumbnails' / 'B.webp').exists())
            before = (target.read_bytes(), target.stat().st_mtime_ns)
            subprocess.run(command + ['--check'], check=True, capture_output=True)
            self.assertEqual((target.read_bytes(), target.stat().st_mtime_ns), before)
            self.assertEqual((assets / 'A.png').read_bytes(), original)
            target.unlink()
            result = subprocess.run(command + ['--check'], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
