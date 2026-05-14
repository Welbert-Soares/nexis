interface CurrencyInputProps {
  cents: number
  onChange: (cents: number) => void
  autoFocus?: boolean
  className?: string
}

export function CurrencyInput({ cents, onChange, autoFocus, className }: CurrencyInputProps) {
  const display = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    const next = digits ? Math.min(parseInt(digits, 10), 99_999_999) : 0
    onChange(next)
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-light text-zinc-500">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        autoFocus={autoFocus}
        className="w-full rounded-xl bg-zinc-800 py-4 pl-14 pr-4 text-2xl font-semibold text-white outline-none focus:ring-1 focus:ring-zinc-600"
      />
    </div>
  )
}
