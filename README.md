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

In **Data analysis**, **Full run ZIP** downloads the complete configured trajectory, even if playback is paused partway through. Its 18 files include `trajectory.csv` (28 time, position, junction, velocity, acceleration, angle and energy columns), `variable_dictionary.csv`, `parameters.csv`, `results.csv`, `frequency_spectrum.csv`, `manifest.json`, a method note, and 11 SVG graphs. Results include small-angle and simulated frequencies and ratios, FFT peaks, coordinate ranges and RMS values, speed, acceleration, path length, closure distance and energy change. The ZIP is created in the browser without an online analysis service. These are deterministic predictions of the ideal model; use tracked video data for experimental measurements and uncertainty estimates.

## References

- [IYPT 2027 Y-shaped pendulum demonstration](https://www.youtube.com/watch?v=XUTGKF8vy_Y)
- [SnailLab interface reference](https://blxchen.github.io/iypt-snailball/)
- [Nonlinear anisotropic pendulum derivation](https://link.springer.com/article/10.1007/s11071-026-12324-y)

## Video tracking

The **Video tracking** view runs OpenCV.js in the browser. Upload a video, seek to a clear frame, click **Select bob** and then the bob, set the equilibrium origin, and calibrate with two points on a visible ruler of known length. Adjust the HSV tolerances, minimum contour area and maximum frame jump before processing. The tracker plays the video once, samples decoded frames at up to the selected rate using video frame callbacks, and records each frame's actual media time. It converts frames to HSV, thresholds the selected colour, extracts contours, and records the centroid of the best nearby contour. Missing detections remain blank in the exported CSV rather than being filled with simulated values. The Python CLI accepts this CSV and skips blank detections when calculating summary statistics. Use a fixed, near-vertical camera for meaningful x–y measurements. Processing and video data stay in the browser; OpenCV.js is loaded from a pinned CDN build only when the tracking view is used.

The **Data analysis** view adds velocity, x/y phase portraits, speed, mechanical-energy change, mode angles and Hann-windowed FFT spectra. These are computed from the same simulated run shown in the 3D view. The equations in **Physics & method** are rendered from LaTeX with MathJax.

OpenCV.js is the browser build of OpenCV 4.12.0 distributed as `@techstark/opencv-js@4.12.0-release.1`; the tracker follows the [OpenCV.js image and contour APIs](https://docs.opencv.org/4.12.0/d0/d84/tutorial_js_usage.html). MathJax 4 renders the TeX equations.
