# Y Pendulum Lab

An interactive IYPT 2027 Problem 05 Bowditch pendulum workspace. It has three pages: live simulation, data analysis, and theory.

## Run

```sh
python3 server.py
```

Open `http://127.0.0.1:8765/`. The Python server enables `/api/analyze`; the static HTML, JavaScript, and CSS also work on GitHub Pages with `python3 -m http.server 8765` for local preview.

## Features

- Interactive projected 3D Y pendulum with pointer rotation and wheel zoom, 3D bob trail and x–y top-view tracer.
- Live x and y time-series graph, time seeking, run duration, sample rate, speed, and damping controls.
- Geometry-derived or manually specified frequency ratio.
- CSV export of recorded positions and velocities and SVG export of plots.
- Analysis page with CSV upload, frequency estimates from zero crossings, ranges, RMS metrics via Python, and standalone Python CLI analysis.

## Model

For upper string length `S`, support spacing `d`, lower length `l`, and gravity `g`:

```
h = sqrt(S² - (d/2)²)
Lx = l                 Ly = h + l
wx = sqrt(g/Lx)        wy = sqrt(g/Ly)
x(t) = Lx sin(ax) exp(-gammax*t) cos(wx*t)
y(t) = Ly sin(ay) exp(-gammay*t) cos(wy*t + phase)
```

This is an ideal small-angle two-mode model. The 3D scene is a geometric visualization, not a coupled nonlinear dynamics solver. The ideal frequencies do not depend on bob mass. Manual ratio mode is a teaching control rather than a physical frequency derived from the selected strings.

## Python CLI

```sh
python3 analyze.py y-pendulum-run.csv --svg trajectory.svg
python3 -m unittest discover -s tests
```

The CLI uses only the Python standard library.

## References

- [IYPT Y pendulum simulator and physics model](https://github.com/addielu-phy/iypt-2027-p05-y-pendulum)
- [Demonstration video provided for this project](https://m.youtube.com/watch?v=Uqc74fZSONg)
- [IYPT Snailball design reference](https://blxchen.github.io/iypt-snailball/)
