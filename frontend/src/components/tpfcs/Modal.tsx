import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const SIZE_CLS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  // almost the whole screen, no body padding (maps, big tables)
  full: 'max-w-[96vw] h-[calc(100vh-3rem)]',
};

// Several modals can be open at once (e.g. "Update status" on top of the activity viewer).
// The page may only scroll again when the LAST one closes, and Escape closes only the top one.
let openModals = 0;
const escapeStack: Array<() => void> = [];

/** Lock page scroll while open and close the top-most modal on Escape. */
export const BASE_Z = 99999;

/** Lock page scroll while open, close the top-most modal on Escape, and return a z-index that
 *  puts this modal above every modal that was opened before it (whatever component renders it). */
export function useModalBehavior(isOpen: boolean, onClose: () => void): number {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [layer, setLayer] = useState(0);

  // Layer = number of modals already open at the moment this one opens.
  useLayoutEffect(() => {
    if (isOpen) setLayer(escapeStack.length);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    openModals += 1;
    document.body.style.overflow = 'hidden';
    const close = () => closeRef.current();
    escapeStack.push(close);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeStack[escapeStack.length - 1] === close) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = escapeStack.indexOf(close);
      if (i >= 0) escapeStack.splice(i, 1);
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.body.style.overflow = '';
    };
  }, [isOpen]);

  return BASE_Z + layer * 10;
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: Props) {
  const z = useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    // Full-screen overlay rendered directly into document.body
    // z-[99999] ensures it sits above header, sidebar and all other UI
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: z, paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Dialog — centered, never touching header */}
      <div
        className={`
          relative w-full ${SIZE_CLS[size]}
          bg-white dark:bg-gray-900
          rounded-2xl shadow-2xl
          border border-gray-200 dark:border-gray-700
          flex flex-col
          max-h-[calc(100vh-4rem)]
          ${size === 'full' ? 'mt-2' : 'mt-8'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className={size === 'full' ? 'flex-1 min-h-0 overflow-hidden' : 'overflow-y-auto flex-1 px-6 py-5'}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
