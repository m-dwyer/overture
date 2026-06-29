const loadWaveform = async (canvas: HTMLCanvasElement) => {
  try {
    const { initOvertureWaveform } = await import("./overture-waveform-scene");
    initOvertureWaveform(canvas);
  } catch {
    canvas.closest(".hero-display")?.classList.add("has-waveform-fallback");
  }
};

document
  .querySelectorAll<HTMLCanvasElement>("[data-overture-waveform]")
  .forEach((canvas) => {
    if (!("IntersectionObserver" in window)) {
      void loadWaveform(canvas);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        observer.disconnect();
        void loadWaveform(canvas);
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(canvas);
  });
