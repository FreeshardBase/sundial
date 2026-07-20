// Apply persisted theme before first paint (avoids flash). Classic script in
// <head> — externalized (not inline) so the CSP can stay script-src 'self'.
try {
  const t = localStorage.getItem('sundial.theme');
  if (t === 'dark' || (t === null && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.dataset.theme = 'dark';
  }
} catch (e) { /* storage unavailable */ }
