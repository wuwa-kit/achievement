import { tr } from '../i18n/index.ts'
import { parseExport, type ExportData } from './data.ts'

export interface Ticket {
  port: number
  key: string
}
export function parseTicket(hash: string): Ticket | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  if (
    p.get('handoff') !== 'v1' ||
    !/^\d{1,5}$/.test(p.get('port') ?? '') ||
    !/^[a-f0-9]{64}$/.test(p.get('key') ?? '')
  )
    return null
  const port = Number(p.get('port'))
  return port > 0 && port <= 65535 ? { port, key: p.get('key')! } : null
}

function request(ticket: Ticket, path: string, options: RequestInit = {}) {
  const init: RequestInit & { targetAddressSpace: string } = {
    ...options,
    targetAddressSpace: 'loopback',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${ticket.key}`, ...options.headers },
  }
  return fetch(`http://127.0.0.1:${ticket.port}/v1/${path}`, init)
}
export async function receiveExport(
  ticket: Ticket,
): Promise<{ data: ExportData; transferId: string }> {
  const response = await request(ticket, 'export')
  if (!response.ok) throw new Error(tr('ui.serviceError', { value0: response.status }))
  const raw: unknown = await response.json()
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('version' in raw) ||
    raw.version !== 1 ||
    !('transferId' in raw) ||
    typeof raw.transferId !== 'string' ||
    !/^[a-f0-9]{32}$/.test(raw.transferId) ||
    !('expiresAt' in raw) ||
    typeof raw.expiresAt !== 'string' ||
    !(Date.parse(raw.expiresAt) > Date.now()) ||
    !('payload' in raw)
  )
    throw new Error(tr('ui.invalidTransfer'))
  return { data: parseExport(raw.payload), transferId: raw.transferId }
}
export async function acknowledge(ticket: Ticket, transferId: string): Promise<void> {
  const response = await request(ticket, 'ack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transferId }),
  })
  if (!response.ok) throw new Error(tr('ui.ackError', { value0: response.status }))
}
