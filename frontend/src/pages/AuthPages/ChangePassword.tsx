import { useState } from 'react';
import { useNavigate } from 'react-router';
import { EyeCloseIcon, EyeIcon } from '../../icons';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Button from '../../components/ui/button/Button';
import { authApi } from '../../api/auth';
import { useAuth } from '../../store/authStore';

// ── Defined OUTSIDE the page component to prevent remount on every keystroke ──
interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}

function PasswordInput({ label, value, onChange, show, onToggle, placeholder }: PasswordInputProps) {
  return (
    <div>
      <Label>{label} <span className="text-red-500">*</span></Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span
          onClick={onToggle}
          className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
        >
          {show
            ? <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
            : <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ChangePassword() {
  const navigate       = useNavigate();
  const { updateUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]      = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [showCurrent,     setShowCurrent]      = useState(false);
  const [showNew,         setShowNew]          = useState(false);
  const [showConfirm,     setShowConfirm]      = useState(false);
  const [loading,         setLoading]          = useState(false);
  const [error,           setError]            = useState('');

  const passwordRules = [
    { label: 'At least 8 characters',     ok: newPassword.length >= 8 },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(newPassword) },
    { label: 'Contains lowercase letter', ok: /[a-z]/.test(newPassword) },
    { label: 'Contains a number',         ok: /\d/.test(newPassword) },
    { label: 'Passwords match',           ok: newPassword === confirmPassword && confirmPassword.length > 0 },
  ];

  const isValid = passwordRules.every((r) => r.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError('');
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      updateUser({ must_change_password: 0 });
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 shadow-lg mb-4">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z"
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">Change Your Password</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              You must set a new password before continuing
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordInput
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              placeholder="Enter your current password"
            />

            <PasswordInput
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
              placeholder="Enter new password"
            />

            <PasswordInput
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              placeholder="Confirm new password"
            />

            {newPassword.length > 0 && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-2">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className="flex items-center gap-2">
                    <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                      rule.ok ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}>
                      {rule.ok && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-xs ${
                      rule.ok ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Button className="w-full" size="sm" disabled={loading || !isValid || !currentPassword}>
              {loading ? 'Updating...' : 'Set New Password'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
