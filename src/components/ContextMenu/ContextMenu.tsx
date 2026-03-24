import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ContextMenu.module.css';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState({ x, y });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    // Delay to avoid immediate close from the right-click event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Measure actual size and adjust position to stay within viewport
  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const padding = 8;
      const newX = Math.min(x, window.innerWidth - rect.width - padding);
      const newY = Math.min(y, window.innerHeight - rect.height - padding);
      setAdjusted({
        x: Math.max(padding, newX),
        y: Math.max(padding, newY),
      });
    }
  }, [x, y, children]); // re-measure when children change (e.g., submenu swap)

  return (
    <div
      ref={ref}
      className={styles.contextMenu}
      style={{ left: adjusted.x, top: adjusted.y }}
    >
      {children}
    </div>
  );
}
