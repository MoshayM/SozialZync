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
  'cinematic motion, natural ambient light, authentic human movement and gestures, ' +
  'subtle facial expressions, film grain texture, handheld camera feel, organic pacing, ' +
  'shallow depth of field, color-graded, 24fps, realistic physics, lifelike animation';

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

// Per-camera-motion descriptor (designed for AI video model prompts)
export const CAMERA_MOTION_DESCRIPTORS: Record<string, string> = {
  'static': 'locked-off static camera, stable frame, subject moves within frame',
  'pan-left': 'camera slowly pans left, revealing the scene, smooth lateral movement',
  'pan-right': 'camera gently pans right, following action, fluid lateral tracking',
  'tilt-up': 'camera tilts upward in a slow reveal, rising motion',
  'tilt-down': 'camera tilts downward, descending reveal',
  'zoom-in': 'slow cinematic push-in, camera creeps forward, subject grows larger',
  'zoom-out': 'slow cinematic pull-out, camera retreats, revealing wider context',
  'dolly-in': 'dolly shot pushing toward subject, foreground blur increases, intimate approach',
  'dolly-out': 'dolly shot pulling back from subject, expanding the scene context',
  'handheld': 'subtle handheld camera shake, naturalistic documentary feel, organic movement',
  'orbit': 'slow orbital arc around subject, 3D parallax depth, 360-degree presence',
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

// Character motion hints per shot type — injected into AI video model prompts
// to encourage realistic character movement rather than static frozen frames.
export const CHARACTER_MOTION_BY_SHOT: Record<string, string> = {
  'talking-head': 'person speaks naturally with subtle head nods, authentic eye contact, expressive micro-gestures, slight shoulder movement',
  'medium': 'character moves naturally, uses hand gestures, body language animated and expressive, subtle weight shifts',
  'close-up': 'face shows genuine emotion, eyes move and blink naturally, subtle smile or expression change, skin texture visible',
  'extreme-close-up': 'extreme detail — breathing visible, pupils react, micro-expressions, fine texture motion',
  'wide': 'people walk and move naturally, environment has ambient motion, leaves rustle, natural light shifts',
  'overhead': 'top-down movement, subjects walk and gesture, dynamic from above, natural flow',
  'POV': 'immersive first-person movement, natural gait, environment responds to viewer motion',
  'B-roll': 'cinematic B-roll with organic environmental motion, atmosphere and mood, natural world movement',
};

// Energy level → human descriptor for music
export const ENERGY_DESCRIPTORS: Record<string, string> = {
  'low': 'gentle understated dynamics, sparse arrangement, breathing space',
  'medium': 'moderate energy, balanced presence, clear melodic lead',
  'high': 'driving energy, full arrangement, punchy transients',
  'dynamic': 'dynamic arc from quiet intro to powerful climax and resolution',
};
