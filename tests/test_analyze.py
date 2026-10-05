import math
import unittest

from analyze import analyse, svg


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


if __name__ == '__main__':
    unittest.main()
