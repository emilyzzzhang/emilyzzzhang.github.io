const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const bgMusic = document.getElementById("bg-music");
const musicToggle = document.getElementById("music-toggle");
if (bgMusic instanceof HTMLAudioElement) {
  bgMusic.volume = 0.55;
  const interactionEvents = ["pointerdown", "keydown", "touchstart"];

  const updateMusicToggle = () => {
    if (!(musicToggle instanceof HTMLButtonElement)) return;
    const isPlaying = !bgMusic.paused;
    musicToggle.textContent = isPlaying ? "Music: On" : "Music: Off";
    musicToggle.setAttribute("aria-pressed", String(isPlaying));
    musicToggle.setAttribute(
      "aria-label",
      isPlaying ? "Turn music off" : "Turn music on"
    );
  };

  const startMusic = () => {
    bgMusic
      .play()
      .then(() => {
        updateMusicToggle();
        interactionEvents.forEach((eventName) =>
          window.removeEventListener(eventName, startMusic)
        );
      })
      .catch(() => {
        updateMusicToggle();
      });
  };

  interactionEvents.forEach((eventName) =>
    window.addEventListener(eventName, startMusic, { once: true })
  );

  if (musicToggle instanceof HTMLButtonElement) {
    musicToggle.addEventListener("click", () => {
      if (bgMusic.paused) {
        startMusic();
        return;
      }

      bgMusic.pause();
      updateMusicToggle();
    });
  }

  bgMusic.addEventListener("pause", updateMusicToggle);
  bgMusic.addEventListener("play", updateMusicToggle);

  // Attempt immediate playback for browsers that allow it.
  startMusic();
  updateMusicToggle();
}

const revealEls = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

revealEls.forEach((el, index) => {
  el.style.transitionDelay = `${Math.min(index * 80, 500)}ms`;
  observer.observe(el);
});

const cursorGlow = document.querySelector(".cursor-glow");
if (cursorGlow && window.matchMedia("(pointer:fine)").matches) {
  window.addEventListener("pointermove", (event) => {
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
  });
}

const bgLayer = document.querySelector(".bg-gif");
if (bgLayer) {
  let ticking = false;

  const updateBgScrollJourney = () => {
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    bgLayer.style.setProperty("--bg-pos-y", `${progress * 100}%`);
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateBgScrollJourney);
        ticking = true;
      }
    },
    { passive: true }
  );

  window.addEventListener("resize", updateBgScrollJourney);
  updateBgScrollJourney();
}
