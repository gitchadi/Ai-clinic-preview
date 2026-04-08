"use client";

import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

type BeforeAfterSliderProps = {
  original: string;
  generated: string;
};

export default function BeforeAfterSlider({
  original,
  generated,
}: BeforeAfterSliderProps) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-[0_30px_120px_rgba(4,47,77,0.35)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-6">
        <span className="rounded-full border border-white/20 bg-slate-950/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/90 backdrop-blur-xl">
          Before
        </span>
        <span className="rounded-full border border-cyan-300/40 bg-cyan-400/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-50 backdrop-blur-xl">
          After
        </span>
      </div>

      <ReactCompareSlider
        className="aspect-[4/5] w-full overflow-hidden rounded-[1.6rem]"
        handle={
          <button
            aria-label="Compare before and after"
            className="h-14 w-14 rounded-full border border-white/70 bg-white/90 shadow-xl backdrop-blur-md"
            type="button"
          />
        }
        itemOne={
          <ReactCompareSliderImage
            alt="Original clinic preview"
            src={original}
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            alt="Generated clinic preview"
            src={generated}
          />
        }
        defaultPosition={45}
      />
    </div>
  );
}
