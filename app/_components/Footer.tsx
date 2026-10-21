// Thin rule + "14 done · 6 open" at the bottom of both list pages.
export default function Footer({ open, done }: { open: number; done: number }) {
  return (
    <footer className="foot">
      {done} done <span className="sep" aria-hidden="true">·</span> {open} open
    </footer>
  );
}
