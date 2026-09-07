import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Award } from 'lucide-react';
import { fetchPublishedRecognitions, type Me, type RecognitionRecord } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';

const PREVIEW_NAMES = ['Santiago', 'Ane', 'Patricia'];

export default function RecognitionsGallery({ me, onBack }: { me: Me; onBack: () => void }) {
  const [month, setMonth] = useState('');
  const [diplomas, setDiplomas] = useState<RecognitionRecord[] | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [previewAs, setPreviewAs] = useState('');

  useEffect(() => {
    fetchPublishedRecognitions()
      .then(d => {
        setMonth(d.month);
        setDiplomas(d.diplomas);
      })
      .catch(e => setError(e.message));
  }, []);

  const displayName = previewAs || me.name;
  const current = diplomas?.[index];

  return (
    <div>
      <TopBar name={displayName} />
      <div className="p-4 md:p-8 space-y-6 max-w-2xl">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Reconocimientos del mes · {month}</h2>
            <p className="text-sm text-slate-500">Diplomas publicados para toda la tropa.</p>
          </div>
          {me.canManageRecognitions && (
            <select
              value={previewAs}
              onChange={e => setPreviewAs(e.target.value)}
              className="text-xs rounded-lg border border-toroto-border px-2.5 py-1.5 bg-white"
              title="Ver esta pantalla como otro perfil, solo para verificar"
            >
              <option value="">Ver como tú misma</option>
              {PREVIEW_NAMES.map(n => (
                <option key={n} value={n}>
                  Ver como {n}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!diplomas && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {diplomas?.length === 0 && (
          <div className="rounded-xl border border-toroto-border bg-white p-8 text-center text-sm text-slate-500">
            Aún no hay diplomas publicados este mes.
          </div>
        )}

        {current && (
          <div className="rounded-xl border border-toroto-border bg-white p-6">
            <div className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center bg-amber-50/40">
              <Award className="mx-auto text-amber-500 mb-2" size={28} />
              <p className="text-xs text-slate-500 mb-3">Se otorga con orgullo y distinción el presente reconocimiento a:</p>
              <p className="font-display text-2xl font-bold text-[#0b1c30] mb-4">{current.nomineeName || 'Sin especificar'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Mención de honor</p>
              <p className="text-sm text-slate-700">{current.diplomaText}</p>
              <p className="text-xs text-slate-400 mt-4">
                {current.month} · Nominado por {current.nominatorName || current.nominatorEmail}
              </p>
            </div>

            {diplomas && diplomas.length > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setIndex(i => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="p-2 rounded-lg border border-toroto-border disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-xs text-slate-500">
                  {index + 1} de {diplomas.length}
                </p>
                <button
                  onClick={() => setIndex(i => Math.min(diplomas.length - 1, i + 1))}
                  disabled={index === diplomas.length - 1}
                  className="p-2 rounded-lg border border-toroto-border disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
