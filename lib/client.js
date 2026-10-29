window.__ModuleLoader__.load({
	id: "@local/birds-screensaver",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		try {
			const name = "birds-screensaver";
			const inject = [];
			const DEFAULT_IDLE_MS = 3 * 60 * 1000;
			const PW_KEY = "dsh-lock-password";
			const DEFAULT_PASSWORD = "1234";

			/** 宿主半通过 /plugins/birds-screensaver/config 下发的配置。 */
			let remoteConfig = { defaultPassword: DEFAULT_PASSWORD, idleMs: DEFAULT_IDLE_MS };

			const FLOCKS = [
				{ hue: 196, sat: 86, lig: 64 },   // 冰蓝
				{ hue: 30, sat: 93, lig: 60 },    // 琥珀
				{ hue: 274, sat: 80, lig: 68 }    // 紫罗兰
			];

			function readIdleMs() {
				try {
					const v = Number(window.localStorage.getItem("dsh-birds-idle-ms"));
					if (Number.isFinite(v) && v >= 10000) return v;
				} catch (e) {}
				const remote = Number(remoteConfig.idleMs);
				if (Number.isFinite(remote) && remote >= 10000) return remote;
				return DEFAULT_IDLE_MS;
			}

			/** 当前生效密码：已保存的自定义密码，否则宿主配置的默认密码（兜底 1234）。 */
			function getPassword() {
				try {
					const saved = window.localStorage.getItem(PW_KEY);
					if (saved && saved.length > 0) return saved;
				} catch (e) {}
				return remoteConfig.defaultPassword || DEFAULT_PASSWORD;
			}

			/** 是否没改过密码（用着配置里的默认密码）。 */
			function isDefaultPassword() {
				try {
					const saved = window.localStorage.getItem(PW_KEY);
					return !(saved && saved.length > 0);
				} catch (e) {
					return true;
				}
			}

			/* ---------------- boids 引擎 ---------------- */
			function createBoids(canvas, opts) {
				opts = opts || {};
				const g = canvas.getContext("2d");
				const dpr = Math.min(window.devicePixelRatio || 1, 2);
				let w = 0, h = 0;
				let raf = 0;
				let last = 0;
				let running = true;
				const mouse = { x: -1e4, y: -1e4 };

				const N = 420;
				const HAWK_COUNT = 2;
				const birds = [];
				const hawks = [];
				const rand = (a, b) => a + Math.random() * (b - a);

				function resize() {
					w = window.innerWidth;
					h = window.innerHeight;
					canvas.width = Math.max(1, Math.floor(w * dpr));
					canvas.height = Math.max(1, Math.floor(h * dpr));
					g.setTransform(dpr, 0, 0, dpr, 0, 0);
					g.fillStyle = "#05070d";
					g.fillRect(0, 0, w, h);
				}
				resize();
				window.addEventListener("resize", resize);

				for (let i = 0; i < N; i++) {
					const f = i % FLOCKS.length;
					const pal = FLOCKS[f];
					birds.push({
						x: rand(0, w), y: rand(0, h),
						vx: rand(-1.2, 1.2), vy: rand(-1.2, 1.2),
						z: Math.random(),
						flock: f,
						hue: (pal.hue + rand(-9, 9) + 360) % 360,
						sat: pal.sat, lig: pal.lig,
						size: rand(1.5, 3.0)
					});
				}
				for (let i = 0; i < HAWK_COUNT; i++) {
					hawks.push({
						x: rand(0, w), y: rand(0, h),
						vx: rand(-2, 2), vy: rand(-2, 2),
						size: rand(3.2, 4.2)
					});
				}

				const PERCEPTION = 64, SEPARATION = 28, MAX_SPEED = 2.6, MAX_FORCE = 0.07;
				const HAWK_SPEED = 3.7, HAWK_FORCE = 0.085, HAWK_HUNT = 420, HAWK_FLEE = 190;

				function limit(x, y, max) {
					const m = Math.hypot(x, y);
					if (m > max && m > 0) return [x / m * max, y / m * max];
					return [x, y];
				}

				function drawBird(b) {
					const ang = Math.atan2(b.vy, b.vx);
					const s = b.size * (0.55 + 0.9 * b.z);
					const alpha = 0.3 + 0.62 * b.z;
					g.save();
					g.translate(b.x, b.y);
					g.rotate(ang);
					g.fillStyle = `hsla(${b.hue},${b.sat}%,${b.lig}%,${alpha})`;
					g.beginPath();
					g.moveTo(s * 2.1, 0);
					g.lineTo(-s, s * 0.85);
					g.lineTo(-s * 0.55, 0);
					g.lineTo(-s, -s * 0.85);
					g.closePath();
					g.fill();
					g.restore();
				}

				function drawHawk(hk) {
					const ang = Math.atan2(hk.vy, hk.vx);
					const s = hk.size;
					g.save();
					g.translate(hk.x, hk.y);
					g.rotate(ang);
					g.shadowColor = "hsla(0,95%,60%,0.85)";
					g.shadowBlur = 14;
					g.fillStyle = "hsla(0,95%,58%,0.95)";
					g.beginPath();
					g.moveTo(s * 3.2, 0);
					g.lineTo(-s * 1.4, s * 1.25);
					g.lineTo(-s * 0.5, 0);
					g.lineTo(-s * 1.4, -s * 1.25);
					g.closePath();
					g.fill();
					g.restore();
				}

				function step(now) {
					if (!running) return;
					const dt = Math.min(48, now - last || 16);
					last = now;
					const k = dt / 16.67;

					g.fillStyle = "rgba(5,7,13,0.26)";
					g.fillRect(0, 0, w, h);

					for (let i = 0; i < N; i++) {
						const b = birds[i];
						let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0;
						let nSep = 0, nAli = 0, nCoh = 0;

						for (let j = 0; j < N; j++) {
							if (j === i) continue;
							const o = birds[j];
							const dx = o.x - b.x, dy = o.y - b.y;
							const d2 = dx * dx + dy * dy;
							if (d2 > PERCEPTION * PERCEPTION || d2 < 0.0001) continue;
							if (d2 < SEPARATION * SEPARATION) { nSep++; sepX -= dx / d2; sepY -= dy / d2; }
							if (o.flock === b.flock) { nAli++; aliX += o.vx; aliY += o.vy; nCoh++; cohX += dx; cohY += dy; }
						}

						let ax = 0, ay = 0;
						if (nSep > 0) { const [x, y] = limit(sepX, sepY, MAX_FORCE * 2.2); ax += x; ay += y; }
						if (nAli > 0) { const [x, y] = limit(aliX / nAli - b.vx, aliY / nAli - b.vy, MAX_FORCE); ax += x; ay += y; }
						if (nCoh > 0) { const [x, y] = limit(cohX / nCoh * 0.02 - b.vx, cohY / nCoh * 0.02 - b.vy, MAX_FORCE * 0.9); ax += x; ay += y; }

						for (const hk of hawks) {
							const hdx = b.x - hk.x, hdy = b.y - hk.y;
							const hd2 = hdx * hdx + hdy * hdy;
							if (hd2 < HAWK_FLEE * HAWK_FLEE && hd2 > 1) {
								const inv = 1 / Math.sqrt(hd2);
								const strength = MAX_FORCE * 6.0 * (1 - Math.sqrt(hd2) / HAWK_FLEE);
								ax += hdx * inv * strength;
								ay += hdy * inv * strength;
							}
						}

						const mdx = b.x - mouse.x, mdy = b.y - mouse.y;
						const md2 = mdx * mdx + mdy * mdy;
						if (md2 < 150 * 150 && md2 > 1) {
							const inv = 1 / Math.sqrt(md2);
							ax += mdx * inv * MAX_FORCE * 3.0;
							ay += mdy * inv * MAX_FORCE * 3.0;
						}

						ax += (Math.random() - 0.5) * MAX_FORCE * 0.5;
						ay += (Math.random() - 0.5) * MAX_FORCE * 0.5;

						b.vx += ax * k; b.vy += ay * k;
						const [vx, vy] = limit(b.vx, b.vy, MAX_SPEED * (0.7 + 0.6 * b.z));
						b.vx = vx; b.vy = vy;
						b.x += b.vx * k; b.y += b.vy * k;

						if (b.x < -12) b.x = w + 12; else if (b.x > w + 12) b.x = -12;
						if (b.y < -12) b.y = h + 12; else if (b.y > h + 12) b.y = -12;
					}

					for (const hk of hawks) {
						let target = null, best = HAWK_HUNT * HAWK_HUNT;
						for (let i = 0; i < N; i += 3) {
							const b = birds[i];
							const dx = b.x - hk.x, dy = b.y - hk.y;
							const d2 = dx * dx + dy * dy;
							if (d2 < best) { best = d2; target = b; }
						}
						let ax = 0, ay = 0;
						if (target) {
							const dx = target.x - hk.x, dy = target.y - hk.y;
							const d = Math.hypot(dx, dy) || 1;
							const [sx, sy] = limit(dx / d * HAWK_SPEED - hk.vx, dy / d * HAWK_SPEED - hk.vy, HAWK_FORCE);
							ax += sx; ay += sy;
						} else {
							ax += (Math.random() - 0.5) * HAWK_FORCE * 1.2;
							ay += (Math.random() - 0.5) * HAWK_FORCE * 1.2;
						}
						hk.vx += ax * k; hk.vy += ay * k;
						const [hvx, hvy] = limit(hk.vx, hk.vy, HAWK_SPEED);
						hk.vx = hvx; hk.vy = hvy;
						hk.x += hk.vx * k; hk.y += hk.vy * k;

						if (hk.x < -20) hk.x = w + 20; else if (hk.x > w + 20) hk.x = -20;
						if (hk.y < -20) hk.y = h + 20; else if (hk.y > h + 20) hk.y = -20;
					}

					for (let i = 0; i < N; i++) drawBird(birds[i]);
					for (const hk of hawks) drawHawk(hk);

					g.save();
					g.font = "11px 'Segoe UI', system-ui, sans-serif";
					g.fillStyle = "rgba(255,255,255,0.22)";
					g.textAlign = "left";
					g.fillText("DEEPSEEK HARNESS", 26, 32);
					g.restore();

					if (opts.hint !== false) {
						g.save();
						g.font = "13px system-ui, 'Segoe UI', sans-serif";
						g.fillStyle = "rgba(255,255,255,0.30)";
						g.textAlign = "center";
						g.fillText("按任意键 / 移动鼠标退出   ·   Ctrl+Shift+L 锁定", w / 2, h - 26);
						g.restore();
					}

					raf = requestAnimationFrame(step);
				}

				last = performance.now();
				raf = requestAnimationFrame(step);

				const onMouse = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
				window.addEventListener("mousemove", onMouse, true);

				return function dispose() {
					running = false;
					cancelAnimationFrame(raf);
					window.removeEventListener("resize", resize);
					window.removeEventListener("mousemove", onMouse, true);
				};
			}

			/* ---------------- 锁屏 ---------------- */
			const STYLE_ID = "dsh-birds-lock-style";
			function ensureStyle() {
				if (document.getElementById(STYLE_ID)) return;
				const st = document.createElement("style");
				st.id = STYLE_ID;
				st.textContent = `
.dsh-birds-root{position:fixed;inset:0;z-index:2147483647;background:#05070d;overflow:hidden}
.dsh-birds-canvas{position:absolute;inset:0;width:100vw;height:100vh;display:block}
.dsh-birds-panel{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#e8eef5;font-family:system-ui,'Segoe UI',sans-serif}
.dsh-birds-icon{font-size:36px;opacity:.9;filter:drop-shadow(0 0 18px rgba(120,200,255,.5))}
.dsh-birds-title{font-size:15px;letter-spacing:2px;color:rgba(255,255,255,.75)}
.dsh-birds-sub{font-size:12.5px;color:rgba(255,255,255,.38)}
.dsh-birds-input{width:220px;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-size:13px;outline:none;text-align:center}
.dsh-birds-input:focus{border-color:rgba(120,200,255,.55);box-shadow:0 0 0 3px rgba(120,200,255,.12)}
.dsh-birds-btn{padding:8px 22px;border-radius:8px;border:1px solid rgba(120,200,255,.35);background:rgba(120,200,255,.12);color:#cfe6ff;font-size:13px;cursor:pointer}
.dsh-birds-btn:hover{background:rgba(120,200,255,.2)}
.dsh-birds-ghost{border-color:rgba(255,255,255,.18);background:transparent;color:rgba(255,255,255,.55)}
.dsh-birds-err{font-size:12px;color:#ff7b7b;min-height:16px}
.dsh-birds-ok{font-size:12px;color:#7bffb0;min-height:16px}
.dsh-birds-foot{position:absolute;bottom:24px;left:0;right:0;text-align:center;font-size:12px;color:rgba(255,255,255,.25)}
.dsh-birds-link{color:rgba(120,200,255,.55);cursor:pointer;text-decoration:underline}
.dsh-birds-shake{animation:dshShake .35s}
@keyframes dshShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.dsh-birds-modal{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)}
.dsh-birds-modal.open{display:flex}
.dsh-birds-box{display:flex;flex-direction:column;gap:10px;padding:22px;border-radius:12px;background:#0d1420;border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 50px rgba(0,0,0,.6);min-width:280px}
.dsh-birds-boxtitle{font-size:14px;color:rgba(255,255,255,.8);text-align:center;letter-spacing:1px}
.dsh-birds-row{display:flex;gap:10px;justify-content:center}
`;
				document.head.appendChild(st);
			}

			function apply(ctx) {
				if (typeof window === "undefined" || typeof document === "undefined") return;

				// 拉取宿主配置（默认密码 / 空闲时间）。拿不到就用内置兜底。
				try {
					fetch("/plugins/birds-screensaver/config", { cache: "no-store" })
						.then((r) => (r.ok ? r.json() : null))
						.then((c) => {
							if (c && typeof c === "object") remoteConfig = Object.assign(remoteConfig, c);
						})
						.catch(() => {});
				} catch (e) {}

				ctx.effect(() => {
					let lastActivity = Date.now();
					let root = null;
					let idleTimer = 0;
					let disposeBoids = null;

					// 可见入口：右下角小锁按钮（同时用于确认插件是否加载成功）
					const trigger = document.createElement("button");
					trigger.type = "button";
					trigger.textContent = "🔒";
					trigger.title = "锁定屏幕（Ctrl+Shift+L）";
					Object.assign(trigger.style, {
						position: "fixed",
						right: "18px",
						bottom: "18px",
						width: "36px",
						height: "36px",
						borderRadius: "50%",
						border: "1px solid rgba(255,255,255,0.14)",
						background: "rgba(255,255,255,0.06)",
						color: "#cfe6ff",
						fontSize: "15px",
						lineHeight: "34px",
						textAlign: "center",
						padding: "0",
						cursor: "pointer",
						zIndex: "2147483000",
						opacity: "0.35",
						transition: "opacity .2s",
					});
					trigger.addEventListener("mouseenter", () => { trigger.style.opacity = "1"; });
					trigger.addEventListener("mouseleave", () => { trigger.style.opacity = "0.35"; });
					trigger.addEventListener("click", () => { if (!root) lock(); });
					document.body.appendChild(trigger);

					const mark = () => { if (!root) lastActivity = Date.now(); };
					const activityEvents = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"];
					for (const t of activityEvents) window.addEventListener(t, mark, { passive: true, capture: true });

					function lock() {
						if (root) return;
						ensureStyle();

						const el = document.createElement("div");
						el.className = "dsh-birds-root";
						el.innerHTML = `
<canvas class="dsh-birds-canvas"></canvas>
<div class="dsh-birds-panel">
  <div class="dsh-birds-icon">🔒</div>
  <div class="dsh-birds-title">DeepSeek Harness 已锁定</div>
  <div class="dsh-birds-sub" data-sub></div>
  <input class="dsh-birds-input" type="password" placeholder="输入密码" autocomplete="off" />
  <button class="dsh-birds-btn" type="button" data-unlock>解锁</button>
  <div class="dsh-birds-err" data-err></div>
</div>
<div class="dsh-birds-foot">
  <span>Ctrl+Shift+L 锁定</span> · <span class="dsh-birds-link" data-setpw>修改密码</span>
</div>
<div class="dsh-birds-modal" data-pwmodal>
  <div class="dsh-birds-box">
    <div class="dsh-birds-boxtitle">修改密码</div>
    <input class="dsh-birds-input" type="password" data-cur placeholder="当前密码" autocomplete="off" />
    <input class="dsh-birds-input" type="password" data-new placeholder="新密码（至少 4 位）" autocomplete="off" />
    <input class="dsh-birds-input" type="password" data-confirm placeholder="确认新密码" autocomplete="off" />
    <div class="dsh-birds-err" data-pwerr></div>
    <div class="dsh-birds-row">
      <button class="dsh-birds-btn" type="button" data-pwsave>保存</button>
      <button class="dsh-birds-btn dsh-birds-ghost" type="button" data-pwcancel>取消</button>
    </div>
  </div>
</div>`;
						document.body.appendChild(el);
						root = el;
						document.documentElement.style.overflow = "hidden";

						const canvas = el.querySelector(".dsh-birds-canvas");
						const input = el.querySelector(".dsh-birds-input");
						const unlockBtn = el.querySelector("[data-unlock]");
						const sub = el.querySelector("[data-sub]");
						const err = el.querySelector("[data-err]");
						const setpw = el.querySelector("[data-setpw]");
						const modal = el.querySelector("[data-pwmodal]");
						const pwErr = el.querySelector("[data-pwerr]");
						const curIn = el.querySelector("[data-cur]");
						const newIn = el.querySelector("[data-new]");
						const confIn = el.querySelector("[data-confirm]");

						disposeBoids = createBoids(canvas, { hint: false });

						function refreshMode() {
							sub.textContent =
								isDefaultPassword() && remoteConfig.defaultPassword === DEFAULT_PASSWORD
									? "输入密码解锁（默认为 1234，可修改）"
									: "输入密码解锁";
							setTimeout(() => input.focus(), 50);
						}
						refreshMode();

						function tryUnlock() {
							if (input.value === getPassword()) {
								unlock();
							} else {
								err.textContent = "密码错误";
								el.classList.remove("dsh-birds-shake");
								void el.offsetWidth;
								el.classList.add("dsh-birds-shake");
								input.value = "";
								input.focus();
							}
						}

						unlockBtn.addEventListener("click", tryUnlock);
						input.addEventListener("keydown", (e) => {
							e.stopPropagation();
							if (e.key === "Enter") tryUnlock();
						});

						/* ---- 修改密码弹窗 ---- */
						function openModal() {
							modal.classList.add("open");
							curIn.value = ""; newIn.value = ""; confIn.value = "";
							pwErr.textContent = "";
							setTimeout(() => curIn.focus(), 50);
						}
						function closeModal() {
							modal.classList.remove("open");
							setTimeout(() => input.focus(), 50);
						}
						function savePassword() {
							if (curIn.value !== getPassword()) { pwErr.textContent = "当前密码错误"; curIn.value = ""; curIn.focus(); return; }
							const nw = newIn.value;
							if (nw.length < 4) { pwErr.textContent = "新密码至少 4 位"; newIn.focus(); return; }
							if (nw !== confIn.value) { pwErr.textContent = "两次输入的新密码不一致"; confIn.value = ""; confIn.focus(); return; }
							try { localStorage.setItem(PW_KEY, nw); } catch (e) {}
							closeModal();
							err.textContent = "密码已更新";
							err.className = "dsh-birds-ok";
							setTimeout(() => { err.textContent = ""; err.className = "dsh-birds-err"; }, 2500);
						}

						setpw.addEventListener("click", openModal);
						el.querySelector("[data-pwsave]").addEventListener("click", savePassword);
						el.querySelector("[data-pwcancel]").addEventListener("click", closeModal);
						[curIn, newIn, confIn].forEach((inp) => {
							inp.addEventListener("keydown", (e) => {
								e.stopPropagation();
								if (e.key === "Enter") savePassword();
								if (e.key === "Escape") closeModal();
							});
						});

						const onAnyKey = (e) => {
							if (modal.classList.contains("open")) return;
							if (e.target === input || e.target === unlockBtn) return;
							e.preventDefault();
							e.stopPropagation();
							input.focus();
						};
						window.addEventListener("keydown", onAnyKey, true);

						el.__dshDispose = () => {
							window.removeEventListener("keydown", onAnyKey, true);
						};
					}

					function unlock() {
						if (!root) return;
						if (root.__dshDispose) root.__dshDispose();
						if (disposeBoids) { disposeBoids(); disposeBoids = null; }
						root.remove();
						root = null;
						document.documentElement.style.overflow = "";
						lastActivity = Date.now();
					}

					const onHotkey = (e) => {
						const altChord = e.ctrlKey && e.altKey && (e.key === "L" || e.key === "l");
						const shiftChord = e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l");
						if (altChord || shiftChord) {
							e.preventDefault();
							if (!root) lock();
						}
					};
					window.addEventListener("keydown", onHotkey, true);

					idleTimer = window.setInterval(() => {
						if (root) return;
						if (document.hidden) return;
						if (Date.now() - lastActivity >= readIdleMs()) lock();
					}, 1000);

					return () => {
						window.clearInterval(idleTimer);
						window.removeEventListener("keydown", onHotkey, true);
						for (const t of activityEvents) window.removeEventListener(t, mark, { capture: true });
						if (trigger && trigger.parentNode) trigger.remove();
						if (root) unlock();
					};
				}, "birds-screensaver");
			}

			exports.apply = apply;
			exports.inject = inject;
			exports.name = name;
		} catch (err) {
			try { console.error("[birds-screensaver]", err); } catch (e) {}
			exports.apply = function () {};
			exports.inject = [];
			exports.name = "birds-screensaver";
		}

		return module.exports;
	}
});
