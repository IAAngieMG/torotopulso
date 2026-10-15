import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveOrgAccess } from './orgPermissions.ts';
import { buildPulsoBrief } from './pulsoBrief.ts';
import type { ResponseRecord } from './pulseData.ts';

export interface PulsoMcpOptions {
  /** Correo ya autenticado (dueño del token de API que llamó al conector) — nunca viene del cliente MCP. */
  email: string;
  loadRecords: () => Promise<ResponseRecord[]>;
}

/**
 * Un servidor MCP por request (modo stateless, ver `simpleStatelessStreamableHttp` del SDK) —
 * encaja con el runtime sin estado de las funciones de Netlify. Expone una sola tool de solo
 * lectura, con el mismo alcance de permisos (`resolveOrgAccess`) que ya aplica el dashboard y la
 * API REST — un conector MCP personalizado nunca ve más de lo que esa cuenta ya puede ver.
 */
export function createPulsoMcpServer({ email, loadRecords }: PulsoMcpOptions): McpServer {
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
