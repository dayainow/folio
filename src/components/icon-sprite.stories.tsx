import type { Meta, StoryObj } from '@storybook/react'
import { SpriteIcon } from '@/components/icon-sprite'

const meta: Meta<typeof SpriteIcon> = {
  title: 'Perf/SpriteIcon',
  component: SpriteIcon,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SpriteIcon>

export const FolioMark: Story = {
  args: { name: 'folio-mark', className: 'size-8' },
}

export const PerfGauge: Story = {
  args: { name: 'perf-gauge', className: 'size-8 text-teal-600' },
}
