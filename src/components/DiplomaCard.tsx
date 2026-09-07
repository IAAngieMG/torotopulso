interface DiplomaCardProps {
  nomineeName: string;
  nomineeRole?: string;
  mention: string;
  month: string;
}

const CornerAccent = ({ className }: { className: string }) => (
  <span className={`absolute w-5 h-5 border-amber-400 ${className}`} />
);

export default function DiplomaCard({ nomineeName, nomineeRole, mention, month }: DiplomaCardProps) {
  return (
    <div className="relative border-2 border-[#0b1c30] rounded-lg p-6 md:p-8 bg-white">
      <CornerAccent className="top-2 left-2 border-t-2 border-l-2" />
      <CornerAccent className="top-2 right-2 border-t-2 border-r-2" />
      <CornerAccent className="bottom-2 left-2 border-b-2 border-l-2" />
      <CornerAccent className="bottom-2 right-2 border-b-2 border-r-2" />

      <p className="text-center text-xs italic text-slate-500 mb-4">
        Se otorga con orgullo y distinción el presente reconocimiento a:
      </p>

      <div className="bg-slate-50 border border-slate-200 rounded-lg py-4 px-3 text-center mb-4">
        <p className="font-display text-2xl font-bold text-[#0b1c30]">{nomineeName || 'Nombre y apellido'}</p>
        {nomineeRole && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">{nomineeRole}</p>}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Mención de honor:</p>
        <p className="text-sm text-slate-700">{mention || '—'}</p>
      </div>

      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        <p className="font-semibold uppercase tracking-wide text-[10px] text-slate-400">Fecha de expedición</p>
        <p>{month} · CDMX</p>
        <p className="text-emerald-600 font-medium mt-1">✓ Expediente Acreditado</p>
      </div>
    </div>
  );
}
