import { IdentityAccessService } from "../identity-access/service.js";
import type { CorporateTenantSettingsRequest } from "./contracts.js";
export declare class SettingsManagementService {
    private readonly identityAccessService;
    private readonly db;
    constructor(identityAccessService?: IdentityAccessService);
    getSettingsForCorporateTenant(corporateTenantId: string): Promise<{
        corporateTenantId: string;
        companyDisplayName: string;
        supportEmail: string | null;
        supportPhone: string | null;
        registeredAddress: string | null;
        defaultApprovalNoteTemplate: string | null;
        maxSingleTransactionAmount: number;
        maxDailyCumulativeTransactionAmount: number;
        maxBulkUploadRows: number;
        duplicateReferencePolicy: "disabled" | "enabled";
        updatedAt: string | null;
        updatedByUserId: string | null;
        updatedByRole: string | null;
    } | null>;
    getSettingsForView(corporateTenantId: string, actedByUserId: string): Promise<{
        error: "forbidden";
        data?: undefined;
    } | {
        error: "tenant_not_found";
        data?: undefined;
    } | {
        data: {
            corporateTenantId: string;
            companyDisplayName: string;
            supportEmail: string | null;
            supportPhone: string | null;
            registeredAddress: string | null;
            defaultApprovalNoteTemplate: string | null;
            maxSingleTransactionAmount: number;
            maxDailyCumulativeTransactionAmount: number;
            maxBulkUploadRows: number;
            duplicateReferencePolicy: "disabled" | "enabled";
            updatedAt: string | null;
            updatedByUserId: string | null;
            updatedByRole: string | null;
        };
        error?: undefined;
    }>;
    upsertSettings(payload: CorporateTenantSettingsRequest): Promise<{
        error: "forbidden";
        data?: undefined;
    } | {
        error: "tenant_not_found";
        data?: undefined;
    } | {
        data: {
            corporateTenantId: string;
            companyDisplayName: string;
            supportEmail: string | null;
            supportPhone: string | null;
            registeredAddress: string | null;
            defaultApprovalNoteTemplate: string | null;
            maxSingleTransactionAmount: number;
            maxDailyCumulativeTransactionAmount: number;
            maxBulkUploadRows: number;
            duplicateReferencePolicy: "disabled" | "enabled";
            updatedAt: string | null;
            updatedByUserId: string | null;
            updatedByRole: string | null;
        };
        error?: undefined;
    }>;
}
