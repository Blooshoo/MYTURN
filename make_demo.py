"""Generates demo.gif — a browser-tab mockup showing MYTURN's favicon states.

Reproduces the same icons the extension draws at runtime (spinner arc, then a
green checkmark). Run:  python make_demo.py
"""
import math
from PIL import Image, ImageDraw, ImageFont

S = 3                      # supersample factor for crisp anti-aliasing
W, H = 460, 150            # logical canvas size
BG = (24, 25, 28)          # browser chrome background
TAB = (43, 45, 49)         # active tab fill
TEXT = (210, 213, 219)
SUBTEXT = (150, 154, 162)

TRACK = (120, 160, 220, 64)   # faint spinner track
ARC = (78, 161, 255, 255)     # moving spinner arc  (#4ea1ff)
GREEN = (46, 204, 113, 255)   # checkmark badge     (#2ecc71)
WHITE = (255, 255, 255, 255)


def font(size):
    for path in (r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"):
        try:
            return ImageFont.truetype(path, size * S)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_spinner(d, cx, cy, r, angle_deg):
    bbox = [cx - r, cy - r, cx + r, cy + r]
    d.ellipse(bbox, outline=TRACK, width=4 * S)
    # ~3/4 sweep, rotating
    d.arc(bbox, angle_deg, angle_deg + 270, fill=ARC, width=4 * S)


def draw_check(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GREEN)
    pts = [(cx - r * 0.45, cy + r * 0.05),
           (cx - r * 0.10, cy + r * 0.42),
           (cx + r * 0.50, cy - r * 0.40)]
    d.line(pts, fill=WHITE, width=4 * S, joint="curve")


def frame(mode, angle_deg=0):
    img = Image.new("RGBA", (W * S, H * S), BG + (255,))
    d = ImageDraw.Draw(img)

    # Tab shape
    tab = [20 * S, 28 * S, 300 * S, 112 * S]
    d.rounded_rectangle(tab, radius=14 * S, fill=TAB)

    # Favicon
    icx, icy, ir = 52 * S, 70 * S, 16 * S
    if mode == "spin":
        draw_spinner(d, icx, icy, ir, angle_deg)
    else:
        draw_check(d, icx, icy, ir)

    # Tab label + close glyph
    d.text((82 * S, 58 * S), "SillyTavern", font=font(19), fill=TEXT)
    d.text((276 * S, 56 * S), "×", font=font(22), fill=SUBTEXT)

    # Caption under the tab
    caption = "Generating reply…" if mode == "spin" else "Your turn!"
    ccol = SUBTEXT if mode == "spin" else GREEN
    d.text((24 * S, 122 * S), caption, font=font(15), fill=ccol)

    return img.resize((W, H), Image.LANCZOS).convert("P", palette=Image.ADAPTIVE)


frames, durations = [], []
for i in range(18):                       # spinning phase
    frames.append(frame("spin", angle_deg=(i * 40) % 360))
    durations.append(70)
frames.append(frame("done"))              # hold the checkmark
durations.append(1700)

frames[0].save(
    "demo.gif", save_all=True, append_images=frames[1:],
    duration=durations, loop=0, disposal=2, optimize=True,
)
print("wrote demo.gif", len(frames), "frames")
