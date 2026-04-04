import { useState } from 'react';

interface Props {
  children: React.ReactNode;
}

/** Expandable "Why does this matter?" section */
export function WhyBox({ children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="why-toggle" onClick={() => setOpen(!open)}>
        {open ? '\u25B4' : '\u25BE'} Why does this matter?
      </button>
      {open && <div className="why-content">{children}</div>}
    </>
  );
}
