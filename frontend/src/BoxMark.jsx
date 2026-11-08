// The Shoebox mark: a lidded box, drawn in the current text color
export default function BoxMark() {
  return (
    <svg aria-hidden="true" width="22" height="19" viewBox="0 0 26 22" fill="none">
      <rect x="1" y="7" width="24" height="14" rx="1.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M0 4.5h26" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  )
}
