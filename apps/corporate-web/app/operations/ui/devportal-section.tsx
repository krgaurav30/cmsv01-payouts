"use client";

export function DevPortalSection({ bankOpsPortalBase }: { bankOpsPortalBase: string }) {
  return (
    <section className="ops-page active" style={{ padding: 0, height: "100%", overflow: "hidden" }}>
      <iframe
        className="ops-devportal-frame"
        src={`${bankOpsPortalBase}/developer-portal?embed=true`}
        title="Future Pay Developer Portal"
        style={{ border: "none", borderRadius: 0, width: "100%", height: "calc(100vh - 100px)", minHeight: "800px", display: "block" }}
      />
    </section>
  );
}
