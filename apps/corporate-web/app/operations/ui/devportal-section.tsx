"use client";

import { useEffect } from "react";

export function DevPortalSection({ bankOpsPortalBase }: { bankOpsPortalBase: string }) {
  useEffect(() => {
    // Hide scrollbar on the parent window to prevent parent page double-scrolling
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    
    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  return (
    <section className="ops-page active" style={{ padding: 0, height: "100%", overflow: "hidden" }}>
      <iframe
        className="ops-devportal-frame"
        src={`${bankOpsPortalBase}/developer-portal?embed=true`}
        title="Future Pay Developer Portal"
        style={{ border: "none", borderRadius: 0, width: "100%", height: "calc(100vh - 140px)", minHeight: "500px", display: "block" }}
      />
    </section>
  );
}
