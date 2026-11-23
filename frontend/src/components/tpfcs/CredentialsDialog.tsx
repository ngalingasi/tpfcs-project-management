import { useState } from 'react';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  username?: string;
  password: string;
  note?: string;
}

/** Shows a temporary password once so the admin can pass it on. */
export default function CredentialsDialog({ open, onClose, title, username, password, note }: Props) {
  const [copied, setCopied] = useState(false);
  const text = username ? `Username: ${username}\nPassword: ${password}` : password;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Give these details to the user. The password is shown only now, and they must choose a new one when they sign in.
        </p>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 font-mono text-sm space-y-1 select-all">
          {username && <div><span className="text-gray-400">Username: </span>{username}</div>}
          <div><span className="text-gray-400">Password: </span>{password}</div>
        </div>
        {note && <p className="text-xs text-gray-500">{note}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={copy} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{copied ? 'Copied' : 'Copy'}</button>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600">Done</button>
        </div>
      </div>
    </Modal>
  );
}
