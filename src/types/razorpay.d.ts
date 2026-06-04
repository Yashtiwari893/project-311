declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void }
  }
}

export {}
