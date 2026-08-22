export function createHUD() {
  const hud = document.getElementById("hud");
  const oxygenEl = document.getElementById("oxygen");
  const fillEl = oxygenEl.querySelector(".fill");
  const timeEl = oxygenEl.querySelector(".time");
  const objectiveEl = document.querySelector("#objective .text");
  const cellEls = [...document.querySelectorAll("#objective .cell")];
  const subtitleEl = document.getElementById("subtitle");
  const screenEl = document.getElementById("screen");
  const muteEl = document.getElementById("mute");

  let subtitleTimer = 0;

  return {
    show() {
      hud.classList.remove("hidden");
    },

    /** Кнопка звука: состояние приходит из аудиодвижка, HUD его только рисует. */
    bindMute(audio) {
      const paint = () => muteEl.classList.toggle("off", audio.muted);
      paint();
      muteEl.addEventListener("click", () => {
        audio.toggleMute();
        paint();
      });
    },

    setOxygen(seconds, total) {
      const clamped = Math.max(0, seconds);
      fillEl.style.width = `${(clamped / total) * 100}%`;
      const m = Math.floor(clamped / 60);
      const s = Math.floor(clamped % 60);
      timeEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      oxygenEl.classList.toggle("low", clamped < 60);
    },

    setObjective(text) {
      objectiveEl.textContent = text;
    },

    setCells(count) {
      cellEls.forEach((el, i) => el.classList.toggle("filled", i < count));
    },

    /** Реплики ИИ станции. Новая реплика перебивает старую. */
    say(text, seconds = 4.5) {
      subtitleEl.innerHTML = text;
      subtitleEl.classList.add("show");
      subtitleTimer = seconds;
    },

    tick(dt) {
      if (subtitleTimer > 0) {
        subtitleTimer -= dt;
        if (subtitleTimer <= 0) subtitleEl.classList.remove("show");
      }
    },

    hideScreen() {
      screenEl.classList.add("gone");
    },

    showScreen({ title, sub, body, button, variant = "" }) {
      screenEl.className = `screen ${variant}`;
      screenEl.querySelector(".inner").innerHTML = `
        <h1>${title}</h1>
        <p class="sub">${sub}</p>
        <p class="body">${body}</p>
        <button id="restart">${button}</button>
      `;
      return screenEl.querySelector("#restart");
    },
  };
}
