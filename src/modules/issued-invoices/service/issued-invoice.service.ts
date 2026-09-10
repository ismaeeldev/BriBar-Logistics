/**
 * Issued-invoice administration (ERP roadmap Phase 4). Admin-only end to
 * end, mirroring `received-invoice.service.ts`'s structure — see ADR 0015
 * for what differs and why.
 */
import {
  AuditAction,
  AuditEntityType,
  diffForAudit,
  writeAudit,
} from '@/lib/audit/audit-service';
import type { Actor } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { withTranslatedErrors } from '@/lib/db/with-translated-errors';
import { businessRuleViolation, forbidden, notFound } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { clientRepository } from '@/modules/clients/repository/client.repository';
import { lookupRepository } from '@/modules/lookup/repository/lookup.repository';
import { Role } from '@/modules/services/domain/service-status';
import { formatDocumentCode } from '@/modules/shared/domain/document-sequence';
import { applyVat, type VatRate } from '@/modules/shared/domain/vat';
import type { Pagination } from '@/modules/shared/schemas/common';
import {
  issuedInvoiceRepository,
  type BillableService,
  type IssuedInvoiceWithRelations,
} from '../repository/issued-invoice.repository';
import type {
  CreateIssuedInvoiceInput,
  UpdateIssuedInvoiceInput,
} from '../schemas/issued-invoice.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const issuedInvoiceService = {
  async listPage(
    actor: Actor,
    filters: { clientId?: string },
    pagination: Pagination,
  ): Promise<{ items: IssuedInvoiceWithRelations[]; total: number }> {
    assertAdmin(actor);
    return issuedInvoiceRepository.listPage(filters, pagination);
  },

  async getById(actor: Actor, id: string): Promise<IssuedInvoiceWithRelations> {
    assertAdmin(actor);
    const found = await issuedInvoiceRepository.findById(id);
    if (!found) throw notFound();
    return found;
  },

  /** The invoice-creation picker's service list — see the repository method's doc comment. */
  async billableServicesForClient(actor: Actor, clientId: string): Promise<BillableService[]> {
    assertAdmin(actor);
    return issuedInvoiceRepository.billableServicesForClient(clientId);
  },

  /**
   * Groups a batch of approved, priced, unbilled services for one client
   * into a new invoice — "Base imponible = Σ service base" (roadmap's own
   * formula), computed here from the services rather than trusted from the
   * request: `input.serviceIds` names *which* rows to bill, never *how
   * much* they total to.
   */
  async create(actor: Actor, input: CreateIssuedInvoiceInput): Promise<IssuedInvoiceWithRelations> {
    assertAdmin(actor);

    const clientRecord = await clientRepository.findById(input.clientId);
    if (!clientRecord) throw notFound();

    if (input.stateId !== undefined) {
      const state = await lookupRepository.findById('INVOICE_STATE', input.stateId);
      if (!state) throw businessRuleViolation(ERRORS.lookupKindMismatch);
    }

    // Re-derives the same billable set the picker offered and checks every
    // requested id is actually in it — never trusts the request for which
    // services are approved, priced, unbilled, or even this client's own
    // (SRS 22.4's discipline, applied to a module the SRS does not cover).
    const billable = await issuedInvoiceRepository.billableServicesForClient(input.clientId);
    const billableById = new Map(billable.map((service) => [service.id, service]));

    const selected = input.serviceIds.map((id) => {
      const service = billableById.get(id);
      if (!service) throw businessRuleViolation(ERRORS.serviceNotBillable);
      return service;
    });

    const baseCents = selected.reduce((sum, service) => sum + (service.baseCents ?? 0), 0);
    const { vatCents, totalCents } = applyVat(baseCents, input.vatRate as VatRate);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const sequence = await issuedInvoiceRepository.nextInvoiceSequence(tx);

        const created = await issuedInvoiceRepository.create(
          {
            invoiceCode: formatDocumentCode('FE', 6, sequence),
            clientId: input.clientId,
            invoiceDate: new Date(`${input.invoiceDate}T00:00:00.000Z`),
            baseCents,
            vatRate: input.vatRate,
            vatCents,
            totalCents,
            stateId: input.stateId ?? null,
            notes: input.notes ?? null,
          },
          tx,
        );

        await issuedInvoiceRepository.linkServices(
          created.id,
          selected.map((service) => service.id),
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.ISSUED_INVOICE,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: {
            invoiceCode: created.invoiceCode,
            clientId: created.clientId,
            baseCents: created.baseCents,
            totalCents: created.totalCents,
            serviceIds: selected.map((service) => service.id),
          },
        });

        // Re-fetch through the repository's own include, so the returned
        // shape always matches `findById`/`listPage` rather than a
        // hand-assembled approximation of it.
        const withServices = await issuedInvoiceRepository.findById(created.id, tx);
        if (!withServices) throw notFound();
        return withServices;
      }),
    );
  },

  /**
   * Only the state and notes are editable after issuance — never the
   * client, date, VAT rate or the service list. Unlike every other module
   * built this session, an issued invoice's total is not a mistake to
   * correct in place: it is what a client was actually billed, and
   * "un-billing" a service to fix a total belongs to deleting the invoice
   * (which frees every service it grouped to be re-invoiced correctly) and
   * issuing a new one, not to a silent edit of the old one.
   */
  async update(
    actor: Actor,
    id: string,
    input: UpdateIssuedInvoiceInput,
  ): Promise<IssuedInvoiceWithRelations> {
    assertAdmin(actor);

    const existing = await issuedInvoiceRepository.findById(id);
    if (!existing) throw notFound();

    if (input.stateId !== undefined) {
      const state = await lookupRepository.findById('INVOICE_STATE', input.stateId);
      if (!state) throw businessRuleViolation(ERRORS.lookupKindMismatch);
    }

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await issuedInvoiceRepository.update(
          id,
          {
            ...(input.stateId === undefined ? {} : { stateId: input.stateId }),
            ...(input.notes === undefined ? {} : { notes: input.notes ?? null }),
          },
          tx,
        );

        const changes = diffForAudit(
          { stateId: existing.state?.id ?? null, notes: existing.notes },
          {
            ...(input.stateId === undefined ? {} : { stateId: input.stateId }),
            ...(input.notes === undefined ? {} : { notes: input.notes ?? null }),
          },
        );

        if (changes) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.ISSUED_INVOICE,
            entityId: id,
            action: AuditAction.UPDATE,
            before: changes.before,
            after: changes.after,
          });
        }

        return updated;
      }),
    );
  },

  /**
   * Deletes the invoice, freeing every service it grouped to be billed
   * again — see the doc comment on `issuedInvoiceRepository.delete`.
   */
  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await issuedInvoiceRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.ISSUED_INVOICE,
          entityId: id,
          action: AuditAction.DELETE,
          before: {
            invoiceCode: existing.invoiceCode,
            clientId: existing.clientId,
            totalCents: existing.totalCents,
            serviceIds: existing.services.map((service) => service.id),
          },
        });

        await issuedInvoiceRepository.delete(id, tx);
      }),
    );
  },
} as const;
