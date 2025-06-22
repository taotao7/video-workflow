import './assets/main.css'

import { StrictMode, Component, ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
  console.error('Error message:', event.message)
  console.error('Error filename:', event.filename)
  console.error('Error line:', event.lineno)
  console.error('Error column:', event.colno)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

// React error boundary
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error?: Error}> {
  constructor(props: {children: ReactNode}) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React error boundary caught error:', error)
    console.error('Error info:', errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>Error: {this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>Reload App</button>
        </div>
      )
    }

    return this.props.children
  }
}

console.log('Application starting...')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
