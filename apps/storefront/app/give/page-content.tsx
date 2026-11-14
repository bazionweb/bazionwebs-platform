"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteChrome } from "../../components/gmfc/SiteChrome";
import { PageHero } from "../../components/gmfc/PageHero";
import { getClientTenantHeaders } from "../../lib/client-tenant";
import { useMinistrySite } from "../../lib/use-ministry-site";

interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  targetAmountMinor: number;
  raisedAmountMinor: number;
  currency: string;
}

const CATEGORIES = [
  "General Ministry",
  "Worship and Teaching",
  "Community Outreach",
  "Missions",
  "Youth and Families",
  "Other",
];

function extractAccountNo(instructions: string | undefined): string {
  if (!instructions) return "262518";
  const match = instructions.match(/Account\s*No:\s*([A-Za-z0-9-]+)/i);
  return match?.[1] ?? "262518";
}

export default function GivePage() {
  const site = useMinistrySite();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [phone, setPhone] = useState("");
  const [donorName, setDonorName] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [campaigns, setCampaigns] = useState<PublicCampaign[]>([]);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "starting" | "pending" | "verified" | "failed">("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ idempotencyKey: string; statusToken: string } | null>(null);

  const effectiveAmount = selectedAmount !== null ? selectedAmount : Number(customAmount) || 0;
  const paybillNo = site.giving.mpesaPaybill || "247 247";
  const accountNo = extractAccountNo(site.giving.instructions);
  const accountName = site.giving.accountName || "GLOBAL · YINV";
  const amounts = site.giving.suggestedAmounts.length > 0 ? site.giving.suggestedAmounts : [500, 1000, 2500, 5000];
  const whatsappPhone = site.contact.whatsappNumber || site.contact.phones[1] || site.contact.phones[0] || "+254 721 341793";
  const whatsappDigits = whatsappPhone.replace(/[^0-9]/g, "");

  useEffect(() => {
    let active = true;
    fetch("/v1/public/church/campaigns", { headers: getClientTenantHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error("Campaign information is unavailable.");
        return response.json() as Promise<{ campaigns: PublicCampaign[] }>;
      })
      .then((data) => {
        if (active) setCampaigns(data.campaigns);
      })
      .catch((error: unknown) => {
        if (active) setCampaignsError(error instanceof Error ? error.message : "Campaign information is unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (paymentStatus !== "pending" || !attempt) return;
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await fetch("/v1/public/church/donations/status", {
          headers: { "X-Donation-Status-Token": attempt.statusToken, ...getClientTenantHeaders() },
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          status?: string;
          paymentStatus?: string;
          providerReference?: string | null;
        };
        if (!active) return;
        if (data.paymentStatus === "verified" && data.status === "succeeded") {
          setPaymentReference(data.providerReference ?? null);
          setPaymentMessage("Safaricom confirmed your donation.");
          setPaymentStatus("verified");
        } else if (data.paymentStatus === "failed" || data.status === "failed") {
          setPaymentMessage("Safaricom did not complete this payment. No donation was recorded as received.");
          setPaymentStatus("failed");
        }
      } catch {
        // Keep polling on transient errors
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => {
      void checkStatus();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [attempt, paymentStatus]);

  const handleMpesaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isSafeInteger(effectiveAmount) || effectiveAmount < 10) {
      setPaymentError("Please enter a whole KES amount of at least 10.");
      return;
    }
    const paymentAttempt = {
      idempotencyKey: crypto.randomUUID(),
      statusToken: `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`,
    };
    setAttempt(paymentAttempt);
    setPaymentStatus("starting");
    setPaymentError(null);
    setPaymentMessage("");
    setPaymentReference(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/v1/public/church/donations/mpesa-stk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": paymentAttempt.idempotencyKey,
          "X-Donation-Status-Token": paymentAttempt.statusToken,
          ...getClientTenantHeaders(),
        },
        body: JSON.stringify({
          amount: effectiveAmount,
          phoneNumber: phone.trim(),
          givingCategory: category,
          ...(selectedCampaignId ? { campaignId: selectedCampaignId } : {}),
          donorName: donorName.trim() || undefined,
          anonymous: !donorName.trim(),
          privacyConsent: true,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setPaymentStatus(data?.error === "PAYMENT_REQUEST_REJECTED" ? "failed" : "idle");
        setPaymentError(
          typeof data?.message === "string"
            ? data.message
            : "Online giving is unavailable. Use the Paybill instructions above.",
        );
        if (response.status === 503 || response.status === 502) setAttempt(null);
        return;
      }
      setPaymentMessage(
        typeof data?.message === "string"
          ? data.message
          : "Payment request received; waiting for Safaricom confirmation.",
      );
      setPaymentStatus(data?.status === "failed" ? "failed" : "pending");
    } catch (error) {
      setPaymentMessage(
        "We could not confirm whether Safaricom received the request. Checking payment status; do not submit another payment yet.",
      );
      setPaymentError(error instanceof Error ? error.message : "The request status is unknown.");
      setPaymentStatus("pending");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SiteChrome currentPath="/give">
      <main id="main-content" className="gmfci-give-main">
        <PageHero
          eyebrow="Partner With Us"
          title="Give to the Mission"
          subtitle="Help us propagate revival to the nations. Every gift makes an eternal difference."
        />

        <section className="gmfci-give-section">
          {/* Exact D:\new-gmfc Hero Give Card */}
          <div className="gmfci-give-hero-card">
            <div className="gmfci-give-hero-left">
              <div className="gmfci-give-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                M-Pesa · Equity Paybill
              </div>
              <h2>Give via Mobile Money</h2>
              <p>
                Fast, secure and instant. Use your M-Pesa to support the ministry directly through
                Equity Bank Paybill, or request an instant M-Pesa STK prompt below.
              </p>

              <div className="gmfci-give-amounts">
                <span>Common amounts:</span>
                <div className="gmfci-give-amount-chips">
                  {amounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(amt);
                        setCustomAmount("");
                        document.getElementById("online-stk-giving")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      style={{
                        border: selectedAmount === amt ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.15)",
                        background: selectedAmount === amt ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.08)",
                        color: "white",
                        fontSize: "13px",
                        fontWeight: 600,
                        padding: "6px 14px",
                        borderRadius: "999px",
                        cursor: "pointer",
                      }}
                    >
                      KES {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="gmfci-give-hero-right">
              <div className="gmfci-give-phone-card">
                <div className="gmfci-give-phone-header">
                  <div className="gmfci-give-equity-logo">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="10" />
                      <path
                        d="M8 12l3 3 5-5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </div>
                  <span>Lipa na M-Pesa · Paybill</span>
                </div>

                <div className="gmfci-give-detail-block">
                  <div className="gmfci-give-detail-item">
                    <span className="gmfci-give-detail-label">Business No.</span>
                    <span className="gmfci-give-detail-number">{paybillNo}</span>
                  </div>
                  <div className="gmfci-give-divider" />
                  <div className="gmfci-give-detail-item">
                    <span className="gmfci-give-detail-label">Account No.</span>
                    <span className="gmfci-give-detail-number">{accountNo}</span>
                  </div>
                  <div className="gmfci-give-divider" />
                  <div className="gmfci-give-detail-item">
                    <span className="gmfci-give-detail-label">Account Name</span>
                    <span className="gmfci-give-detail-name">{accountName}</span>
                  </div>
                </div>

                <div className="gmfci-give-steps-compact">
                  <p className="gmfci-give-steps-title">How to pay</p>
                  <ol>
                    <li>M-Pesa → Lipa na M-Pesa → Paybill</li>
                    <li>
                      Business No: <strong>{paybillNo}</strong>
                    </li>
                    <li>
                      Account No: <strong>{accountNo}</strong>
                    </li>
                    <li>Enter amount &amp; confirm with PIN</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Online STK Push & Campaigns layered on top */}
          <div
            id="online-stk-giving"
            style={{
              backgroundColor: "#ffffff",
              padding: "36px",
              borderRadius: "20px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              marginBottom: "36px",
            }}
          >
            {paymentStatus === "pending" || paymentStatus === "verified" || paymentStatus === "failed" ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: "48px", marginBottom: "14px" }}>
                  {paymentStatus === "verified" ? "✅" : paymentStatus === "failed" ? "⚠️" : "📲"}
                </div>
                <h3 style={{ fontSize: "22px", color: "#4a1110", marginBottom: "8px", fontFamily: "var(--font-outfit)" }}>
                  {paymentStatus === "verified"
                    ? "Donation Confirmed"
                    : paymentStatus === "failed"
                      ? "Payment Not Completed"
                      : "Waiting for Payment Confirmation"}
                </h3>
                <p style={{ fontSize: "15px", color: "#374151", lineHeight: 1.6, marginBottom: "18px" }}>
                  {paymentMessage || `Check ${phone} for an M-Pesa prompt and approve it to continue.`}
                </p>
                <div
                  style={{
                    padding: "14px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "10px",
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "20px",
                  }}
                >
                  {paymentStatus === "verified" ? (
                    <>
                      Payment reference: <strong>{paymentReference ?? "confirmed"}</strong>. Fund:{" "}
                      <em>{category}</em>.
                    </>
                  ) : paymentStatus === "failed" ? (
                    "The payment was not counted as received. You can start a new attempt if you want to try again."
                  ) : (
                    "Your donation is not recorded as received until Safaricom confirmation arrives."
                  )}
                </div>
                <button
                  type="button"
                  className="ch-btn ch-btn-outline"
                  disabled={paymentStatus === "pending"}
                  onClick={() => {
                    setPaymentStatus("idle");
                    setPaymentError(null);
                    setAttempt(null);
                    setPaymentMessage("");
                    setPrivacyConsent(false);
                  }}
                >
                  Make Another Donation
                </button>
              </div>
            ) : (
              <form onSubmit={handleMpesaSubmit} style={{ display: "grid", gap: "18px" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#b45e14" }}>
                    Online Giving Portal
                  </span>
                  <h3 style={{ fontSize: "24px", color: "#4a1110", margin: "6px 0", fontFamily: "var(--font-outfit)" }}>
                    Give Instantly with M-Pesa STK Push
                  </h3>
                  <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                    Submit your phone number to receive a prompt directly on your device.
                  </p>
                </div>

                {paymentError && <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{paymentError}</p>}

                <div className="gmfci-form-row">
                  <div className="gmfci-form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="custom-giving-amount">Amount (KES)</label>
                    <input
                      id="custom-giving-amount"
                      type="number"
                      min={10}
                      max={250000}
                      value={selectedAmount !== null ? String(selectedAmount) : customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setSelectedAmount(null);
                      }}
                      placeholder="1000"
                    />
                  </div>
                  <div className="gmfci-form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="giving-category">Giving Purpose</label>
                    <select
                      id="giving-category"
                      value={selectedCampaignId ? `campaign:${selectedCampaignId}` : `category:${category}`}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith("campaign:")) {
                          const campaign = campaigns.find((item) => item.id === value.slice("campaign:".length));
                          setSelectedCampaignId(campaign?.id ?? "");
                          if (campaign) setCategory(campaign.title.slice(0, 80));
                        } else {
                          setSelectedCampaignId("");
                          setCategory(value.slice("category:".length));
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "13px 16px",
                        border: "1.5px solid #e5e7eb",
                        borderRadius: "10px",
                        fontSize: "15px",
                        background: "#fafafa",
                      }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={`category:${c}`}>
                          {c}
                        </option>
                      ))}
                      {campaigns.length > 0 && (
                        <optgroup label="Active campaigns">
                          {campaigns.map((campaign) => (
                            <option key={campaign.id} value={`campaign:${campaign.id}`}>
                              {campaign.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                <div className="gmfci-form-row">
                  <div className="gmfci-form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="giving-phone">M-Pesa Mobile Number *</label>
                    <input
                      id="giving-phone"
                      type="tel"
                      required
                      placeholder="e.g. 0721341793 or 254721341793"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="gmfci-form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="giving-donor-name">Donor Name (Optional)</label>
                    <input
                      id="giving-donor-name"
                      type="text"
                      placeholder="Leave blank for anonymous gift"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                    />
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.6, color: "#4b5563" }}>
                  <input
                    type="checkbox"
                    required
                    checked={privacyConsent}
                    onChange={(event) => setPrivacyConsent(event.target.checked)}
                    style={{ marginTop: 3, minWidth: 16, minHeight: 16 }}
                  />
                  <span>
                    I understand that these details are used to process and reconcile this gift. Read the{" "}
                    <Link href="/privacy" style={{ textDecoration: "underline", color: "#4a1110" }}>
                      privacy notice
                    </Link>
                    .
                  </span>
                </label>

                <button type="submit" disabled={isSubmitting} className="gmfci-form-submit">
                  {isSubmitting
                    ? "Triggering STK Push..."
                    : `Give KES ${effectiveAmount.toLocaleString()} via M-Pesa`}
                </button>
              </form>
            )}
          </div>

          {/* Active Campaigns if any exist */}
          {campaigns.length > 0 && (
            <div style={{ marginBottom: "36px" }}>
              <h3 style={{ fontSize: "22px", color: "#4a1110", marginBottom: "16px", fontFamily: "var(--font-outfit)" }}>
                Active Ministry Campaigns
              </h3>
              <div className="ch-grid-3">
                {campaigns.map((camp) => {
                  const targetAmount = camp.targetAmountMinor / 100;
                  const raisedAmount = camp.raisedAmountMinor / 100;
                  const pct = targetAmount > 0 ? Math.min(100, Math.round((raisedAmount / targetAmount) * 100)) : 0;
                  return (
                    <div key={camp.id} className="ch-card">
                      <div className="ch-card-body">
                        <span className="ch-sermon-badge">Campaign</span>
                        <h4 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px", color: "#4a1110" }}>
                          {camp.title}
                        </h4>
                        <p style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.6, marginBottom: "16px" }}>
                          {camp.description ?? "Support this ministry campaign."}
                        </p>
                        <div style={{ marginTop: "auto" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                            <span>Raised: <strong>{camp.currency} {raisedAmount.toLocaleString()}</strong></span>
                            <span>Target: <strong>{camp.currency} {targetAmount.toLocaleString()}</strong></span>
                          </div>
                          <div style={{ height: "8px", backgroundColor: "#e5e7eb", borderRadius: "999px", overflow: "hidden", marginBottom: "14px" }}>
                            <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#e47a2b" }} />
                          </div>
                          <button
                            type="button"
                            className="gmfci-form-submit"
                            style={{ padding: "10px 16px", fontSize: "14px" }}
                            onClick={() => {
                              setSelectedCampaignId(camp.id);
                              setCategory(camp.title.slice(0, 80));
                              document.getElementById("online-stk-giving")?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            Support This Campaign ({pct}% funded)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {campaignsError && <p role="status">{campaignsError}</p>}
            </div>
          )}

          {/* Exact Contact Bar from D:\new-gmfc */}
          <div className="gmfci-give-contact-bar">
            <p>For other giving methods, international transfers, or cheques, please contact us:</p>
            <div className="gmfci-give-contact-links">
              {site.contact.email && (
                <a href={`mailto:${site.contact.email}`} className="gmfci-give-contact-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  {site.contact.email}
                </a>
              )}
              {whatsappDigits && (
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  className="gmfci-give-contact-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                  </svg>
                  {site.contact.phones[1] || site.contact.phones[0] || whatsappPhone}
                </a>
              )}
            </div>
          </div>

          {/* Exact Scripture Quote from D:\new-gmfc */}
          <div className="gmfci-give-quote-wrap">
            <div className="gmfci-give-quote-mark">&ldquo;</div>
            <blockquote className="gmfci-give-quote">
              {site.scripture.verse ||
                "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver."}
            </blockquote>
            <cite>— {site.scripture.reference || "2 Corinthians 9:7"}</cite>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
