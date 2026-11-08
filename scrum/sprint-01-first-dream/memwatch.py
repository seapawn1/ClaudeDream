"""Sprint 01 working file: sample memory every N seconds while a dream runs (item 8, for the item 10
memory requirement). Appends CSV lines: time, free physical MB, total MB of all claude.exe, largest
claude.exe MB, number of claude.exe. Stop it when the run ends; the peak is the max of each column.

  python -I memwatch.py <out.csv> [seconds]
  python -I memwatch.py --peak <out.csv>
"""
import csv
import io
import subprocess
import sys
import time


def sample():
    out = subprocess.run(["wmic", "OS", "get", "FreePhysicalMemory", "/value"], capture_output=True, text=True).stdout
    free_kb = int(next(l.split("=")[1] for l in out.splitlines() if l.startswith("FreePhysicalMemory")))
    tl = subprocess.run(["tasklist", "/FI", "IMAGENAME eq claude.exe", "/FO", "CSV", "/NH"],
                        capture_output=True, text=True, encoding="mbcs", errors="replace").stdout
    sizes = []
    for row in csv.reader(io.StringIO(tl)):
        if len(row) >= 5 and row[0].lower() == "claude.exe":
            sizes.append(int("".join(ch for ch in row[4] if ch.isdigit())) // 1024)  # "340,884 K" -> MB
    return [time.strftime("%H:%M:%S"), free_kb // 1024, sum(sizes), max(sizes or [0]), len(sizes)]


def main(argv):
    if argv[0] == "--peak":
        rows = list(csv.reader(open(argv[1], encoding="utf-8")))
        print("samples", len(rows))
        print("lowest free MB", min(int(r[1]) for r in rows), "| peak all claude MB", max(int(r[2]) for r in rows),
              "| peak largest claude MB", max(int(r[3]) for r in rows), "| most claude processes", max(int(r[4]) for r in rows))
        return
    every = float(argv[1]) if len(argv) > 1 else 30
    while True:
        with open(argv[0], "a", encoding="utf-8", newline="") as f:
            csv.writer(f).writerow(sample())
        time.sleep(every)


if __name__ == "__main__":
    main(sys.argv[1:])
