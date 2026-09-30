// 글 속 canvas 데모의 공통 런타임
// 캔버스 크기와 DPR, 테마 색, 화면 진입 시 자동 재생, "결과 보기 / 다시 재생" 버튼을 맡는다

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOutBack = (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

export function formatMs(v: number) {
	if (v >= 1000) return `${Math.round(v).toLocaleString('en-US')}ms`;
	return Number.isInteger(v) || v >= 100 ? `${Math.round(v)}ms` : `${v.toFixed(1)}ms`;
}

export function seeded(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type Colors = {
	text: string;
	muted: string;
	faint: string;
	border: string;
	accent: string;
	bg: string;
	panel: string;
	blue: string;
};

export type Frame = {
	ctx: CanvasRenderingContext2D;
	W: number;
	H: number;
	colors: Colors;
	font: string;
	/** 자동 재생 타임라인의 경과 시간(ms) */
	time: number;
	/** performance.now(), 토글 전환처럼 타임라인 밖의 애니메이션용 */
	now: number;
	done: boolean;
};

/** 재생이 끝난 뒤 버튼으로 켜고 끄는 전환. 모션 줄이기 설정이면 즉시 끝난다 */
export class Tween {
	private from = 0;
	private to = 0;
	private at = -Infinity;

	constructor(private readonly dur: number) {}

	value(now: number) {
		return lerp(this.from, this.to, easeInOut(clamp((now - this.at) / this.dur)));
	}

	get target() {
		return this.to;
	}

	set(to: number, now: number, instant: boolean) {
		this.from = instant ? to : this.value(now);
		this.to = to;
		this.at = instant ? -Infinity : now;
	}

	reset() {
		this.from = 0;
		this.to = 0;
		this.at = -Infinity;
	}

	active(now: number) {
		return now - this.at < this.dur;
	}
}

export function setText(el: Element | null, text: string) {
	if (el && el.textContent !== text) el.textContent = text;
}

type Options = {
	duration: number;
	draw: (f: Frame) => void;
	/** 타임라인이 끝난 뒤에도 프레임을 계속 요청해야 하는지 */
	animating?: (now: number) => boolean;
	onReplay?: () => void;
};

export function mountDemo(root: HTMLElement, opts: Options) {
	const canvas = root.querySelector('canvas')!;
	const ctx = canvas.getContext('2d')!;
	const playBtn = root.querySelector<HTMLButtonElement>('[data-play]');
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let colors = {} as Colors;
	let font = 'sans-serif';
	let W = 0;
	let H = 0;
	let time = 0;
	let playStart = 0;
	let playing = false;
	let started = false;
	let raf = 0;

	function readColors() {
		const cs = getComputedStyle(root);
		const v = (name: string) => cs.getPropertyValue(name).trim();
		colors = {
			text: v('--text'),
			muted: v('--muted'),
			faint: v('--faint'),
			border: v('--border'),
			accent: v('--accent'),
			bg: v('--bg'),
			panel: v('--panel'),
			blue: v('--chart-blue'),
		};
		font = cs.fontFamily;
	}

	function resize() {
		const dpr = window.devicePixelRatio || 1;
		W = canvas.clientWidth;
		H = canvas.clientHeight;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function render(now = performance.now()) {
		if (!W || !H) return;
		ctx.clearRect(0, 0, W, H);
		ctx.textBaseline = 'middle';
		opts.draw({ ctx, W, H, colors, font, time, now, done: time >= opts.duration });
	}

	function updateButton() {
		setText(playBtn, playing || !started ? '결과 보기' : '다시 재생');
	}

	function loop(now: number) {
		if (playing) {
			time = Math.min(now - playStart, opts.duration);
			if (time >= opts.duration) {
				playing = false;
				updateButton();
			}
		}
		render(now);
		raf = playing || opts.animating?.(now) ? requestAnimationFrame(loop) : 0;
	}

	function kick() {
		if (!raf) raf = requestAnimationFrame(loop);
	}

	function play() {
		started = true;
		opts.onReplay?.();
		if (reduceMotion) {
			time = opts.duration;
			updateButton();
			render();
			return;
		}
		playing = true;
		playStart = performance.now();
		updateButton();
		kick();
	}

	function skip() {
		started = true;
		playing = false;
		time = opts.duration;
		updateButton();
		render();
	}

	readColors();
	resize();
	render();

	new ResizeObserver(() => {
		resize();
		render();
	}).observe(canvas);

	new MutationObserver(() => {
		readColors();
		render();
	}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	const io = new IntersectionObserver(
		(entries) => {
			if (started || !entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4)) return;
			io.disconnect();
			play();
		},
		{ threshold: 0.4 },
	);
	io.observe(root);

	playBtn?.addEventListener('click', () => {
		io.disconnect();
		if (playing || !started) skip();
		else play();
	});

	return { render, kick, reduceMotion };
}
