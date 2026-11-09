export interface ChurchWhatsAppButtonProps {
  href?: string;
  ministryName: string;
}

function safeWhatsAppHref(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["wa.me", "api.whatsapp.com"].includes(url.hostname)) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function ChurchWhatsAppButton({ href, ministryName }: ChurchWhatsAppButtonProps) {
  const safeHref = safeWhatsAppHref(href);
  if (!safeHref) return null;

  return (
    <a
      className="ch-whatsapp-float"
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${ministryName} on WhatsApp (opens in a new tab)`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path
          fill="currentColor"
          d="M12.04 2a9.94 9.94 0 0 0-8.52 15.06L2 22l5.1-1.34A10 10 0 1 0 12.04 2zm0 18.18c-1.5 0-2.97-.4-4.26-1.17l-.3-.18-3.02.79.8-2.94-.2-.3a8.2 8.2 0 1 1 6.98 3.8zm4.5-6.13c-.25-.13-1.48-.73-1.7-.81-.23-.08-.4-.13-.56.13-.17.25-.65.8-.8.96-.15.17-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.25-1.5-1.4-1.75-.14-.25-.02-.39.11-.52.11-.11.25-.29.37-.44.13-.15.17-.26.25-.42.08-.17.04-.32-.02-.45-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43l-.48-.01c-.17 0-.45.06-.68.32-.23.25-.9.88-.9 2.14 0 1.25.92 2.46 1.05 2.62.13.17 1.81 2.77 4.39 3.88.61.27 1.09.42 1.46.54.61.19 1.17.16 1.61.1.49-.07 1.49-.61 1.7-1.2.21-.58.21-1.08.15-1.19-.06-.1-.23-.17-.48-.29z"
        />
      </svg>
      <span>Chat on WhatsApp</span>
    </a>
  );
}
