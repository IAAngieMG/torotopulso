import { Snowflake, LogOut, Sparkles } from 'lucide-react';
import { TOKEN_KEY, type Me } from '../lib/apiClient.ts';

/** Pantalla completa durante la pausa general de Pulso por vacaciones de fin de año (28 dic – 3 ene). */
export default function PulsoPause({ me }: { me: Me }) {
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0b1c30] text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto">
          <Snowflake size={24} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-1">Pulso en pausa</p>
          <h1 className="font-display text-2xl font-semibold">Feliz cierre de año, {me.name}.</h1>
        </div>
        <p className="text-sm text-white/70">
          Del 28 de diciembre al 3 de enero no se piden respuestas ni se generan red flags — descansa sin pendientes.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-white/80 bg-white/10 rounded-full px-4 py-2 mx-auto w-fit">
          <Sparkles size={14} />
          Volvemos el lunes 4 de enero con tu Resumen del año
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-xs text-white/50 hover:text-white mx-auto mt-6">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
