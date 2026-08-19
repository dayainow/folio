/**
 * Folio MCP HTTP (Streamable HTTP, stateless JSON)
 * POST /api/mcp — MCP JSON-RPC
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authorizeMcpHttpRequest } from '@/lib/mcp-http-auth'
import { createFolioMcpServer } from '@/mcp/create-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  const auth = authorizeMcpHttpRequest(req)
  if (!auth.ok) {
    return Response.json(
      { error: auth.code },
      {
        status: auth.status,
        headers: auth.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined,
      },
    )
  }

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
