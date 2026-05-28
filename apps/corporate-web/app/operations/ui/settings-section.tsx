"use client";

import { FormEvent } from "react";
import type { CorporateTenantSettings, CorporateTenant } from "../../../lib/types";

export interface SettingsSectionProps {
  settings: CorporateTenantSettings | null;
  selectedTenant: CorporateTenant | null | undefined;
  canEditSettings: boolean;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function SettingsSection({
  settings,
  selectedTenant,
  canEditSettings,
  busy,
  onSubmit
}: SettingsSectionProps) {
  return (
    <section className="ops-page active">
      <form className="ops-form" onSubmit={onSubmit}>
        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Corporate profile</h3>
            </div>
          </div>

          <div className="ops-fields two">
            <label>
              Company display name
              <input
                defaultValue={settings?.companyDisplayName ?? selectedTenant?.name ?? ""}
                disabled={!canEditSettings}
                name="companyDisplayName"
                required
              />
            </label>
            <label>
              Support email
              <input
                defaultValue={settings?.supportEmail ?? ""}
                disabled={!canEditSettings}
                name="supportEmail"
                placeholder="support@futurepay.in"
                type="email"
              />
            </label>
          </div>

          <div className="ops-fields two">
            <label>
              Support phone
              <input
                defaultValue={settings?.supportPhone ?? ""}
                disabled={!canEditSettings}
                name="supportPhone"
                placeholder="+91 98765 43210"
              />
            </label>
            <label>
              Registered address
              <input
                defaultValue={settings?.registeredAddress ?? ""}
                disabled={!canEditSettings}
                name="registeredAddress"
                placeholder="Corporate registered address"
              />
            </label>
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Transaction controls</h3>
            </div>
          </div>

          <div className="ops-fields two">
            <label>
              Default approval note template
              <textarea
                defaultValue={settings?.defaultApprovalNoteTemplate ?? ""}
                disabled={!canEditSettings}
                name="defaultApprovalNoteTemplate"
                placeholder="Submitted by maker for checker approval"
              />
            </label>
            <label>
              Duplicate Transaction Reference Check
              <label className="ops-toggle">
                <input
                  defaultChecked={
                    (settings?.duplicateReferencePolicy ?? "enabled") === "enabled"
                  }
                  disabled={!canEditSettings}
                  name="duplicateReferencePolicy"
                  type="checkbox"
                />
                <span className="ops-toggle-track">
                  <span className="ops-toggle-thumb" />
                </span>
                <span className="ops-toggle-label">On / Off</span>
              </label>
            </label>
          </div>

          <div className="ops-fields three">
            <label>
              Max single transaction amount (INR)
              <input
                defaultValue={settings ? settings.maxSingleTransactionAmount / 100 : 500000}
                disabled={!canEditSettings}
                inputMode="decimal"
                min={1}
                name="maxSingleTransactionAmount"
                placeholder="500000.00"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label>
              Max daily cumulative transaction amount (INR)
              <input
                defaultValue={
                  settings ? settings.maxDailyCumulativeTransactionAmount / 100 : 5000000
                }
                disabled={!canEditSettings}
                inputMode="decimal"
                min={1}
                name="maxDailyCumulativeTransactionAmount"
                placeholder="5000000.00"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label>
              Max bulk upload rows
              <input
                defaultValue={settings?.maxBulkUploadRows ?? 100}
                disabled={!canEditSettings}
                min={1}
                name="maxBulkUploadRows"
                required
                step="1"
                type="number"
              />
            </label>
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Custom Metadata Fields</h3>
              <p className="ops-panel-desc" style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Define up to 4 custom metadata fields that will appear as native inputs in your payout creation UI and as spreadsheet columns for bulk uploads.
              </p>
            </div>
          </div>

          <div className="ops-fields two">
            <label>
              Field 1 Name
              <input
                defaultValue={settings?.metadataFields?.[0] ?? ""}
                disabled={!canEditSettings}
                name="metadataField1"
                placeholder="e.g. Invoice Number"
                maxLength={40}
              />
            </label>
            <label>
              Field 2 Name
              <input
                defaultValue={settings?.metadataFields?.[1] ?? ""}
                disabled={!canEditSettings}
                name="metadataField2"
                placeholder="e.g. Cost Center"
                maxLength={40}
              />
            </label>
          </div>

          <div className="ops-fields two">
            <label>
              Field 3 Name
              <input
                defaultValue={settings?.metadataFields?.[2] ?? ""}
                disabled={!canEditSettings}
                name="metadataField3"
                placeholder="e.g. Department"
                maxLength={40}
              />
            </label>
            <label>
              Field 4 Name
              <input
                defaultValue={settings?.metadataFields?.[3] ?? ""}
                disabled={!canEditSettings}
                name="metadataField4"
                placeholder="e.g. Project Code"
                maxLength={40}
              />
            </label>
          </div>
        </section>

        <section className="ops-panel" style={{ borderTop: "none", paddingTop: "0" }}>
          <div className="ops-actions" style={{ marginTop: "0" }}>
            <button
              className="ops-button primary"
              disabled={busy || !canEditSettings}
              type="submit"
            >
              {busy ? "Saving..." : "Save settings"}
            </button>
          </div>
        </section>
      </form>
    </section>
  );
}
