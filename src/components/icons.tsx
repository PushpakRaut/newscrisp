import type { ReactNode } from "react";

type P = { size?: number; filled?: boolean };

const base = (size: number, strokeWidth = 1.9) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Heart = ({ size = 22, filled }: P) => (
  <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20.3s-7.8-4.6-9.3-9.6C1.6 7 3.9 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.3 0 5.6 3 4.5 6.7-1.5 5-9.3 9.6-9.3 9.6z" />
  </svg>
);
export const Share = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3v12" />
    <path d="M7.5 7.5L12 3l4.5 4.5" />
    <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
);
export const Ellipsis = ({ size = 22 }: P) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <circle cx="5.5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18.5" cy="12" r="1.7" />
  </svg>
);
export const Newspaper = ({ size = 24, filled }: P) => (
  <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
    <rect x="3" y="4" width="14" height="16" rx="2.5" />
    <path d="M17 8h2.5a1.5 1.5 0 0 1 1.5 1.5V18a2 2 0 0 1-4 0" />
    <path d="M6.5 8.5h7M6.5 12h7M6.5 15.5h4" stroke={filled ? "var(--bar-bg-solid)" : "currentColor"} />
  </svg>
);
export const Search = ({ size = 24, strokeWidth }: P & { strokeWidth?: number }) => (
  <svg {...base(size, strokeWidth ?? 1.9)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4.7-4.7" />
  </svg>
);
export const Refresh = ({ size = 20 }: P) => (
  <svg {...base(size, 2)}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v5h-5" />
  </svg>
);
export const Chevron = ({ size = 14 }: P) => (
  <svg {...base(size, 2.4)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const XMark = ({ size = 14 }: P) => (
  <svg {...base(size, 2.4)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const ArrowUpRight = ({ size = 14 }: P) => (
  <svg {...base(size, 2.2)}>
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
);
export const Check = ({ size = 16 }: P) => (
  <svg {...base(size, 2.4)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** Line icons for each topic, used where a story has no photo. */
const TOPIC_PATHS: Record<string, ReactNode> = {
  top: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  india: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4.5c4-2 6 2 10 0s4-1 4-1v9s0-1-4 1-6-2-10 0" />
    </>
  ),
  world: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5S9.6 6 12 3.5z" />
    </>
  ),
  business: (
    <>
      <path d="M4 19.5h16" />
      <path d="M5 15l4.5-4.5 3.5 3.5L19.5 7.5" />
      <path d="M15 7.5h4.5V12" />
    </>
  ),
  technology: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
    </>
  ),
  sports: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4" />
    </>
  ),
  entertainment: (
    <>
      <rect x="3.5" y="9" width="17" height="11" rx="2" />
      <path d="M3.5 9l2-5 4 1.2-1.6 3.8M9.5 5.2l4 1.2-1.6 2.6M13.5 6.4l4 1.2-.8 1.4" />
    </>
  ),
  science: (
    <>
      <path d="M9.5 3.5h5M10.5 3.5v5.5L5 18.5A1.6 1.6 0 0 0 6.4 21h11.2a1.6 1.6 0 0 0 1.4-2.5L13.5 9V3.5" />
      <path d="M7.5 14.5h9" />
    </>
  ),
};

export const TopicIcon = ({ topic, size = 22 }: { topic: string; size?: number }) => (
  <svg {...base(size, 1.7)}>{TOPIC_PATHS[topic] ?? TOPIC_PATHS.top}</svg>
);
