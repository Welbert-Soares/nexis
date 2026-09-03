import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('renderiza um div com a utility shimmer', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('shimmer')
  })

  it('faz merge da className do consumidor', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    const cls = (container.firstElementChild as HTMLElement).className
    expect(cls).toContain('h-4')
    expect(cls).toContain('w-20')
  })

  it('repassa outros props (ex: data-testid)', () => {
    const { getByTestId } = render(<Skeleton data-testid="sk" />)
    expect(getByTestId('sk')).toBeTruthy()
  })
})
