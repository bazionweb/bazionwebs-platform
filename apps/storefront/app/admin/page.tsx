"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminDashboard } from "./admin-dashboard";
import { MinistryAdminDashboard } from "./ministry-admin";

export default function AdminPage() {
  const [view, setView] = useState<"ministry" | "platform">("ministry");

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--church-bg-alt)", fontFamily: "var(--church-font)" }}>
      <header
        style={{
          backgroundColor: "var(--church-primary)",
          color: "#ffffff",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/" style={{ color: "#ffffff", textDecoration: "none", fontWeight: 800, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "var(--church-gold)" }}>✝</span> GLOBAL MISSION FC
          </Link>
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", background: "rgba(217, 119, 6, 0.2)", color: "var(--church-gold)", padding: "3px 8px", borderRadius: "10px", fontWeight: 700 }}>
            Admin Portal
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.1)", borderRadius: "6px", padding: "2px" }}>
            <button
              type="button"
              onClick={() => setView("ministry")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                backgroundColor: view === "ministry" ? "var(--church-gold)" : "transparent",
                color: view === "ministry" ? "#0a192f" : "#ffffff",
              }}
            >
              Ministry Operations
            </button>
            <button
              type="button"
              onClick={() => setView("platform")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                backgroundColor: view === "platform" ? "var(--church-gold)" : "transparent",
                color: view === "platform" ? "#0a192f" : "#ffffff",
              }}
            >
              Platform Tenants
            </button>
          </div>
          <Link
            href="/"
            style={{
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
              fontSize: "13px",
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            ← View Public Site
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
        {view === "ministry" ? (
          <MinistryAdminDashboard />
        ) : (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "8px", border: "1px solid var(--church-border)" }}>
            <AdminDashboard />
          </div>
        )}
      </div>

      <footer style={{ padding: "24px", textAlign: "center", fontSize: "12px", color: "var(--church-muted)", borderTop: "1px solid var(--church-border)", marginTop: "40px" }}>
        <span>GLOBAL MISSION FOR CHRIST INTERNATIONAL · POWERED BY BAZION WEB MULTI-TENANT ARCHITECTURE</span>
      </footer>
    </main>
  );
}
