// Environment detection has no bridge listeners, state stores or initialization side effects.
export const isDesktop = !!window.chrome?.webview
