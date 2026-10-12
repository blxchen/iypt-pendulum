"""Dependency-free Bowditch pendulum CSV analysis and SVG figure generation."""
import argparse
import csv
import json
import math
from pathlib import Path
from statistics import median


def frequency(rows, key):
    crossings = []
    steps = [b['time_s'] - a['time_s'] for a, b in zip(rows, rows[1:])
             if b['time_s'] > a['time_s']]
    regular_step = median(steps) if steps else float('inf')
    for a, b in zip(rows, rows[1:]):
        if b['time_s'] - a['time_s'] > 1.5 * regular_step:
            continue  # A missed video detection is not an observed crossing.
        y0, y1 = a[key], b[key]
        if y0 < 0 <= y1 and y1 != y0:
            crossings.append(a['time_s'] + (b['time_s'] - a['time_s']) * (-y0) / (y1 - y0))
    if len(crossings) < 2 or crossings[-1] == crossings[0]:
        return None
    return (len(crossings) - 1) / (crossings[-1] - crossings[0])


def analyse(rows):
    if len(rows) < 2:
        raise ValueError('At least two samples are required')
    rows = sorted(rows, key=lambda r: r['time_s'])
    fx, fy = frequency(rows, 'x_m'), frequency(rows, 'y_m')
    return {
        'samples': len(rows),
        'duration_s': rows[-1]['time_s'] - rows[0]['time_s'],
        'frequency_x_hz': fx,
        'frequency_y_hz': fy,
        'frequency_ratio': fx / fy if fx is not None and fy else None,
        'x_range_m': max(r['x_m'] for r in rows) - min(r['x_m'] for r in rows),
        'y_range_m': max(r['y_m'] for r in rows) - min(r['y_m'] for r in rows),
        'x_rms_m': math.sqrt(sum(r['x_m'] ** 2 for r in rows) / len(rows)),
        'y_rms_m': math.sqrt(sum(r['y_m'] ** 2 for r in rows) / len(rows)),
    }


def svg(rows):
    width, height, pad = 900, 600, 65
    max_abs = max(0.001, *(abs(r[k]) for r in rows for k in ('x_m', 'y_m'))) * 1.15
    x = lambda r: width / 2 + r['x_m'] / max_abs * (height - 2 * pad) / 2
    y = lambda r: height / 2 - r['y_m'] / max_abs * (height - 2 * pad) / 2
    path = ' '.join(f'{"M" if i == 0 else "L"}{x(r):.2f},{y(r):.2f}' for i, r in enumerate(rows))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<rect width="100%" height="100%" fill="#0a2432"/><path d="M{width/2} {pad}V{height-pad} M{pad} {height/2}H{width-pad}" stroke="#42636d"/>
<text x="65" y="38" fill="#eaf2ee" font-family="sans-serif" font-size="24">Y pendulum · x–y trajectory</text>
<path d="{path}" fill="none" stroke="#c5ec70" stroke-width="2"/>
<text x="{width-100}" y="{height-25}" fill="#9bb6bc" font-family="sans-serif">x (m)</text>
<text x="25" y="55" fill="#9bb6bc" font-family="sans-serif">y (m)</text></svg>'''


def load_csv(path):
    with open(path, newline='', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        if not {'time_s', 'x_m', 'y_m'} <= set(reader.fieldnames or []):
            raise ValueError('CSV needs time_s, x_m and y_m columns')
        return [{k: float(row[k]) for k in ('time_s', 'x_m', 'y_m')}
                for row in reader if all(row.get(k, '').strip() for k in ('time_s', 'x_m', 'y_m'))]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_file')
    parser.add_argument('--svg', help='Optional SVG output path')
    args = parser.parse_args()
    data = load_csv(args.csv_file)
    print(json.dumps(analyse(data), indent=2))
    if args.svg:
        Path(args.svg).write_text(svg(data), encoding='utf-8')
