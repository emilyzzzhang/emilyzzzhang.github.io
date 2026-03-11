const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

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
