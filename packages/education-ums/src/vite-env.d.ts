// Declare PWA virtual module
declare module 'virtual:pwa-register' {
  export function registerSW(options?: any): (reloadPage?: boolean) => Promise<void>;
}

declare const __BMI_BUILD_SHA__: string;

declare module 'https://esm.sh/html2pdf.js@0.10.1?bundle' {
  const html2pdf: any;
  export default html2pdf;
}
