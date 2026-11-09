"""Same model as sim_threshold.py, for the other way to read rule B: diff = net drop of the changed entries
minus net drop of the unchanged entries (both as a share of their own group), pass when diff > theta.
Also with a drift: a share `drift` of all entries becomes stale between the two checks (new commits and
sessions make memory older), which the control group shows too."""
import math, random, sys
sys.stdout.reconfigure(encoding="utf-8")
random.seed(11)
P0, RUNS = 0.5, 4000


def one(n_ch, n_un, f, delta, drift):
    r = (1 - math.sqrt(1 - 2 * f)) / 2
    noisy = lambda truth: (not truth) if random.random() < r else truth
    d_ch = d_un = 0
    for _ in range(n_ch):
        stale = random.random() < P0
        after_truth = stale or random.random() < drift
        if stale:
            after_truth = random.random() >= delta
        d_ch += int(noisy(stale)) - int(noisy(after_truth))
    for _ in range(n_un):
        stale = random.random() < P0
        after_truth = stale or random.random() < drift
        d_un += int(noisy(stale)) - int(noisy(after_truth))
    return d_ch / n_ch - d_un / n_un


print("share of runs that pass (net drop changed - net drop unchanged > theta)")
print(f"{'f':>5s} {'drift':>5s} {'n_ch/n_un':>10s} {'theta':>6s} | " + " ".join(f"d={d:<5}" for d in (0, 0.1, 0.2, 0.3)))
for f, drift in ((0.10, 0.0), (0.10, 0.05)):
    for n_ch, n_un in ((14, 12), (30, 30), (60, 60)):
        for theta in (0.0, 0.05, 0.10, 0.15):
            res = []
            for delta in (0, 0.1, 0.2, 0.3):
                ok = sum(1 for _ in range(RUNS) if one(n_ch, n_un, f, delta, drift) > theta)
                res.append(f"{100 * ok / RUNS:5.1f}%")
            print(f"{f:5.2f} {drift:5.2f} {n_ch:>4d}/{n_un:<5d} {theta:6.2f} | " + " ".join(res))
