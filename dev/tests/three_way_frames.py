"""Side by side: the same frames with each tracker's skeleton (Regular, Accurate, RTMPose), at the clip's fastest moments.
Usage: python3 three_way_frames.py <clip> <full dump> <heavy dump> <rtm dump> <out.png> [frames]"""
import sys, json, subprocess, io
from PIL import Image, ImageDraw
clip, fa, fb, fc, out = sys.argv[1:6]; nf = int(sys.argv[6]) if len(sys.argv) > 6 else 4
D = [json.load(open(f)) for f in (fa, fb, fc)]; names = ['Regular', 'Accurate', 'RTMPose']; cols = ['#6E8BFF', '#4FD1A1', '#FFB347']
S = D[0]['S']
def pt(d, i, j): o = i * S; return d['raw'][o + 1 + j * 3], d['raw'][o + 2 + j * 3], d['raw'][o + 3 + j * 3]
def near(d, t):
    best, bd = None, 1e9
    for i in range(d['n']):
        dd = abs(d['raw'][i * S] - t)
        if dd < bd: bd, best = dd, i
    return best if bd < 0.03 else None
# fastest moments: wrist + ankle speed in the Accurate track
d1 = D[1]; sp = []
for i in range(1, d1['n']):
    s = 0
    for j in (15, 16, 27, 28):
        a, b = pt(d1, i, j), pt(d1, i - 1, j)
        if a[0] == a[0] and b[0] == b[0]: s += ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
    sp.append((s, d1['raw'][i * S]))
sp.sort(reverse=True); picks = []
for s, t in sp:
    if all(abs(t - p) > 1.5 for p in picks): picks.append(t)
    if len(picks) >= nf: break
picks.sort()
BONES = [(11, 13), (13, 15), (12, 14), (14, 16), (11, 12), (23, 24), (11, 23), (12, 24), (23, 25), (25, 27), (24, 26), (26, 28), (27, 31), (28, 32), (27, 29), (28, 30), (15, 19), (16, 20)]
rows = []
for t in picks:
    png = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', clip, '-frames:v', '1', '-f', 'image2', '-vcodec', 'png', '-'], capture_output=True).stdout
    base = Image.open(io.BytesIO(png)).convert('RGB'); W, H = base.size; panels = []
    for m, d in enumerate(D):
        im = base.copy(); dr = ImageDraw.Draw(im); i = near(d, t)
        if i is not None:
            for a, b in BONES:
                pa, pb = pt(d, i, a), pt(d, i, b)
                if pa[0] == pa[0] and pb[0] == pb[0] and min(pa[2], pb[2]) > 0.3:
                    dr.line([(pa[0] * W, pa[1] * H), (pb[0] * W, pb[1] * H)], fill='black', width=7); dr.line([(pa[0] * W, pa[1] * H), (pb[0] * W, pb[1] * H)], fill=cols[m], width=4)
            for j in (15, 16, 31, 32):
                p = pt(d, i, j)
                if p[0] == p[0] and p[2] > 0.3: dr.ellipse([p[0] * W - 5, p[1] * H - 5, p[0] * W + 5, p[1] * H + 5], fill=cols[m], outline='black')
        dr.rectangle([0, 0, W, 22], fill=(0, 0, 0)); dr.text((6, 5), f'{names[m]}  {t:.2f}s', fill=cols[m])
        panels.append(im)
    row = Image.new('RGB', (W * 3 + 8, H), 'black')
    for m, p in enumerate(panels): row.paste(p, (m * (W + 4), 0))
    rows.append(row)
sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows) + 4 * len(rows)), 'black'); y = 0
for r in rows: sheet.paste(r, (0, y)); y += r.height + 4
sheet.save(out); print('saved', out, 'moments', [round(p, 2) for p in picks])
