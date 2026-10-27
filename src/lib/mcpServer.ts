import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveOrgAccess } from './orgPermissions.ts';
import { buildPulsoBrief } from './pulsoBrief.ts';
import type { ResponseRecord } from './pulseData.ts';

/** Por qué `mcpAuthenticate` (server.ts) no pudo resolver un correo a partir del header `Authorization`. */
export type McpAuthFailureReason = 'missing_header' | 'malformed_token' | 'not_found';

const AUTH_FAILURE_DETAIL: Record<McpAuthFailureReason, string> = {
  missing_header: 'No llegó ningún header "Authorization" en la petición — revisa que el conector lo tenga configurado.',
  malformed_token: 'El header "Authorization" llegó pero no trae el formato esperado "Bearer pt_...".',
  not_found: 'El token no coincide con ninguno activo: puede estar mal copiado (espacios o saltos de línea de más) o haber sido revocado/regenerado. Genera uno nuevo en "Acceso API" y vuelve a pegarlo completo.',
};

export interface PulsoMcpOptions {
  /** Correo ya autenticado (dueño del token de API que llamó al conector) — nunca viene del cliente MCP. `null` si la petición no trajo un token válido: el handshake (`initialize`/`tools/list`) igual se completa, y la tool sola devuelve el error de auth al invocarse. */
  email: string | null;
  /** Por qué `email` es `null`, para dar un mensaje de error más específico que ayude a diagnosticar (no distingue entre sí: "falta header" vs "token no encontrado" son errores muy distintos de resolver). */
  authFailureReason?: McpAuthFailureReason;
  loadRecords: () => Promise<ResponseRecord[]>;
}

/**
 * Un servidor MCP por request (modo stateless, ver `simpleStatelessStreamableHttp` del SDK) —
 * encaja con el runtime sin estado de las funciones de Netlify. Expone una sola tool de solo
 * lectura, con el mismo alcance de permisos (`resolveOrgAccess`) que ya aplica el dashboard y la
 * API REST — un conector MCP personalizado nunca ve más de lo que esa cuenta ya puede ver.
 *
 * No se exige el token en `initialize`/`tools/list` (solo al invocar la tool): algunos clientes MCP
 * hacen una conexión de prueba sin credenciales antes de aplicar el header configurado, y un 401 a
 * nivel de transporte ahí se ve como "servidor inválido" en vez de un problema de auth.
 */
export function createPulsoMcpServer({ email, authFailureReason, loadRecords }: PulsoMcpOptions): McpServer {
  const server = new McpServer({ name: 'pulso-toroto', version: '1.0.0' });

  server.registerTool(
    'pulso_brief',
    {
      title: 'Brief de Pulso Toroto',
      description:
        'Da el informe de Pulso Toroto (KPIs, resumen por equipo y alertas) para un periodo: semana, mes, trimestre, semestre o año. Respeta el mismo alcance de permisos que el dashboard de quien llama.',
      inputSchema: {
        range: z.enum(['week', 'month', 'quarter', 'semester', 'year']).describe('Periodo del brief'),
      },
    },
    async ({ range }) => {
      if (!email) {
        const detail = authFailureReason ? ` ${AUTH_FAILURE_DETAIL[authFailureReason]}` : '';
        return { content: [{ type: 'text' as const, text: `Token de API inválido, revocado o no provisto.${detail}` }], isError: true };
      }
      const access = resolveOrgAccess(email);
      if (!access.granted) {
        return { content: [{ type: 'text' as const, text: 'Esta cuenta no tiene acceso a Pulso Toroto.' }], isError: true };
      }
      const allRecords = await loadRecords();
      const markdown = buildPulsoBrief({ access, email, allRecords, range });
      return { content: [{ type: 'text' as const, text: markdown }] };
    },
  );

  return server;
}
