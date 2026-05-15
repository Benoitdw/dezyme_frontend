<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';

	let { label = 'Pending…' }: { label?: string } = $props();

	let canvas: HTMLCanvasElement;
	let cleanup: (() => void) | null = null;

	function normalizePts(pts: THREE.Vector3[], targetR: number): THREE.Vector3[] {
		const maxR = Math.max(...pts.map(p => p.length()));
		return pts.map(p => p.clone().multiplyScalar(targetR / maxR));
	}

	function makeHelixCoords(n: number): THREE.Vector3[] {
		const pts: THREE.Vector3[] = [];
		const rise = 1.5, radius = 2.3, pitch = (2 * Math.PI) / 3.6;
		for (let i = 0; i < n; i++) {
			const t = i * pitch;
			pts.push(new THREE.Vector3(i * rise - (n * rise) / 2, radius * Math.cos(t), radius * Math.sin(t)));
		}
		return normalizePts(pts, 18);
	}

	function makeCoilCoords(n: number): THREE.Vector3[] {
		const pts: THREE.Vector3[] = [];
		let s = 42;
		const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff - 0.5; };
		for (let i = 0; i < n; i++) {
			pts.push(new THREE.Vector3(rand() * 26, i * 0.5 - (n * 0.25) + rand() * 7, rand() * 26));
		}
		return normalizePts(pts, 20);
	}

	function chainColor(t: number): THREE.Color {
		const c = new THREE.Color();
		if (t < 0.25)      c.lerpColors(new THREE.Color(0x0044ff), new THREE.Color(0x00ccff), t * 4);
		else if (t < 0.5)  c.lerpColors(new THREE.Color(0x00ccff), new THREE.Color(0x00ee66), (t - 0.25) * 4);
		else if (t < 0.75) c.lerpColors(new THREE.Color(0x00ee66), new THREE.Color(0xffaa00), (t - 0.5) * 4);
		else               c.lerpColors(new THREE.Color(0xffaa00), new THREE.Color(0xff1133), (t - 0.75) * 4);
		return c;
	}

	function easeInOut3(t: number): number {
		return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
	}
	function easeOutElastic(t: number): number {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
	}
	function easeInElastic(t: number): number { return 1 - easeOutElastic(1 - t); }

	function startAnimation(): () => void {
		const W = canvas.clientWidth || 480;
		const H = canvas.clientHeight || 320;
		canvas.width  = W;
		canvas.height = H;

		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(W, H);
		renderer.setClearColor(0x000000, 0);
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.5;

		const scene  = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 300);
		camera.position.set(0, 0, 50);

		scene.add(new THREE.AmbientLight(0xffeedd, 0.4));

		const ptA = new THREE.PointLight(0x3377ff, 200, 150);
		ptA.position.set(-28, 18, 22);
		scene.add(ptA);

		const ptB = new THREE.PointLight(0xff2233, 200, 150);
		ptB.position.set(28, -18, -22);
		scene.add(ptB);

		const ptW = new THREE.PointLight(0xffffff, 60, 100);
		ptW.position.set(0, 38, 14);
		scene.add(ptW);

		const N = 50;
		const coilPts  = makeCoilCoords(N);
		const helixPts = makeHelixCoords(N);
		const curPts   = coilPts.map(p => p.clone());
		const atomAlpha = new Float32Array(N).fill(0);

		const sphereGeo = new THREE.SphereGeometry(1, 22, 14);
		const spheres: THREE.Mesh[] = [];
		const mats: THREE.MeshStandardMaterial[] = [];

		for (let i = 0; i < N; i++) {
			const col = chainColor(i / (N - 1));
			const mat = new THREE.MeshStandardMaterial({
				color: col, emissive: col.clone(), emissiveIntensity: 0.08,
				roughness: 0.15, metalness: 0.05,
			});
			mats.push(mat);
			const m = new THREE.Mesh(sphereGeo, mat);
			m.scale.setScalar(0.72);
			m.position.copy(curPts[i]);
			scene.add(m);
			spheres.push(m);
		}

		let tubeMesh: THREE.Mesh | null = null;
		const tubeGeos: THREE.BufferGeometry[] = [];
		const tubeMats: THREE.MeshStandardMaterial[] = [];

		function rebuildTube(emissIntensity: number) {
			if (tubeMesh) scene.remove(tubeMesh);
			const curve = new THREE.CatmullRomCurve3(curPts.map(p => p.clone()));
			const geo   = new THREE.TubeGeometry(curve, N * 4, 0.2, 10, false);
			tubeGeos.push(geo);
			const pos = geo.attributes.position;
			const colArr = new Float32Array(pos.count * 3);
			for (let i = 0; i < pos.count; i++) {
				const c = chainColor(i / (pos.count - 1));
				colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
			}
			geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
			const mat = new THREE.MeshStandardMaterial({
				vertexColors: true, emissive: new THREE.Color(1, 1, 1),
				emissiveIntensity: emissIntensity, roughness: 0.28,
			});
			tubeMats.push(mat);
			tubeMesh = new THREE.Mesh(geo, mat);
			scene.add(tubeMesh);
		}

		const HOLD_COIL_MS  = 1800;
		const HOLD_HELIX_MS = 2200;
		const MORPH_MS      = 3400;
		const STAGGER_FRAC  = 0.5;

		let phase = 0, phaseStart = 0;
		let cameraAngle = 0, camDist = 52;
		let lastTs = 0, frame_n = 0, animId: number;
		let flashTs = -Infinity;

		function getAtomAlphas(elapsed: number, folding: boolean): Float32Array {
			const out = new Float32Array(N);
			const staggerMs = STAGGER_FRAC * MORPH_MS;
			const morphDur  = MORPH_MS - staggerMs;
			for (let i = 0; i < N; i++) {
				const orderIdx = folding ? i : (N - 1 - i);
				const startMs  = (orderIdx / (N - 1)) * staggerMs;
				const localT   = Math.max(0, Math.min(1, (elapsed - startMs) / morphDur));
				out[i] = folding ? easeOutElastic(localT) : easeInElastic(localT);
			}
			return out;
		}

		function frame(ts: number) {
			const dt = Math.min((ts - lastTs) / 1000, 0.05);
			lastTs = ts; frame_n++;
			if (!phaseStart) phaseStart = ts;

			const elapsed = ts - phaseStart;
			let globalAlpha = 0;

			if (phase === 0) {
				globalAlpha = 0;
				if (elapsed > HOLD_COIL_MS) { phase = 1; phaseStart = ts; }
			} else if (phase === 1) {
				const aa = getAtomAlphas(elapsed, true);
				for (let i = 0; i < N; i++) atomAlpha[i] = aa[i];
				globalAlpha = easeInOut3(Math.min(elapsed / MORPH_MS, 1));
				if (elapsed > MORPH_MS) { phase = 2; phaseStart = ts; flashTs = ts; atomAlpha.fill(1); }
			} else if (phase === 2) {
				globalAlpha = 1;
				if (elapsed > HOLD_HELIX_MS) { phase = 3; phaseStart = ts; }
			} else {
				const aa = getAtomAlphas(elapsed, false);
				for (let i = 0; i < N; i++) atomAlpha[i] = 1 - aa[i];
				globalAlpha = 1 - easeInOut3(Math.min(elapsed / MORPH_MS, 1));
				if (elapsed > MORPH_MS) { phase = 0; phaseStart = ts; atomAlpha.fill(0); }
			}

			const flashBump = (ts - flashTs) < 500
				? Math.sin(((ts - flashTs) / 500) * Math.PI) * 3.0
				: 0;
			const breathe = phase === 2 ? 0.5 + 0.5 * Math.sin(ts * 0.0016) : 0;

			if (phase === 0) {
				for (let i = 0; i < N; i++) {
					const j = 0.12;
					curPts[i].x = coilPts[i].x + Math.sin(ts * 0.00085 * (i + 1) + i * 0.9) * j;
					curPts[i].y = coilPts[i].y + Math.sin(ts * 0.00110 * (i + 1.4) + i * 0.6) * j;
					curPts[i].z = coilPts[i].z + Math.sin(ts * 0.00095 * (i + 0.6) + i * 1.1) * j;
					spheres[i].position.copy(curPts[i]);
				}
			}

			const targetDist = 52 - globalAlpha * 16;
			camDist += (targetDist - camDist) * Math.min(dt * 2.5, 1);
			cameraAngle += dt * (0.15 + globalAlpha * 0.09);
			camera.position.set(
				Math.sin(cameraAngle) * camDist,
				Math.sin(cameraAngle * 0.32) * (1 - globalAlpha) * 7,
				Math.cos(cameraAngle) * camDist
			);
			camera.lookAt(0, 0, 0);

			for (let i = 0; i < N; i++) {
				const rawA   = atomAlpha[i];
				const clampA = Math.max(0, Math.min(1, rawA));
				if (phase === 1 || phase === 3) {
					curPts[i].lerpVectors(coilPts[i], helixPts[i], rawA);
					spheres[i].position.copy(curPts[i]);
				} else if (phase === 2) {
					curPts[i].copy(helixPts[i]);
					spheres[i].position.copy(helixPts[i]);
				}
				const baseR  = 0.72 + clampA * 0.22;
				const squash = 1 - 0.22 * Math.sin(clampA * Math.PI);
				spheres[i].scale.setScalar(baseR * squash);
				mats[i].emissiveIntensity = 0.06 + clampA * clampA * 1.8 + breathe * 0.45 + flashBump * clampA;
			}

			if (frame_n % 2 === 0) {
				rebuildTube(0.04 + globalAlpha * 0.55 + breathe * 0.3 + flashBump * 0.4 * globalAlpha);
			}

			const lm = 1 + flashBump * 0.5 + breathe * 0.25;
			ptA.intensity = (200 + globalAlpha * 130) * lm;
			ptB.intensity = (200 + globalAlpha * 130) * lm;
			ptW.intensity = (60  + globalAlpha * 60)  * lm;

			renderer.render(scene, camera);
			animId = requestAnimationFrame(frame);
		}

		rebuildTube(0.04);
		animId = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(animId);
			renderer.dispose();
			sphereGeo.dispose();
			mats.forEach(m => m.dispose());
			tubeGeos.forEach(g => g.dispose());
			tubeMats.forEach(m => m.dispose());
		};
	}

	onMount(() => { cleanup = startAnimation(); });
	onDestroy(() => cleanup?.());
</script>

<div class="wrap">
	<canvas bind:this={canvas} class="canvas"></canvas>
	<p class="label">
		<span class="dot"></span>
		{label}
	</p>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 0;
	}

	.canvas {
		width: 480px;
		height: 300px;
		max-width: 100%;
		display: block;
	}

	.label {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-muted);
		margin: -0.25rem 0 0;
		letter-spacing: 0.02em;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; transform: scale(0.85); }
		50%       { opacity: 1;   transform: scale(1.15); }
	}
</style>
