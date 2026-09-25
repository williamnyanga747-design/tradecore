import React, { useRef, useEffect, useState, useCallback } from 'react';

type GameMode = 'menu' | 'timer' | 'invite' | 'vs' | 'playing' | 'winner';
type PlayMode = 'ai' | 'local' | 'remote';
type TimerOption = 3 | 6 | 9 | 12;

interface User {
  id: string;
  name: string;
  role: string;
  avatar: string;
  online: boolean;
}

const MOCK_USERS: User[] = [
  { id: 'root', name: 'Root Mandate', role: 'Super Admin', avatar: 'R', online: true },
  { id: 'dsm_hq', name: 'DSM HQ Staff', role: 'Manager', avatar: 'D', online: true },
  { id: 'dsm_alpha', name: 'DSM Store Alpha', role: 'Cashier', avatar: 'A', online: true },
  { id: 'alpha_mgr', name: 'Alpha Global Mgr', role: 'Manager', avatar: 'M', online: false },
];

export default function AirHockeyPro({ onClose }: { onClose?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number>(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  
  // Game State
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [playMode, setPlayMode] = useState<PlayMode>('ai');
  const [timerOption, setTimerOption] = useState<TimerOption>(3);
  const [timeLeft, setTimeLeft] = useState(180);
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [winner, setWinner] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [invitedUser, setInvitedUser] = useState<User | null>(null);
  const [roomId, setRoomId] = useState('');
  const [vsCountdown, setVsCountdown] = useState(3);
  const [showGoal, setShowGoal] = useState(false);
  const [showSpeedUp, setShowSpeedUp] = useState(false);
  const [networkPing, setNetworkPing] = useState<number>(18);
  const [isHost, setIsHost] = useState(true);

  // Refs for physics & smooth input (avoids unnecessary re-renders)
  const gameStateRef = useRef({
    puck: { x: 400, y: 200, vx: 0, vy: 0, radius: 12 },
    p1: { x: 120, y: 200, radius: 40, vy: 0 },
    p2: { x: 680, y: 200, radius: 40, vy: 0 },
    trail: [] as { x: number; y: number }[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color?: string }[],
    keys: {} as Record<string, boolean>,
    mouse: { x: 0, y: 0, active: false },
    touchP1: { x: 0, y: 0, active: false },
    touchP2: { x: 0, y: 0, active: false },
    speedMultiplier: 1,
    lastHitTime: 0,
    goalScoredCooldown: false,
  });

  // Sound Effects - Web Audio API (No external MP3 required)
  const initAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch {
      // Audio context policy fallback
    }
  }, []);

  const playSound = useCallback((freq: number | number[], duration: number, type: OscillatorType = 'sine', vol = 0.3) => {
    if (isMuted) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const effectiveVol = vol * volume;

      if (Array.isArray(freq)) {
        osc.frequency.setValueAtTime(freq[0], ctx.currentTime);
        freq.forEach((f, i) => {
          if (i > 0) {
            osc.frequency.linearRampToValueAtTime(f, ctx.currentTime + (duration / freq.length) * i);
          }
        });
      } else {
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
      }
      
      osc.type = type;
      gain.gain.setValueAtTime(effectiveVol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio glitches
    }
  }, [isMuted, volume, initAudio]);

  const sounds = {
    hit: () => {
      playSound(800, 0.08, 'sine', 0.25);
      setTimeout(() => playSound(1200, 0.06, 'sine', 0.2), 35);
    },
    wall: () => playSound(200, 0.1, 'square', 0.18),
    goal: () => playSound([400, 800, 1200], 0.6, 'sine', 0.4),
    speedUp: () => playSound([1000, 2000], 0.15, 'sine', 0.25),
    countdown: () => playSound(600, 0.1, 'sine', 0.28),
    win: () => {
      playSound(523, 0.3, 'sine', 0.3);
      setTimeout(() => playSound(659, 0.3, 'sine', 0.3), 200);
      setTimeout(() => playSound(784, 0.5, 'sine', 0.3), 400);
    },
    lose: () => playSound([600, 300], 0.5, 'sine', 0.25),
  };

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      gameStateRef.current.keys[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      gameStateRef.current.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Realtime Broadcast Channel (Cross-Tab / Cross-Device fallback)
  useEffect(() => {
    if (!roomId) return;
    try {
      const channel = new BroadcastChannel(`air_hockey_${roomId}`);
      broadcastChannelRef.current = channel;
      
      channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        
        if (data.type === 'accept_invite' && !isHost) {
          // Both in room
        } else if (data.type === 'paddle_move') {
          if (isHost) {
            gameStateRef.current.p2.x = data.x;
            gameStateRef.current.p2.y = data.y;
          } else {
            gameStateRef.current.p1.x = data.x;
            gameStateRef.current.p1.y = data.y;
          }
        } else if (data.type === 'puck_sync' && !isHost) {
          gameStateRef.current.puck.x = data.x;
          gameStateRef.current.puck.y = data.y;
          gameStateRef.current.puck.vx = data.vx;
          gameStateRef.current.puck.vy = data.vy;
          gameStateRef.current.speedMultiplier = data.speedMultiplier;
          setScore(data.score);
        } else if (data.type === 'goal_event') {
          setShowGoal(true);
          sounds.goal();
          setTimeout(() => setShowGoal(false), 1500);
        }
      };

      return () => {
        channel.close();
      };
    } catch {
      // BroadcastChannel unavailable
    }
  }, [roomId, isHost, sounds]);

  // Ping jitter simulation
  useEffect(() => {
    if (gameMode !== 'playing' || playMode !== 'remote') return;
    const interval = setInterval(() => {
      setNetworkPing(16 + Math.floor(Math.random() * 8));
    }, 2000);
    return () => clearInterval(interval);
  }, [gameMode, playMode]);

  // Game Logic Functions
  const resetPuck = useCallback((direction: 1 | -1 = 1) => {
    const gs = gameStateRef.current;
    gs.puck.x = 400;
    gs.puck.y = 200;
    gs.puck.vx = direction * (3.5 + Math.random() * 1.5);
    gs.puck.vy = (Math.random() - 0.5) * 3;
    gs.trail = [];
    gs.speedMultiplier = 1;
    gs.goalScoredCooldown = false;
  }, []);

  const addParticles = (x: number, y: number, color = '#ffffff') => {
    const gs = gameStateRef.current;
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 7;
      gs.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
      });
    }
  };

  const checkGoal = useCallback(() => {
    const gs = gameStateRef.current;
    if (gs.goalScoredCooldown) return false;

    // Center 38% height is the goal area (y 130 to 270 on 400px height)
    const goalTop = 130;
    const goalBottom = 270;
    
    // Left goal (p2 scores)
    if (gs.puck.x - gs.puck.radius <= 4 && gs.puck.y >= goalTop && gs.puck.y <= goalBottom) {
      gs.goalScoredCooldown = true;
      setScore(s => {
        const next = { ...s, p2: s.p2 + 1 };
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'goal_event', scorer: 'p2' });
        }
        return next;
      });
      setShowGoal(true);
      sounds.goal();
      addParticles(20, gs.puck.y, '#00d9ff');
      setTimeout(() => setShowGoal(false), 1500);
      setTimeout(() => resetPuck(1), 600);
      return true;
    }

    // Right goal (p1 scores)
    if (gs.puck.x + gs.puck.radius >= 796 && gs.puck.y >= goalTop && gs.puck.y <= goalBottom) {
      gs.goalScoredCooldown = true;
      setScore(s => {
        const next = { ...s, p1: s.p1 + 1 };
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'goal_event', scorer: 'p1' });
        }
        return next;
      });
      setShowGoal(true);
      sounds.goal();
      addParticles(780, gs.puck.y, '#ff3333');
      setTimeout(() => setShowGoal(false), 1500);
      setTimeout(() => resetPuck(-1), 600);
      return true;
    }

    return false;
  }, [sounds, resetPuck]);

  // Main 60FPS Game Loop
  useEffect(() => {
    if (gameMode !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gs = gameStateRef.current;
    const goalTop = 130;
    const goalBottom = 270;
    let lastNetworkBroadcast = 0;

    const loop = (timestamp: number) => {
      // 1. Inputs - Player 1 (Red, Left Half)
      if (gs.keys['w'] || gs.keys['W']) gs.p1.y = Math.max(40, gs.p1.y - 7.5);
      if (gs.keys['s'] || gs.keys['S']) gs.p1.y = Math.min(360, gs.p1.y + 7.5);
      if (gs.keys['a'] || gs.keys['A']) gs.p1.x = Math.max(40, gs.p1.x - 7.5);
      if (gs.keys['d'] || gs.keys['D']) gs.p1.x = Math.min(360, gs.p1.x + 7.5);

      if (gs.mouse.active) {
        if (playMode !== 'local' || gs.mouse.x < 400) {
          gs.p1.x = Math.max(40, Math.min(360, gs.mouse.x));
          gs.p1.y = Math.max(40, Math.min(360, gs.mouse.y));
        }
      }
      if (gs.touchP1.active) {
        gs.p1.x = Math.max(40, Math.min(360, gs.touchP1.x));
        gs.p1.y = Math.max(40, Math.min(360, gs.touchP1.y));
      }

      // 2. Inputs - Player 2 (Cyan, Right Half)
      if (playMode === 'local') {
        if (gs.keys['ArrowUp']) gs.p2.y = Math.max(40, gs.p2.y - 7.5);
        if (gs.keys['ArrowDown']) gs.p2.y = Math.min(360, gs.p2.y + 7.5);
        if (gs.keys['ArrowLeft']) gs.p2.x = Math.max(440, gs.p2.x - 7.5);
        if (gs.keys['ArrowRight']) gs.p2.x = Math.min(760, gs.p2.x + 7.5);

        if (gs.mouse.active && gs.mouse.x >= 400) {
          gs.p2.x = Math.max(440, Math.min(760, gs.mouse.x));
          gs.p2.y = Math.max(40, Math.min(360, gs.mouse.y));
        }
        if (gs.touchP2.active) {
          gs.p2.x = Math.max(440, Math.min(760, gs.touchP2.x));
          gs.p2.y = Math.max(40, Math.min(360, gs.touchP2.y));
        }
      } else if (playMode === 'ai') {
        // AI Follows Puck with slight lag & imperfection
        const targetY = gs.puck.y + (Math.sin(timestamp * 0.003) * 14);
        const dy = targetY - gs.p2.y;
        gs.p2.y += dy * 0.14;
        gs.p2.y = Math.max(40, Math.min(360, gs.p2.y));

        // When puck crosses into AI side, AI charges forward slightly
        const targetX = gs.puck.x > 400 
          ? Math.min(720, Math.max(500, gs.puck.x + 40))
          : 680;
        gs.p2.x += (targetX - gs.p2.x) * 0.09;
        gs.p2.x = Math.max(440, Math.min(760, gs.p2.x));
      }

      // 3. Puck Physics (Host Authoritative)
      if (isHost || playMode !== 'remote') {
        gs.puck.x += gs.puck.vx * gs.speedMultiplier;
        gs.puck.y += gs.puck.vy * gs.speedMultiplier;

        // Friction
        gs.puck.vx *= 0.993;
        gs.puck.vy *= 0.993;

        // Top & Bottom Wall Bounce
        if (gs.puck.y - gs.puck.radius <= 0) {
          gs.puck.y = gs.puck.radius;
          gs.puck.vy = Math.abs(gs.puck.vy);
          sounds.wall();
        } else if (gs.puck.y + gs.puck.radius >= 400) {
          gs.puck.y = 400 - gs.puck.radius;
          gs.puck.vy = -Math.abs(gs.puck.vy);
          sounds.wall();
        }

        // Left & Right Wall Bounce (outside goal area)
        // Left wall
        if (gs.puck.x - gs.puck.radius <= 0) {
          if (gs.puck.y < goalTop || gs.puck.y > goalBottom) {
            gs.puck.x = gs.puck.radius;
            gs.puck.vx = Math.abs(gs.puck.vx);
            sounds.wall();
          }
        }
        // Right wall
        if (gs.puck.x + gs.puck.radius >= 800) {
          if (gs.puck.y < goalTop || gs.puck.y > goalBottom) {
            gs.puck.x = 800 - gs.puck.radius;
            gs.puck.vx = -Math.abs(gs.puck.vx);
            sounds.wall();
          }
        }

        // Paddle - Puck Collisions (Circle vs Circle)
        const handlePaddleCollision = (paddle: typeof gs.p1) => {
          const dx = gs.puck.x - paddle.x;
          const dy = gs.puck.y - paddle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = gs.puck.radius + paddle.radius;

          if (dist < minDist && dist > 0.001) {
            const angle = Math.atan2(dy, dx);
            const overlap = minDist - dist;
            gs.puck.x += Math.cos(angle) * overlap;
            gs.puck.y += Math.sin(angle) * overlap;

            const currentSpeed = Math.sqrt(gs.puck.vx * gs.puck.vx + gs.puck.vy * gs.puck.vy);
            const nextSpeed = Math.min(13, Math.max(4.5, currentSpeed + 0.35));

            gs.puck.vx = Math.cos(angle) * nextSpeed;
            gs.puck.vy = Math.sin(angle) * nextSpeed;

            gs.speedMultiplier = Math.min(1.8, gs.speedMultiplier + 0.04);
            if (gs.speedMultiplier > 1.4 && !showSpeedUp) {
              setShowSpeedUp(true);
              sounds.speedUp();
              setTimeout(() => setShowSpeedUp(false), 900);
            }

            sounds.hit();
            addParticles(gs.puck.x, gs.puck.y, '#ffffff');
            return true;
          }
          return false;
        };

        handlePaddleCollision(gs.p1);
        handlePaddleCollision(gs.p2);

        // Check if a goal was scored
        checkGoal();

        // Broadcast state at 20Hz for cross-device
        if (playMode === 'remote' && broadcastChannelRef.current && timestamp - lastNetworkBroadcast > 50) {
          lastNetworkBroadcast = timestamp;
          broadcastChannelRef.current.postMessage({
            type: 'puck_sync',
            x: gs.puck.x,
            y: gs.puck.y,
            vx: gs.puck.vx,
            vy: gs.puck.vy,
            speedMultiplier: gs.speedMultiplier,
            score,
          });
        }
      }

      // Trail Update (Keep 12 positions)
      gs.trail.push({ x: gs.puck.x, y: gs.puck.y });
      if (gs.trail.length > 12) gs.trail.shift();

      // Particles Update
      gs.particles = gs.particles.filter(p => p.life > 0).map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * 0.96,
        vy: p.vy * 0.96,
        life: p.life - 0.04,
      }));

      // 4. Render Table, Neon Glow, Paddles, and Puck
      // Table Background
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, 800, 400);

      // Subtle Background Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= 800; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 400);
        ctx.stroke();
      }
      for (let y = 0; y <= 400; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(800, y);
        ctx.stroke();
      }

      // Outer Neon Glow Borders
      // Left side (Red Glow)
      ctx.save();
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(400, 2);
      ctx.lineTo(2, 2);
      ctx.lineTo(2, goalTop);
      ctx.moveTo(2, goalBottom);
      ctx.lineTo(2, 398);
      ctx.lineTo(400, 398);
      ctx.stroke();
      ctx.restore();

      // Right side (Cyan Glow)
      ctx.save();
      ctx.shadowColor = '#00d9ff';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#00d9ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(400, 2);
      ctx.lineTo(798, 2);
      ctx.lineTo(798, goalTop);
      ctx.moveTo(798, goalBottom);
      ctx.lineTo(798, 398);
      ctx.lineTo(400, 398);
      ctx.stroke();
      ctx.restore();

      // Goal Pockets
      ctx.fillStyle = 'rgba(255, 51, 51, 0.15)';
      ctx.fillRect(0, goalTop, 10, goalBottom - goalTop);
      ctx.fillStyle = 'rgba(0, 217, 255, 0.15)';
      ctx.fillRect(790, goalTop, 10, goalBottom - goalTop);

      // Center Dividing Line (Dashed)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(400, 0);
      ctx.lineTo(400, 400);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Center Circle
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(400, 200, 65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(400, 200, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
      ctx.restore();

      // Goal Arc Creases
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 51, 51, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 200, 90, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 217, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(800, 200, 90, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
      ctx.restore();

      // Puck Trail (12 dots)
      gs.trail.forEach((pos, i) => {
        const factor = (i + 1) / gs.trail.length;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 11 * factor, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.28 * factor})`;
        ctx.fill();
      });

      // Particle Explosions
      gs.particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, 3.5 * p.life), 0, Math.PI * 2);
        ctx.fillStyle = p.color ? p.color : `rgba(255, 255, 255, ${p.life})`;
        ctx.fill();
      });

      // Draw Glowing Paddles
      const renderPaddle = (paddle: typeof gs.p1, mainColor: string, glowColor: string) => {
        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddle.radius, 0, Math.PI * 2);
        ctx.fillStyle = mainColor;
        ctx.fill();

        // Inner Bevel Ring
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddle.radius * 0.65, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();

        // Center Handle Cap
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddle.radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      };

      renderPaddle(gs.p1, '#ff3333', '#ff3333');
      renderPaddle(gs.p2, '#00d9ff', '#00d9ff');

      // Draw Glowing Puck
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(gs.puck.x, gs.puck.y, gs.puck.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(gs.puck.x, gs.puck.y, gs.puck.radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.restore();

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameMode, playMode, isHost, sounds, checkGoal, score, showSpeedUp]);

  // Match Timer Countdown
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameMode('winner');
          const p1Score = score.p1;
          const p2Score = score.p2;
          if (p1Score === p2Score) {
            setWinner('DRAW');
          } else if (p1Score > p2Score) {
            setWinner('Player 1 WINS!');
            sounds.win();
          } else {
            const oppName = playMode === 'ai' ? 'AI' : (invitedUser?.name || 'Player 2');
            setWinner(`${oppName} WINS!`);
            sounds.lose();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameMode, score, playMode, invitedUser, sounds]);

  // VS Screen Countdown (3 -> 2 -> 1 -> GO!)
  useEffect(() => {
    if (gameMode !== 'vs') return;
    if (vsCountdown <= 0) {
      setGameMode('playing');
      setTimeLeft(timerOption * 60);
      setScore({ p1: 0, p2: 0 });
      resetPuck(Math.random() > 0.5 ? 1 : -1);
      return;
    }
    sounds.countdown();
    const timer = setTimeout(() => setVsCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [gameMode, vsCountdown, timerOption, resetPuck, sounds]);

  // Mouse & Touch Input Coordinates Mapping
  const handleCanvasMouse = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 800;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    gameStateRef.current.mouse = { x, y, active: true };
  };

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    let p1Touched = false;
    let p2Touched = false;

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const x = ((touch.clientX - rect.left) / rect.width) * 800;
      const y = ((touch.clientY - rect.top) / rect.height) * 400;

      if (x < 400) {
        gameStateRef.current.touchP1 = { x, y, active: true };
        p1Touched = true;
      } else {
        gameStateRef.current.touchP2 = { x, y, active: true };
        p2Touched = true;
      }
    }

    if (!p1Touched) gameStateRef.current.touchP1.active = false;
    if (!p2Touched) gameStateRef.current.touchP2.active = false;
  };

  const startGameMode = (mode: PlayMode) => {
    initAudio();
    setPlayMode(mode);
    setGameMode('timer');
  };

  const selectTimer = (t: TimerOption) => {
    setTimerOption(t);
    if (playMode === 'ai' || playMode === 'local') {
      setVsCountdown(3);
      setGameMode('vs');
    } else {
      setGameMode('invite');
    }
  };

  const inviteUser = (user: User) => {
    initAudio();
    setInvitedUser(user);
    const room = `ROOM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setRoomId(room);
    setIsHost(true);
    
    // Simulate opponent accepting after 1.5s
    setTimeout(() => {
      setVsCountdown(3);
      setGameMode('vs');
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[110] flex items-center justify-center p-3 overflow-y-auto">
      <div 
        ref={containerRef} 
        className="w-full max-w-[880px] bg-[#0a0a12] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col my-auto"
      >
        {/* Header Bar */}
        <div className="flex justify-between items-center px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-500 to-cyan-400 flex items-center justify-center font-black text-white text-xs shadow-md">
              AH
            </div>
            <div>
              <h2 className="text-white font-extrabold text-base flex items-center gap-1.5">
                <span className="text-cyan-400">Air Hockey</span> Pro
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded ml-1">NEW</span>
              </h2>
              <div className="text-[10px] text-gray-400 font-mono">
                {playMode === 'ai' ? 'Single Player vs AI' : playMode === 'local' ? '2P Same Screen' : 'Cross-Device Multiplayer'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle & Volume Slider */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className="text-white hover:text-cyan-300 text-xs transition cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-14 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                title="Volume"
              />
            </div>

            {onClose && (
              <button 
                onClick={onClose} 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                title="Exit Game"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* SCREEN 1: Game Mode Select */}
        {gameMode === 'menu' && (
          <div className="p-6 md:p-10 text-center">
            <h3 className="text-white text-2xl font-black mb-2">Chagua Game Mode</h3>
            <p className="text-gray-400 text-sm mb-8">Cheza solo vs AI, watu 2 screen moja au mwalike mwenzako kwenye kifaa chake</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Mode 1: vs AI */}
              <button
                onClick={() => startGameMode('ai')}
                className="bg-slate-900/90 hover:bg-slate-800 border-2 border-slate-700 hover:border-red-500 rounded-2xl p-6 text-left transition transform hover:-translate-y-1 shadow-lg group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">
                  🤖
                </div>
                <div className="font-black text-lg text-white mb-1">Cheza vs AI</div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Solo practice. AI inacheza upande wa kulia kwa physics ya kweli.
                </div>
                <div className="mt-4 text-[11px] font-bold text-red-400 flex items-center gap-1">
                  Mouse Drag / WASD Keys →
                </div>
              </button>

              {/* Mode 2: Same Device */}
              <button
                onClick={() => startGameMode('local')}
                className="bg-slate-900/90 hover:bg-slate-800 border-2 border-slate-700 hover:border-cyan-400 rounded-2xl p-6 text-left transition transform hover:-translate-y-1 shadow-lg group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">
                  👥
                </div>
                <div className="font-black text-lg text-white mb-1">Same Device 2P</div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Wachezaji 2 kwenye screen moja (Keyboard au split touch screen).
                </div>
                <div className="mt-4 text-[11px] font-bold text-cyan-400 flex items-center gap-1">
                  WASD vs Arrow Keys →
                </div>
              </button>

              {/* Mode 3: Different Device */}
              <button
                onClick={() => startGameMode('remote')}
                className="bg-slate-900/90 hover:bg-slate-800 border-2 border-slate-700 hover:border-emerald-400 rounded-2xl p-6 text-left transition transform hover:-translate-y-1 shadow-lg group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">
                  🌐
                </div>
                <div className="font-black text-lg text-white mb-1">Different Device</div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Mwalike mtumiaji mwingine wa TradeCore kwenye simu au computer yake.
                </div>
                <div className="mt-4 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  Invite Inside System →
                </div>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: Timer Duration Select */}
        {gameMode === 'timer' && (
          <div className="p-8 md:p-12 text-center max-w-md mx-auto">
            <h3 className="text-white text-2xl font-black mb-2">Chagua Muda wa Mechi</h3>
            <p className="text-gray-400 text-xs mb-8">
              Mechi itachezwa kwa muda uliochaguliwa. Muda ukimalizika aliyefunga magoli mengi ndiye mshindi!
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[3, 6, 9, 12].map(duration => (
                <button
                  key={duration}
                  onClick={() => selectTimer(duration as TimerOption)}
                  className={`py-4 rounded-xl font-black text-lg transition border-2 cursor-pointer ${
                    timerOption === duration
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg scale-105'
                      : 'bg-slate-800/80 border-slate-700 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  {duration} MIN
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setGameMode('menu')}
                className="text-xs text-gray-400 hover:text-white underline cursor-pointer py-2"
              >
                ← Rudi kwenye Menu
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: Invite Inside TradeCore */}
        {gameMode === 'invite' && (
          <div className="p-6 md:p-8 max-w-xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-white text-xl font-bold">Mwalike Mpinzani</h3>
                <p className="text-gray-400 text-xs">Watumiaji waliopo TradeCore • Muda: {timerOption} MIN</p>
              </div>
              <button
                onClick={() => setGameMode('timer')}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                ← Badili Muda
              </button>
            </div>

            {!invitedUser ? (
              <div className="space-y-3">
                {MOCK_USERS.map(user => (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white font-black text-base shadow">
                          {user.avatar}
                        </div>
                        <span 
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a12] ${
                            user.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm leading-tight">{user.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {user.role} {user.online ? '• Online' : '• Offline'}
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={!user.online}
                      onClick={() => inviteUser(user)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow ${
                        user.online
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95'
                          : 'bg-slate-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {user.online ? 'INVITE' : 'Offline'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800">
                <div className="text-4xl mb-3 animate-bounce">📨</div>
                <div className="text-white font-bold text-lg mb-1">
                  Invitation sent to {invitedUser.name}
                </div>
                <div className="text-emerald-400 text-xs font-mono mb-4">
                  Waiting for response... Room ID: <span className="font-bold text-white">{roomId}</span>
                </div>
                <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 4: VS Countdown Screen */}
        {gameMode === 'vs' && (
          <div className="p-10 md:p-14 text-center">
            <div className="flex justify-center items-center gap-6 md:gap-12 mb-8">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-red-600 to-red-500 border-4 border-white/20 flex items-center justify-center text-white text-3xl font-black shadow-[0_0_25px_#ff3333]">
                  P1
                </div>
                <span className="text-white font-bold text-sm mt-3">You (Red)</span>
              </div>

              <div className="text-4xl md:text-5xl font-black text-amber-400 font-mono tracking-tighter">
                VS
              </div>

              <div className="flex flex-col items-center">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-cyan-400 border-4 border-white/20 flex items-center justify-center text-slate-950 text-3xl font-black shadow-[0_0_25px_#00d9ff]">
                  {playMode === 'ai' ? 'AI' : (invitedUser?.avatar || 'P2')}
                </div>
                <span className="text-white font-bold text-sm mt-3">
                  {playMode === 'ai' ? 'Computer AI' : (invitedUser?.name || 'Player 2 (Cyan)')}
                </span>
              </div>
            </div>

            <div className="text-7xl md:text-8xl font-black text-white tracking-tight animate-pulse font-mono mb-3">
              {vsCountdown > 0 ? vsCountdown : 'GO!'}
            </div>
            <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">
              {timerOption} MIN MATCH • {roomId || 'LOCAL TABLE'}
            </div>
          </div>
        )}

        {/* SCREEN 5: Active Gameplay Canvas */}
        {(gameMode === 'playing' || gameMode === 'winner') && (
          <div className="relative select-none">
            {/* Top Score & Match Bar */}
            <div className="flex justify-between items-center px-4 py-2 bg-black/40 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ff3333]"></span>
                  <span className="text-red-400 font-black text-xl font-mono">{score.p1}</span>
                </div>
                <span className="text-slate-600 font-bold">:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#00d9ff]"></span>
                  <span className="text-cyan-400 font-black text-xl font-mono">{score.p2}</span>
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="flex items-center gap-2">
                <span 
                  className={`font-mono font-black text-lg px-3 py-0.5 rounded-lg border ${
                    timeLeft < 30 
                      ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' 
                      : 'bg-slate-800 text-white border-slate-700'
                  }`}
                >
                  ⏱ {formatTime(timeLeft)}
                </span>
              </div>

              {/* Status & Connection Ping */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {playMode === 'remote' && (
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded text-[11px] font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>{networkPing}ms</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setGameMode('menu');
                    resetPuck();
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-2.5 py-1 rounded text-xs transition cursor-pointer"
                >
                  End Match
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="relative bg-[#0a0a12] w-full overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={800}
                height={400}
                className="w-full h-auto block max-h-[55vh] object-contain cursor-crosshair touch-none"
                onMouseMove={handleCanvasMouse}
                onMouseDown={(e) => {
                  initAudio();
                  gameStateRef.current.mouse.active = true;
                  handleCanvasMouse(e);
                }}
                onMouseUp={() => {
                  gameStateRef.current.mouse.active = false;
                }}
                onTouchStart={(e) => {
                  initAudio();
                  handleTouch(e);
                }}
                onTouchMove={handleTouch}
                onTouchEnd={handleTouch}
              />

              {/* Animated GOAL! Banner */}
              {showGoal && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="text-6xl md:text-8xl font-black text-red-500 font-mono tracking-widest animate-bounce drop-shadow-[0_0_35px_#ff3333]">
                    GOAL!
                  </div>
                </div>
              )}

              {/* SPEEDING UP Notification */}
              {showSpeedUp && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none z-20">
                  <div className="text-amber-300 font-black text-sm tracking-wider px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full animate-pulse shadow-[0_0_12px_#fbbf24]">
                    ⚡ SPEEDING UP
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls Info Bar */}
            <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex justify-between items-center text-[11px] text-gray-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-300">Controls:</span>
                {playMode === 'ai' ? (
                  <span>Drag mouse on left table or use W/A/S/D keys</span>
                ) : playMode === 'local' ? (
                  <span>P1: WASD / Mouse Left • P2: Arrow Keys / Mouse Right</span>
                ) : (
                  <span>Control your paddle on your screen. Sync is live!</span>
                )}
              </div>
              <div className="text-gray-500 font-mono">
                {roomId ? `Room: ${roomId}` : 'Local 60FPS Physics'}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 6: Winner / Draw Overlay */}
        {gameMode === 'winner' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-30 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl animate-scale-up">
              <div className="text-6xl mb-3">
                {winner === 'DRAW' ? '🤝' : '🏆'}
              </div>
              <h3 className="text-white text-3xl font-black mb-1 tracking-tight">
                {winner}
              </h3>
              <p className="text-gray-400 text-xs mb-6">
                Mchezo umekamilika! Matokeo: <span className="text-red-400 font-bold">{score.p1}</span> - <span className="text-cyan-400 font-bold">{score.p2}</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setGameMode('menu');
                    setScore({ p1: 0, p2: 0 });
                    setInvitedUser(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition cursor-pointer text-xs"
                >
                  Menu
                </button>
                <button
                  onClick={() => {
                    setVsCountdown(3);
                    setGameMode('vs');
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition cursor-pointer text-xs shadow-lg"
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
