import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Algo deu errado'
    return { hasError: true, message }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-300">Ocorreu um erro</p>
            <p className="text-xs text-zinc-600">{this.state.message}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="rounded-full bg-zinc-800 px-5 py-2 text-xs font-medium text-zinc-300 active:bg-zinc-700"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
