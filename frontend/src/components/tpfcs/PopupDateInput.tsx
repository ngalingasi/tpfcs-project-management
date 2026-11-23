import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.css';
import { CalenderIcon } from '../../icons';

function placeCalendar(inst: flatpickr.Instance) {
  const cal = inst.calendarContainer;
  const r = inst.input.getBoundingClientRect();
  const h = cal.offsetHeight;
  const w = cal.offsetWidth;
  const gap = 6;
  const below = window.innerHeight - r.bottom - gap;
  const above = r.top - gap;
  let top: number;
  if (below >= h) top = r.bottom + gap;
  else if (above >= h) top = r.top - h - gap;
  else top = Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom + gap));
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
  cal.style.top = `${top + window.scrollY}px`;
  cal.style.left = `${left + window.scrollX}px`;
  cal.style.right = 'auto';
}

/**
 * Date field whose calendar is attached to <body> and floats above everything
 * (like a dropdown), so it never takes space inside, or gets clipped by, the dialog.
 */
export default function PopupDateInput({ id, label, value, placeholder, minDate, clearable, onChange }: {
  id: string; label: string; value: string; placeholder?: string;
  /** Earliest selectable date (YYYY-MM-DD). */
  minDate?: string;
  /** Show a small × to empty the field (for optional dates). */
  clearable?: boolean;
  onChange: (isoDate: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!inputRef.current) return;
    fpRef.current = flatpickr(inputRef.current, {
      dateFormat: 'Y-m-d',
      monthSelectorType: 'static',
      appendTo: document.body,
      disableMobile: true,
      defaultDate: value || undefined,
      minDate: minDate || undefined,
      onReady: (_d, _s, inst) => inst.calendarContainer.classList.add('plan-date-popup'),
      // flatpickr measures the calendar before the app's CSS has sized it and ends up overlapping the field,
      // so place it ourselves once it is open: below the field if it fits, otherwise above, always inside the viewport.
      onOpen: (_d, _s, inst) => requestAnimationFrame(() => placeCalendar(inst)),
      onChange: (dates) => {
        const d = dates[0];
        if (!d) return;
        const pad = (n: number) => String(n).padStart(2, '0');
        onChangeRef.current(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      },
    });
    return () => { fpRef.current?.destroy(); fpRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the picker in step if the value is changed from outside (e.g. dialog reopened)
  useEffect(() => {
    if (fpRef.current && value !== fpRef.current.input.value) fpRef.current.setDate(value || '', false);
  }, [value]);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        <input id={id} ref={inputRef} placeholder={placeholder} readOnly
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 cursor-pointer" />
        {clearable && value ? (
          <button type="button" title="Clear date" aria-label="Clear date"
            onClick={() => { fpRef.current?.clear(); onChange(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
        ) : (
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
            <CalenderIcon className="size-6" />
          </span>
        )}
      </div>
    </div>
  );
}
