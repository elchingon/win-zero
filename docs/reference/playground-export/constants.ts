import {SpriteConfig} from './utils/helper';

/**
 * Configuration for the game.
 */
export const CONFIG = {
  title: {
    value: 'Win Zero',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1376,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 768,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System Constants
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Thematic elements
  backgroundColor: {
    value: '#0c071e',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#00f2fe',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  goldColor: {
    value: '#ffd700',
    type: 'color',
    label: 'Gold Color',
    group: 'THEME',
  },
  accentMagenta: {
    value: '#ff007f',
    type: 'color',
    label: 'Accent Magenta',
    group: 'THEME',
  },
  fontFamily: {
    value: '"Outfit", "Inter", system-ui, -apple-system, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // Audio Levels
  defaultMusicVolume: {
    value: 0.45,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Gameplay Tuning & Rules (Tunable)
  shieldMaxHealth: {
    value: 100,
    type: 'number',
    label: 'Shield Max Health',
    group: 'Rules',
  },
  zeroBaseSpeed: {
    value: 110,
    type: 'number',
    label: 'Zero Target Speed',
    group: 'Physics',
  },
  laserFireRate: {
    value: 8.5,
    type: 'number',
    label: 'Blaster Fire Rate (shots/sec)',
    group: 'Rules',
  },
  bombStartingStock: {
    value: 3,
    type: 'number',
    label: 'Starting Supernova Bombs',
    group: 'Rules',
  },
  screenShakeIntensity: {
    value: 1.0,
    type: 'number',
    label: 'Screen Shake Intensity',
    group: 'Visuals',
  },
  aimAssistEnabled: {
    value: true,
    type: 'boolean',
    label: 'Aim Assist Magnetism',
    group: 'Rules',
  },
  starTokenMultiplier: {
    value: 1,
    type: 'number',
    label: 'Star Token Multiplier',
    group: 'Rules',
  },

  // Asset dimensions and Aspect Ratios (derived from read_assets_metadata)
  assetBgSpaceArenaAspectRatio: {
    value: 1.79166667, // 1376 / 768
    type: 'number',
    label: 'Arena BG Aspect Ratio',
    group: 'ASSETS',
  },
  assetBgSpaceArenaWidth: {
    value: 1376,
    type: 'number',
    label: 'Arena BG Width',
    group: 'ASSETS',
  },
  assetBgSpaceArenaHeight: {
    value: 768,
    type: 'number',
    label: 'Arena BG Height',
    group: 'ASSETS',
  },

  assetBlasterTurretAspectRatio: {
    value: 0.72560975, // 476 / 656
    type: 'number',
    label: 'Blaster Turret Aspect Ratio',
    group: 'ASSETS',
  },
  assetBlasterTurretWidth: {
    value: 88,
    type: 'number',
    label: 'Blaster Turret Width',
    group: 'ASSETS',
  },
  assetBlasterTurretHeight: {
    value: 121, // 88 / 0.72560975 ≈ 121.28
    type: 'number',
    label: 'Blaster Turret Height',
    group: 'ASSETS',
  },

  assetTargetZeroCyanAspectRatio: {
    value: 0.96725784, // 709 / 733
    type: 'number',
    label: 'Cyan Zero Aspect Ratio',
    group: 'ASSETS',
  },
  assetTargetZeroGoldAspectRatio: {
    value: 0.98211382, // 604 / 615
    type: 'number',
    label: 'Gold Zero Aspect Ratio',
    group: 'ASSETS',
  },
  assetItemSuperBombAspectRatio: {
    value: 1.00420168, // 717 / 714
    type: 'number',
    label: 'Super Bomb Aspect Ratio',
    group: 'ASSETS',
  },
  assetItemTrophyStarAspectRatio: {
    value: 1.09161491, // 703 / 644
    type: 'number',
    label: 'Trophy Star Aspect Ratio',
    group: 'ASSETS',
  },
  assetReticleCrosshairAspectRatio: {
    value: 1.00645161, // 624 / 620
    type: 'number',
    label: 'Reticle Aspect Ratio',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

/**
 * Default Habit Presets
 */
export const DEFAULT_HABIT_PRESETS = [
  { id: 'alcohol', name: 'Zero Alcohol / Clean Living', tag: 'Health', streakTarget: 30 },
  { id: 'sugar', name: 'Zero Refined Sugar', tag: 'Diet', streakTarget: 21 },
  { id: 'workout', name: 'Daily Workout & Fitness', tag: 'Fitness', streakTarget: 14 },
  { id: 'meditation', name: 'Mindfulness & Meditation', tag: 'Mental', streakTarget: 30 },
  { id: 'reading', name: 'Read 30 Mins Daily', tag: 'Growth', streakTarget: 7 },
  { id: 'coding', name: 'Daily Code & Build', tag: 'Career', streakTarget: 100 },
];
