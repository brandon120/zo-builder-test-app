import { useCallback, useEffect, useRef, useState } from "react";

const CANVAS_W = 800;
const CANVAS_H = 600;
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 10;
const BULLET_RADIUS = 4;
const ENEMY_RADIUS = 14;
const ENEMY_BASE_SPEED = 1.2;
const SPAWN_INTERVAL = 1200;
const MAX_HEALTH = 5;
const AIM_DISTANCE = 120;

type Vec2 = { x: number; y: number };

type Bullet = Vec2 & { vx: number; vy: number };

type Enemy = Vec2 & { speed: number; hp: number };

type GameState = "menu" | "playing" | "gameover";

type MobileInput = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
};

const EMPTY_MOBILE_INPUT: MobileInput = {
  moveX: 0,
  moveY: 0,
  aimX: 1,
  aimY: 0,
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

function getFullscreenElement() {
  const doc = document as FullscreenDocument;
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

async function requestElementFullscreen(element: HTMLElement) {
  const el = element as FullscreenElement;
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
    return;
  }
  if (el.mozRequestFullScreen) {
    await el.mozRequestFullScreen();
    return;
  }
  if (el.msRequestFullscreen) {
    await el.msRequestFullscreen();
    return;
  }
  throw new Error("Fullscreen API is not supported");
}

async function exitElementFullscreen() {
  const doc = document as FullscreenDocument;
  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
    return;
  }
  if (doc.mozCancelFullScreen) {
    await doc.mozCancelFullScreen();
    return;
  }
  if (doc.msExitFullscreen) {
    await doc.msExitFullscreen();
    return;
  }
}

function dist(a: Vec2, b: Vec2) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function GameIcon() {
  return (
    <svg
      className="game-icon"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="header-shield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="header-ship" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0a0e17" />
      <path
        d="M32 8 L52 18 V34 C52 46 32 56 32 56 C32 56 12 46 12 34 V18 Z"
        fill="url(#header-shield)"
        stroke="#7dd3fc"
        strokeWidth="2"
      />
      <path
        d="M36 22 L44 28 L32 40 L24 32 L28 28 Z"
        fill="url(#header-ship)"
        stroke="#fef08a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="20" r="3" fill="#f87171" />
    </svg>
  );
}

function MobileButton({
  label,
  subLabel,
  className = "",
  onPress,
  onRelease,
}: {
  label: string;
  subLabel?: string;
  className?: string;
  onPress: () => void;
  onRelease: () => void;
}) {
  return (
    <button
      type="button"
      className={`mobile-btn ${className}`}
      aria-label={subLabel ?? label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onPress();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onRelease();
      }}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="mobile-btn-label">{label}</span>
      {subLabel ? <span className="mobile-btn-sublabel">{subLabel}</span> : null}
    </button>
  );
}

function VirtualJoystick({
  label,
  className = "",
  onChange,
}: {
  label: string;
  className?: string;
  onChange: (x: number, y: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const [thumbOffset, setThumbOffset] = useState({ x: 0, y: 0 });

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;

      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDist = rect.width / 2 - 22;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance > maxDist) {
        dx = (dx / distance) * maxDist;
        dy = (dy / distance) * maxDist;
      }

      setThumbOffset({ x: dx, y: dy });

      const normX = dx / maxDist;
      const normY = dy / maxDist;
      const normLen = Math.hypot(normX, normY);

      if (normLen < 0.12) {
        onChange(0, 0);
        return;
      }

      onChange(normX / normLen, normY / normLen);
    },
    [onChange],
  );

  const reset = useCallback(() => {
    activeRef.current = false;
    setThumbOffset({ x: 0, y: 0 });
    onChange(0, 0);
  }, [onChange]);

  return (
    <div className={`joystick-group ${className}`}>
      <span className="mobile-group-label">{label}</span>
      <div
        ref={baseRef}
        className="joystick-base"
        role="application"
        aria-label={`${label} joystick`}
        onPointerDown={(e) => {
          e.preventDefault();
          activeRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!activeRef.current) return;
          e.preventDefault();
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={reset}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="joystick-thumb"
          style={{ transform: `translate(${thumbOffset.x}px, ${thumbOffset.y}px)` }}
        />
      </div>
    </div>
  );
}

export default function DefenseGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMode, setMobileMode] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const gameRef = useRef({
    player: { x: CANVAS_W / 2, y: CANVAS_H / 2 },
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    keys: new Set<string>(),
    mouse: { x: CANVAS_W / 2 + AIM_DISTANCE, y: CANVAS_H / 2 },
    aimDir: { x: 1, y: 0 },
    mobile: { ...EMPTY_MOBILE_INPUT },
    lastSpawn: 0,
    lastShot: 0,
    animId: 0,
    score: 0,
    wave: 1,
    health: MAX_HEALTH,
    kills: 0,
    invincibleUntil: 0,
  });

  const mobileModeRef = useRef(mobileMode);
  mobileModeRef.current = mobileMode;

  const setMobileInput = useCallback((patch: Partial<MobileInput>) => {
    Object.assign(gameRef.current.mobile, patch);
  }, []);

  const clearMobileInput = useCallback(() => {
    Object.assign(gameRef.current.mobile, EMPTY_MOBILE_INPUT);
  }, []);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.player = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    g.bullets = [];
    g.enemies = [];
    g.lastSpawn = 0;
    g.lastShot = 0;
    g.score = 0;
    g.wave = 1;
    g.health = MAX_HEALTH;
    g.kills = 0;
    g.invincibleUntil = 0;
    g.aimDir = { x: 1, y: 0 };
    g.mouse = { x: CANVAS_W / 2 + AIM_DISTANCE, y: CANVAS_H / 2 };
    clearMobileInput();
    setScore(0);
    setWave(1);
    setHealth(MAX_HEALTH);
    setGameState("playing");
  }, [clearMobileInput]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const g = gameRef.current;

    const spawnEnemy = () => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = Math.random() * CANVAS_W;
        y = -ENEMY_RADIUS;
      } else if (edge === 1) {
        x = CANVAS_W + ENEMY_RADIUS;
        y = Math.random() * CANVAS_H;
      } else if (edge === 2) {
        x = Math.random() * CANVAS_W;
        y = CANVAS_H + ENEMY_RADIUS;
      } else {
        x = -ENEMY_RADIUS;
        y = Math.random() * CANVAS_H;
      }
      const speed = ENEMY_BASE_SPEED + g.wave * 0.15 + Math.random() * 0.5;
      g.enemies.push({ x, y, speed, hp: 1 + Math.floor(g.wave / 3) });
    };

    const shoot = () => {
      const now = performance.now();
      if (now - g.lastShot < 180) return;
      g.lastShot = now;

      const dx = g.mouse.x - g.player.x;
      const dy = g.mouse.y - g.player.y;
      const len = Math.hypot(dx, dy) || 1;
      g.bullets.push({
        x: g.player.x,
        y: g.player.y,
        vx: (dx / len) * BULLET_SPEED,
        vy: (dy / len) * BULLET_SPEED,
      });
    };

    const updateAimFromMobile = () => {
      const { aimX, aimY } = g.mobile;
      if (aimX || aimY) {
        g.aimDir = { x: aimX, y: aimY };
      }
      g.mouse.x = g.player.x + g.aimDir.x * AIM_DISTANCE;
      g.mouse.y = g.player.y + g.aimDir.y * AIM_DISTANCE;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (mobileModeRef.current) return;
      g.keys.add(e.key.toLowerCase());
      if (e.key === " " && gameState === "playing") {
        e.preventDefault();
        shoot();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (mobileModeRef.current) return;
      g.keys.delete(e.key.toLowerCase());
    };

    const onMouseMove = (e: MouseEvent) => {
      if (mobileModeRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      g.mouse.x = (e.clientX - rect.left) * scaleX;
      g.mouse.y = (e.clientY - rect.top) * scaleY;
    };

    const onMouseDown = () => {
      if (mobileModeRef.current) return;
      if (gameState === "playing") shoot();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);

    let lastTime = 0;

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.67, 3);
      lastTime = time;

      const { player } = g;

      if (gameState === "playing") {
        let dx = 0;
        let dy = 0;

        if (mobileModeRef.current) {
          updateAimFromMobile();
          const m = g.mobile;
          dx = m.moveX;
          dy = m.moveY;
          shoot();
        } else {
          const { keys } = g;
          if (keys.has("w") || keys.has("arrowup")) dy -= 1;
          if (keys.has("s") || keys.has("arrowdown")) dy += 1;
          if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
          if (keys.has("d") || keys.has("arrowright")) dx += 1;
        }

        if (dx || dy) {
          const len = Math.hypot(dx, dy) || 1;
          player.x = clamp(
            player.x + (dx / len) * PLAYER_SPEED * dt,
            PLAYER_RADIUS,
            CANVAS_W - PLAYER_RADIUS,
          );
          player.y = clamp(
            player.y + (dy / len) * PLAYER_SPEED * dt,
            PLAYER_RADIUS,
            CANVAS_H - PLAYER_RADIUS,
          );
        }

        if (mobileModeRef.current) {
          g.mouse.x = player.x + g.aimDir.x * AIM_DISTANCE;
          g.mouse.y = player.y + g.aimDir.y * AIM_DISTANCE;
        }

        const spawnRate = Math.max(400, SPAWN_INTERVAL - g.wave * 80);
        if (time - g.lastSpawn > spawnRate) {
          g.lastSpawn = time;
          const count = 1 + Math.floor(g.wave / 2);
          for (let i = 0; i < count; i++) spawnEnemy();
        }

        g.bullets = g.bullets.filter((b) => {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          return (
            b.x > -20 &&
            b.x < CANVAS_W + 20 &&
            b.y > -20 &&
            b.y < CANVAS_H + 20
          );
        });

        for (const enemy of g.enemies) {
          const edx = player.x - enemy.x;
          const edy = player.y - enemy.y;
          const elen = Math.hypot(edx, edy) || 1;
          enemy.x += (edx / elen) * enemy.speed * dt;
          enemy.y += (edy / elen) * enemy.speed * dt;
        }

        const hitBullets = new Set<Bullet>();
        const deadEnemies = new Set<Enemy>();

        for (const bullet of g.bullets) {
          for (const enemy of g.enemies) {
            if (deadEnemies.has(enemy)) continue;
            if (dist(bullet, enemy) < BULLET_RADIUS + ENEMY_RADIUS) {
              hitBullets.add(bullet);
              enemy.hp -= 1;
              if (enemy.hp <= 0) {
                deadEnemies.add(enemy);
                g.kills += 1;
                g.score += 10;
                if (g.kills % 8 === 0) {
                  g.wave += 1;
                  setWave(g.wave);
                }
                setScore(g.score);
              }
              break;
            }
          }
        }

        g.bullets = g.bullets.filter((b) => !hitBullets.has(b));
        g.enemies = g.enemies.filter((e) => !deadEnemies.has(e));

        if (time > g.invincibleUntil) {
          for (const enemy of g.enemies) {
            if (dist(player, enemy) < PLAYER_RADIUS + ENEMY_RADIUS - 4) {
              g.health -= 1;
              setHealth(g.health);
              g.invincibleUntil = time + 1200;
              if (g.health <= 0) setGameState("gameover");
              break;
            }
          }
        }
      }

      ctx.fillStyle = "#0a0e17";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();

      for (const enemy of g.enemies) {
        const grad = ctx.createRadialGradient(
          enemy.x,
          enemy.y,
          0,
          enemy.x,
          enemy.y,
          ENEMY_RADIUS,
        );
        grad.addColorStop(0, "#f87171");
        grad.addColorStop(1, "#991b1b");
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, ENEMY_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        if (enemy.hp > 1) {
          ctx.fillStyle = "#fca5a5";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(enemy.hp), enemy.x, enemy.y + 4);
        }
      }

      for (const bullet of g.bullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "#fde047";
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      const invincible = time < g.invincibleUntil;
      if (!invincible || Math.floor(time / 100) % 2 === 0) {
        const angle = Math.atan2(
          g.mouse.y - player.y,
          g.mouse.x - player.x,
        );
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(PLAYER_RADIUS + 6, 0);
        ctx.lineTo(-PLAYER_RADIUS, -PLAYER_RADIUS * 0.7);
        ctx.lineTo(-PLAYER_RADIUS * 0.4, 0);
        ctx.lineTo(-PLAYER_RADIUS, PLAYER_RADIUS * 0.7);
        ctx.closePath();
        const playerGrad = ctx.createLinearGradient(
          -PLAYER_RADIUS,
          0,
          PLAYER_RADIUS,
          0,
        );
        playerGrad.addColorStop(0, "#38bdf8");
        playerGrad.addColorStop(1, "#0ea5e9");
        ctx.fillStyle = playerGrad;
        ctx.fill();
        ctx.strokeStyle = "#7dd3fc";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Score: ${g.score}`, 16, 28);
      ctx.fillText(`Wave: ${g.wave}`, 16, 52);

      for (let i = 0; i < MAX_HEALTH; i++) {
        ctx.beginPath();
        ctx.arc(16 + i * 22, 78, 8, 0, Math.PI * 2);
        ctx.fillStyle = i < g.health ? "#f87171" : "rgba(100,116,139,0.3)";
        ctx.fill();
      }

      if (gameState === "playing") {
        ctx.strokeStyle = "rgba(253, 224, 71, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(g.mouse.x, g.mouse.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(g.mouse.x - 16, g.mouse.y);
        ctx.lineTo(g.mouse.x - 6, g.mouse.y);
        ctx.moveTo(g.mouse.x + 6, g.mouse.y);
        ctx.lineTo(g.mouse.x + 16, g.mouse.y);
        ctx.moveTo(g.mouse.x, g.mouse.y - 16);
        ctx.lineTo(g.mouse.x, g.mouse.y - 6);
        ctx.moveTo(g.mouse.x, g.mouse.y + 6);
        ctx.lineTo(g.mouse.x, g.mouse.y + 16);
        ctx.stroke();
      }

      if (gameState === "menu") {
        ctx.fillStyle = "rgba(10, 14, 23, 0.75)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 42px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Last Stand", CANVAS_W / 2, CANVAS_H / 2 - 70);
        ctx.font = "18px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(
          "Defend yourself from incoming waves",
          CANVAS_W / 2,
          CANVAS_H / 2 - 30,
        );
        if (mobileModeRef.current) {
          ctx.fillText(
            "Use the move and aim joysticks — shooting is automatic",
            CANVAS_W / 2,
            CANVAS_H / 2,
          );
          ctx.fillText(
            "Tap Start below when you are ready",
            CANVAS_W / 2,
            CANVAS_H / 2 + 30,
          );
        } else {
          ctx.fillText(
            "WASD / Arrows to move · Click or Space to shoot",
            CANVAS_W / 2,
            CANVAS_H / 2,
          );
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 20px sans-serif";
          ctx.fillText("Click anywhere to start", CANVAS_W / 2, CANVAS_H / 2 + 50);
        }
      }

      if (gameState === "gameover") {
        ctx.fillStyle = "rgba(10, 14, 23, 0.8)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#f87171";
        ctx.font = "bold 42px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Defeated", CANVAS_W / 2, CANVAS_H / 2 - 40);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "22px sans-serif";
        ctx.fillText(`Final Score: ${g.score}`, CANVAS_W / 2, CANVAS_H / 2 + 5);
        ctx.fillText(`Reached Wave ${g.wave}`, CANVAS_W / 2, CANVAS_H / 2 + 35);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 18px sans-serif";
        const restartHint = mobileModeRef.current
          ? "Tap Start to play again"
          : "Click to play again";
        ctx.fillText(restartHint, CANVAS_W / 2, CANVAS_H / 2 + 80);
      }

      g.animId = requestAnimationFrame(loop);
    };

    g.animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(g.animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
    };
  }, [gameState]);

  useEffect(() => {
    const syncFullscreenState = () => {
      const container = gameContainerRef.current;
      const active = Boolean(container && getFullscreenElement() === container);
      setIsFullscreen(active);
      if (active) setIsImmersive(false);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!isImmersive) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsImmersive(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isImmersive]);

  const handleCanvasClick = () => {
    if (mobileMode) return;
    if (gameState === "menu" || gameState === "gameover") startGame();
  };

  const toggleMobileMode = () => {
    setMobileMode((prev) => {
      const next = !prev;
      if (next) {
        gameRef.current.keys.clear();
      } else {
        clearMobileInput();
      }
      return next;
    });
  };

  const toggleFullscreen = async () => {
    const container = gameContainerRef.current;
    if (!container) return;

    if (getFullscreenElement() === container) {
      await exitElementFullscreen();
      return;
    }

    if (isImmersive) {
      setIsImmersive(false);
      return;
    }

    try {
      await requestElementFullscreen(container);
    } catch {
      // Embedded previews often block the Fullscreen API, so expand in-page instead.
      setIsImmersive(true);
    }
  };

  const isExpanded = isFullscreen || isImmersive;

  const handleMoveJoystick = useCallback(
    (x: number, y: number) => setMobileInput({ moveX: x, moveY: y }),
    [setMobileInput],
  );

  const handleAimJoystick = useCallback(
    (x: number, y: number) => {
      if (x || y) {
        setMobileInput({ aimX: x, aimY: y });
      } else {
        setMobileInput({ aimX: 0, aimY: 0 });
      }
    },
    [setMobileInput],
  );

  return (
    <div
      ref={gameContainerRef}
      className={`game-container${mobileMode ? " mobile-mode" : ""}${isImmersive ? " immersive-mode" : ""}`}
    >
      <header className="game-header">
        <div className="game-header-row">
          <div className="game-header-brand">
            <GameIcon />
            <div>
              <h1>Last Stand</h1>
              <p>Survive the waves. Protect yourself at all costs.</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="fullscreen-btn"
              aria-label={isExpanded ? "Exit fullscreen" : "Enter fullscreen"}
              aria-pressed={isExpanded}
              onClick={toggleFullscreen}
            >
              {isExpanded ? "⤢" : "⛶"}
            </button>
            <button
              type="button"
              className="settings-btn"
              aria-label="Open settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      {settingsOpen ? (
        <div className="settings-panel" role="dialog" aria-label="Game settings">
          <div className="settings-panel-header">
            <h2>Settings</h2>
            <button
              type="button"
              className="settings-close"
              aria-label="Close settings"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
          </div>
          <label className="settings-toggle">
            <span>
              <strong>Mobile play</strong>
              <small>Show joystick touch controls with automatic shooting</small>
            </span>
            <input
              type="checkbox"
              checked={mobileMode}
              onChange={toggleMobileMode}
            />
            <span className="settings-switch" aria-hidden="true" />
          </label>
        </div>
      ) : null}

      <div className="game-stage">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="game-canvas"
          onClick={handleCanvasClick}
        />

        {mobileMode ? (
          <div className="mobile-controls" aria-label="Touch controls">
            <VirtualJoystick label="Move" onChange={handleMoveJoystick} />

            <div className="mobile-control-group mobile-actions">
              {(gameState === "menu" || gameState === "gameover") && (
                <MobileButton
                  label="START"
                  subLabel="Start game"
                  className="mobile-start"
                  onPress={startGame}
                  onRelease={() => undefined}
                />
              )}

              <VirtualJoystick
                label="Aim"
                className="aim-joystick"
                onChange={handleAimJoystick}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="game-stats">
        <span>Score: {score}</span>
        <span>Wave: {wave}</span>
        <span>
          Health:{" "}
          {Array.from({ length: MAX_HEALTH }, (_, i) => (
            <span key={i} className={i < health ? "heart alive" : "heart"}>
              ♥
            </span>
          ))}
        </span>
        {mobileMode ? <span className="mode-badge">Mobile mode</span> : null}
      </div>

      <p className="game-hint">
        {mobileMode ? (
          <>
            Use the <strong>Move</strong> and <strong>Aim</strong> joysticks — your gun
            fires automatically.
          </>
        ) : (
          <>
            Move with <kbd>WASD</kbd> or arrow keys · Shoot with mouse click or{" "}
            <kbd>Space</kbd> · Use <kbd>⛶</kbd> for fullscreen · Open{" "}
            <kbd>⚙ Settings</kbd> for mobile controls
          </>
        )}
      </p>
    </div>
  );
}
