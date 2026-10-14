// tslint:disable
/* eslint-disable */
import {
  Award,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Crosshair,
  FastForward,
  Flame,
  Gamepad2,
  HelpCircle,
  Menu,
  Pause,
  Play,
  RotateCw,
  Settings,
  Shield,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {DEFAULT_HABIT_PRESETS, getConfig} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  createFixedStepper,
  drawAsset,
  drawBackground,
  Entity,
  formatTime,
  gameAudio,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useAutoFocus,
  useInput,
  useIsMobile,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

// Music asset path from manifest
const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_celebration_synth.mp3';

// Weapon Definitions
export type WeaponType = 'laser' | 'shotgun' | 'starcannon';

interface WeaponConfig {
  id: WeaponType;
  name: string;
  icon: string;
  cooldown: number; // seconds
  damage: number;
  color: string;
  description: string;
}

const WEAPONS: Record<WeaponType, WeaponConfig> = {
  laser: {
    id: 'laser',
    name: 'Twin Pulse Laser',
    icon: '⚡',
    cooldown: 0.12,
    damage: 15,
    color: '#00f2fe',
    description: 'Rapid precision twin beams',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Pulse Shotgun',
    icon: '🔱',
    cooldown: 0.32,
    damage: 18,
    color: '#38ef7d',
    description: 'Triple spread high-impact burst',
  },
  starcannon: {
    id: 'starcannon',
    name: 'Star Cluster Cannon',
    icon: '⭐',
    cooldown: 0.45,
    damage: 35,
    color: '#ffd700',
    description: 'Explosive shell bursting into star fragments',
  },
};

// Simulation Entities
interface ZeroEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'cyan' | 'gold' | 'mini';
  maxHp: number;
  hp: number;
  rotation: number;
  vRot: number;
  scaleX: number;
  scaleY: number;
  hitTimer: number;
  orbitAngle: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weapon: WeaponType;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
  isFragment?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'confetti' | 'ring' | 'zero';
  rotation: number;
  vRot: number;
}

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface DropItem {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: 'bomb' | 'star';
  life: number;
  bobTimer: number;
}

// Matrix Zero Stream for Daily Cooldown Screens
interface MatrixZeroStream {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
  size: number;
  alpha: number;
}

// Habit Tracking Storage Interface
interface HabitData {
  goalName: string;
  streak: number;
  totalZerosBlasted: number;
  lastCheckInDate: string;
  starTokens: number;
  bombs: number;
  unlockedWeapons: WeaponType[];
  upgrades: {
    fireRateLevel: number;
    damageLevel: number;
    shieldRegenLevel: number;
    bombStockLevel: number;
  };
}

const DEFAULT_HABIT: HabitData = {
  goalName: 'Zero Alcohol / Clean Living',
  streak: 1,
  totalZerosBlasted: 0,
  lastCheckInDate: '',
  starTokens: 50,
  bombs: 3,
  unlockedWeapons: ['laser', 'shotgun', 'starcannon'],
  upgrades: {
    fireRateLevel: 0,
    damageLevel: 0,
    shieldRegenLevel: 0,
    bombStockLevel: 0,
  },
};

// Date Helpers
const getTodayDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTimeUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Next midnight
  const diffMs = Math.max(0, midnight.getTime() - now.getTime());
  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    totalSecs,
  };
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();
  const isMobile = useIsMobile();

  // --- PLAYGROUND SDK INTEGRATION ---
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // --- ASSET PRELOADING ---
  const ASSETS_MANIFEST: Record<string, string> = {
    bg_space_arena: 'assets/images/bg_space_arena.png',
    blaster_turret: 'assets/images/blaster_turret.png',
    item_super_bomb: 'assets/images/item_super_bomb.png',
    item_trophy_star: 'assets/images/item_trophy_star.png',
    reticle_crosshair: 'assets/images/reticle_crosshair.png',
    target_zero_cyan: 'assets/images/target_zero_cyan.png',
    target_zero_gold: 'assets/images/target_zero_gold.png',
  };
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;

  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // Primary Game Loop State
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
  });
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Additional Sub-Screens and Modes
  const [gameMode, setGameMode] = useState<'HABIT' | 'ARCADE'>('HABIT');
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isGoalSetupOpen, setIsGoalSetupOpen] = useState(false);
  const [isDailyCooldownOpen, setIsDailyCooldownOpen] = useState(false);

  // Audio UI States
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // Persistent Habit & Progression Data
  const [habit, setHabit] = useState<HabitData>(() => {
    try {
      const saved = localStorage.getItem('winzero_habit_data_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Storage read failed', e);
    }
    return DEFAULT_HABIT;
  });

  const saveHabit = (updated: HabitData) => {
    setHabit(updated);
    try {
      localStorage.setItem('winzero_habit_data_v1', JSON.stringify(updated));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  };

  // --- DAILY NOTIFICATION & COUNTDOWN SYSTEM ---
  const [countdown, setCountdown] = useState(getTimeUntilMidnight);
  const [isDailyNotifyEnabled, setIsDailyNotifyEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('winzero_daily_notify_v1');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Simulated / In-game Toast Notification Banner
  const [activeToast, setActiveToast] = useState<{
    id: number;
    title: string;
    message: string;
  } | null>(null);

  const triggerToast = (title: string, message: string) => {
    const id = Date.now();
    setActiveToast({id, title, message});
    gameAudio.playHoverMicroTone();
    setTimeout(() => {
      setActiveToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  // Notification Toggle Handler
  const toggleDailyNotification = async () => {
    const nextState = !isDailyNotifyEnabled;
    setIsDailyNotifyEnabled(nextState);
    try {
      localStorage.setItem('winzero_daily_notify_v1', String(nextState));
    } catch (e) {
      console.warn('Notification pref save failed', e);
    }

    if (nextState) {
      gameAudio.playConfirmSelect();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch (e) {
            console.warn('Notification permission request failed', e);
          }
        }
      }
      triggerToast(
        '🔔 Daily Reminder Active',
        `You'll receive a reminder at midnight when Day ${habit.streak + 1} zeroes reset!`,
      );
    } else {
      gameAudio.playCrispClick();
      triggerToast(
        '🔕 Daily Reminder Paused',
        'Daily reset reminders have been turned off.',
      );
    }
  };

  // Send Test Simulated Notification
  const sendTestNotification = () => {
    gameAudio.playPowerupChime();
    const title = '🎯 WIN ZERO: Daily Habit Reset!';
    const message = `Day ${habit.streak + 1} targets are ready! Blast today's zeroes to protect your ${habit.goalName} streak.`;

    // Trigger in-game toast
    triggerToast(title, message);

    // If native browser notification is granted, show real notification too
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, {
          body: message,
          icon: 'assets/images/item_trophy_star.png',
        });
      } catch (e) {
        console.warn('Native notification spawn failed', e);
      }
    }
  };

  // Fast Forward Dev / Demo Mechanic
  const fastForwardToNextDay = () => {
    // Set last check-in date to yesterday to unlock the next day immediately
    const prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = `${prevDate.getFullYear()}-${String(
      prevDate.getMonth() + 1,
    ).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

    const updated: HabitData = {
      ...habit,
      lastCheckInDate: prevDateStr,
    };
    saveHabit(updated);
    setIsDailyCooldownOpen(false);
    gameAudio.playPowerupChime();
    triggerToast(
      '⚡ FAST FORWARD: Next Day Unlocked!',
      `Simulated midnight cycle completed! Day ${updated.streak} daily zeroes are unlocked and ready to blast!`,
    );
  };

  // Update Countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isDailyCompletedToday = habit.lastCheckInDate === getTodayDateStr();

  // Active Weapon & In-Game Dynamic Stats
  const [activeWeapon, setActiveWeapon] = useState<WeaponType>('laser');
  const [shieldHealth, setShieldHealth] = useState(100);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [remainingZerosCount, setRemainingZerosCount] = useState(0);
  const [bombsAvailable, setBombsAvailable] = useState(3);
  const [celebrationStreak, setCelebrationStreak] = useState(1);

  // Input Handling
  const inputRef = useInput(canvasRef, true, {
    width: canvasWidth,
    height: canvasHeight,
  });

  // Autofocus buttons
  const startButtonRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START',
  );

  // --- REFS FOR HIGH-PERFORMANCE 60FPS SIMULATION ---
  const zerosRef = useRef<ZeroEntity[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatersRef = useRef<Floater[]>([]);
  const dropsRef = useRef<DropItem[]>([]);
  const matrixStreamsRef = useRef<MatrixZeroStream[]>([]);

  const turretRef = useRef({
    x: canvasWidth / 2,
    y: canvasHeight - 55,
    angle: -Math.PI / 2,
    recoil: 0,
    muzzleFlash: 0,
  });

  const weaponCooldownRef = useRef(0);
  const autoAimTargetRef = useRef<{x: number; y: number} | null>(null);
  const screenShakeRef = useRef(0);
  const hitStopRef = useRef(0);
  const comboTimerRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const arcadeWaveRef = useRef(1);
  const zerosSpawnedInWaveRef = useRef(0);
  const targetZerosInWaveRef = useRef(5);
  const nextEntityIdRef = useRef(1);

  const activeWeaponRef = useRef<WeaponType>('laser');
  activeWeaponRef.current = activeWeapon;
  const gameModeRef = useRef<'HABIT' | 'ARCADE'>('HABIT');
  gameModeRef.current = gameMode;
  const habitRef = useRef(habit);
  habitRef.current = habit;
  const bombsAvailableRef = useRef(bombsAvailable);
  bombsAvailableRef.current = bombsAvailable;
  const isDailyCooldownOpenRef = useRef(isDailyCooldownOpen);
  isDailyCooldownOpenRef.current = isDailyCooldownOpen;

  // Turret base coordinates
  const turretBaseX = canvasWidth / 2;
  const turretBaseY = canvasHeight - 55;

  // Initialize Matrix Zero Streams for Cascading Zeroes Effect
  useEffect(() => {
    const streamCount = 38;
    const streams: MatrixZeroStream[] = [];
    for (let i = 0; i < streamCount; i++) {
      const colX = (canvasWidth / streamCount) * i + Math.random() * 20;
      const length = 8 + Math.floor(Math.random() * 16);
      const chars = Array.from({length}, () => (Math.random() > 0.3 ? '0' : 'Ø'));
      streams.push({
        x: colX,
        y: Math.random() * -canvasHeight,
        speed: 120 + Math.random() * 280,
        length,
        chars,
        size: 16 + Math.random() * 14,
        alpha: 0.3 + Math.random() * 0.7,
      });
    }
    matrixStreamsRef.current = streams;
  }, [canvasWidth, canvasHeight]);

  // --- SPAWN HELPERS ---
  const spawnZero = (
    type: 'cyan' | 'gold' | 'mini',
    customX?: number,
    customY?: number,
  ) => {
    const baseSpeed = (getConfig('zeroBaseSpeed') as number) || 110;
    const speedMult =
      type === 'mini' ? 1.4 : type === 'gold' ? 0.75 : 1.0;
    const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.7;
    const speed = baseSpeed * (0.85 + Math.random() * 0.3) * speedMult;

    const radius =
      type === 'gold' ? 52 : type === 'mini' ? 24 : 38;
    const hp =
      type === 'gold' ? 120 : type === 'mini' ? 15 : 40;

    const x =
      customX !== undefined
        ? customX
        : radius + 40 + Math.random() * (canvasWidth - radius * 2 - 80);
    const y = customY !== undefined ? customY : 70 + Math.random() * 120;

    zerosRef.current.push({
      id: nextEntityIdRef.current++,
      x,
      y,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.sin(angle) * speed * 0.6,
      radius,
      type,
      maxHp: hp,
      hp,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 1.5,
      scaleX: 1,
      scaleY: 1,
      hitTimer: 0,
      orbitAngle: Math.random() * Math.PI * 2,
    });
  };

  const spawnParticles = (
    x: number,
    y: number,
    count: number,
    colorScheme: 'cyan' | 'gold' | 'supernova' | 'spark' | 'zeros',
  ) => {
    const colors =
      colorScheme === 'gold'
        ? ['#ffd700', '#ffea79', '#ff9900', '#ffffff', '#ffb703']
        : colorScheme === 'supernova'
        ? [
            '#00f2fe',
            '#ff007f',
            '#ffd700',
            '#7928ca',
            '#38ef7d',
            '#ffffff',
            '#ff5e62',
          ]
        : colorScheme === 'zeros'
        ? ['#00f2fe', '#38ef7d', '#ffd700', '#00c6ff']
        : colorScheme === 'spark'
        ? ['#ffffff', '#00f2fe', '#80d0c7']
        : ['#00f2fe', '#4facfe', '#00c6ff', '#ffffff', '#a1c4fd'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 320;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shapes: Array<'circle' | 'star' | 'confetti' | 'ring' | 'zero'> =
        colorScheme === 'zeros'
          ? ['zero', 'circle', 'ring']
          : colorScheme === 'supernova'
          ? ['star', 'confetti', 'circle', 'ring', 'zero']
          : ['circle', 'star'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (shape === 'confetti' ? 50 : 0),
        size: shape === 'star' ? 6 + Math.random() * 8 : shape === 'zero' ? 14 : 3 + Math.random() * 6,
        color,
        life: 0,
        maxLife: 0.5 + Math.random() * 1.0,
        shape,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 8,
      });
    }
  };

  const spawnFloater = (x: number, y: number, text: string, color = '#ffd700') => {
    floatersRef.current.push({
      id: nextEntityIdRef.current++,
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 1.1,
    });
  };

  // --- DETONATE SUPERNOVA CELEBRATION BOMB ---
  const triggerSupernovaBomb = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (bombsAvailableRef.current <= 0) return;

    setBombsAvailable((b) => Math.max(0, b - 1));
    bombsAvailableRef.current = Math.max(0, bombsAvailableRef.current - 1);

    gameAudio.playChiptuneExplosion();
    gameAudio.playPowerupChime();
    screenShakeRef.current = 24 * (getConfig('screenShakeIntensity') as number);
    hitStopRef.current = 0.12;

    const activeZeros = [...zerosRef.current];
    zerosRef.current = [];

    let totalPoints = 0;
    activeZeros.forEach((zero) => {
      spawnParticles(zero.x, zero.y, 40, 'supernova');
      totalPoints += zero.type === 'gold' ? 500 : 200;
    });

    spawnParticles(canvasWidth / 2, canvasHeight / 2, 120, 'supernova');
    spawnFloater(
      canvasWidth / 2,
      canvasHeight / 2 - 40,
      'SUPERNOVA CELEBRATION! 💥',
      '#ff007f',
    );

    setGameState((prev) => ({
      ...prev,
      score: prev.score + Math.max(300, totalPoints),
    }));

    if (gameModeRef.current === 'HABIT') {
      setTimeout(() => {
        completeHabitCelebration();
      }, 400);
    }
  }, [canvasWidth, canvasHeight]);

  // Complete habit celebration routine
  const completeHabitCelebration = () => {
    gameAudio.playVictoryFanfare();
    const currentStreak = habitRef.current.streak;
    const newStreak = currentStreak + 1;
    const earnedStars = 20 * (getConfig('starTokenMultiplier') as number);

    const updated: HabitData = {
      ...habitRef.current,
      streak: newStreak,
      totalZerosBlasted:
        habitRef.current.totalZerosBlasted + targetZerosInWaveRef.current,
      lastCheckInDate: getTodayDateStr(),
      starTokens: habitRef.current.starTokens + earnedStars,
      bombs: Math.min(
        5,
        habitRef.current.bombs +
          1 +
          habitRef.current.upgrades.bombStockLevel,
      ),
    };
    saveHabit(updated);
    setCelebrationStreak(newStreak);
    setGameState((prev) => ({
      ...prev,
      status: 'VICTORY',
      score: prev.score + 1000 + newStreak * 200,
    }));

    triggerToast(
      '🎉 Day ' + newStreak + ' Streak Saved!',
      'Zeroes blasted for today! Daily cooldown matrix activated until midnight.',
    );
  };

  // --- FIRE WEAPONS ---
  const fireActiveWeapon = (targetX: number, targetY: number) => {
    const dx = targetX - turretBaseX;
    const dy = targetY - turretBaseY;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return;

    const angle = Math.atan2(dy, dx);
    turretRef.current.angle = angle;
    turretRef.current.recoil = 12;
    turretRef.current.muzzleFlash = 0.08;

    const weapon = WEAPONS[activeWeaponRef.current];
    const dmgUpgrade = habitRef.current.upgrades.damageLevel * 4;
    const fireRateUpgrade = habitRef.current.upgrades.fireRateLevel * 0.15;
    weaponCooldownRef.current = Math.max(
      0.06,
      weapon.cooldown * (1 - fireRateUpgrade),
    );

    gameAudio.playArcadeLaser();

    if (weapon.id === 'laser') {
      const perpAngle = angle + Math.PI / 2;
      const offset = 12;
      const pSpeed = 950;

      for (const side of [-1, 1]) {
        const sx = turretBaseX + Math.cos(perpAngle) * (offset * side);
        const sy = turretBaseY + Math.sin(perpAngle) * (offset * side);
        projectilesRef.current.push({
          id: nextEntityIdRef.current++,
          x: sx,
          y: sy,
          vx: Math.cos(angle) * pSpeed,
          vy: Math.sin(angle) * pSpeed,
          weapon: 'laser',
          damage: weapon.damage + dmgUpgrade,
          life: 0,
          maxLife: 1.4,
          color: weapon.color,
        });
      }
    } else if (weapon.id === 'shotgun') {
      const pSpeed = 820;
      const spread = 0.16;
      for (const offset of [-spread, 0, spread]) {
        const shotAngle = angle + offset;
        projectilesRef.current.push({
          id: nextEntityIdRef.current++,
          x: turretBaseX,
          y: turretBaseY,
          vx: Math.cos(shotAngle) * pSpeed,
          vy: Math.sin(shotAngle) * pSpeed,
          weapon: 'shotgun',
          damage: weapon.damage + dmgUpgrade,
          life: 0,
          maxLife: 1.2,
          color: weapon.color,
        });
      }
    } else if (weapon.id === 'starcannon') {
      const pSpeed = 700;
      projectilesRef.current.push({
        id: nextEntityIdRef.current++,
        x: turretBaseX,
        y: turretBaseY,
        vx: Math.cos(angle) * pSpeed,
        vy: Math.sin(angle) * pSpeed,
        weapon: 'starcannon',
        damage: weapon.damage + dmgUpgrade * 1.5,
        life: 0,
        maxLife: 1.6,
        color: weapon.color,
      });
    }
  };

  // --- INITIALIZE GAME RUN ---
  const initGame = useCallback(
    (mode: 'HABIT' | 'ARCADE' = gameMode) => {
      // Check if trying to play habit when already finished today
      if (mode === 'HABIT' && habitRef.current.lastCheckInDate === getTodayDateStr()) {
        setIsDailyCooldownOpen(true);
        gameAudio.playCrispClick();
        return;
      }

      setGameMode(mode);
      gameModeRef.current = mode;
      setIsDailyCooldownOpen(false);

      zerosRef.current = [];
      projectilesRef.current = [];
      particlesRef.current = [];
      floatersRef.current = [];
      dropsRef.current = [];

      weaponCooldownRef.current = 0;
      screenShakeRef.current = 0;
      hitStopRef.current = 0;
      comboTimerRef.current = 0;
      setCurrentCombo(0);
      setShieldHealth(getConfig('shieldMaxHealth') as number);
      setBombsAvailable(
        (getConfig('bombStartingStock') as number) +
          habitRef.current.upgrades.bombStockLevel,
      );

      if (mode === 'HABIT') {
        const streak = habitRef.current.streak;
        const zeroCount = Math.min(18, 3 + streak);
        targetZerosInWaveRef.current = zeroCount;
        setRemainingZerosCount(zeroCount);
        zerosSpawnedInWaveRef.current = zeroCount;

        const isMilestone =
          streak === 7 ||
          streak === 14 ||
          streak === 21 ||
          streak === 30 ||
          streak === 100;

        for (let i = 0; i < zeroCount; i++) {
          if (i === 0 && (isMilestone || streak >= 5)) {
            spawnZero('gold');
          } else {
            spawnZero('cyan');
          }
        }
      } else {
        arcadeWaveRef.current = 1;
        zerosSpawnedInWaveRef.current = 0;
        targetZerosInWaveRef.current = 8;
        setRemainingZerosCount(8);
        for (let i = 0; i < 4; i++) {
          spawnZero('cyan');
          zerosSpawnedInWaveRef.current++;
        }
      }

      setGameState({
        status: 'PLAYING',
        score: 0,
        level: mode === 'HABIT' ? habitRef.current.streak : 1,
      });

      if (sdk) {
        sdk.startGame();
      }
    },
    [gameMode, sdk],
  );

  // Playground lifecycle
  usePlaygroundGameLifecycle(gameState, sdk);

  // Auto-start check
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame('HABIT');
    }
  }, [initGame]);

  // Handle back button / Esc navigation
  useEffect(() => {
    (window as any).canHandleBackKey =
      gameState.status !== 'START' ||
      isGameMenuOpen ||
      isHowToPlayOpen ||
      isDailyCooldownOpen;
  }, [gameState.status, isGameMenuOpen, isHowToPlayOpen, isDailyCooldownOpen]);

  // Global keydown listeners for shortcuts (1, 2, 3, Space, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDailyCooldownOpen) {
          setIsDailyCooldownOpen(false);
          return;
        }
        if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
          return;
        }
        if (isShopOpen) {
          setIsShopOpen(false);
          return;
        }
        if (isGoalSetupOpen) {
          setIsGoalSetupOpen(false);
          return;
        }
        if (gameStateRef.current.status === 'PLAYING') {
          setIsGameMenuOpen((prev) => !prev);
        }
        return;
      }

      if (gameStateRef.current.status !== 'PLAYING' || isGameMenuOpen) return;

      if (e.key === '1') {
        setActiveWeapon('laser');
        gameAudio.playCrispClick();
      } else if (e.key === '2') {
        setActiveWeapon('shotgun');
        gameAudio.playCrispClick();
      } else if (e.key === '3') {
        setActiveWeapon('starcannon');
        gameAudio.playCrispClick();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        triggerSupernovaBomb();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isDailyCooldownOpen,
    isHowToPlayOpen,
    isShopOpen,
    isGoalSetupOpen,
    isGameMenuOpen,
    triggerSupernovaBomb,
  ]);

  // Sound effects on game status transitions
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
    }
  }, [gameState.status]);

  // --- 60FPS SIMULATION UPDATE ---
  const update = (dt: number) => {
    // Update Matrix Streams for Cascading Zeroes Background
    for (const stream of matrixStreamsRef.current) {
      stream.y += stream.speed * dt;
      if (stream.y > canvasHeight + 100) {
        stream.y = -stream.length * stream.size - Math.random() * 200;
        stream.x = Math.random() * canvasWidth;
        stream.speed = 120 + Math.random() * 280;
      }
    }

    if (gameStateRef.current.status !== 'PLAYING' || isGameMenuOpen) return;

    // Hit stop check
    if (hitStopRef.current > 0) {
      hitStopRef.current -= dt;
      return;
    }

    const input = inputRef.current;
    let targetAimX = input.pointer.x;
    let targetAimY = input.pointer.y;

    // Turret Recoil & Muzzle flash
    if (turretRef.current.recoil > 0) {
      turretRef.current.recoil = Math.max(0, turretRef.current.recoil - dt * 60);
    }
    if (turretRef.current.muzzleFlash > 0) {
      turretRef.current.muzzleFlash = Math.max(
        0,
        turretRef.current.muzzleFlash - dt,
      );
    }

    // Shield passive regen upgrade
    if (habitRef.current.upgrades.shieldRegenLevel > 0) {
      setShieldHealth((prev) =>
        Math.min(
          getConfig('shieldMaxHealth') as number,
          prev + dt * habitRef.current.upgrades.shieldRegenLevel * 1.5,
        ),
      );
    }

    // Combo timer decay
    if (comboTimerRef.current > 0) {
      comboTimerRef.current -= dt;
      if (comboTimerRef.current <= 0) {
        setCurrentCombo(0);
      }
    }

    // Aim Assist Magnetism
    const aimAssist = getConfig('aimAssistEnabled') as boolean;
    if (aimAssist && zerosRef.current.length > 0) {
      let closestZero: ZeroEntity | null = null;
      let closestDist = 9999;
      for (const zero of zerosRef.current) {
        const d = Math.hypot(zero.x - targetAimX, zero.y - targetAimY);
        if (d < 110 && d < closestDist) {
          closestDist = d;
          closestZero = zero;
        }
      }
      if (closestZero) {
        targetAimX += (closestZero.x - targetAimX) * 0.45;
        targetAimY += (closestZero.y - targetAimY) * 0.45;
      }
    }
    autoAimTargetRef.current = {x: targetAimX, y: targetAimY};

    const targetAngle = Math.atan2(
      targetAimY - turretBaseY,
      targetAimX - turretBaseX,
    );
    const clampedAngle = Math.max(
      -Math.PI * 0.95,
      Math.min(-Math.PI * 0.05, targetAngle),
    );
    turretRef.current.angle += (clampedAngle - turretRef.current.angle) * 0.4;

    // Firing logic
    if (weaponCooldownRef.current > 0) {
      weaponCooldownRef.current -= dt;
    }

    if (
      (input.pointer.down || input.actions.confirm || input.actions.tap) &&
      weaponCooldownRef.current <= 0 &&
      targetAimY < canvasHeight - 30
    ) {
      fireActiveWeapon(targetAimX, targetAimY);
    }

    // Update Projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
      const p = projectilesRef.current[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;

      if (
        p.life > p.maxLife ||
        p.x < -40 ||
        p.x > canvasWidth + 40 ||
        p.y < -40 ||
        p.y > canvasHeight + 40
      ) {
        projectilesRef.current.splice(i, 1);
        continue;
      }

      let projectileConsumed = false;
      for (let j = zerosRef.current.length - 1; j >= 0; j--) {
        const zero = zerosRef.current[j];
        const dist = Math.hypot(p.x - zero.x, p.y - zero.y);

        if (dist < zero.radius + 8) {
          zero.hp -= p.damage;
          zero.hitTimer = 0.12;
          zero.scaleX = 1.35;
          zero.scaleY = 0.75;
          zero.vx += (p.vx / 900) * 45;
          zero.vy += (p.vy / 900) * 45;

          spawnParticles(p.x, p.y, 8, 'spark');

          if (p.weapon === 'starcannon' && !p.isFragment) {
            gameAudio.playChiptuneExplosion();
            screenShakeRef.current =
              6 * (getConfig('screenShakeIntensity') as number);
            spawnParticles(p.x, p.y, 22, 'gold');

            for (let k = 0; k < 6; k++) {
              const fAngle = (Math.PI * 2 * k) / 6;
              const fSpeed = 380;
              projectilesRef.current.push({
                id: nextEntityIdRef.current++,
                x: p.x,
                y: p.y,
                vx: Math.cos(fAngle) * fSpeed,
                vy: Math.sin(fAngle) * fSpeed,
                weapon: 'starcannon',
                damage: 16,
                life: 0,
                maxLife: 0.35,
                color: '#ffd700',
                isFragment: true,
              });
            }
          }

          if (zero.hp <= 0) {
            gameAudio.playChiptuneExplosion();
            gameAudio.playCoinPickup();
            screenShakeRef.current =
              zero.type === 'gold'
                ? 16 * (getConfig('screenShakeIntensity') as number)
                : 8 * (getConfig('screenShakeIntensity') as number);

            spawnParticles(
              zero.x,
              zero.y,
              zero.type === 'gold' ? 45 : 24,
              zero.type === 'gold' ? 'gold' : 'cyan',
            );

            setCurrentCombo((prev) => {
              const next = prev + 1;
              comboTimerRef.current = 2.4;
              return next;
            });

            const comboBonus = Math.min(10, currentCombo + 1);
            const basePts =
              zero.type === 'gold' ? 350 : zero.type === 'mini' ? 50 : 120;
            const awardedPoints = basePts * comboBonus;

            setGameState((prev) => ({
              ...prev,
              score: prev.score + awardedPoints,
            }));

            spawnFloater(
              zero.x,
              zero.y - 15,
              `+${awardedPoints} ${comboBonus > 1 ? `x${comboBonus}` : ''}`,
              zero.type === 'gold' ? '#ffd700' : '#00f2fe',
            );

            if (
              gameModeRef.current === 'ARCADE' &&
              zero.type === 'cyan' &&
              Math.random() < 0.4
            ) {
              spawnZero('mini', zero.x - 18, zero.y);
              spawnZero('mini', zero.x + 18, zero.y);
            }

            if (Math.random() < 0.22) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                x: zero.x,
                y: zero.y,
                vy: 55,
                type: Math.random() < 0.35 ? 'bomb' : 'star',
                life: 0,
                bobTimer: Math.random() * Math.PI * 2,
              });
            }

            zerosRef.current.splice(j, 1);

            if (gameModeRef.current === 'HABIT') {
              setRemainingZerosCount(zerosRef.current.length);
              if (zerosRef.current.length === 0) {
                setTimeout(() => {
                  completeHabitCelebration();
                }, 300);
              }
            }
          }

          if (p.weapon !== 'laser') {
            projectileConsumed = true;
            break;
          }
        }
      }

      if (projectileConsumed) {
        projectilesRef.current.splice(i, 1);
      }
    }

    // Update Zero Entities
    for (let i = zerosRef.current.length - 1; i >= 0; i--) {
      const z = zerosRef.current[i];
      z.x += z.vx * dt;
      z.y += z.vy * dt;
      z.rotation += z.vRot * dt;
      z.orbitAngle += dt * 2.0;

      z.scaleX += (1 - z.scaleX) * 0.15;
      z.scaleY += (1 - z.scaleY) * 0.15;
      if (z.hitTimer > 0) z.hitTimer -= dt;

      const minX = z.radius + 20;
      const maxX = canvasWidth - z.radius - 20;
      const minY = z.radius + 40;
      const maxY = canvasHeight - 120;

      if (z.x < minX) {
        z.x = minX;
        z.vx = Math.abs(z.vx);
        z.scaleX = 0.8;
        z.scaleY = 1.25;
      } else if (z.x > maxX) {
        z.x = maxX;
        z.vx = -Math.abs(z.vx);
        z.scaleX = 0.8;
        z.scaleY = 1.25;
      }

      if (z.y < minY) {
        z.y = minY;
        z.vy = Math.abs(z.vy);
        z.scaleY = 0.8;
        z.scaleX = 1.25;
      } else if (z.y > maxY) {
        z.y = maxY;
        z.vy = -Math.abs(z.vy);
        z.scaleY = 0.7;
        z.scaleX = 1.3;

        if (gameModeRef.current === 'ARCADE') {
          const dmg = z.type === 'gold' ? 25 : z.type === 'mini' ? 8 : 15;
          setShieldHealth((prev) => {
            const next = Math.max(0, prev - dmg);
            if (next <= 0) {
              setGameState((g) => ({...g, status: 'GAME_OVER'}));
            }
            return next;
          });
          screenShakeRef.current = 10;
          spawnParticles(z.x, z.y, 16, 'spark');
          spawnFloater(z.x, z.y - 10, `-${dmg} SHIELD`, '#ff007f');
        }
      }
    }

    // Arcade Endless Spawner Loop
    if (gameModeRef.current === 'ARCADE') {
      spawnTimerRef.current += dt;
      const maxOnScreen = Math.min(14, 4 + arcadeWaveRef.current * 2);
      if (
        spawnTimerRef.current > 1.8 &&
        zerosRef.current.length < maxOnScreen
      ) {
        spawnTimerRef.current = 0;
        const isGold = Math.random() < 0.2 + arcadeWaveRef.current * 0.05;
        spawnZero(isGold ? 'gold' : 'cyan');
        zerosSpawnedInWaveRef.current++;

        if (zerosSpawnedInWaveRef.current >= targetZerosInWaveRef.current) {
          arcadeWaveRef.current++;
          zerosSpawnedInWaveRef.current = 0;
          targetZerosInWaveRef.current += 4;
          setGameState((prev) => ({...prev, level: arcadeWaveRef.current}));
          spawnFloater(
            canvasWidth / 2,
            120,
            `WAVE ${arcadeWaveRef.current}!`,
            '#ffd700',
          );
          gameAudio.playPowerupChime();
        }
      }
    }

    // Update Drop Items
    for (let i = dropsRef.current.length - 1; i >= 0; i--) {
      const drop = dropsRef.current[i];
      drop.y += drop.vy * dt;
      drop.bobTimer += dt * 3;
      drop.life += dt;

      const distReticle = Math.hypot(
        drop.x - targetAimX,
        drop.y - targetAimY,
      );
      if (distReticle < 60 || drop.y > canvasHeight - 70) {
        if (drop.type === 'bomb') {
          setBombsAvailable((b) => Math.min(5, b + 1));
          spawnFloater(drop.x, drop.y, '+1 CELEBRATION BOMB! 💣', '#ff007f');
          gameAudio.playPowerupChime();
        } else {
          const starsEarned = 10 * (getConfig('starTokenMultiplier') as number);
          const updated = {
            ...habitRef.current,
            starTokens: habitRef.current.starTokens + starsEarned,
          };
          saveHabit(updated);
          spawnFloater(drop.x, drop.y, `+${starsEarned} STARS! ⭐`, '#ffd700');
          gameAudio.playCoinPickup();
        }
        spawnParticles(drop.x, drop.y, 14, 'gold');
        dropsRef.current.splice(i, 1);
        continue;
      }

      if (drop.life > 12) {
        dropsRef.current.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
      p.life += dt;
      if (p.shape === 'confetti') {
        p.vy += dt * 120;
      }
      if (p.life >= p.maxLife) {
        particlesRef.current.splice(i, 1);
      }
    }

    // Update Floaters
    for (let i = floatersRef.current.length - 1; i >= 0; i--) {
      const f = floatersRef.current[i];
      f.y -= dt * 45;
      f.life += dt;
      if (f.life >= f.maxLife) {
        floatersRef.current.splice(i, 1);
      }
    }

    // Screen Shake Decay
    if (screenShakeRef.current > 0) {
      screenShakeRef.current = Math.max(
        0,
        screenShakeRef.current - dt * 40,
      );
    }
  };

  // --- 60FPS RENDERING ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    prepareCanvas(ctx, canvasWidth, canvasHeight);

    ctx.save();

    // Screen Shake Translation
    if (screenShakeRef.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Draw Space Arena Background
    drawBackground(
      ctx,
      assets['bg_space_arena'],
      canvasWidth,
      canvasHeight,
      '#0c071e',
    );

    // 2. Draw Cascading Matrix Zeroes Stream Effect (Active during Daily Cooldown or Start)
    const showMatrix = isDailyCooldownOpen || isDailyCompletedToday;
    if (showMatrix) {
      ctx.save();
      ctx.font = 'bold 18px "Courier New", monospace';
      for (const stream of matrixStreamsRef.current) {
        for (let j = 0; j < stream.chars.length; j++) {
          const cy = stream.y + j * stream.size;
          if (cy < -20 || cy > canvasHeight + 20) continue;

          const isHead = j === stream.chars.length - 1;
          ctx.globalAlpha = isHead ? 0.95 : (j / stream.length) * stream.alpha * 0.75;
          ctx.fillStyle = isHead ? '#ffffff' : j % 3 === 0 ? '#00f2fe' : '#38ef7d';

          if (isHead) {
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 10;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.fillText(stream.chars[j], stream.x, cy);
        }
      }
      ctx.restore();
    }

    // Subtle Hex Grid Glow Overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.07)';
    ctx.lineWidth = 1;
    const hexSize = 50;
    for (let x = 0; x < canvasWidth; x += hexSize * 1.5) {
      for (let y = 0; y < canvasHeight; y += hexSize * Math.sqrt(3)) {
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a;
          const hx = x + hexSize * Math.cos(angle);
          const hy = y + hexSize * Math.sin(angle);
          if (a === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Draw Shield Energy Barrier at Bottom (in Arcade Mode)
    if (gameModeRef.current === 'ARCADE') {
      const shieldY = canvasHeight - 110;
      const maxShield = (getConfig('shieldMaxHealth') as number) || 100;
      const pct = Math.max(0, Math.min(1, shieldHealth / maxShield));

      ctx.save();
      ctx.strokeStyle =
        pct > 0.5 ? 'rgba(0, 242, 254, 0.6)' : 'rgba(255, 0, 127, 0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(30, shieldY);
      ctx.lineTo(canvasWidth - 30, shieldY);
      ctx.stroke();

      const grad = ctx.createLinearGradient(0, shieldY, 0, canvasHeight - 70);
      grad.addColorStop(
        0,
        pct > 0.5 ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 0, 127, 0.25)',
      );
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(30, shieldY, canvasWidth - 60, canvasHeight - 70 - shieldY);
      ctx.restore();
    }

    // 4. Draw Drop Items (Bombs and Stars)
    for (const drop of dropsRef.current) {
      ctx.save();
      const bobY = drop.y + Math.sin(drop.bobTimer) * 6;
      ctx.translate(drop.x, bobY);

      ctx.fillStyle =
        drop.type === 'bomb'
          ? 'rgba(255, 0, 127, 0.25)'
          : 'rgba(255, 215, 0, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();

      if (drop.type === 'bomb') {
        drawAsset(
          ctx,
          assets['item_super_bomb'],
          -18,
          -18,
          36,
          36,
          (fallbackCtx) => {
            fallbackCtx.fillStyle = '#ff007f';
            fallbackCtx.beginPath();
            fallbackCtx.arc(0, 0, 16, 0, Math.PI * 2);
            fallbackCtx.fill();
          },
        );
      } else {
        drawAsset(
          ctx,
          assets['item_trophy_star'],
          -18,
          -18,
          36,
          36,
          (fallbackCtx) => {
            fallbackCtx.fillStyle = '#ffd700';
            fallbackCtx.beginPath();
            fallbackCtx.arc(0, 0, 16, 0, Math.PI * 2);
            fallbackCtx.fill();
          },
        );
      }
      ctx.restore();
    }

    // 5. Draw Projectiles
    for (const p of projectilesRef.current) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;

      if (p.weapon === 'laser') {
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.weapon === 'shotgun') {
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.weapon === 'starcannon') {
        ctx.beginPath();
        ctx.arc(0, 0, p.isFragment ? 4 : 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Draw Zero Entities
    for (const z of zerosRef.current) {
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.scale(z.scaleX, z.scaleY);
      ctx.rotate(z.rotation);

      const dSize = z.radius * 2;
      const assetKey =
        z.type === 'gold' ? 'target_zero_gold' : 'target_zero_cyan';

      if (z.hitTimer > 0) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 24;
      } else if (z.type === 'gold') {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 18;
      } else {
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 12;
      }

      drawAsset(
        ctx,
        assets[assetKey],
        -z.radius,
        -z.radius,
        dSize,
        dSize,
        (fallbackCtx) => {
          fallbackCtx.fillStyle =
            z.type === 'gold' ? '#ffd700' : '#00f2fe';
          fallbackCtx.beginPath();
          fallbackCtx.arc(0, 0, z.radius, 0, Math.PI * 2);
          fallbackCtx.fill();
          fallbackCtx.fillStyle = '#0c071e';
          fallbackCtx.beginPath();
          fallbackCtx.arc(0, 0, z.radius * 0.5, 0, Math.PI * 2);
          fallbackCtx.fill();
        },
      );

      if (z.type === 'gold') {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, z.radius * 1.3, z.radius * 0.6, z.orbitAngle, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (z.hp < z.maxHp) {
        ctx.restore();
        ctx.save();
        ctx.translate(z.x, z.y - z.radius - 12);
        const barW = z.radius * 1.6;
        const barH = 4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-barW / 2, -barH / 2, barW, barH);
        const hpPct = Math.max(0, z.hp / z.maxHp);
        ctx.fillStyle = z.type === 'gold' ? '#ffd700' : '#00f2fe';
        ctx.fillRect(-barW / 2, -barH / 2, barW * hpPct, barH);
      }

      ctx.restore();
    }

    // 7. Draw Particles
    for (const p of particlesRef.current) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      ctx.rotate(p.rotation);

      if (p.shape === 'star') {
        const s = p.size;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(
            Math.cos(((18 + i * 72) * Math.PI) / 180) * s,
            -Math.sin(((18 + i * 72) * Math.PI) / 180) * s,
          );
          ctx.lineTo(
            Math.cos(((54 + i * 72) * Math.PI) / 180) * (s * 0.5),
            -Math.sin(((54 + i * 72) * Math.PI) / 180) * (s * 0.5),
          );
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'zero') {
        ctx.font = `bold ${p.size}px "Outfit", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0', 0, 0);
      } else if (p.shape === 'confetti') {
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      } else if (p.shape === 'ring') {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 + p.life * 2), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Draw Floaters
    for (const f of floatersRef.current) {
      ctx.save();
      const alpha = Math.max(0, 1 - f.life / f.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 16px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // 9. Draw Player Turret Base & Cannon
    ctx.save();
    const tWidth = (getConfig('assetBlasterTurretWidth') as number) || 88;
    const tHeight = (getConfig('assetBlasterTurretHeight') as number) || 121;
    const turretRecoilY =
      Math.sin(turretRef.current.angle) * turretRef.current.recoil;
    const turretRecoilX =
      Math.cos(turretRef.current.angle) * turretRef.current.recoil;

    ctx.translate(
      turretBaseX + turretRecoilX,
      turretBaseY + turretRecoilY,
    );
    ctx.rotate(turretRef.current.angle + Math.PI / 2);

    drawAsset(
      ctx,
      assets['blaster_turret'],
      -tWidth / 2,
      -tHeight / 2,
      tWidth,
      tHeight,
      (fallbackCtx) => {
        fallbackCtx.fillStyle = '#ffffff';
        fallbackCtx.fillRect(-20, -40, 40, 60);
      },
    );

    if (turretRef.current.muzzleFlash > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(0, -tHeight / 2 - 8, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 10. Draw Targeting Reticle Crosshair
    if (autoAimTargetRef.current && gameStateRef.current.status === 'PLAYING') {
      const rx = autoAimTargetRef.current.x;
      const ry = autoAimTargetRef.current.y;
      ctx.save();
      ctx.translate(rx, ry);
      const rSize = 44;

      drawAsset(
        ctx,
        assets['reticle_crosshair'],
        -rSize / 2,
        -rSize / 2,
        rSize,
        rSize,
        (fallbackCtx) => {
          fallbackCtx.strokeStyle = '#00f2fe';
          fallbackCtx.lineWidth = 2;
          fallbackCtx.beginPath();
          fallbackCtx.arc(0, 0, 16, 0, Math.PI * 2);
          fallbackCtx.stroke();
        },
      );
      ctx.restore();
    }

    ctx.restore();
  };

  // --- GAME LOOP RAF ---
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      stepperRef.current?.(time, (dt) => updateRef.current(dt));
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isMusicPlaying =
    !['START', 'GAME_OVER'].includes(gameState.status) && !isMusicMuted;

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between bg-slate-950 text-white font-sans select-none">
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white">
          <div className="text-xl font-bold tracking-widest animate-pulse text-cyan-400">
            LOADING WIN ZERO...
          </div>
        </div>
      )}

      {/* Background Music */}
      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={isMusicPlaying}
        isMuted={isMusicMuted}
      />

      {/* --- IN-GAME NOTIFICATION TOAST OVERLAY --- */}
      {activeToast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-slate-900/95 border-2 border-cyan-400 text-white rounded-2xl p-3.5 shadow-[0_0_25px_rgba(0,242,254,0.4)] backdrop-blur-md flex items-start gap-3 animate-bounce">
          <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400 shrink-0">
            <Bell size={20} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-cyan-300 tracking-wide uppercase">
              {activeToast.title}
            </div>
            <div className="text-xs text-slate-200 mt-0.5 leading-snug">
              {activeToast.message}
            </div>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* DEDICATED TOP HUD BAR */}
      <header className="w-full bg-slate-900/90 border-b border-cyan-500/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        {/* Left: Habit Info / Streak */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-400/30 px-2.5 py-1 rounded-full text-xs font-semibold text-cyan-300">
            <Flame size={14} className="text-orange-400 fill-orange-400" />
            <span>
              {gameMode === 'HABIT'
                ? `Day ${habit.streak} Streak`
                : `Wave ${gameState.level}`}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-300 truncate max-w-[180px]">
            <span className="font-semibold text-cyan-400">Goal:</span>{' '}
            {habit.goalName}
          </div>

          {/* Star Tokens Counter */}
          <div className="flex items-center gap-1 bg-amber-950/50 border border-amber-400/30 px-2 py-0.5 rounded-md text-xs font-bold text-amber-300">
            <Star size={13} className="text-amber-400 fill-amber-400" />
            <span>{habit.starTokens}</span>
          </div>
        </div>

        {/* Center: Score & Combo / Countdown / Zeros Left */}
        <div className="flex items-center gap-4 text-xs font-bold">
          <div>
            SCORE: <span className="text-cyan-300">{gameState.score}</span>
          </div>

          {/* Daily Reset Midnight Indicator */}
          <button
            onClick={() => setIsDailyCooldownOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-500/30 text-[11px] transition-colors">
            <Clock size={12} className="text-cyan-400" />
            <span>
              RESET: {countdown.hours}:{countdown.minutes}:{countdown.seconds}
            </span>
          </button>

          {currentCombo > 1 && (
            <div className="text-orange-400 animate-bounce">
              {currentCombo}x COMBO!
            </div>
          )}
          {gameMode === 'HABIT' && gameState.status === 'PLAYING' && (
            <div className="text-amber-300 bg-black/40 px-2 py-0.5 rounded border border-amber-500/20">
              ZEROS LEFT: {remainingZerosCount}
            </div>
          )}
          {gameMode === 'ARCADE' && gameState.status === 'PLAYING' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <Shield size={14} className="text-cyan-400" />
              <div className="w-16 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-200 ${
                    shieldHealth > 40 ? 'bg-cyan-400' : 'bg-rose-500'
                  }`}
                  style={{width: `${Math.max(0, shieldHealth)}%`}}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions & Persistent Menu Button */}
        <div className="flex items-center gap-2">
          {gameState.status === 'PLAYING' && (
            <button
              onClick={() => setIsShopOpen(true)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded text-xs font-bold flex items-center gap-1 transition-colors">
              <Sparkles size={13} />
              <span className="hidden sm:inline">Shop</span>
            </button>
          )}

          {/* Reserved Top-Right Menu Button */}
          <button
            onClick={() => setIsGameMenuOpen(true)}
            data-testid="menu-button"
            className="min-w-[40px] min-h-[36px] bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1 rounded font-bold text-xs flex items-center justify-center gap-1 shadow-lg transition-colors">
            <Menu size={16} />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* GAME CANVAS WRAPPER */}
      <div className="flex-1 w-full min-h-0 flex items-center justify-center relative bg-slate-950">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
          }}
          className="h-auto max-w-full max-h-full drop-shadow-2xl"
        />
      </div>

      {/* BOTTOM CONTROLS & WEAPON SELECTOR DOCK */}
      {gameState.status === 'PLAYING' && (
        <footer className="w-full bg-slate-900/90 border-t border-cyan-500/20 px-3 py-1.5 flex items-center justify-between gap-2 z-20 shrink-0">
          {/* Weapon Selector */}
          <div className="flex items-center gap-1.5">
            {(['laser', 'shotgun', 'starcannon'] as WeaponType[]).map((wId, idx) => {
              const w = WEAPONS[wId];
              const isSelected = activeWeapon === wId;
              return (
                <button
                  key={wId}
                  onClick={() => {
                    setActiveWeapon(wId);
                    gameAudio.playCrispClick();
                  }}
                  className={`min-w-[48px] min-h-[44px] px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all border ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_12px_rgba(0,242,254,0.6)]'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}>
                  <span className="text-sm">{w.icon}</span>
                  <span className="hidden md:inline">{w.name}</span>
                  <span className="text-[10px] opacity-60">[{idx + 1}]</span>
                </button>
              );
            })}
          </div>

          {/* Supernova Celebration Bomb Detonator Button */}
          <button
            onClick={triggerSupernovaBomb}
            disabled={bombsAvailable <= 0}
            className={`min-w-[48px] min-h-[44px] px-4 py-1.5 rounded-lg font-black text-xs md:text-sm flex items-center gap-2 transition-all border ${
              bombsAvailable > 0
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white border-pink-400 shadow-[0_0_16px_rgba(255,0,127,0.7)] animate-pulse hover:scale-105 active:scale-95'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}>
            <span className="text-base">💣</span>
            <span>SUPERNOVA ({bombsAvailable})</span>
            <span className="hidden sm:inline text-[10px] opacity-75">
              [SPACE]
            </span>
          </button>
        </footer>
      )}

      {/* --- START MENU OVERLAY --- */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
            {/* Trophy Star Emblem */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center p-3 shadow-lg shadow-cyan-500/30">
              <Award className="w-10 h-10 text-amber-300 fill-amber-300" />
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-yellow-300 to-pink-400">
                WIN ZERO
              </h1>
              <p className="text-xs md:text-sm text-cyan-200 mt-1">
                Blast zeroes to celebrate daily discipline & build streaks!
              </p>
            </div>

            {/* Active Habit Goal Card */}
            <div className="w-full bg-slate-800/80 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col gap-2 text-left">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>ACTIVE HABIT GOAL</span>
                <button
                  onClick={() => setIsGoalSetupOpen(true)}
                  className="text-cyan-400 font-bold hover:underline">
                  Change
                </button>
              </div>
              <div className="text-sm font-bold text-white">
                {habit.goalName}
              </div>
              <div className="flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-1.5">
                  <Flame size={14} className="fill-amber-400 text-amber-400" />
                  <span>Current Streak: Day {habit.streak}</span>
                </div>
                {isDailyCompletedToday && (
                  <span className="bg-emerald-950/80 border border-emerald-400/40 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    DONE TODAY
                  </span>
                )}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="w-full flex flex-col gap-2.5 mt-2">
              {isDailyCompletedToday ? (
                <button
                  ref={startButtonRef}
                  onClick={() => setIsDailyCooldownOpen(true)}
                  className="w-full min-h-[48px] bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm md:text-base rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-transform active:scale-95">
                  <Clock size={18} />
                  TODAY COMPLETED • VIEW ZERO COOLDOWN
                </button>
              ) : (
                <button
                  ref={startButtonRef}
                  onClick={() => initGame('HABIT')}
                  className="w-full min-h-[48px] bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-base md:text-lg rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 transition-transform active:scale-95">
                  <Sparkles size={20} />
                  CHECK-IN & BLAST DAY {habit.streak}
                </button>
              )}

              <button
                onClick={() => initGame('ARCADE')}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm md:text-base rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors">
                <Gamepad2 size={18} className="text-pink-400" />
                ENDLESS ARCADE RUSH
              </button>
            </div>

            {/* Daily Reset Status & Cooldown Matrix Shortcut */}
            <div className="w-full bg-slate-800/40 border border-slate-700/60 rounded-xl p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock size={14} className="text-cyan-400" />
                <span>Midnight Reset:</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {countdown.hours}:{countdown.minutes}:{countdown.seconds}
                </span>
              </div>
              <button
                onClick={() => setIsDailyCooldownOpen(true)}
                className="text-cyan-400 font-bold hover:underline flex items-center gap-1 text-[11px]">
                Daily Matrix
              </button>
            </div>

            {/* Secondary Navigation */}
            <div className="flex items-center justify-between w-full pt-2 border-t border-slate-800 text-xs text-slate-400">
              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="hover:text-cyan-300 flex items-center gap-1">
                <HelpCircle size={14} />
                How to Play
              </button>
              <button
                onClick={() => setIsShopOpen(true)}
                className="hover:text-amber-300 flex items-center gap-1 text-amber-400 font-semibold">
                <Sparkles size={14} />
                Arsenal Shop
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- DAILY COOLDOWN & CASCADING ZEROES MATRIX MODAL --- */}
      {isDailyCooldownOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-lg bg-slate-900/95 border-2 border-cyan-400/80 rounded-2xl p-6 shadow-[0_0_40px_rgba(0,242,254,0.3)] backdrop-blur-md flex flex-col gap-4 text-center">
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400">
                  <Clock size={20} className="animate-spin" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg md:text-xl font-black text-cyan-300">
                    DAILY CYCLE & RESET COOLDOWN
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Cascading Zeroes Matrix Active • Resets at Midnight
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDailyCooldownOpen(false)}
                className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Giant Countdown Clock Display */}
            <div className="w-full bg-slate-950/80 border border-cyan-500/40 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-inner">
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={13} />
                Next Daily Zeroes Spawn In
              </div>

              <div className="grid grid-cols-3 gap-2 w-full max-w-xs my-1">
                <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-3xl md:text-4xl font-black text-cyan-300 font-mono">
                    {countdown.hours}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">
                    Hours
                  </span>
                </div>
                <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-3xl md:text-4xl font-black text-cyan-300 font-mono">
                    {countdown.minutes}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">
                    Minutes
                  </span>
                </div>
                <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-3xl md:text-4xl font-black text-cyan-300 font-mono">
                    {countdown.seconds}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">
                    Seconds
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                {isDailyCompletedToday ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Day {habit.streak} Discipline
                    Secured!
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold">
                    Day {habit.streak} Ready to Check-In!
                  </span>
                )}
              </div>
            </div>

            {/* Notification Reminder Toggle & Simulator Controls */}
            <div className="w-full bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isDailyNotifyEnabled ? (
                    <Bell size={18} className="text-cyan-400" />
                  ) : (
                    <BellOff size={18} className="text-slate-500" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-white">
                      Daily Reset Reminder
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Alerts when tomorrow's zeroes become available
                    </div>
                  </div>
                </div>

                <button
                  onClick={toggleDailyNotification}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                    isDailyNotifyEnabled
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_10px_rgba(0,242,254,0.5)]'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}>
                  {isDailyNotifyEnabled ? 'ENABLED' : 'MUTED'}
                </button>
              </div>

              {/* Notification Test Simulator */}
              <div className="pt-2 border-t border-slate-700 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Preview reminder message:
                </span>
                <button
                  onClick={sendTestNotification}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors">
                  <Bell size={12} />
                  <span>Send Test Toast</span>
                </button>
              </div>
            </div>

            {/* Dev / Demo Fast-Forward Mechanic Button */}
            <div className="w-full bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900/40 border border-purple-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-left">
              <div>
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <FastForward size={14} className="text-pink-400" />
                  Fast-Forward / Dev Test
                </div>
                <div className="text-[10px] text-slate-400">
                  Skip midnight cooldown & unlock Day {habit.streak} check-in immediately
                </div>
              </div>

              <button
                onClick={fastForwardToNextDay}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black text-xs rounded-lg shadow-md transition-transform active:scale-95 shrink-0 flex items-center justify-center gap-1">
                <FastForward size={14} />
                <span>UNLOCK NEXT DAY</span>
              </button>
            </div>

            {/* Footer Options */}
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <button
                onClick={() => {
                  setIsDailyCooldownOpen(false);
                  initGame('ARCADE');
                }}
                className="flex-1 min-h-[42px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                <Gamepad2 size={16} className="text-pink-400" />
                PLAY ENDLESS ARCADE
              </button>

              <button
                onClick={() => setIsDailyCooldownOpen(false)}
                className="flex-1 min-h-[42px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center">
                CLOSE COOLDOWN
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- HABIT GOAL SETUP MODAL --- */}
      {isGoalSetupOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-cyan-300">
                Choose Habit Goal
              </h2>
              <button
                onClick={() => setIsGoalSetupOpen(false)}
                className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select what daily discipline you are tracking to blast away zeroes:
            </p>

            {/* Presets List */}
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {DEFAULT_HABIT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    const updated = {...habit, goalName: preset.name};
                    saveHabit(updated);
                    setIsGoalSetupOpen(false);
                    gameAudio.playCrispClick();
                  }}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-colors ${
                    habit.goalName === preset.name
                      ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300'
                      : 'bg-slate-800/70 border-slate-700 hover:border-cyan-500 text-slate-200'
                  }`}>
                  <div>
                    <div className="text-xs font-bold">{preset.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Target: {preset.streakTarget} Days • {preset.tag}
                    </div>
                  </div>
                  {habit.goalName === preset.name && (
                    <Award size={18} className="text-amber-400" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsGoalSetupOpen(false)}
              className="min-h-[44px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-colors">
              CONFIRM
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* --- ARSENAL UPGRADE SHOP --- */}
      {isShopOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-amber-400" />
                <h2 className="text-xl font-bold text-amber-300">
                  Arsenal Upgrades
                </h2>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-1 rounded-full border border-amber-500/30">
                <Star size={14} className="fill-amber-400" />
                <span>{habit.starTokens} Tokens</span>
              </div>
            </div>

            {/* Upgrades List */}
            <div className="flex flex-col gap-2.5 text-left">
              {/* Fire Rate */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-cyan-300">
                    Blaster Rapid Fire
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Level {habit.upgrades.fireRateLevel} / 5 (+15% speed)
                  </div>
                </div>
                <button
                  disabled={
                    habit.starTokens < 30 ||
                    habit.upgrades.fireRateLevel >= 5
                  }
                  onClick={() => {
                    if (habit.starTokens >= 30) {
                      const updated: HabitData = {
                        ...habit,
                        starTokens: habit.starTokens - 30,
                        upgrades: {
                          ...habit.upgrades,
                          fireRateLevel: habit.upgrades.fireRateLevel + 1,
                        },
                      };
                      saveHabit(updated);
                      gameAudio.playPowerupChime();
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-lg transition-colors">
                  {habit.upgrades.fireRateLevel >= 5 ? 'MAX' : '30 ⭐'}
                </button>
              </div>

              {/* Damage */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-pink-300">
                    Plasma Overdrive Damage
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Level {habit.upgrades.damageLevel} / 5 (+25% power)
                  </div>
                </div>
                <button
                  disabled={
                    habit.starTokens < 40 ||
                    habit.upgrades.damageLevel >= 5
                  }
                  onClick={() => {
                    if (habit.starTokens >= 40) {
                      const updated: HabitData = {
                        ...habit,
                        starTokens: habit.starTokens - 40,
                        upgrades: {
                          ...habit.upgrades,
                          damageLevel: habit.upgrades.damageLevel + 1,
                        },
                      };
                      saveHabit(updated);
                      gameAudio.playPowerupChime();
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-lg transition-colors">
                  {habit.upgrades.damageLevel >= 5 ? 'MAX' : '40 ⭐'}
                </button>
              </div>

              {/* Shield Regen */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    Nanite Shield Regen
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Level {habit.upgrades.shieldRegenLevel} / 5 (Regenerates
                    integrity)
                  </div>
                </div>
                <button
                  disabled={
                    habit.starTokens < 35 ||
                    habit.upgrades.shieldRegenLevel >= 5
                  }
                  onClick={() => {
                    if (habit.starTokens >= 35) {
                      const updated: HabitData = {
                        ...habit,
                        starTokens: habit.starTokens - 35,
                        upgrades: {
                          ...habit.upgrades,
                          shieldRegenLevel:
                            habit.upgrades.shieldRegenLevel + 1,
                        },
                      };
                      saveHabit(updated);
                      gameAudio.playPowerupChime();
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-lg transition-colors">
                  {habit.upgrades.shieldRegenLevel >= 5 ? 'MAX' : '35 ⭐'}
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsShopOpen(false)}
              className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-colors mt-2">
              CLOSE
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* --- MANDATORY GAME MENU OVERLAY --- */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl md:text-3xl font-black text-cyan-300">
              GAME MENU
            </h2>

            {/* Menu Buttons */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => setIsGameMenuOpen(false)}
                className="w-full min-h-[48px] bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2">
                <Play size={18} />
                RESUME
              </button>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  initGame(gameMode);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2">
                <RotateCw size={16} />
                TRY LEVEL AGAIN
              </button>

              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2">
                <HelpCircle size={16} />
                HOW TO PLAY
              </button>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setIsDailyCooldownOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-sm rounded-xl border border-cyan-500/30 transition-colors flex items-center justify-center gap-2">
                <Clock size={16} />
                DAILY MATRIX & COUNTDOWN
              </button>

              {/* Audio Controls Grid */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => {
                    const muted = gameAudio.toggleMute();
                    setIsSfxMuted(muted);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                    isSfxMuted
                      ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                      : 'bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700'
                  }`}>
                  {isSfxMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  <span>SFX: {isSfxMuted ? 'OFF' : 'ON'}</span>
                </button>

                <button
                  onClick={() => setIsMusicMuted((prev) => !prev)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                    isMusicMuted
                      ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                      : 'bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700'
                  }`}>
                  {isMusicMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  <span>Music: {isMusicMuted ? 'OFF' : 'ON'}</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full min-h-[44px] bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border border-rose-500/40 font-bold text-xs rounded-xl transition-colors mt-2">
                QUIT TO MAIN MENU
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- HOW TO PLAY GUIDE MODAL --- */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 className="text-xl font-bold text-cyan-300 flex items-center gap-2">
                <HelpCircle size={20} />
                How to Play Win Zero
              </h2>
              <button
                onClick={() => setIsHowToPlayOpen(false)}
                className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3">
              <div>
                <span className="font-bold text-cyan-300">
                  1. The Daily Celebration Cycle:
                </span>
                <p className="mt-0.5 text-slate-400">
                  Track your real-world daily habit (e.g. Stop Drinking, Fitness,
                  Reading). Each day you check in, active zero targets spawn.
                  Blast every zero to trigger full-screen victory fireworks and
                  advance your streak!
                </p>
              </div>

              <div>
                <span className="font-bold text-emerald-300">
                  2. Midnight Reset & Cascading Zero Matrix:
                </span>
                <p className="mt-0.5 text-slate-400">
                  Once today's check-in is blasted, the game enters a Cascading Zeroes
                  cooldown mode with a live midnight countdown timer and daily reminders.
                  You can also use Fast-Forward to test future days!
                </p>
              </div>

              <div>
                <span className="font-bold text-amber-300">
                  3. Blaster Arsenal (1, 2, 3):
                </span>
                <ul className="mt-1 list-disc list-inside text-slate-400 space-y-0.5">
                  <li>
                    <b className="text-cyan-300">Pulse Laser:</b> Fast precision
                    twin beams.
                  </li>
                  <li>
                    <b className="text-emerald-300">Pulse Shotgun:</b> 3-way
                    spread for crowds.
                  </li>
                  <li>
                    <b className="text-amber-300">Star Cannon:</b> Explosive
                    shells with cluster fragments.
                  </li>
                </ul>
              </div>

              <div>
                <span className="font-bold text-pink-400">
                  4. Supernova Bomb (Spacebar / Bomb Button):
                </span>
                <p className="mt-0.5 text-slate-400">
                  Vaporizes all zeroes on screen instantly in a spectacular
                  celebratory blast wave.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
              className="min-h-[44px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-colors mt-2 text-center">
              GOT IT!
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* --- VICTORY CELEBRATION MODAL --- */}
      {gameState.status === 'VICTORY' && (
        <MenuOverlay tone="victory" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-400 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 flex items-center justify-center p-4 shadow-[0_0_24px_rgba(255,215,0,0.6)] animate-bounce">
              <Award className="w-12 h-12 text-slate-950 fill-slate-950" />
            </div>

            <div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-emerald-300">
                DAY {celebrationStreak} COMPLETE!
              </h2>
              <p className="text-xs text-emerald-300 mt-1">
                Zeroes Blasted! Habit Streak Extended!
              </p>
            </div>

            {/* Habit Milestone Certificate Card */}
            <div className="w-full bg-slate-800/90 border border-amber-400/40 rounded-xl p-4 flex flex-col gap-2 text-left">
              <div className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">
                Habit Discipline Record
              </div>
              <div className="text-base font-black text-white">
                {habit.goalName}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-700">
                <span>New Streak:</span>
                <span className="font-bold text-amber-300">
                  {habit.streak} Days 🔥
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Reward:</span>
                <span className="font-bold text-amber-300">+20 Star Tokens ⭐</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Next Daily Reset In:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {countdown.hours}:{countdown.minutes}:{countdown.seconds}
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  setGameState((g) => ({...g, status: 'START'}));
                  setIsDailyCooldownOpen(true);
                }}
                className="w-full min-h-[48px] bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-base rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                <Clock size={18} />
                VIEW DAILY MATRIX & COUNTDOWN
              </button>
              <button
                onClick={() => setGameState((g) => ({...g, status: 'START'}))}
                className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors">
                RETURN TO DASHBOARD
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- GAME OVER OVERLAY (Arcade Mode) --- */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="SHIELD DEPLETED"
          description={`Final Score: ${gameState.score} • Wave ${gameState.level}`}
          actionLabel="TRY AGAIN"
          onAction={() => initGame('ARCADE')}
          icon={<RotateCw size={24} />}
          tone="danger"
        />
      )}
    </div>
  );
}
