export function LocaleFlag({ locale }: { locale: "el" | "en" }) {
  if (locale === "el") {
    return (
      <svg viewBox="0 0 27 18" className="h-3.5 w-5 overflow-hidden rounded-[3px]" aria-hidden="true">
        <rect width="27" height="18" fill="#0d5eaf" />
        <rect y="2" width="27" height="2" fill="#fff" />
        <rect y="6" width="27" height="2" fill="#fff" />
        <rect y="10" width="27" height="2" fill="#fff" />
        <rect y="14" width="27" height="2" fill="#fff" />
        <rect width="10" height="10" fill="#0d5eaf" />
        <rect x="4" width="2" height="10" fill="#fff" />
        <rect y="4" width="10" height="2" fill="#fff" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 60 30" className="h-3.5 w-5 overflow-hidden rounded-[3px]" aria-hidden="true">
      <clipPath id="locale-flag-uk">
        <rect width="60" height="30" />
      </clipPath>
      <g clipPath="url(#locale-flag-uk)">
        <path fill="#012169" d="M0 0h60v30H0z" />
        <path stroke="#fff" strokeWidth="6" d="m0 0 60 30m0-30L0 30" />
        <path stroke="#c8102e" strokeWidth="4" d="m0 0 60 30m0-30L0 30" />
        <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
        <path stroke="#c8102e" strokeWidth="6" d="M30 0v30M0 15h60" />
      </g>
    </svg>
  );
}
