/**
 * Folio MCP HTTP (Streamable HTTP, stateless JSON)
 * POST /api/mcp — MCP JSON-RPC
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createFolioMcpServer } from '@/mcp/create-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  const server = createFolioMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(req)
}

export async function POST(req: Request) {
  return handle(req)
}

export async function GET(req: Request) {
  return handle(req)
}

export async function DELETE(req: Request) {
  return handle(req)
}
