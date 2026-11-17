declare module '*.module.css' {
  const classes: { readonly [key: string]: string; [key: string]: any };
  export default classes;
}

declare module '*.css';
