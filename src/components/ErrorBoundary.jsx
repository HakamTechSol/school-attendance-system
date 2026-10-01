import { Component } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[app] unhandled error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-lg">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
            <AlertOctagon size={28} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Something broke</h1>
          <p className="mt-2 text-sm text-slate-600">
            The page hit an unexpected error. Reloading usually fixes it.
          </p>
          <pre className="mt-4 max-h-32 overflow-x-auto rounded-xl bg-slate-50 p-3 text-left text-xs text-slate-600">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw size={16} aria-hidden="true" /> Reload the app
          </button>
        </div>
      </div>
    )
  }
}