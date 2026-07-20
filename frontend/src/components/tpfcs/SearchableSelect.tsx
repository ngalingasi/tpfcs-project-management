import { useEffect, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;   // shown on the closed control when nothing is selected
  allLabel?: string;      // label for the "clear / all" option at the top of the list
  allowClear?: boolean;   // whether to show the "clear / all" option at all (default true)
  label?: string;         // optional field label rendered above the control
  required?: boolean;
  error?: string;
  className?: string;
}

// A simple, dependency-free searchable dropdown (combobox).
// Click to open, type to filter the option list, click an option to select it.
export default function SearchableSelect({
  options, value, onChange, placeholder = 'Select...', allLabel = 'All', allowClear = true,
  label, required, error, className = '',
}: Props) {
  const [open, setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const rootRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setSearch('');
      // Focus the search box as soon as the dropdown opens
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 ${
          error ? 'border-red-400' : 'border-gray-300 dark:border-gray-700'
        }`}
      >
        <span className={selected ? '' : 'text-gray-400'}>{selected ? selected.label : placeholder}</span>
        <svg className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {allowClear && (
              <li>
                <button
                  type="button"
                  onClick={() => select('')}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    value === '' ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {allLabel}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No matches found</li>
            ) : filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => select(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    value === o.value ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
