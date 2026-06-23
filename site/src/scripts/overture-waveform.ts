const loadWaveform = async (canvas: HTMLCanvasElement) => {
  const { initOvertureWaveform } = await import("./overture-waveform-scene");
  initOvertureWaveform(canvas);
};

document.querySelectorAll<HTMLCanvasElement>("[data-overture-waveform]").forEach((canvas) => {
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
