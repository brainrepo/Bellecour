import { useEffect, useRef } from "react";

const BAR_COUNT = 28;
const BAR_WIDTH = 2;
const BAR_GAP = 1.5;
const MIN_HEIGHT = 2;
const CANVAS_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
const CANVAS_HEIGHT = 32;

interface WaveformProps {
  analyser: AnalyserNode | null;
}

function Waveform({ analyser }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const prevRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));

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
        const binIndex = Math.min(i + 1, dataArray.length - 1);
        const raw = dataArray[binIndex] / 255;

        // Smooth with previous frame for organic feel
        const smoothed = prevRef.current[i] * 0.3 + raw * 0.7;
        prevRef.current[i] = smoothed;

        const barHeight = Math.max(MIN_HEIGHT, smoothed * (CANVAS_HEIGHT - 4));
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = centerY - barHeight / 2;

        // Soft rose glow — brighter bars at higher amplitude
        const alpha = 0.25 + smoothed * 0.65;
        ctx.fillStyle = `rgba(253, 164, 175, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
        ctx.fill();
      }
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
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
