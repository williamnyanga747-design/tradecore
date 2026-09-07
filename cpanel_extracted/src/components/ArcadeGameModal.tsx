import React, { useEffect, useRef, useState } from 'react';
import { X, Gamepad2, Volume2, VolumeX, Power, RotateCcw } from 'lucide-react';

interface ArcadeGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size?: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isBoss: boolean;
}

interface Pickup {
  x: number;
  y: number;
  type: 'ammo' | 'heart';
}

interface Boss {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  dir: number;
  shootTimer: number;
  moveTimer: number;
  entering: boolean;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'car' | 'truck';
  color: string;
  hp: number;
  shootTimer: number;
  canShoot: boolean;
}

interface GameState {
  player_x: number;
  player_y: number;
  score: 0;
  obstacles: Obstacle[];
  pBullets: Bullet[];
  eBullets: Bullet[];
  particles: Particle[];
  pickups: Pickup[];
  game_speed: number;
  roadOffset: number;
  gameOver: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  frameCount: number;
  highScore: number;
  lastShoot: number;
  ammo: number;
  maxAmmo: number;
  lives: number;
  isReloading: boolean;
  autoFire: boolean;
  isFiring: boolean;
  boss: Boss | null;
  bossLevel: number;
  nextBossScore: number;
}

const MAX_AMMO = 50;
const MAX_LIVES = 5;
const SHOOT_COOLDOWN = 135;

export default function ArcadeGameModal({ isOpen, onClose, userName }: ArcadeGameModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [isAutoFire, setIsAutoFire] = useState(false);
  const [pressedLeft, setPressedLeft] = useState(false);
  const [pressedRight, setPressedRight] = useState(false);
  const [pressedShoot, setPressedShoot] = useState(false);
  const [showReloadHint, setShowReloadHint] = useState<string | null>(null);
  const [bossBarVisible, setBossBarVisible] = useState(false);
  const [bossBarWidth, setBossBarWidth] = useState('100%');
  const [bossLabelVisible, setBossLabelVisible] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);
  const gameStateRef = useRef<GameState>({
    player_x: 60,
    player_y: 168,
    score: 0,
    obstacles: [],
    pBullets: [],
    eBullets: [],
    particles: [],
    pickups: [],
    game_speed: 1.8,
    roadOffset: 0,
    gameOver: false,
    moveLeft: false,
    moveRight: false,
    frameCount: 0,
    highScore: parseInt(localStorage.getItem('arcade_highscore') || '0', 10),
    lastShoot: 0,
    ammo: MAX_AMMO,
    maxAmmo: MAX_AMMO,
    lives: 3,
    isReloading: false,
    autoFire: false,
    isFiring: false,
    boss: null,
    bossLevel: 1,
    nextBossScore: 200,
  });

  const animFrameRef = useRef<number | null>(null);

  // --- Audio Functions ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.3, slideTo: number | null = null) => {
    if (!isSoundOn || !audioCtxRef.current) return;
    initAudio();
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const playNoise = (duration: number, vol: number, filterFreq = 800) => {
    if (!isSoundOn || !audioCtxRef.current) return;
    initAudio();
    try {
      const ctx = audioCtxRef.current;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {}
  };

  const startEngineHum = (speed: number) => {
    if (!isSoundOn || !audioCtxRef.current || engineOscRef.current) return;
    initAudio();
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 55 + speed * 12;
      gain.gain.value = 0.035;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      engineOscRef.current = osc;
      engineGainRef.current = gain;
    } catch {}
  };

  const updateEngineHum = (speed: number) => {
    if (engineOscRef.current && audioCtxRef.current) {
      engineOscRef.current.frequency.setTargetAtTime(55 + speed * 14, audioCtxRef.current.currentTime, 0.1);
    }
  };

  const stopEngineHum = () => {
    if (engineOscRef.current && engineGainRef.current && audioCtxRef.current) {
      try {
        engineGainRef.current.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.2);
        engineOscRef.current.stop(audioCtxRef.current.currentTime + 0.22);
      } catch {}
      engineOscRef.current = null;
      engineGainRef.current = null;
    }
  };

  // --- Sound Effects ---
  const sfx = {
    shoot: () => {
      playTone(900, 'square', 0.07, 0.22, 400);
      playTone(1800, 'square', 0.05, 0.1);
      playNoise(0.06, 0.07, 2600);
    },
    enemyShoot: () => {
      playTone(250, 'square', 0.12, 0.15, 120);
    },
    bossShoot: () => {
      playTone(180, 'square', 0.15, 0.25, 80);
      playTone(90, 'sawtooth', 0.2, 0.2);
    },
    hit: () => {
      playNoise(0.22, 0.35, 1200);
      playTone(150, 'sawtooth', 0.22, 0.4, 20);
    },
    bossHit: () => {
      playTone(600, 'square', 0.06, 0.25);
      playNoise(0.1, 0.15, 2000);
    },
    playerHit: () => {
      playNoise(0.4, 0.4, 600);
      playTone(300, 'sawtooth', 0.5, 0.5, 40);
    },
    bossExplode: () => {
      playNoise(0.8, 0.6, 900);
      playTone(400, 'sawtooth', 0.8, 0.6, 20);
      playTone(150, 'sine', 1.0, 0.5);
    },
    pickup: () => {
      playTone(600, 'sine', 0.1, 0.3, 1200);
      setTimeout(() => playTone(1000, 'sine', 0.12, 0.25), 80);
    },
    empty: () => {
      playTone(120, 'square', 0.15, 0.2);
    },
    reload: () => {
      playTone(300, 'square', 0.08, 0.2, 500);
      setTimeout(() => playTone(500, 'square', 0.08, 0.2, 700), 100);
      setTimeout(() => playTone(800, 'square', 0.15, 0.25), 200);
    },
    bossEnter: () => {
      playTone(100, 'sawtooth', 0.5, 0.4, 300);
      setTimeout(() => playTone(80, 'sawtooth', 0.6, 0.4, 40), 300);
      playNoise(0.5, 0.3, 200);
    },
    levelUp: () => {
      playTone(400, 'square', 0.12, 0.3, 800);
      setTimeout(() => playTone(600, 'square', 0.12, 0.3, 1000), 100);
      setTimeout(() => playTone(900, 'square', 0.2, 0.3), 200);
    },
    powerOn: () => {
      playTone(200, 'sine', 0.15, 0.4, 600);
      setTimeout(() => playTone(600, 'square', 0.2, 0.25, 900), 120);
    },
    move: () => playTone(450, 'square', 0.05, 0.06),
    score: () => {
      playTone(1200, 'sine', 0.08, 0.2);
      setTimeout(() => playTone(1600, 'sine', 0.1, 0.18), 60);
    },
    crash: () => {
      playNoise(0.6, 0.5, 1200);
      playTone(200, 'sawtooth', 0.5, 0.5, 20);
      playTone(90, 'sine', 0.8, 0.4);
      stopEngineHum();
    },
  };

  // --- Game Logic ---

  const spawnObstacle = () => {
    const state = gameStateRef.current;
    if (state.boss) return;
    const isTruck = Math.random() < 0.35;
    const w = isTruck ? 10 : 8;
    const h = isTruck ? 14 : 10;
    state.obstacles.push({
      x: Math.floor(Math.random() * 96) + 16,
      y: -h - 10,
      w,
      h,
      type: isTruck ? 'truck' : 'car',
      color: Math.random() > 0.5 ? '#00ffff' : '#7dd3fc',
      hp: isTruck ? 2 : 1,
      shootTimer: 60 + Math.random() * 90,
      canShoot: Math.random() < 0.6,
    });
  };

  const spawnBoss = () => {
    const state = gameStateRef.current;
    const baseHp = 20 + (state.bossLevel - 1) * 5;
    state.boss = {
      x: 54,
      y: -30,
      w: 22,
      h: 28,
      hp: baseHp,
      maxHp: baseHp,
      dir: 1,
      shootTimer: 0,
      moveTimer: 0,
      entering: true,
    };
    setBossBarVisible(true);
    setBossLabelVisible(true);
    setBossBarWidth('100%');
    sfx.bossEnter();
    setShowReloadHint(`BOSS LVL ${state.bossLevel} - SHOOT CAB!`);
    setTimeout(() => {
      if (!state.isReloading) setShowReloadHint(null);
    }, 2000);
  };

  const createExplosion = (x: number, y: number, c1 = '#ffff00', c2 = '#00ffff', cnt = 14) => {
    const state = gameStateRef.current;
    for (let i = 0; i < cnt; i++) {
      state.particles.push({
        x: x + 4,
        y: y + 5,
        vx: (Math.random() - 0.5) * 4.5,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 18 + Math.random() * 18,
        color: Math.random() > 0.5 ? c1 : c2,
        size: Math.random() > 0.6 ? 2 : 1,
      });
    }
  };

  const tryShoot = () => {
    const state = gameStateRef.current;
    if (state.isReloading) return;
    const now = Date.now();
    if (now - state.lastShoot < SHOOT_COOLDOWN) return;
    if (state.ammo <= 0) {
      sfx.empty();
      setShowReloadHint('NO AMMO! RELOADING...');
      startReload();
      return;
    }
    state.lastShoot = now;
    state.ammo--;
    state.pBullets.push({
      x: state.player_x + 3.5,
      y: state.player_y - 2,
      vx: 0,
      vy: -7.8,
      life: 65,
      isBoss: false,
    });
    sfx.shoot();
    state.particles.push({
      x: state.player_x + 4,
      y: state.player_y - 1,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -2,
      life: 5,
      color: '#facc15',
      size: 2,
    });
    if (state.ammo === 0) {
      setShowReloadHint('RELOADING...');
      startReload();
    }
  };

  const startReload = () => {
    const state = gameStateRef.current;
    if (state.isReloading || state.ammo === state.maxAmmo) return;
    state.isReloading = true;
    setShowReloadHint('RELOADING...');
    sfx.reload();
    setTimeout(() => {
      state.ammo = state.maxAmmo;
      state.isReloading = false;
      setShowReloadHint(null);
      sfx.pickup();
    }, 1100);
  };

  // --- Game Loop ---
  const loop = () => {
    const canvas = canvasRef.current;
    const state = gameStateRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (isPowerOn && !state.gameOver) {
          state.frameCount++;
          if (state.frameCount === 2) startEngineHum(state.game_speed);
          if (state.moveLeft) state.player_x -= 2.9;
          if (state.moveRight) state.player_x += 2.9;
          state.player_x = Math.max(6, Math.min(114, state.player_x));
          if (state.frameCount % 20 === 0) updateEngineHum(state.game_speed);
          state.roadOffset = (state.roadOffset + state.game_speed) % 16;

          if (state.autoFire && state.isFiring) tryShoot();

          if (!state.boss && state.score >= state.nextBossScore) {
            spawnBoss();
          }

          if (!state.boss && Math.random() < 0.03 + state.score * 0.00003 && state.obstacles.length < 5) {
            spawnObstacle();
          }

          // Boss logic
          if (state.boss) {
            if (state.boss.entering) {
              state.boss.y += 1.2;
              if (state.boss.y >= 28) { state.boss.y = 28; state.boss.entering = false; }
            } else {
              state.boss.x += state.boss.dir * 0.7;
              state.boss.moveTimer++;
              if (state.boss.x <= 8 || state.boss.x >= 98) {
                state.boss.dir *= -1;
                state.boss.x = Math.max(8, Math.min(98, state.boss.x));
              }
              state.boss.shootTimer--;
              if (state.boss.shootTimer <= 0) {
                const spread = state.bossLevel > 2 ? [-2, 0, 2] : [-1.2, 0, 1.2];
                for (const sx of spread) {
                  state.eBullets.push({
                    x: state.boss.x + state.boss.w / 2 + sx * 2,
                    y: state.boss.y + state.boss.h,
                    vx: sx * 0.3,
                    vy: 2.8 + state.game_speed * 0.2 + Math.abs(sx) * 0.2,
                    life: 90,
                    isBoss: true,
                  });
                }
                if (state.bossLevel > 1 && Math.random() < 0.5) {
                  state.eBullets.push({ x: state.boss.x - 1, y: state.boss.y + 10, vx: -0.8, vy: 2.5, life: 90, isBoss: true });
                  state.eBullets.push({ x: state.boss.x + state.boss.w + 1, y: state.boss.y + 10, vx: 0.8, vy: 2.5, life: 90, isBoss: true });
                }
                sfx.bossShoot();
                state.boss.shootTimer = state.bossLevel > 2 ? 35 : 55;
              }

              // Player bullets hitting boss
              for (let j = state.pBullets.length - 1; j >= 0; j--) {
                const b = state.pBullets[j];
                if (b.x > state.boss.x - 2 && b.x < state.boss.x + state.boss.w + 2 &&
                    b.y > state.boss.y - 2 && b.y < state.boss.y + state.boss.h + 2) {
                  state.pBullets.splice(j, 1);
                  state.boss.hp--;
                  createExplosion(b.x, b.y, '#fff', '#facc15', 4);
                  sfx.bossHit();
                  setBossBarWidth(`${Math.max(0, (state.boss.hp / state.boss.maxHp) * 100)}%`);
                  if (state.boss.hp <= 0) {
                    createExplosion(state.boss.x + state.boss.w / 2, state.boss.y + state.boss.h / 2, '#ef4444', '#facc15', 35);
                    createExplosion(state.boss.x, state.boss.y, '#facc15', '#ffffff', 20);
                    sfx.bossExplode();
                    state.score += 200 * state.bossLevel;
                    for (let k = 0; k < 3; k++) {
                      state.pickups.push({
                        x: state.boss.x + Math.random() * state.boss.w,
                        y: state.boss.y + state.boss.h / 2 + Math.random() * 10,
                        type: 'ammo',
                      });
                    }
                    state.pickups.push({
                      x: state.boss.x + state.boss.w / 2,
                      y: state.boss.y + state.boss.h / 2,
                      type: 'heart',
                    });
                    state.boss = null;
                    setBossBarVisible(false);
                    setBossLabelVisible(false);
                    state.bossLevel++;
                    state.nextBossScore += 250;
                    state.game_speed += 0.25;
                    setShowReloadHint(`BOSS DESTROYED! +${200 * (state.bossLevel - 1)}`);
                    setTimeout(() => {
                      if (!state.isReloading) setShowReloadHint(null);
                    }, 2000);
                    break;
                  }
                }
              }

              // Boss collision with player
              if (state.boss && state.boss.y + state.boss.h > state.player_y - 2 &&
                  state.boss.y < state.player_y + 10 &&
                  Math.abs(state.boss.x + state.boss.w / 2 - state.player_x - 4) < (state.boss.w + 8) / 2) {
                state.gameOver = true;
                createExplosion(state.player_x, state.player_y, '#ff0000', '#ffff00', 24);
                sfx.crash();
                const finalScore = state.score;
                const high = state.highScore;
                setTimeout(() => {
                  if (finalScore > high) {
                    state.highScore = finalScore;
                    localStorage.setItem('arcade_highscore', String(finalScore));
                  }
                  alert(`CRUSHED BY BOSS! Score:${finalScore}\nRebooting...`);
                  resetGame();
                }, 400);
              }
            }
          }

          // Player bullets update
          for (let i = state.pBullets.length - 1; i >= 0; i--) {
            state.pBullets[i].y += state.pBullets[i].vy;
            if (state.pBullets[i].vx) state.pBullets[i].x += state.pBullets[i].vx;
            state.pBullets[i].life--;
            if (state.pBullets[i].y < 10 || state.pBullets[i].life <= 0) state.pBullets.splice(i, 1);
          }

          // Enemy bullets update + collision with player
          for (let i = state.eBullets.length - 1; i >= 0; i--) {
            const eb = state.eBullets[i];
            eb.y += eb.vy;
            if (eb.vx) eb.x += eb.vx;
            eb.life--;
            if (eb.y > 195 || eb.life <= 0 || eb.x < 0 || eb.x > 128) {
              state.eBullets.splice(i, 1);
            } else if (eb.y + 3 > state.player_y - 1 && eb.y < state.player_y + 10 && Math.abs(eb.x - state.player_x) < 6) {
              createExplosion(state.player_x, state.player_y, '#ff4444', '#ffff00', 10);
              state.eBullets.splice(i, 1);
              state.lives--;
              sfx.playerHit();
              if (state.lives <= 0) {
                state.gameOver = true;
                sfx.crash();
                const finalScore = state.score;
                const high = state.highScore;
                setTimeout(() => {
                  if (finalScore > high) {
                    state.highScore = finalScore;
                    localStorage.setItem('arcade_highscore', String(finalScore));
                  }
                  alert(`DESTROYED! Final Score: ${finalScore} Boss Lvl:${state.bossLevel}\nRebooting...`);
                  resetGame();
                }, 400);
              }
            }
          }

          // Pickups
          for (let i = state.pickups.length - 1; i >= 0; i--) {
            const pu = state.pickups[i];
            pu.y += state.game_speed * 0.8;
            if (pu.y + 6 > state.player_y - 2 && pu.y < state.player_y + 10 && Math.abs(pu.x - state.player_x) < 10) {
              if (pu.type === 'ammo') {
                state.ammo = Math.min(state.maxAmmo, state.ammo + 25);
                sfx.pickup();
                setShowReloadHint('+25 AMMO!');
              } else if (pu.type === 'heart') {
                state.lives = Math.min(MAX_LIVES, state.lives + 1);
                sfx.pickup();
                setShowReloadHint('+1 LIFE!');
              }
              createExplosion(pu.x, pu.y, '#facc15', '#ffffff', 8);
              state.pickups.splice(i, 1);
              setTimeout(() => {
                if (!state.isReloading) setShowReloadHint(null);
              }, 900);
            } else if (pu.y > 195) {
              state.pickups.splice(i, 1);
            }
          }

          // Obstacles
          for (let i = state.obstacles.length - 1; i >= 0; i--) {
            const o = state.obstacles[i];
            o.y += state.game_speed;
            if (o.canShoot) {
              o.shootTimer--;
              if (o.shootTimer <= 0 && o.y > 14 && o.y < 120) {
                state.eBullets.push({
                  x: o.x + o.w / 2,
                  y: o.y + o.h,
                  vx: 0,
                  vy: 3.0 + state.game_speed * 0.25,
                  life: 80,
                  isBoss: false,
                });
                sfx.enemyShoot();
                o.shootTimer = 90 + Math.random() * 110;
              }
            }
            let hit = false;
            for (let j = state.pBullets.length - 1; j >= 0; j--) {
              const b = state.pBullets[j];
              if (b.x > o.x - 1 && b.x < o.x + o.w + 1 && b.y > o.y - 2 && b.y < o.y + o.h + 2) {
                state.pBullets.splice(j, 1);
                o.hp--;
                if (o.hp <= 0) {
                  createExplosion(o.x, o.y, '#facc15', '#fb923c', o.type === 'truck' ? 16 : 10);
                  sfx.hit();
                  if (Math.random() < 0.4) state.pickups.push({ x: o.x + o.w / 2 - 2, y: o.y, type: 'ammo' });
                  state.obstacles.splice(i, 1);
                  state.score += o.type === 'truck' ? 25 : 15;
                  hit = true;
                } else {
                  createExplosion(o.x + o.w / 2, o.y + 2, '#fff', '#38bdf8', 4);
                  sfx.bossHit();
                }
                break;
              }
            }
            if (hit) continue;
            if (o.y + o.h > state.player_y - 2 && o.y < state.player_y + 10 && Math.abs(o.x - state.player_x) < (o.w + 8) / 2) {
              state.gameOver = true;
              createExplosion(state.player_x, state.player_y, '#ff0000', '#ffff00', 20);
              sfx.crash();
              const finalScore = state.score;
              const high = state.highScore;
              setTimeout(() => {
                if (finalScore > high) {
                  state.highScore = finalScore;
                  localStorage.setItem('arcade_highscore', String(finalScore));
                }
                alert(`CRASH! Final Score: ${finalScore}\nRebooting...`);
                resetGame();
              }, 350);
            }
            if (o.y > 195) {
              state.obstacles.splice(i, 1);
              state.score += 5;
              if (!state.boss && state.score % 100 === 0) {
                state.game_speed += 0.2;
                sfx.levelUp();
              }
            }
          }

          // Particles
          for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.14;
            p.life--;
            if (p.life <= 0) state.particles.splice(i, 1);
          }
        }

        // --- DRAW ---
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 128, 192);
        if (isPowerOn) {
          if (state.boss) {
            ctx.fillStyle = 'rgba(239,68,68,0.07)';
            ctx.fillRect(0, 14, 128, 40);
          }
          // HUD
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('SCORE:' + state.score, 4, 9);
          ctx.fillText('LVL:' + state.bossLevel, 86, 9);
          ctx.fillStyle = 'rgba(250,204,21,0.7)';
          ctx.fillRect(0, 12, 128, 1);

          // Road borders
          ctx.fillStyle = '#164e63';
          ctx.fillRect(0, 14, 2, 178);
          ctx.fillRect(126, 14, 2, 178);

          // Center dashed lines
          ctx.fillStyle = '#083344';
          for (let y = 14 - state.roadOffset; y < 192; y += 16) {
            ctx.fillRect(63, y, 2, 8);
          }

          // Side rumble strips
          ctx.fillStyle = '#0e7490';
          for (let y = 14 - state.roadOffset; y < 192; y += 6) {
            ctx.fillRect(3, y, 1, 2);
            ctx.fillRect(124, y, 1, 2);
          }

          // Pickups
          for (const pu of state.pickups) {
            if (pu.type === 'ammo') {
              ctx.fillStyle = '#facc15';
              ctx.fillRect(pu.x, pu.y, 5, 5);
              ctx.fillStyle = '#422006';
              ctx.fillRect(pu.x + 1, pu.y + 1, 3, 1);
            } else {
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(pu.x, pu.y, 5, 5);
              ctx.fillStyle = '#fff';
              ctx.fillRect(pu.x + 1, pu.y + 1, 1, 1);
              ctx.fillRect(pu.x + 3, pu.y + 1, 1, 1);
              ctx.fillRect(pu.x + 1, pu.y + 3, 3, 1);
            }
          }

          // Player bullets
          ctx.fillStyle = '#facc15';
          for (const b of state.pBullets) {
            ctx.fillRect(b.x, b.y, 1.5, 4);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(b.x, b.y + 4, 1.5, 1);
            ctx.fillStyle = '#facc15';
          }

          // Enemy bullets
          ctx.fillStyle = '#ef4444';
          for (const b of state.eBullets) {
            ctx.fillStyle = b.isBoss ? '#f87171' : '#ef4444';
            ctx.fillRect(b.x, b.y, b.isBoss ? 2.5 : 1.5, b.isBoss ? 3 : 3);
          }

          // Obstacles
          for (const o of state.obstacles) {
            ctx.fillStyle = o.color;
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#000';
            ctx.fillRect(o.x + 1, o.y + (o.type === 'truck' ? 3 : 2), o.w - 2, o.type === 'truck' ? 3 : 2);
            ctx.fillStyle = '#fde047';
            if (o.y > -5) {
              ctx.fillRect(o.x, o.y + o.h - 1, 2, 1);
              ctx.fillRect(o.x + o.w - 2, o.y + o.h - 1, 2, 1);
            }
          }

          // Boss
          if (state.boss) {
            const o = state.boss;
            ctx.fillStyle = 'rgba(239,68,68,0.2)';
            ctx.fillRect(o.x - 2, o.y + 2, o.w + 4, o.h + 4);
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(o.x, o.y, o.w, 12);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(o.x + 1, o.y + 1, o.w - 2, 4);
            ctx.fillStyle = '#000';
            ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 2);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(o.x + 2, o.y + o.h - 2, 4, 2);
            ctx.fillRect(o.x + o.w - 6, o.y + o.h - 2, 4, 2);
            ctx.fillStyle = '#f87171';
            ctx.fillRect(o.x + o.w / 2 - 1, o.y + o.h - 4, 2, 6);
            ctx.fillStyle = '#dc2626';
            for (let py = o.y + 8; py < o.y + o.h - 2; py += 4) {
              ctx.fillRect(o.x - 1, py, 1, 2);
              ctx.fillRect(o.x + o.w, py, 1, 2);
            }
          }

          // Player ship
          ctx.fillStyle = 'rgba(34,211,238,0.15)';
          ctx.fillRect(state.player_x - 1, state.player_y + 2, 10, 10);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(state.player_x + 3, state.player_y, 2, 2);
          ctx.fillRect(state.player_x, state.player_y + 2, 8, 6);
          ctx.fillRect(state.player_x + 1, state.player_y + 8, 6, 3);
          ctx.fillStyle = '#000';
          ctx.fillRect(state.player_x + 2, state.player_y + 3, 4, 2);
          ctx.fillStyle = '#f87171';
          ctx.fillRect(state.player_x, state.player_y + 9, 1, 1);
          ctx.fillRect(state.player_x + 7, state.player_y + 9, 1, 1);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(state.player_x + 3.5, state.player_y - 1, 1, 2);

          // Particles
          for (const p of state.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / 20);
            const sz = p.size || 1;
            ctx.fillRect(p.x, p.y, sz, sz);
          }
          ctx.globalAlpha = 1;

          // Boss HP bar
          if (state.boss) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(10, 16, 108, 8);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 7px monospace';
            ctx.fillText('BOSS HP:' + state.boss.hp + '/' + state.boss.maxHp, 18, 21);
          }

          // Reloading overlay
          if (state.isReloading) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 90, 128, 12);
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('RELOADING...', 32, 98);
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const resetGame = () => {
    const state = gameStateRef.current;
    state.player_x = 60;
    state.score = 0;
    state.obstacles = [];
    state.pBullets = [];
    state.eBullets = [];
    state.particles = [];
    state.pickups = [];
    state.game_speed = 1.8;
    state.gameOver = false;
    state.roadOffset = 0;
    state.ammo = MAX_AMMO;
    state.lives = 3;
    state.isReloading = false;
    state.boss = null;
    state.bossLevel = 1;
    state.nextBossScore = 200;
    state.lastShoot = 0;
    setBossBarVisible(false);
    setBossLabelVisible(false);
    setShowReloadHint(null);
    if (isSoundOn) startEngineHum(state.game_speed);
  };

  const ensureAudioActive = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const restartGame = () => {
    ensureAudioActive();
    resetGame();
  };

  // --- Keyboard & Touch Handlers ---
  const handleKeyDown = (e: KeyboardEvent) => {
    ensureAudioActive();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      gameStateRef.current.moveLeft = true;
      setPressedLeft(true);
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      gameStateRef.current.moveRight = true;
      setPressedRight(true);
    }
    if (e.code === 'Space') {
      e.preventDefault();
      ensureAudioActive();
      gameStateRef.current.isFiring = true;
      setPressedShoot(true);
      tryShoot();
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      startReload();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      gameStateRef.current.moveLeft = false;
      setPressedLeft(false);
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      gameStateRef.current.moveRight = false;
      setPressedRight(false);
    }
    if (e.code === 'Space') {
      gameStateRef.current.isFiring = false;
      setPressedShoot(false);
    }
  };

  const handleTouchLeftStart = (e: React.SyntheticEvent) => {
    e.preventDefault();
    ensureAudioActive();
    if (!isPowerOn) return;
    gameStateRef.current.moveLeft = true;
    setPressedLeft(true);
  };

  const handleTouchLeftEnd = () => {
    gameStateRef.current.moveLeft = false;
    setPressedLeft(false);
  };

  const handleTouchRightStart = (e: React.SyntheticEvent) => {
    e.preventDefault();
    ensureAudioActive();
    if (!isPowerOn) return;
    gameStateRef.current.moveRight = true;
    setPressedRight(true);
  };

  const handleTouchRightEnd = () => {
    gameStateRef.current.moveRight = false;
    setPressedRight(false);
  };

  const handleShootStart = (e: React.SyntheticEvent) => {
    e.preventDefault();
    ensureAudioActive();
    if (!isPowerOn) return;
    gameStateRef.current.isFiring = true;
    setPressedShoot(true);
    tryShoot();
  };

  const handleShootEnd = () => {
    gameStateRef.current.isFiring = false;
    setPressedShoot(false);
  };

  const handleAutoFireChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const state = gameStateRef.current;
    state.autoFire = e.target.checked;
    setIsAutoFire(e.target.checked);
  };

  const handleSoundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const on = e.target.checked;
    setIsSoundOn(on);
    if (!on) {
      stopEngineHum();
    } else if (isPowerOn) {
      startEngineHum(gameStateRef.current.game_speed);
    }
  };

  const handlePowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const on = e.target.checked;
    setIsPowerOn(on);
    if (!on) {
      const state = gameStateRef.current;
      state.moveLeft = false;
      state.moveRight = false;
      state.isFiring = false;
      setPressedLeft(false);
      setPressedRight(false);
      setPressedShoot(false);
      sfx.crash();
      stopEngineHum();
    } else {
      sfx.powerOn();
      resetGame();
    }
  };

  // --- Lifecycle ---
  useEffect(() => {
    if (!isOpen) return;

    gameStateRef.current = {
      player_x: 60,
      player_y: 168,
      score: 0,
      obstacles: [],
      pBullets: [],
      eBullets: [],
      particles: [],
      pickups: [],
      game_speed: 1.8,
      roadOffset: 0,
      gameOver: false,
      moveLeft: false,
      moveRight: false,
      frameCount: 0,
      highScore: parseInt(localStorage.getItem('arcade_highscore') || '0', 10),
      lastShoot: 0,
      ammo: MAX_AMMO,
      maxAmmo: MAX_AMMO,
      lives: 3,
      isReloading: false,
      autoFire: false,
      isFiring: false,
      boss: null,
      bossLevel: 1,
      nextBossScore: 200,
    };
    setIsAutoFire(false);
    setIsPowerOn(true);
    setBossBarVisible(false);
    setBossLabelVisible(false);
    setShowReloadHint(null);

    sfx.powerOn();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopEngineHum();
    };
  }, [isOpen]);

  useEffect(() => {
    if (gameStateRef.current.autoFire) {
      gameStateRef.current.isFiring = pressedShoot || false;
    }
  }, [pressedShoot, isAutoFire]);

  if (!isOpen) return null;

  return (
    <div onClick={ensureAudioActive} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="relative flex flex-col items-center">
        {/* Top Control Bar */}
        <div className="w-full max-w-[380px] flex items-center justify-between mb-2 text-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Gamepad2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide block leading-tight">Mind Refresh Arcade</span>
              <span className="text-[10px] text-gray-300 block font-mono">Welcome, {userName || 'Operator'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer"
            title="Close Game"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Handheld Case */}
        <div className="w-[min(94vw,380px)] bg-gradient-to-b from-slate-700 to-slate-800 border-[5px] border-slate-900 rounded-[26px] p-3 flex flex-col shadow-2xl relative">
          {/* Console Header Switches */}
          <div className="flex justify-between items-center mb-2 text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">
            <span>⨂ D1Y POCKET V5 ⨂</span>
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoFire}
                  onChange={handleAutoFireChange}
                  className="w-3 h-3"
                />
                <span className={`text-[9px] font-bold ${isAutoFire ? 'text-amber-400' : 'text-slate-500'}`}>AUTO</span>
              </label>
              <button
                type="button"
                onClick={() => handleSoundChange({ target: { checked: !isSoundOn } } as any)}
                className={`p-1 rounded flex items-center gap-1 text-[9px] font-bold transition ${
                  isSoundOn ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40' : 'bg-slate-900 text-slate-500'
                }`}
                title="Toggle Sound"
              >
                {isSoundOn ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                SND
              </button>
              <button
                type="button"
                onClick={() => handlePowerChange({ target: { checked: !isPowerOn } } as any)}
                className={`p-1 rounded flex items-center gap-1 text-[9px] font-bold transition ${
                  isPowerOn ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-slate-900 text-red-400'
                }`}
                title="Toggle Power"
              >
                <Power className="w-3 h-3" />
                PWR
              </button>
            </div>
          </div>

          {/* Boss Bar */}
          {bossBarVisible && (
            <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden border border-slate-700 mb-1">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-amber-400 transition-all duration-150"
                style={{ width: bossBarWidth }}
              ></div>
            </div>
          )}

          {/* Boss Label */}
          {bossLabelVisible && (
            <div className="text-[7px] text-red-400 text-center font-mono uppercase tracking-wider animate-pulse mb-1">
              ⚠ BOSS TRUCK INCOMING ⚠
            </div>
          )}

          {/* OLED Bezel Screen */}
          <div
            className={`w-full bg-black border-4 rounded-xl p-2 flex justify-center items-center shadow-inner relative overflow-hidden mb-2 transition ${
              !isPowerOn ? 'brightness-50 border-slate-800' : 'border-slate-600'
            }`}
          >
            <canvas
              ref={canvasRef}
              width={128}
              height={192}
              className="w-full max-h-[300px] object-contain rounded border border-slate-900 bg-black image-pixelated cursor-pointer"
              onClick={restartGame}
            />
          </div>

          {/* HUD Stats Bar */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 w-full text-[7.5px] text-slate-300 font-mono mb-2 bg-slate-900 rounded px-2 py-1 border border-slate-700">
            <span>SCORE:{gameStateRef.current.score} • HI:{gameStateRef.current.highScore}</span>
            <span className="text-center text-amber-400">AMMO:{gameStateRef.current.ammo}/{gameStateRef.current.maxAmmo}{gameStateRef.current.isReloading ? ' 🔺' : ''}</span>
            <span className="text-right">
              {'♥'.repeat(Math.max(0, gameStateRef.current.lives))}
              {'♡'.repeat(Math.max(0, MAX_LIVES - gameStateRef.current.lives))}
              {' B:' + gameStateRef.current.bossLevel}
            </span>
          </div>

          {/* Reload Hint */}
          {showReloadHint && (
            <div className="text-[7px] text-red-400 text-center font-mono mb-1 h-3">{showReloadHint}</div>
          )}

          {/* Controller Row */}
          <div className="grid grid-cols-[1fr_0.85fr_1fr] gap-2 w-full mb-2">
            <button
              type="button"
              onMouseDown={handleTouchLeftStart}
              onMouseUp={handleTouchLeftEnd}
              onMouseLeave={handleTouchLeftEnd}
              onTouchStart={handleTouchLeftStart}
              onTouchEnd={handleTouchLeftEnd}
              className={`flex-1 h-16 bg-gradient-to-b from-red-500 to-red-700 border-b-4 border-red-900 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-lg active:translate-y-1 transition-all cursor-pointer ${
                pressedLeft ? 'translate-y-1 border-b-0 bg-red-800' : ''
              }`}
            >
              ◀ LEFT
            </button>
            <button
              type="button"
              onMouseDown={handleShootStart}
              onMouseUp={handleShootEnd}
              onMouseLeave={handleShootEnd}
              onTouchStart={handleShootStart}
              onTouchEnd={handleShootEnd}
              className={`flex-1 h-16 bg-gradient-to-b from-amber-400 to-amber-600 border-b-4 border-amber-800 rounded-2xl flex flex-col items-center justify-center font-extrabold text-xs shadow-lg active:translate-y-1 transition-all cursor-pointer ${
                pressedShoot ? 'translate-y-1 border-b-0 bg-amber-700' : ''
              } text-amber-900`}
            >
              <span className="text-2xl mb-1">💥</span>
              <span>FIRE</span>
            </button>
            <button
              type="button"
              onMouseDown={handleTouchRightStart}
              onMouseUp={handleTouchRightEnd}
              onMouseLeave={handleTouchRightEnd}
              onTouchStart={handleTouchRightStart}
              onTouchEnd={handleTouchRightEnd}
              className={`flex-1 h-16 bg-gradient-to-b from-red-500 to-red-700 border-b-4 border-red-900 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-lg active:translate-y-1 transition-all cursor-pointer ${
                pressedRight ? 'translate-y-1 border-b-0 bg-red-800' : ''
              }`}
            >
              RIGHT ▶
            </button>
          </div>

          {/* Reset Button */}
          <div className="flex justify-center mb-1">
            <button
              type="button"
              onClick={restartGame}
              className="px-3 h-8 bg-slate-900 border-b-4 border-slate-950 rounded-xl flex items-center justify-center text-amber-400 font-bold text-[10px] hover:bg-slate-800 transition active:translate-y-0.5 shrink-0"
              title="Restart Game"
            >
              <RotateCcw className="w-4 h-4 mb-0.5" />
              RESET
            </button>
          </div>

          {/* Instructions */}
          <div className="text-center text-[9px] font-mono text-slate-400 tracking-wider">
            BOSS EVERY 200PTS • 20HP • SHOOT CAB TO WIN • COLLECT AMMO • PRESS R TO RELOAD
          </div>
        </div>
      </div>
    </div>
  );
}
