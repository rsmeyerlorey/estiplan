import { useState, useEffect, useRef } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  step?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * A number input that allows backspacing through zero.
 * Keeps local string state so the user can clear the field,
 * and only pushes numeric values to the parent on change.
 * Converts empty → 0 on blur.
 */
export function NumberInput({
  value,
  onChange,
  step = 'any',
  placeholder,
  style,
  className = 'text-input',
}: Props) {
  const [localValue, setLocalValue] = useState(() => formatNum(value));
  const isFocused = useRef(false);

  // Sync from parent when not focused (e.g., parent resets state)
  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(formatNum(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);

    // Only push to parent if it's a valid number
    if (raw === '' || raw === '-' || raw === '.') return;
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleFocus = () => {
    isFocused.current = true;
  };

  const handleBlur = () => {
    isFocused.current = false;
    // On blur, normalize: empty → 0, otherwise format cleanly
    if (localValue === '' || localValue === '-' || localValue === '.') {
      setLocalValue('0');
      onChange(0);
    } else {
      const parsed = parseFloat(localValue);
      if (!isNaN(parsed)) {
        setLocalValue(formatNum(parsed));
      }
    }
  };

  return (
    <input
      type="number"
      className={className}
      step={step}
      placeholder={placeholder}
      style={style}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

/** Format a number for display — avoids trailing zeros */
function formatNum(n: number): string {
  if (n === 0) return '0';
  // Use a reasonable number of decimal places
  const s = Number(n.toFixed(6)).toString();
  return s;
}
