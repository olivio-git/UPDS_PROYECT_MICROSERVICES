export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes % 60}m`;
};

export const formatGradingTime = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
