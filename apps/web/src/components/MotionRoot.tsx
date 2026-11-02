"use client";

// Toda animação do site passa por aqui: com "reduzir movimento" ligado no sistema,
// o Motion pula direto para o estado final (DESIGN.md, "Motion").

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
