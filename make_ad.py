"""
Sozialzync 30-second advertisement video generator.
Requires: pip install imageio[ffmpeg] pillow numpy
imageio[ffmpeg] auto-downloads a static ffmpeg binary on first run.
"""

import os, sys, subprocess

# ── Install deps silently ───────────────────────────────────────────────────
subprocess.check_call([sys.executable, "-m", "pip", "install",
                       "imageio[ffmpeg]", "pillow", "numpy", "-q"])

import imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ── Config ──────────────────────────────────────────────────────────────────
W, H   = 1280, 720
FPS    = 30
OUT    = os.path.join(os.path.dirname(__file__), "sozialzync-ad-30s.mp4")
BASE   = os.path.dirname(__file__)

# Brand colours
PURPLE      = (109, 74, 224)
PURPLE_DARK = (79, 46, 196)
WHITE       = (255, 255, 255)
OFF_WHITE   = (250, 249, 255)
DARK        = (31,  41,  55)
AMBER       = (217, 119, 6)

# ── Font helpers ─────────────────────────────────────────────────────────────
def _font(size: int, bold: bool = False):
    """Best available font — falls back to default PIL bitmap font."""
    candidates = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    bold_candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    paths = bold_candidates if bold else candidates
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

# ── Drawing helpers ──────────────────────────────────────────────────────────
def gradient_bg(w: int, h: int, top: tuple, bottom: tuple) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return img

def centered_text(draw: ImageDraw.ImageDraw, text: str, y: int,
                  font: ImageFont.FreeTypeFont, fill: tuple,
                  img_w: int, shadow: bool = False):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (img_w - tw) // 2
    if shadow:
        draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 80))
    draw.text((x, y), text, font=font, fill=fill)

def pill(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int,
         fill: tuple, radius: int = 20):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill)

def load_screenshot(path: str, target_w: int, target_h: int,
                    padding: int = 40) -> Image.Image:
    """Fit screenshot inside a rounded white card."""
    try:
        img = Image.open(path).convert("RGB")
    except Exception:
        return None
    # Fit to card area
    aw, ah = target_w - 2 * padding, target_h - 2 * padding
    img.thumbnail((aw, ah), Image.LANCZOS)
    card = Image.new("RGB", (target_w, target_h), OFF_WHITE)
    # White rounded-rect card
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle([4, 4, target_w - 4, target_h - 4],
                                 radius=18, fill=WHITE,
                                 outline=(227, 221, 248), width=2)
    ox = (target_w - img.width) // 2
    oy = (target_h - img.height) // 2
    card.paste(img, (ox, oy))
    return card

# ── Ken Burns zoom ───────────────────────────────────────────────────────────
def ken_burns(img: Image.Image, frame: int, total: int,
              start_scale: float = 1.0, end_scale: float = 1.12) -> np.ndarray:
    t = frame / max(total - 1, 1)
    scale = start_scale + (end_scale - start_scale) * t
    iw, ih = img.size
    nw, nh = int(iw * scale), int(ih * scale)
    resized = img.resize((nw, nh), Image.LANCZOS)
    cx, cy = nw // 2, nh // 2
    x0 = cx - W // 2
    y0 = cy - H // 2
    x0 = max(0, min(x0, nw - W))
    y0 = max(0, min(y0, nh - H))
    cropped = resized.crop((x0, y0, x0 + W, y0 + H))
    return np.array(cropped)

# ── Fade overlay ─────────────────────────────────────────────────────────────
def fade_overlay(frame_arr: np.ndarray, alpha: float) -> np.ndarray:
    """alpha 0 = fully visible, 1 = black."""
    black = np.zeros_like(frame_arr)
    return (frame_arr * (1 - alpha) + black * alpha).astype(np.uint8)

# ── Scene builders ───────────────────────────────────────────────────────────

def scene_title(n_frames: int) -> list:
    """Scene 1: Brand intro — gradient bg + logo text + tagline."""
    frames = []
    f_bold = _font(82, bold=True)
    f_tag  = _font(32)
    f_pill = _font(20)

    bg = gradient_bg(W, H, PURPLE_DARK, PURPLE)

    for i in range(n_frames):
        img = bg.copy()
        draw = ImageDraw.Draw(img)

        # Decorative circles
        draw.ellipse([-80, -80, 200, 200], fill=(255, 255, 255, 15))
        draw.ellipse([W - 200, H - 200, W + 80, H + 80],
                     fill=(255, 255, 255, 10))

        # "S" monogram circle
        cx, cy = W // 2, H // 2 - 80
        draw.ellipse([cx - 52, cy - 52, cx + 52, cy + 52],
                     fill=WHITE)
        draw.text((cx - 28, cy - 44), "S", font=_font(70, bold=True),
                  fill=PURPLE)

        # Name
        centered_text(draw, "Sozialzync", H // 2 + 10, f_bold, WHITE, W, shadow=True)

        # Tagline pill
        tag = "AI YouTube Content OS"
        tbbox = draw.textbbox((0, 0), tag, font=f_tag)
        tw = tbbox[2] - tbbox[0]
        pill_x = (W - tw - 32) // 2
        pill(draw, pill_x, H // 2 + 110, tw + 32, 44,
             fill=(255, 255, 255, 30), radius=22)
        centered_text(draw, tag, H // 2 + 118, f_tag,
                      (230, 220, 255), W)

        # Fade in/out
        t = i / n_frames
        alpha = max(0.0, 1 - t * 5) if i < n_frames // 5 else 0.0
        if i > n_frames * 0.80:
            alpha = (i - n_frames * 0.80) / (n_frames * 0.20)
        frames.append(fade_overlay(np.array(img), alpha))
    return frames


def scene_screenshot(ss_path: str, headline: str, subline: str,
                     n_frames: int, zoom_out: bool = False) -> list:
    """Scene: screenshot on right, text on left."""
    frames = []
    f_h  = _font(44, bold=True)
    f_s  = _font(24)
    f_kw = _font(18)

    card_w, card_h = 700, 440
    card = load_screenshot(ss_path, card_w, card_h) if ss_path else None
    if card is None:
        card = Image.new("RGB", (card_w, card_h), (227, 221, 248))
        cd = ImageDraw.Draw(card)
        cd.rounded_rectangle([4, 4, card_w - 4, card_h - 4],
                              radius=18, fill=WHITE, outline=(109, 74, 224), width=2)
        cd.text((40, card_h // 2 - 20), "[ screenshot ]",
                font=f_s, fill=(170, 160, 200))

    # Base bg
    base_bg = gradient_bg(W, H, (250, 249, 255), (240, 236, 255))

    start_s = 1.0 if not zoom_out else 1.10
    end_s   = 1.10 if not zoom_out else 1.0

    for i in range(n_frames):
        t = i / max(n_frames - 1, 1)

        # Ken Burns on background
        big = base_bg.resize(
            (int(W * (start_s + (end_s - start_s) * t)),
             int(H * (start_s + (end_s - start_s) * t))),
            Image.LANCZOS)
        ox = (big.width - W) // 2
        oy = (big.height - H) // 2
        frame_img = big.crop((ox, oy, ox + W, oy + H)).copy()
        draw = ImageDraw.Draw(frame_img)

        # Purple accent bar on left
        draw.rectangle([0, 0, 6, H], fill=PURPLE)

        # Left text panel
        tx = 60
        ty = H // 2 - 100

        # Purple dot + headline
        draw.ellipse([tx - 18, ty + 12, tx - 6, ty + 24], fill=PURPLE)
        # Wrap headline
        words = headline.split()
        lines, cur = [], ""
        for w in words:
            test = (cur + " " + w).strip()
            bb = draw.textbbox((0, 0), test, font=f_h)
            if bb[2] - bb[0] > 480 and cur:
                lines.append(cur)
                cur = w
            else:
                cur = test
        if cur:
            lines.append(cur)
        ly = ty
        for line in lines:
            draw.text((tx, ly), line, font=f_h, fill=DARK)
            ly += 54

        draw.text((tx, ly + 8), subline, font=f_s, fill=(100, 90, 140))

        # Animated slide-in for card (eased)
        ease = 1 - (1 - min(t * 2, 1)) ** 3
        cx_target = W - card_w // 2 - 60
        cx_start  = W + card_w // 2
        cx = int(cx_start + (cx_target - cx_start) * ease)
        cy = (H - card_h) // 2
        frame_img.paste(card, (cx - card_w // 2, cy))

        # Fade in
        alpha = max(0.0, 1 - t * 8) if i < n_frames // 8 else 0.0
        if t > 0.85:
            alpha = (t - 0.85) / 0.15
        frames.append(fade_overlay(np.array(frame_img), alpha))
    return frames


def scene_features(n_frames: int) -> list:
    """Scene: feature grid — 4 icons + labels on purple gradient."""
    FEATURES = [
        ("🎬", "AI Script Generation"),
        ("🔍", "Trend Discovery"),
        ("📊", "Channel Analytics"),
        ("🚀", "One-Click Publish"),
    ]
    frames = []
    f_icon = _font(48)
    f_lbl  = _font(26, bold=True)
    f_head = _font(38, bold=True)
    f_sub  = _font(22)

    bg = gradient_bg(W, H, (79, 46, 196), (109, 74, 224))

    for i in range(n_frames):
        t = i / max(n_frames - 1, 1)
        img = bg.copy()
        draw = ImageDraw.Draw(img)

        centered_text(draw, "Everything You Need to Grow",
                      60, f_head, WHITE, W, shadow=True)
        centered_text(draw, "Research · Script · Voice · Music · Video · Publish",
                      115, f_sub, (200, 185, 255), W)

        cols = 2
        cw, ch = 520, 200
        gx = (W - cols * cw) // 2
        gy = 200

        for idx, (icon, label) in enumerate(FEATURES):
            col = idx % cols
            row = idx // cols
            x = gx + col * (cw + 20)
            y = gy + row * (ch + 16)

            # Animate: slide up + fade in staggered
            delay = idx * 0.10
            local_t = max(0.0, min(1.0, (t - delay) / 0.35))
            ease = 1 - (1 - local_t) ** 3
            y_off = int(40 * (1 - ease))
            a = ease

            card_img = Image.new("RGBA", (cw, ch), (255, 255, 255, 0))
            cd = ImageDraw.Draw(card_img)
            card_alpha = int(40 * a)
            cd.rounded_rectangle([0, 0, cw, ch], radius=20,
                                  fill=(255, 255, 255, card_alpha))

            # Icon
            cd.text((30, 30), icon, font=f_icon, fill=(255, 255, 255, int(255 * a)))
            # Label
            cd.text((30, 100), label, font=f_lbl, fill=(255, 255, 255, int(255 * a)))

            composite = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            composite.paste(card_img, (x, y + y_off), card_img)
            img = Image.alpha_composite(img.convert("RGBA"), composite).convert("RGB")
            draw = ImageDraw.Draw(img)

        alpha = max(0.0, 1 - t * 8) if i < n_frames // 8 else 0.0
        if t > 0.85:
            alpha = (t - 0.85) / 0.15
        frames.append(fade_overlay(np.array(img), alpha))
    return frames


def scene_cta(n_frames: int) -> list:
    """Final CTA scene."""
    frames = []
    f_big  = _font(72, bold=True)
    f_sub  = _font(30)
    f_url  = _font(26)
    f_pill = _font(22, bold=True)

    bg = gradient_bg(W, H, PURPLE_DARK, (50, 20, 140))

    for i in range(n_frames):
        t = i / max(n_frames - 1, 1)
        img = bg.copy()
        draw = ImageDraw.Draw(img)

        # Glow circle
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        r = int(220 + 30 * abs(0.5 - t) * 2)
        gd.ellipse([W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r],
                   fill=(140, 100, 255, 25))
        img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
        draw = ImageDraw.Draw(img)

        # Text
        centered_text(draw, "Start Creating Today", H // 2 - 100,
                      f_big, WHITE, W, shadow=True)
        centered_text(draw, "AI-powered YouTube growth — free to start",
                      H // 2 + 10, f_sub, (200, 185, 255), W)

        # CTA pill
        url = "sozialzync.vercel.app"
        bb = draw.textbbox((0, 0), url, font=f_url)
        uw = bb[2] - bb[0]
        px = (W - uw - 60) // 2
        pill(draw, px, H // 2 + 80, uw + 60, 52,
             fill=WHITE, radius=26)
        centered_text(draw, url, H // 2 + 92, f_url, PURPLE, W)

        # Bottom badge
        badge = "✨  Sozialzync  ·  AI YouTube Content OS"
        centered_text(draw, badge, H - 60, _font(18), (160, 140, 220), W)

        alpha = max(0.0, 1 - t * 8) if i < n_frames // 8 else 0.0
        frames.append(fade_overlay(np.array(img), alpha))
    return frames


# ── Screenshot paths ─────────────────────────────────────────────────────────
SS = {
    "dashboard": os.path.join(BASE, "shots", "cp-01-dashboard.png"),
    "copilot":   os.path.join(BASE, "shots", "cp-02-copilot-open.png"),
    "home":      os.path.join(BASE, "screenshots", "live-01-home.png"),
    "landing":   os.path.join(BASE, "screenshots", "01-landing-hero.png"),
}

# ── Build all scenes ─────────────────────────────────────────────────────────
# 30 seconds × 30 fps = 900 frames
# 6 scenes:  title(5s) + ss1(5s) + ss2(5s) + features(5s) + ss3(5s) + cta(5s)
SPF = FPS * 5  # frames per 5-second scene

print("Building scene 1: title card ...")
all_frames = scene_title(SPF)

print("Building scene 2: dashboard ...")
all_frames += scene_screenshot(
    SS["dashboard"],
    "Your AI Content\nDashboard",
    "Manage projects, channels & pipelines in one place.",
    SPF, zoom_out=False)

print("Building scene 3: copilot ...")
all_frames += scene_screenshot(
    SS["copilot"],
    "Voice-Powered\nAI Copilot",
    "Speak your intent. Your copilot handles the rest.",
    SPF, zoom_out=True)

print("Building scene 4: feature grid ...")
all_frames += scene_features(SPF)

print("Building scene 5: discover / home ...")
all_frames += scene_screenshot(
    SS.get("home", SS["landing"]),
    "Discover Trends.\nBenchmark. Grow.",
    "Real-time YouTube insights ground every decision.",
    SPF, zoom_out=False)

print("Building scene 6: CTA ...")
all_frames += scene_cta(SPF)

# ── Write video ──────────────────────────────────────────────────────────────
print(f"Encoding {len(all_frames)} frames -> {OUT} ...")
writer = imageio.get_writer(OUT, fps=FPS, codec="libx264",
                            output_params=["-crf", "20", "-pix_fmt", "yuv420p"])
for idx, frame in enumerate(all_frames):
    writer.append_data(frame)
    if idx % 90 == 0:
        print(f"  {idx}/{len(all_frames)} frames ...")
writer.close()
print(f"\nDone! -> {OUT}")
