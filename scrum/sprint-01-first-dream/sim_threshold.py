"""How often rule B passes by chance, and when the dream really helps. Monte Carlo on a plain model:
each old entry is truly stale-or-wrong (share p0) or not; one check calls it wrong with probability r;
r is set so that two checks of an unchanged entry disagree with the measured flip rate f = 2 r (1 - r).
Changed entries: before/after are two independent checks of the same entry, except that a share delta of
the truly stale ones become not stale. Unchanged entries (control): two checks, their flip rate.
Statistic: diff = (stale before - stale after) / n_changed - flips / n_unchanged. Pass when diff > theta."""
import math, random, sys
sys.stdout.reconfigure(encoding="utf-8")
random.seed(7)
P0 = 0.5          # share of old entries that are truly stale or wrong (the checks mark about half)
RUNS = 4000


def one(n_ch, n_un, f, delta):
    r = (1 - math.sqrt(1 - 2 * f)) / 2
    drop = flips = 0
    for _ in range(n_ch):
        stale = random.random() < P0
        before = (not stale) if random.random() < r else stale
        stale_after = stale and random.random() >= delta
        after = (not stale_after) if random.random() < r else stale_after
        drop += int(before) - int(after)
    for _ in range(n_un):
        stale = random.random() < P0
        a = (not stale) if random.random() < r else stale
        b = (not stale) if random.random() < r else stale
        flips += int(a != b)
    return drop / n_ch - flips / n_un


print("share of runs that pass (diff > theta); f = flip rate of the control; delta = share of changed entries really fixed")
print(f"{'f':>5s} {'n_ch/n_un':>10s} {'theta':>6s} | " + " ".join(f"d={d:<4}" for d in (0, 0.1, 0.2, 0.3)))
for f in (0.08, 0.135):
    for n_ch, n_un in ((14, 12), (30, 30), (60, 60)):
        for theta in (0.0, 0.05):
            res = []
            for delta in (0, 0.1, 0.2, 0.3):
                ok = sum(1 for _ in range(RUNS) if one(n_ch, n_un, f, delta) > theta)
                res.append(f"{100 * ok / RUNS:5.1f}%")
            print(f"{f:5.3f} {n_ch:>4d}/{n_un:<5d} {theta:6.2f} | " + " ".join(res))
