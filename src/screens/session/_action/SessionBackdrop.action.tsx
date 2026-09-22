"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

export function SessionBackdropAction() {
  const reduced = useReducedMotion();
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, { stiffness: 35, damping: 22 });
  const y = useSpring(targetY, { stiffness: 35, damping: 22 });
  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (event: PointerEvent) => {
      targetX.set((event.clientX / window.innerWidth - 0.5) * 24);
      targetY.set((event.clientY / window.innerHeight - 0.5) * 18);
    };
    const reset = () => {
      targetX.set(0);
      targetY.set(0);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", reset);
      document.documentElement.removeEventListener("pointerleave", reset);
    };
  }, [reduced, targetX, targetY]);
  return (
    <div className="login-backdrop" aria-hidden="true">
      <motion.svg
        viewBox="0 0 800 800"
        style={{ x: reduced ? 0 : x, y: reduced ? 0 : y }}
        fill="none"
      >
        <g className="draft-rings">
          <circle cx="400" cy="400" r="304" />
          <circle cx="400" cy="400" r="288" strokeDasharray="2 8" />
          <path d="M96 400h608M400 96v608" strokeDasharray="3 9" />
          {Array.from({ length: 100 }, (_, i) => (
            <path
              key={i}
              d={`M400 80v${i % 5 === 0 ? 13 : 5}`}
              transform={`rotate(${i * 3.6} 400 400)`}
            />
          ))}
        </g>
        <g className="draft-page">
          <path d="M262 198h248l44 44v365H262z" />
          <path d="M510 198v44h44M282 216h115M282 254h248M282 559h248" />
          <text x="284" y="243">
            TEACHBAY / WORKSHEET
          </text>
          {[296, 378, 468].map((top, i) => (
            <g key={top}>
              <text x="282" y={top + 7}>
                0{i + 1}
              </text>
              <path d={`M315 ${top}h198m-198 12h182m-182 12h130`} />
              <rect
                x="315"
                y={top + 36}
                width={i === 1 ? 145 : 198}
                height={i === 1 ? 32 : 17}
                strokeDasharray={i === 1 ? undefined : "3 4"}
              />
            </g>
          ))}
          <text x="282" y="581">
            COLLECT · SELECT · PRINT
          </text>
        </g>
        <g className="draft-guides">
          <path d="M234 198v409m-6-409h12m-12 409h12M262 635h292m-292-6v12m292-12v12M120 316h91l28-28M557 490h83l34 34M483 173l42-45h109" />
          <circle cx="674" cy="524" r="5" />
          <circle cx="634" cy="128" r="5" />
          <circle cx="173" cy="578" r="37" />
          <path d="M151 578h44m-22-22v44" />
          <text x="113" y="306">
            SOURCE
          </text>
          <text x="562" y="482">
            OUTPUT
          </text>
          <text x="369" y="653">
            210 × 297
          </text>
        </g>
        <circle
          className="draft-orbit"
          cx="400"
          cy="400"
          r="330"
          strokeDasharray="110 1964"
        />
      </motion.svg>
    </div>
  );
}
