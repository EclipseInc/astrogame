/**
 * Звук собирается синтезом на Web Audio: ни одного файла в репозитории,
 * ни одной лицензии, мгновенная загрузка.
 *
 * Главная идея — физика. На Луне нет воздуха, поэтому снаружи не слышно
 * ничего. Всё, что слышит игрок, слышно ВНУТРИ скафандра: дыхание, глухой
 * удар подошвы через кость, шорох ткани, треск рации. Отсюда все шаги
 * задавлены фильтром низких частот, а тишина — часть звуковой картины.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const MUTE_KEY = "lastsignal.muted";

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let ready = false;

  let muted = localStorage.getItem(MUTE_KEY) === "1";

  // Дыхание
  let breathTimer = 0;
  let inhale = true;
  let urgency = 0; // 0 — спокойно, 1 — задыхается

  // Сердце: включается только когда кислорода мало
  let heartTimer = 0;

  function makeNoiseBuffer() {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Отфильтрованный всплеск шума — основа шагов, дыхания и рации. */
  function noise({
    dur = 0.2,
    freq = 800,
    q = 1,
    type = "bandpass",
    gain = 0.3,
    attack = 0.01,
    sweep = 0,
    delay = 0,
  }) {
    if (!ready || muted) return;

    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    if (sweep) filter.frequency.linearRampToValueAtTime(Math.max(40, freq + sweep), t + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter).connect(env).connect(master);
    // случайное смещение по буферу, чтобы одинаковые звуки не совпадали
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** Чистый тон с огибающей — сигналы, зуммеры, финальные аккорды. */
  function tone({
    freq = 440,
    to = null,
    dur = 0.3,
    gain = 0.2,
    type = "sine",
    attack = 0.008,
    delay = 0,
  }) {
    if (!ready || muted) return;

    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function breathe() {
    // Вдох выше и длиннее, выдох ниже и мягче — иначе читается как шум ветра
    const dur = inhale ? 0.9 : 1.05;
    noise({
      dur,
      freq: inhale ? 430 : 300,
      q: 0.85,
      gain: 0.05 + urgency * 0.055,
      attack: dur * 0.45,
      sweep: inhale ? 240 : -130,
    });
  }

  function heartbeat() {
    const g = 0.05 + urgency * 0.09;
    tone({ freq: 62, to: 40, dur: 0.16, gain: g, type: "sine" });
    tone({ freq: 55, to: 36, dur: 0.2, gain: g * 0.75, type: "sine", delay: 0.26 });
  }

  const api = {
    get muted() {
      return muted;
    },

    get ready() {
      return ready;
    },

    /** Вызывать из обработчика клика: без жеста браузер не даст звук. */
    init() {
      if (ready) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      noiseBuffer = makeNoiseBuffer();
      ready = true;

      if (ctx.state === "suspended") ctx.resume();
    },

    toggleMute() {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      if (master) {
        master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
      }
      return muted;
    },

    /** 0 — кислорода полно, 1 — на исходе. Управляет дыханием и пульсом. */
    setUrgency(v) {
      urgency = clamp(v, 0, 1);
    },

    // --- события игры ---

    step() {
      // Подошва слышна через кость, а не через воздух: только низ
      noise({ dur: 0.13, freq: 240, q: 0.7, type: "lowpass", gain: 0.13, attack: 0.004 });
      noise({ dur: 0.08, freq: 1400, q: 0.6, gain: 0.02, attack: 0.003 });
    },

    jump() {
      noise({ dur: 0.22, freq: 900, q: 0.5, type: "highpass", gain: 0.045, attack: 0.02 });
    },

    land(power = 1) {
      const p = clamp(power, 0.2, 1.8);
      noise({ dur: 0.2, freq: 150, q: 0.8, type: "lowpass", gain: 0.1 * p, attack: 0.004 });
      tone({ freq: 74, to: 42, dur: 0.18, gain: 0.07 * p, type: "sine" });
    },

    /** Треск несущей перед репликой станции. */
    radio() {
      noise({ dur: 0.11, freq: 1900, q: 3.5, gain: 0.07, attack: 0.006 });
      tone({ freq: 1250, dur: 0.05, gain: 0.035, type: "square", delay: 0.05 });
    },

    pickup() {
      tone({ freq: 620, to: 950, dur: 0.22, gain: 0.1, type: "triangle" });
      noise({ dur: 0.18, freq: 3200, q: 2, gain: 0.03, attack: 0.005, delay: 0.02 });
    },

    deposit() {
      tone({ freq: 130, to: 82, dur: 0.16, gain: 0.13, type: "square" });
      tone({ freq: 330, to: 495, dur: 0.5, gain: 0.06, type: "sine", delay: 0.1 });
    },

    canister() {
      noise({ dur: 0.3, freq: 2600, q: 1.2, gain: 0.05, attack: 0.01, sweep: -1600 });
      tone({ freq: 780, dur: 0.12, gain: 0.05, type: "sine" });
    },

    warning() {
      tone({ freq: 880, dur: 0.1, gain: 0.09, type: "square" });
      tone({ freq: 880, dur: 0.1, gain: 0.09, type: "square", delay: 0.17 });
    },

    win() {
      [440, 554, 659, 880].forEach((f, i) =>
        tone({ freq: f, dur: 0.9, gain: 0.07, type: "sine", delay: i * 0.16 })
      );
      api.radio();
    },

    fail() {
      [330, 262, 196, 147].forEach((f, i) =>
        tone({ freq: f, dur: 1.1, gain: 0.08, type: "sine", delay: i * 0.28 })
      );
    },

    /** Дыхание и пульс идут сами, их не надо дёргать событиями. */
    update(dt) {
      if (!ready || muted) return;

      breathTimer -= dt;
      if (breathTimer <= 0) {
        breathe();
        inhale = !inhale;
        breathTimer = (4.4 - urgency * 2.5) / 2;
      }

      if (urgency > 0.45) {
        heartTimer -= dt;
        if (heartTimer <= 0) {
          heartbeat();
          heartTimer = 1.25 - urgency * 0.5;
        }
      }
    },
  };

  return api;
}
