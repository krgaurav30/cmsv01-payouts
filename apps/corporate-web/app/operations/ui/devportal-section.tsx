"use client";

export function DevPortalSection({ bankOpsPortalBase }: { bankOpsPortalBase: string }) {
  return (
    <section className="ops-page active">
      <section className="ops-panel">
        <div className="ops-panel-head">
          <div>
            <h3>Developer portal</h3>
            <p className="ops-meta">
              Open and share the published partner APIs for beneficiary and payment flows.
            </p>
          </div>
          <div className="ops-actions">
            <a
              className="ops-button secondary ops-link-button"
              href={`${bankOpsPortalBase}/developer-portal`}
              rel="noreferrer"
              target="_blank"
            >
              Open full portal
            </a>
            <a className="ops-button primary ops-link-button" href="/bank/dev-portal/openapi/swagger-download">
              Download Swagger
            </a>
          </div>
        </div>

        <iframe
          className="ops-devportal-frame"
          src={`${bankOpsPortalBase}/developer-portal`}
          title="Future Pay Developer Portal"
        />
      </section>
    </section>
  );
}
