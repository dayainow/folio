/**
 * Folio MCP stdio 서버 엔트리
 * 사용: npm run mcp:server
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createFolioMcpServer } from '@/mcp/create-server'

async function main() {
  const server = createFolioMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[folio-mcp] stdio server ready')
}

main().catch((err) => {
  console.error('[folio-mcp] fatal', err)
  process.exit(1)
})
