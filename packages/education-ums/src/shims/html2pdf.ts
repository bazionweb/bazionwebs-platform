export default function html2pdf() {
  return {
    set(_opts?: Record<string, unknown>) {
      return {
        from(_el: HTMLElement) {
          return {
            save: async () => {
              if (typeof window !== "undefined") window.print();
            },
            output: async (_type?: string) => new Blob([""], { type: "application/pdf" }),
          };
        },
      };
    },
  };
}

