// Hand-drawn spot illustrations for the welcome flow. Geometric line art
// on transparent, sized by the parent. No images, no deps.

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-auto text-muted-foreground"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function PathArt() {
  return (
    <Frame>
      <rect x="18" y="28" width="76" height="64" rx="8" />
      <path d="M42 52l-9 8 9 8M62 52l9 8-9 8" className="text-ac" stroke="currentColor" />
      <circle cx="148" cy="60" r="32" strokeDasharray="5 6" />
      <path d="M148 44v16l11 7" className="text-ac" stroke="currentColor" />
      <path d="M100 60h12" />
    </Frame>
  );
}

export function SetupArt() {
  return (
    <Frame>
      <rect x="60" y="14" width="80" height="92" rx="8" />
      <path d="M78 38h44M78 60h44M78 82h28" />
      <circle cx="108" cy="38" r="5" className="text-ac" stroke="currentColor" fill="#1a1a1a" />
      <circle cx="94" cy="60" r="5" className="text-ac" stroke="currentColor" fill="#1a1a1a" />
      <circle cx="118" cy="82" r="5" stroke="currentColor" fill="#1a1a1a" />
    </Frame>
  );
}

export function LoadArt() {
  return (
    <Frame>
      <rect x="30" y="34" width="76" height="56" rx="8" />
      <rect x="52" y="22" width="76" height="56" rx="8" />
      <rect x="74" y="34" width="76" height="56" rx="8" className="text-ac" stroke="currentColor" />
      <path d="M112 56v12M106 62h12" className="text-ac" stroke="currentColor" />
      <path d="M44 52h20M44 62h14" />
    </Frame>
  );
}

export function DoneArt() {
  return (
    <Frame>
      <circle cx="100" cy="58" r="34" />
      <circle cx="100" cy="58" r="26" strokeDasharray="4 5" className="text-ac" stroke="currentColor" />
      <path d="M88 58l8 8 16-16" className="text-ac" stroke="currentColor" strokeWidth="3" />
      <path d="M66 100h68" />
    </Frame>
  );
}
