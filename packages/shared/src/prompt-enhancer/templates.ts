// Prompt enhancement templates — pure constants, no runtime logic.

export const IMAGE_QUALITY_SUFFIX =
  '35mm film grain, candid ambient lighting, authentic human micro-expressions, ' +
  'sub-surface skin scatter, shallow depth of field, raw photo aesthetic, ' +
  'photojournalistic, color-graded, high detail, shot on Sony A7 III';

export const IMAGE_NEGATIVE_BASE =
  '3D render, plastic skin, glossy stock photo, oversaturated, stiff pose, mannequin, ' +
  'cartoon, CGI, watermark, logo, text overlay, low resolution, blurry, distorted, ' +
  'anime, illustration, painting, artificial ring light, fake smile, uncanny valley';

export const VIDEO_QUALITY_SUFFIX =
  'cinematic motion, natural ambient light, authentic human movement, film grain, ' +
  'handheld camera feel, organic pacing, depth of field blur, color-graded, 24fps';

export const VIDEO_NEGATIVE_BASE =
  'stock footage watermark, robotic animation, stiff movement, plastic skin, CGI uncanny valley, ' +
  'overexposed, blurry, distorted faces, jumpcut artifacts, strobe, synthetic motion, ' +
  'low quality, choppy, looping artifact';

export const MUSIC_HUMANIZING =
  'organic live-performance feel, subtle tempo rubato, human dynamics, ' +
  'natural room reverb, micro-timing variation, expressive phrasing, no synthetic quantization';

// Per-shot-type camera descriptor for video prompts
export const SHOT_TYPE_DESCRIPTORS: Record<string, string> = {
  'wide': 'wide establishing shot',
  'medium': 'medium shot, mid-distance framing',
  'close-up': 'close-up shot, intimate framing',
  'extreme-close-up': 'extreme close-up, macro detail',
  'overhead': "overhead bird's-eye view, top-down angle",
  'POV': 'first-person POV, immersive perspective',
  'B-roll': 'cinematic B-roll footage',
  'text-overlay': 'clean minimal background for text overlay',
  'screen-capture': 'crisp screen recording, UI clearly visible',
  'talking-head': 'talking-head shot, direct-to-camera, natural eye contact',
};

// Per-camera-motion descriptor
export const CAMERA_MOTION_DESCRIPTORS: Record<string, string> = {
  'static': 'locked-off static camera',
  'pan-left': 'smooth pan left',
  'pan-right': 'smooth pan right',
  'tilt-up': 'slow tilt upward reveal',
  'tilt-down': 'slow tilt downward',
  'zoom-in': 'slow push-in zoom',
  'zoom-out': 'slow pull-out zoom',
  'dolly-in': 'dolly push toward subject',
  'dolly-out': 'dolly pull back',
  'handheld': 'subtle handheld shake, naturalistic documentary feel',
  'orbit': 'slow orbital rotation around subject',
};

// Per-emotion visual mood for image prompts
export const EMOTION_VISUAL_MODIFIERS: Record<string, string> = {
  'excitement': 'vibrant warm colors, dynamic composition, high energy',
  'curiosity': 'soft mysterious lighting, intriguing framing, muted palette',
  'trust': 'warm neutral tones, open approachable framing, clean background',
  'inspiration': 'golden hour light, uplifting composition, airy',
  'urgency': 'tight framing, high contrast, dramatic shadows',
  'calm': 'soft diffused light, pastel tones, serene atmosphere',
  'neutral': 'balanced natural light, documentary realist style',
  'suspense': 'low-key lighting, heavy shadows, tension-building framing',
  'joy': 'bright natural light, warm tones, candid smiling, energetic',
};

// Energy level → human descriptor for music
export const ENERGY_DESCRIPTORS: Record<string, string> = {
  'low': 'gentle understated dynamics, sparse arrangement, breathing space',
  'medium': 'moderate energy, balanced presence, clear melodic lead',
  'high': 'driving energy, full arrangement, punchy transients',
  'dynamic': 'dynamic arc from quiet intro to powerful climax and resolution',
};
