// Google API type declarations used across the app

export type GPEnvironment = 'TEST' | 'PRODUCTION'

export type GPClient = {
  loadPaymentData: (req: unknown) => Promise<{ paymentMethodData: { tokenizationData: { token: string } } }>
  isReadyToPay: (req: unknown) => Promise<{ result: boolean }>
  createButton: (config: {
    onClick: () => void
    buttonColor?: string
    buttonType?: string
    buttonRadius?: number
    buttonSizeMode?: string
  }) => HTMLElement
}

export interface GoogleAccounts {
  id: {
    initialize: (config: {
      client_id: string
      callback: (response: { credential: string }) => void
    }) => void
    renderButton: (
      parent: HTMLElement,
      options: {
        theme: string
        size: string
        shape: string
        text: string
        width: number
      }
    ) => void
  }
}

declare global {
  interface Window {
    google?: {
      accounts?: GoogleAccounts
      payments?: {
        api: {
          PaymentsClient: new (config: { environment: GPEnvironment }) => GPClient
        }
      }
    }
  }
}

export {}
