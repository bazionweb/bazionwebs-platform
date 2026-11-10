export interface ScriptureQuoteProps {
  verse: string;
  reference: string;
  version?: string;
}

export function ScriptureQuote({ verse, reference, version = "NKJV" }: ScriptureQuoteProps) {
  return (
    <div className="ch-scripture-box">
      <p className="ch-scripture-text">“{verse}”</p>
      <div className="ch-scripture-ref">
        — {reference} {version && `(${version})`}
      </div>
    </div>
  );
}
