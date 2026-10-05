# Y Pendulum Lab

An interactive IYPT 2027 Problem 05 Bowditch pendulum workspace inspired by [SnailLab](https://blxchen.github.io/iypt-snailball/). Simulation, analysis and theory are views of one HTML app. Switching views does not reset or pause the run.

## Run

```sh
python3 server.py
```

Open `http://127.0.0.1:8765/`. The Python server adds `/api/analyze`; the simulation and its graphs also work as a static GitHub Pages site. Use `python3 -m unittest discover -s tests` for Python analysis tests.

## Physics

The ideal model assumes fixed supports, taut and inextensible strings, a massless junction, and a point bob. For upper string length `S`, support spacing `d`, lower string length `l`:

```
h = sqrt(S² - (d/2)²),   R = h + l cos(phi)
J = (0, h sin(theta), -h cos(theta))
B = (l sin(phi), R sin(theta), -R cos(theta))
T = (m/2) [l² phi_dot² + R² theta_dot²]
V = -m g R cos(theta)
phi_ddot = -(R/l) sin(phi) theta_dot² - (g/l) sin(phi) cos(theta)
theta_ddot = (2l sin(phi)/R) phi_dot theta_dot - (g/R) sin(theta)
```

The equations follow from the Euler–Lagrange equations and are integrated with fixed-step fourth-order Runge–Kutta at a substep no greater than 1/240 s. Optional damping adds `-2 gammaX phi_dot` and `-2 gammaY theta_dot`. The three rendered string lengths remain exact. The displayed `fx` and `fy` are small-angle reference frequencies; the analysis view estimates actual simulated frequencies from zero crossings. This model does not include junction mass, string stretch, slack or friction.

## Controls and data

Drag the 3D view to orbit; scroll to zoom. The 3D floor trace and x–y graph use the same simulated bob positions. The trace graph has auto scale and zoom controls, labelled metric axes, and SVG export. Time seeking, speed, sampling rate, geometry, release angles, phase and damping are adjustable. The analysis view reads the same run and can export CSV or SVG. The local Python API reports frequency estimates, coordinate ranges and RMS values. `python3 analyze.py run.csv --svg trace.svg` also works offline.

## References

- [IYPT 2027 Y-shaped pendulum demonstration](https://www.youtube.com/watch?v=XUTGKF8vy_Y)
- [SnailLab interface reference](https://blxchen.github.io/iypt-snailball/)
- [Nonlinear anisotropic pendulum derivation](https://link.springer.com/article/10.1007/s11071-026-12324-y)
