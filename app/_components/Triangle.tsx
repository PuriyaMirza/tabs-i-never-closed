// The slim outline triangle on each row: points down when closed, up when open.
export default function Triangle({ open }: { open: boolean }) {
  return (
    <svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden="true">
      <path
        d={open ? "M1 8L7 1L13 8Z" : "M1 1L7 8L13 1Z"}
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
