export const enableMocking = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (import.meta.env.MODE !== 'mock') return

  const { worker } = await import('./browser')

  return worker.start({ onUnhandledRequest: 'bypass' })
}
