interface Props {
  connected: boolean;
}

export default function ConnectionIndicator({ connected }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-400 animate-pulse'
        }`}
      />
      {!connected && (
        <span className="text-xs font-medium opacity-70">Reconectando...</span>
      )}
    </div>
  );
}
