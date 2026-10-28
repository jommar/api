/** A column heading that shortens on phones, where every column counts. */
export function HeadLabel({ short, long }: { short: string; long: string }) {
  return (
    <>
      <span className="sm:hidden" aria-hidden>
        {short}
      </span>
      <span className="sr-only sm:not-sr-only">{long}</span>
    </>
  );
}
