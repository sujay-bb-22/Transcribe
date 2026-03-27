import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

// ---- Types ----

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  tiltPhase: number;
  tiltSpeed: number;
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  width: number;
  height: number;
  age: number;
  life: number;
  fadeIn: number;
  fadeOutStart: number;
  flagCode: string;
}

interface Ribbon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  swayPhase: number;
  swaySpeed: number;
  swayAmp: number;
  width: number;
  length: number;
  age: number;
  life: number;
  flagCode: string;
}

export interface ConfettiHandle {
  burst: (x: number, y: number, flagCode: string) => void;
}

// ---- Constants ----

const TAU = Math.PI * 2;
const GRAVITY = 1080;

// ---- Helpers ----

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---- Flag rendering ----

const flagCache = new Map<string, HTMLCanvasElement>();

function createFlagFace(
  code: string,
  side: "front" | "back",
): HTMLCanvasElement {
  const key = `${code}-${side}`;
  const cached = flagCache.get(key);
  if (cached) return cached;

  const off = document.createElement("canvas");
  off.width = 160;
  off.height = 108;
  const g = off.getContext("2d")!;
  const shade = side === "back";

  const white = shade ? "#d6d9e3" : "#ffffff";
  const red = shade ? "#aa4046" : "#c83b43";
  const blue = shade ? "#2e4a82" : "#3c63b8";
  const black = shade ? "#2c2d31" : "#111111";
  const gold = shade ? "#b79a4c" : "#f0ca58";
  const green = shade ? "#2f8456" : "#2fa86a";
  const skyBlue = shade ? "#4a8ab0" : "#5bb5e8";
  const darkRed = shade ? "#8a2020" : "#be1e2d";
  const darkGreen = shade ? "#1a5e30" : "#1f8247";

  const W = off.width;
  const H = off.height;

  g.clearRect(0, 0, W, H);
  roundRect(g, 0, 0, W, H, 10);
  g.clip();

  switch (code) {
    case "fr": {
      g.fillStyle = blue;
      g.fillRect(0, 0, W / 3, H);
      g.fillStyle = white;
      g.fillRect(W / 3, 0, W / 3, H);
      g.fillStyle = red;
      g.fillRect((W / 3) * 2, 0, W / 3, H);
      break;
    }
    case "de": {
      g.fillStyle = black;
      g.fillRect(0, 0, W, H / 3);
      g.fillStyle = red;
      g.fillRect(0, H / 3, W, H / 3);
      g.fillStyle = gold;
      g.fillRect(0, (H / 3) * 2, W, H / 3);
      break;
    }
    case "jp": {
      g.fillStyle = white;
      g.fillRect(0, 0, W, H);
      g.fillStyle = red;
      g.beginPath();
      g.arc(W / 2, H / 2, H * 0.26, 0, TAU);
      g.fill();
      break;
    }
    case "it": {
      g.fillStyle = green;
      g.fillRect(0, 0, W / 3, H);
      g.fillStyle = white;
      g.fillRect(W / 3, 0, W / 3, H);
      g.fillStyle = red;
      g.fillRect((W / 3) * 2, 0, W / 3, H);
      break;
    }
    case "es": {
      g.fillStyle = red;
      g.fillRect(0, 0, W, H / 4);
      g.fillStyle = gold;
      g.fillRect(0, H / 4, W, H / 2);
      g.fillStyle = red;
      g.fillRect(0, (H / 4) * 3, W, H / 4);
      break;
    }
    case "pt": {
      g.fillStyle = green;
      g.fillRect(0, 0, W * 0.4, H);
      g.fillStyle = red;
      g.fillRect(W * 0.4, 0, W * 0.6, H);
      // Simplified armillary sphere
      g.fillStyle = gold;
      g.beginPath();
      g.arc(W * 0.4, H / 2, H * 0.22, 0, TAU);
      g.fill();
      break;
    }
    case "nl": {
      g.fillStyle = darkRed;
      g.fillRect(0, 0, W, H / 3);
      g.fillStyle = white;
      g.fillRect(0, H / 3, W, H / 3);
      g.fillStyle = blue;
      g.fillRect(0, (H / 3) * 2, W, H / 3);
      break;
    }
    case "pl": {
      g.fillStyle = white;
      g.fillRect(0, 0, W, H / 2);
      g.fillStyle = red;
      g.fillRect(0, H / 2, W, H / 2);
      break;
    }
    case "gr": {
      // Greece: blue and white stripes with cross
      const stripeH = H / 9;
      for (let i = 0; i < 9; i++) {
        g.fillStyle = i % 2 === 0 ? skyBlue : white;
        g.fillRect(0, i * stripeH, W, stripeH + 0.5);
      }
      g.fillStyle = skyBlue;
      g.fillRect(0, 0, W * 0.37, stripeH * 5);
      g.fillStyle = white;
      g.fillRect((W * 0.37) / 2 - stripeH * 0.5, 0, stripeH, stripeH * 5);
      g.fillRect(0, stripeH * 2, W * 0.37, stripeH);
      break;
    }
    case "sa": {
      // Saudi Arabia (simplified): green with white
      g.fillStyle = darkGreen;
      g.fillRect(0, 0, W, H);
      g.fillStyle = white;
      g.font = `bold ${H * 0.18}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("☪", W / 2, H / 2);
      break;
    }
    case "cn": {
      // China: red with yellow stars
      g.fillStyle = red;
      g.fillRect(0, 0, W, H);
      g.fillStyle = gold;
      g.beginPath();
      g.arc(W * 0.22, H * 0.3, H * 0.14, 0, TAU);
      g.fill();
      // Small stars
      for (const [sx, sy] of [
        [0.38, 0.14],
        [0.44, 0.24],
        [0.44, 0.38],
        [0.38, 0.48],
      ] as const) {
        g.beginPath();
        g.arc(W * sx, H * sy, H * 0.05, 0, TAU);
        g.fill();
      }
      break;
    }
    case "vn": {
      // Vietnam: red with yellow star
      g.fillStyle = red;
      g.fillRect(0, 0, W, H);
      g.fillStyle = gold;
      g.beginPath();
      g.arc(W / 2, H / 2, H * 0.22, 0, TAU);
      g.fill();
      break;
    }
    case "kr": {
      // South Korea (simplified): white with red/blue circle
      g.fillStyle = white;
      g.fillRect(0, 0, W, H);
      const cx = W / 2,
        cy = H / 2,
        r = H * 0.24;
      g.fillStyle = red;
      g.beginPath();
      g.arc(cx, cy, r, Math.PI, 0);
      g.fill();
      g.fillStyle = blue;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI);
      g.fill();
      break;
    }
    case "us":
    default: {
      const stripeH = H / 13;
      for (let i = 0; i < 13; i++) {
        g.fillStyle = i % 2 === 0 ? red : white;
        g.fillRect(0, i * stripeH, W, stripeH + 0.5);
      }
      g.fillStyle = blue;
      g.fillRect(0, 0, W * 0.46, stripeH * 7);
      g.fillStyle = white;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 6; col++) {
          const sx = 12 + col * 10 + (row % 2) * 4;
          const sy = 10 + row * 10;
          g.beginPath();
          g.arc(sx, sy, 1.6, 0, TAU);
          g.fill();
        }
      }
      break;
    }
  }

  // Gloss / shade overlay
  if (!shade) {
    const gloss = g.createLinearGradient(0, 0, W, H);
    gloss.addColorStop(0, "rgba(255,255,255,0.20)");
    gloss.addColorStop(0.4, "rgba(255,255,255,0.02)");
    gloss.addColorStop(1, "rgba(0,0,0,0.10)");
    g.fillStyle = gloss;
    g.fillRect(0, 0, W, H);
  } else {
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(0, 0, W, H);
  }

  // Border
  g.lineWidth = 2;
  g.strokeStyle =
    side === "front" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)";
  roundRect(g, 1, 1, W - 2, H - 2, 10);
  g.stroke();

  flagCache.set(key, off);
  return off;
}

// ---- Particle factories ----

function makeParticle(x: number, y: number, flagCode: string): Particle {
  const angle = rand(-Math.PI * 0.92, -Math.PI * 0.08);
  const speed = rand(320, 860);
  const size = rand(12, 24);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle: rand(0, TAU),
    spin: rand(-10, 10),
    tiltPhase: rand(0, TAU),
    tiltSpeed: rand(8, 16),
    wobblePhase: rand(0, TAU),
    wobbleSpeed: rand(3.5, 8),
    wobbleAmp: rand(4, 14),
    width: size * rand(1.0, 1.35),
    height: size * rand(0.55, 0.88),
    age: 0,
    life: rand(1.8, 2.85),
    fadeIn: rand(0.04, 0.12),
    fadeOutStart: rand(0.58, 0.78),
    flagCode,
  };
}

function makeRibbon(x: number, y: number, flagCode: string): Ribbon {
  const angle = rand(-Math.PI * 0.92, -Math.PI * 0.08);
  const speed = rand(280, 620);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle: rand(0, TAU),
    spin: rand(-8, 8),
    swayPhase: rand(0, TAU),
    swaySpeed: rand(5, 10),
    swayAmp: rand(5, 12),
    width: rand(5, 7),
    length: rand(22, 42),
    age: 0,
    life: rand(1.6, 2.3),
    flagCode,
  };
}

// ---- Alpha helper ----

function alphaFor(
  age: number,
  life: number,
  fadeIn: number,
  fadeOutStart: number,
) {
  const t = age / life;
  if (t < fadeIn) return t / fadeIn;
  if (t < fadeOutStart) return 1;
  return 1 - (t - fadeOutStart) / (1 - fadeOutStart);
}

// ---- Component ----

const Confetti = forwardRef<ConfettiHandle>(function Confetti(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ribbonsRef = useRef<Ribbon[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  // Resize handler
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: w, height: h, dpr };
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Animation loop
  const tick = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dt = Math.min(0.033, (now - lastTimeRef.current) / 1000 || 0.016);
    lastTimeRef.current = now;
    const { width, height } = sizeRef.current;

    ctx.clearRect(0, 0, width, height);

    const particles = particlesRef.current;
    const ribbons = ribbonsRef.current;

    // Update particles
    particlesRef.current = particles.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) return false;
      p.vx *= Math.pow(0.992, dt * 60);
      p.vy += GRAVITY * dt;
      p.vx += Math.sin(now * 0.0016 + p.wobblePhase) * 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.tiltPhase += p.tiltSpeed * dt;
      p.wobblePhase += p.wobbleSpeed * dt;
      return p.y < height + 120 && p.x > -160 && p.x < width + 160;
    });

    // Update ribbons
    ribbonsRef.current = ribbons.filter((r) => {
      r.age += dt;
      if (r.age >= r.life) return false;
      r.vx *= Math.pow(0.989, dt * 60);
      r.vy += GRAVITY * 0.75 * dt;
      r.vx += Math.cos(now * 0.0012 + r.swayPhase) * 14 * 1.1 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.angle += r.spin * dt;
      r.swayPhase += r.swaySpeed * dt;
      return r.y < height + 120 && r.x > -160 && r.x < width + 160;
    });

    // Draw ribbons
    for (const r of ribbonsRef.current) {
      const front = createFlagFace(r.flagCode, "front");
      const back = createFlagFace(r.flagCode, "back");
      const progress = r.age / r.life;
      const alpha = clamp(1 - Math.pow(progress, 2.2), 0, 1);
      const flip = Math.cos(r.swayPhase);
      const img = flip >= 0 ? front : back;
      const stretch = lerp(0.32, 1, Math.abs(flip));
      const swayX = Math.sin(r.swayPhase) * r.swayAmp;

      ctx.save();
      ctx.globalAlpha = alpha * 0.86;
      ctx.translate(r.x + swayX, r.y);
      ctx.rotate(r.angle);
      ctx.scale(stretch, 1);
      ctx.drawImage(img, -r.width / 2, -r.length / 2, r.width, r.length);
      ctx.restore();
    }

    // Draw particles
    for (const p of particlesRef.current) {
      const front = createFlagFace(p.flagCode, "front");
      const back = createFlagFace(p.flagCode, "back");
      const alpha = clamp(
        alphaFor(p.age, p.life, p.fadeIn, p.fadeOutStart),
        0,
        1,
      );
      const progress = p.age / p.life;
      const flip = Math.cos(p.tiltPhase);
      const scaleX = Math.sign(flip) * lerp(0.14, 1, Math.abs(flip));
      const wobbleX = Math.sin(p.wobblePhase) * p.wobbleAmp;
      const wobbleY = Math.cos(p.wobblePhase * 0.8) * (p.wobbleAmp * 0.22);
      const img = flip >= 0 ? front : back;

      ctx.save();
      ctx.globalAlpha = alpha * clamp(1 - progress * 0.1, 0.72, 1);
      ctx.translate(p.x + wobbleX, p.y + wobbleY);
      ctx.rotate(p.angle);
      ctx.scale(scaleX, 1);
      ctx.drawImage(img, -p.width / 2, -p.height / 2, p.width, p.height);
      ctx.restore();
    }

    if (particlesRef.current.length || ribbonsRef.current.length) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Expose burst method
  const burst = useCallback(
    (x: number, y: number, flagCode: string) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const { width, height } = sizeRef.current;
      const areaFactor = clamp((width * height) / (1440 * 900), 0.72, 1.3);
      const particleCount = Math.round(80 * areaFactor);
      const ribbonCount = Math.round(14 * areaFactor);

      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(
          makeParticle(x + rand(-8, 8), y + rand(-8, 8), flagCode),
        );
      }
      for (let i = 0; i < ribbonCount; i++) {
        ribbonsRef.current.push(
          makeRibbon(x + rand(-12, 12), y + rand(-6, 6), flagCode),
        );
      }

      if (!rafRef.current) {
        lastTimeRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  useImperativeHandle(ref, () => ({ burst }), [burst]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
});

export default Confetti;
