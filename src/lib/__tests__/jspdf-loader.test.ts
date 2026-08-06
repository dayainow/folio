import { describe, expect, it } from 'vitest'
import { loadJsPdf } from '@/lib/jspdf-loader'

describe('jspdf-loader (P66)', () => {
  it('loads jsPDF constructor dynamically', async () => {
    const JsPDF = await loadJsPdf()
    expect(typeof JsPDF).toBe('function')
    const again = await loadJsPdf()
    expect(again).toBe(JsPDF)
  })
})
