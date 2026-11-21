// Builds the public URL of an uploaded file. The API returns `file_url` (path relative to /uploads);
// older rows fall back to the stored file_path.
export const fileUrl = (doc: { file_url?: string | null; file_path?: string | null }): string => {
  const base = (import.meta.env.VITE_API_URL ?? '').replace('/api', '').replace(/\/v1\/?$/, '');
  if (doc.file_url) return `${base}/uploads/${doc.file_url}`;
  const fp = (doc.file_path ?? '').replace(/\\/g, '/');
  const rel = fp.includes('uploads/') ? fp.split('uploads/').pop() : fp.split('/').pop();
  return `${base}/uploads/${rel}`;
};
