import type { Me } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';

/**
 * Informe estático de la herramienta Pulso Toroto, con el mismo formato que Angie usa para otras
 * herramientas del IA Hub (Resumen, Qué problema resuelve, Módulos, Integraciones, Control
 * humano, Acceso y Próximos pasos). Vive dentro de la app en vez de ser un PDF aparte para que
 * se mantenga junto al código que describe y cualquier persona con visión global lo consulte
 * sin pedírselo a nadie.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Table({ rows, cols }: { cols: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-toroto-border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            {cols.map(c => (
              <th key={c} className="px-4 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-toroto-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 align-top text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InformeHerramienta({ me, onSetViewAs }: { me: Me; onSetViewAs: (email: string) => void }) {
  return (
    <div>
      <TopBar me={me} onSetViewAs={onSetViewAs} />
      <div className="px-4 md:px-8 py-6 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold mb-1">Pulso Toroto — Informe de la herramienta</h1>
        <p className="text-sm text-slate-400 mb-8">Equipo de Toroto</p>

        <Section title="Resumen">
          <p>
            Pulso Toroto es la herramienta del IA Hub que convierte las encuestas diarias que la tropa contesta en Slack
            (Inicio del día, Comida, Cierre del día y la Encuesta Viernes) en un panel de seguimiento por persona, por
            equipo y para toda Toroto. Las respuestas llegan a un Google Sheet mediante un bot de Slack; Pulso Toroto las
            lee, calcula KPIs, detecta patrones de alerta ("red flags") y reconstruye quién le reporta a quién a partir de
            un organigrama propio, sin que nadie tenga que capturar nada a mano.
          </p>
          <p>
            Además del pulso diario, la app tiene un módulo de Reconocimientos del mes: recibe nominaciones que la tropa
            envía por Slack, genera con IA un diploma a partir de cada nominación, y solo publica los que una persona
            gestora aprobó.
          </p>
          <p>
            El objetivo no es vigilar a nadie, sino que los líderes detecten a tiempo quién necesita apoyo y que el
            equipo vea reconocido su esfuerzo cada mes.
          </p>
        </Section>

        <Section title="Qué problema resuelve">
          <p>
            Antes de Pulso Toroto, saber cómo venía el equipo en participación, ánimo o puntualidad de check-in exigía
            revisar el Sheet de respuestas a mano, encuesta por encuesta y persona por persona — algo que no escala con
            la operación diaria ni avisa a tiempo cuando alguien deja de responder o reporta una calificación baja varios
            días seguidos. Pulso Toroto hace esa lectura automáticamente, respeta quién está de vacaciones para no
            generar alertas falsas, y limita lo que cada persona ve según su lugar en el organigrama.
          </p>

          <Table
            cols={['Quién la usa', 'Para qué']}
            rows={[
              ['Líderes de equipo', 'Ver el pulso de su equipo y de las personas a su cargo, y atender las red flags que les toquen.'],
              ['Visión global (Angie, Karla, Santiago, Patricia, Alejandro)', 'Ver el pulso de toda Toroto, por equipo y por persona, y usar "Ver como" para revisar lo que ve otra cuenta.'],
              ['Karla y Angie (gestoras de Reconocimientos)', 'Generar, aprobar y publicar los diplomas del mes a partir de las nominaciones recibidas por Slack.'],
              ['Karla, Samantha y Angie', 'Consultar el buzón de feedback interno que llega desde la app.'],
              ['Santiago, Angie, Patricia, Samantha y Karla', 'Ver la sección de Reconocimientos del mes, como gestoras o solo para consultarla.'],
            ]}
          />
        </Section>

        <Section title="Módulos y funciones">
          <p>
            <strong>Resumen y Pulso.</strong> Cuatro pestañas según el alcance de la cuenta: General Toroto (o General,
            para quien no tiene visión global), Equipos, Personas y Líderes. Cada una trae KPIs (promedio de Inicio del
            día, promedio de Cierre del día, porcentaje de participación), una serie semanal y la distribución de
            energía/ánimo del periodo elegido (hoy, semana, semana pasada, mes, trimestre, semestre o año).
          </p>
          <p>
            <strong>Red flags.</strong> Reglas deterministas (sin IA generativa) sobre el historial de cada persona,
            evaluadas sobre la semana pasada completa: silencio total, check-in de Inicio del día tarde, Comida o Cierre
            del día sin contestar en días que sí participó, y calificación baja en Cierre del día. Ninguna se dispara por
            un solo día — todas piden un patrón de más de tres días hábiles. Quien esté de vacaciones con alcance
            "todo" no genera red flags; quien solo tiene pausada la Encuesta Viernes sigue contando normal en el resto.
            Cada persona con red flags recibe además una recomendación puntual, comparando la semana evaluada contra sus
            semanas previas.
          </p>
          <p>
            <strong>Vista por equipo y por persona.</strong> Detalle de KPIs, red flags y, cuando existe, el análisis
            histórico de Polly de esa persona. "Ver como" permite a Angie y Karla simular el dashboard de cualquier otra
            cuenta con acceso, para verificar qué ve.
          </p>
          <p>
            <strong>Feedback recibido.</strong> Buzón interno donde cualquier persona del equipo puede reportar dudas,
            fallas o mejoras desde la app; solo quien tiene acceso al buzón lo consulta, y solo Angie puede eliminar
            entradas ya resueltas.
          </p>
          <p>
            <strong>Reconocimientos del mes.</strong> Las nominaciones llegan por Slack a un Sheet propio. Desde la
            bandeja, Karla o Angie generan con IA (tono cálido o formal) el texto del diploma a partir de la nominación,
            lo aprueban o rechazan, y publican los aprobados del mes para que toda la tropa los vea en la galería
            pública de Reconocimientos.
          </p>
        </Section>

        <Section title="Integraciones">
          <Table
            cols={['Integración', 'Sentido', 'Qué se intercambia', 'Estado']}
            rows={[
              ['Google Sheets', 'Sheet → Pulso', 'Respuestas de las encuestas (Inicio, Comida, Cierre, Encuesta Viernes) y las nominaciones de Reconocimientos.', 'Activa'],
              ['Slack (vía bot externo)', 'Slack → Sheet → Pulso', 'La tropa contesta encuestas y envía nominaciones en Slack; un bot las escribe en el Sheet que Pulso lee.', 'Activa'],
              ['Google OAuth', 'Login', 'Inicio de sesión con la cuenta de Google de cada persona; no se guarda contraseña propia.', 'Activa'],
              ['Gemini (Google AI)', 'Pulso → Gemini', 'El texto libre de una nominación aprobada se envía a Gemini para redactar el diploma en el tono elegido.', 'Activa'],
              ['Netlify Blobs', 'Pulso ↔ almacenamiento', 'Guarda los registros de Reconocimientos (generados, aprobados, publicados) y el buzón de feedback.', 'Activa'],
            ]}
          />
        </Section>

        <Section title="Control humano, trazabilidad y seguridad">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Ningún diploma se publica sin que Karla o Angie lo generen y aprueben primero; lo que queda rechazado no
              llega a la galería pública.
            </li>
            <li>
              El alcance de cada cuenta (qué equipos, personas y pestañas ve) lo calcula el backend a partir del
              organigrama y las listas de acceso — nunca lo decide el navegador de quien usa la app.
            </li>
            <li>
              "Ver como" deja rastro de que se está simulando otra cuenta: la app muestra un aviso visible y un botón
              para volver a la vista propia; solo Angie y Karla pueden usarlo.
            </li>
            <li>
              Las red flags son reglas fijas sobre datos ya existentes, no una calificación de IA sobre el desempeño de
              nadie, y nunca se disparan por un incidente aislado de un solo día.
            </li>
            <li>Quien está de vacaciones no genera alertas ni cuenta en la participación mientras dure su periodo.</li>
          </ul>
        </Section>

        <Section title="Acceso y requisitos">
          <p>Para usar Pulso Toroto se necesita:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Una cuenta de Google de dominio Toroto, para iniciar sesión.</li>
            <li>Aparecer en el organigrama (src/lib/orgChart.ts) para tener un equipo y, con él, un alcance de datos.</li>
            <li>Estar en la lista correspondiente para ver Reconocimientos, el buzón de feedback o usar "Ver como" — el acceso no es automático por tener cuenta de Toroto.</li>
          </ul>
        </Section>

        <Section title="Próximos pasos">
          <ul className="list-disc pl-5 space-y-2">
            <li>Revisar con Angie si GET /api/recognitions/published debe validar quién puede verlo además del login genérico, en vez de depender solo del gate de la interfaz.</li>
            <li>Confirmar si otras cuentas de líder, además de Angie y Karla, deberían poder usar "Ver como" para verificar su propio alcance.</li>
            <li>Decidir cuánto tiempo se conservan los registros de Reconocimientos y del buzón de feedback en Netlify Blobs.</li>
            <li>Evaluar si conviene un reporte histórico (como el de Polly) para otras encuestas, no solo para Inicio del día.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
