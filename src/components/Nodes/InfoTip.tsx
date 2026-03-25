import { useState, useCallback, useRef, useEffect } from 'react';
import tip from './Tooltip.module.css';

interface Props {
  text: string;
  /** Extra CSS class for the clickable wrapper */
  className?: string;
  /** 'center' (default) or 'left' alignment */
  align?: 'center' | 'left';
  children: React.ReactNode;
}

/**
 * InfoTip — wraps any element to make it click-to-show an educational tooltip.
 * Shows a help cursor + dotted underline on hover as a visual hint.
 * Click to toggle the tooltip; click anywhere else to dismiss.
 */
export function InfoTip({ text, className, align = 'center', children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Delay to avoid immediately closing from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const popupClass = align === 'left' ? tip.tooltipPopupLeft : tip.tooltipPopup;

  return (
    <span
      ref={ref}
      className={`${tip.tooltip} ${className || ''}`}
      onClick={handleClick}
    >
      {children}
      {open && (
        <span className={`${popupClass} nopan nodrag`}>
          {text}
        </span>
      )}
    </span>
  );
}
