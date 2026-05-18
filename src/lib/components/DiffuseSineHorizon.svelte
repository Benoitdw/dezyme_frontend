<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  let canvas: HTMLCanvasElement;
  let t = 0;
  let raf = 0;
  let isMobile = false;

  function waveColor(): [number, number, number] {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? [255, 140, 60] : [45, 111, 163];
  }

  function draw() {
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const [r, g, b] = waveColor();
    const scale = isMobile ? 0.5 : 1;

    const drawWave = (
      speed: number, freq: number, amp: number,
      yFrac: number, lw: number, alpha: number
    ) => {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const edge = Math.min(1, x / 80, (W - x) / 80);
        const y = H * yFrac + Math.sin((x / W) * freq * Math.PI * 2 + t * speed) * amp * edge;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * scale})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    };

    drawWave(2.2, 2.5, 28, 0.55, 6, 0.14);
    drawWave(3.5, 3.2, 18, 0.63, 1, 0.10);

    t += 0.016;
    raf = requestAnimationFrame(draw);
  }

  function resize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    isMobile = window.innerWidth < 768;
  }

  onMount(() => {
    if (!browser) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    resize();
    window.addEventListener('resize', resize, { passive: true });
    raf = requestAnimationFrame(draw);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
</style>
