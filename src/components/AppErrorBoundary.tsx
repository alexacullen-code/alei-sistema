import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  errorMessage: string
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Error inesperado en la aplicación'
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Error capturado:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              <h1 className="text-lg font-semibold">Se detectó un error en esta pantalla</h1>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              Para evitar pantalla en blanco, mostramos este aviso. Podés recargar la página.
            </p>

            <pre className="mt-4 max-h-40 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">
              {this.state.errorMessage}
            </pre>

            <div className="mt-5 flex gap-2">
              <Button onClick={this.handleReload}>Recargar</Button>
              <Button variant="outline" onClick={() => this.setState({ hasError: false, errorMessage: '' })}>
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
