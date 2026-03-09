declare module 'virtual:apps' {
  export const apps: Record<string, string> | undefined
  export const appUrls: Record<string, string> | undefined
  export default apps
}

declare module 'virtual:libs' {
  export const libs: Record<string, string> | undefined
  export const libUrls: Record<string, string> | undefined
  
  export default libs
}