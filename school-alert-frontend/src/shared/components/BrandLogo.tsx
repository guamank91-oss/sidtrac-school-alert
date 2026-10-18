interface BrandLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const

/** SIDTRAC mark — escudo + radar (SVG, sin fondo damero). */
export function BrandLogo({ className = '', size = 'md' }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${SIZE_CLASS[size]} shrink-0 ${className}`.trim()}
      aria-hidden
    >
      <path
        d="M32 6C22.5 11 14 12.5 14 12.5V30.5C14 44.5 23.5 53.2 32 57C40.5 53.2 50 44.5 50 30.5V12.5S41.5 11 32 6Z"
        fill="#0B2550"
        stroke="#38BDF8"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="31" r="3.25" fill="#7DD3FC" />
      <path
        d="M32 31L42 24.5A13 13 0 0 0 32 18"
        fill="#38BDF8"
        fillOpacity="0.35"
      />
      <circle
        cx="32"
        cy="31"
        r="7"
        stroke="#7DD3FC"
        strokeWidth="1.5"
        opacity="0.95"
      />
      <circle
        cx="32"
        cy="31"
        r="11"
        stroke="#38BDF8"
        strokeWidth="1.35"
        opacity="0.7"
      />
      <path
        d="M26 17.5c1.7-1.2 3.7-1.9 6-1.9s4.3.7 6 1.9"
        stroke="#E0F2FE"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M23.5 14.5c2.5-1.8 5.4-2.8 8.5-2.8s6 1 8.5 2.8"
        stroke="#38BDF8"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  )
}
