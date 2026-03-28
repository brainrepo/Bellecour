import { useEffect, useRef } from "react";

const BAR_COUNT = 24;
const BAR_WIDTH = 2;
const BAR_GAP = 1.5;
const MIN_HEIGHT = 2;
const CANVAS_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
const CANVAS_HEIGHT = 28;

interface WaveformProps {
  analyser: AnalyserNode | null;
}

function Waveform({ analyser }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d")!;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      analyser!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const centerY = CANVAS_HEIGHT / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Map bar index to frequency bin (skip the very lowest bins)
        const binIndex = Math.min(i + 1, dataArray.length - 1);
        const value = dataArray[binIndex] / 255;

        const barHeight = Math.max(MIN_HEIGHT, value * (CANVAS_HEIGHT - 4));
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = centerY - barHeight / 2;

        // Gradient from indigo to white based on amplitude
        const r = 99 + Math.round(value * 80);
        const g = 102 + Math.round(value * 80);
        const b = 241;
        const alpha = 0.5 + value * 0.5;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1);
        ctx.fill();
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="waveform-canvas"
    />
  );
}

export default Waveform;
