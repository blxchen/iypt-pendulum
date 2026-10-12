import math
import unittest
import tempfile
from pathlib import Path

from analyze import analyse, load_csv, svg


class AnalysisTests(unittest.TestCase):
    def test_known_frequency_ratio(self):
        rows = [
            {'time_s': i / 200, 'x_m': math.sin(2 * math.pi * 1.5 * i / 200),
             'y_m': math.sin(2 * math.pi * i / 200)}
            for i in range(2001)
        ]
        result = analyse(rows)
        self.assertAlmostEqual(result['frequency_x_hz'], 1.5, places=3)
        self.assertAlmostEqual(result['frequency_y_hz'], 1, places=3)
        self.assertAlmostEqual(result['frequency_ratio'], 1.5, places=3)
        self.assertIn('<svg', svg(rows))

    def test_short_record_has_no_frequency(self):
        result = analyse([{'time_s': 0, 'x_m': 1, 'y_m': 2},
                          {'time_s': 0.1, 'x_m': 0, 'y_m': 1}])
        self.assertIsNone(result['frequency_ratio'])

    def test_video_csv_missing_detection_is_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'tracked.csv'
            path.write_text('time_s,x_m,y_m,pixel_x,pixel_y\n'
                            '0,0.2,-0.1,120,80\n'
                            '0.1,,,,\n'
                            '0.2,0.3,-0.2,130,90\n')
            rows = load_csv(path)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]['time_s'], 0.2)


if __name__ == '__main__':
    unittest.main()
