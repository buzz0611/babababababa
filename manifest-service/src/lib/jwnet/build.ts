import 'server-only';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getCompany, linksForManifest, loadManifests, loadSecondaries } from '../data';
import type { JwnetPayload } from './payload';

/** DB の内容から JWNET 送信内容を組み立てる */
export async function buildManifestPayload(manifestId: number, kind: 'disposal_end' | 'final_disposal_end'): Promise<JwnetPayload> {
  const company = await getCompany();
  const [m] = await loadManifests({ ids: [manifestId] });
  if (!m) throw new Error('マニフェストが見つかりません');
  const [facility] = await db.select().from(schema.facilities).where(eq(schema.facilities.id, m.facilityId));
  const links = await linksForManifest(m.id);
  const secs = await loadSecondaries({ ids: links.map((l) => l.secondaryId) });
  const fac = { name: facility.name, address: facility.address, permitNo: facility.permitNo };

  if (kind === 'disposal_end') {
    if (!m.disposalEndDate) throw new Error('処分終了日が未入力です');
    return {
      kind,
      report: {
        subscriberNo: company.jwnetSubscriberNo,
        manifestNo: m.manifestNo,
        disposalEndDate: m.disposalEndDate,
        receivedDate: m.receivedDate,
        facility: fac,
        disposalMethod: m.disposalMethod,
        disposedQtyT: m.disposedQtyT,
        residues: secs.map((s) => ({
          wasteType: s.wasteType,
          qtyT: links.find((l) => l.secondaryId === s.id)?.allocatedQtyT ?? null,
          destination: `${s.disposerName} ${s.destAddress}`.trim(),
        })),
        isFinalDisposal: facility.isFinalDisposal,
      },
    };
  }
  if (!m.finalDisposalDate) throw new Error('最終処分終了日が未入力です');
  const disposerIds = secs.map((s) => s.disposerId);
  const disposers = disposerIds.length
    ? await db.select().from(schema.partners).where(inArray(schema.partners.id, disposerIds))
    : [];
  return {
    kind,
    report: {
      subscriberNo: company.jwnetSubscriberNo,
      manifestNo: m.manifestNo,
      finalDisposalDate: m.finalDisposalDate,
      finalDisposalPlace: m.finalDisposalPlace,
      facilities: [fac, ...disposers.map((d) => ({ name: d.name, address: d.address, permitNo: d.permitNo }))],
    },
  };
}

export async function buildSecondaryPayload(secondaryId: number): Promise<JwnetPayload> {
  const company = await getCompany();
  const [s] = await db.select().from(schema.secondaryManifests).where(eq(schema.secondaryManifests.id, secondaryId));
  if (!s) throw new Error('二次マニフェストが見つかりません');
  const partnerOf = async (id: number | null) =>
    id ? (await db.select().from(schema.partners).where(eq(schema.partners.id, id)))[0] : undefined;
  const [tr, dp] = await Promise.all([partnerOf(s.transporterId), partnerOf(s.disposerId)]);
  const links = await db
    .select({ manifestNo: schema.manifests.manifestNo, allocatedQtyT: schema.secondaryLinks.allocatedQtyT })
    .from(schema.secondaryLinks)
    .innerJoin(schema.manifests, eq(schema.manifests.id, schema.secondaryLinks.manifestId))
    .where(eq(schema.secondaryLinks.secondaryId, s.id));
  return {
    kind: 'register_secondary',
    report: {
      subscriberNo: company.jwnetSubscriberNo,
      manifestNo: s.manifestNo,
      handoverDate: s.issueDate,
      wasteType: s.wasteType,
      wasteName: s.wasteName,
      qtyT: s.qtyT,
      transporterSubscriberNo: tr?.jwnetSubscriberNo ?? '',
      disposerSubscriberNo: dp?.jwnetSubscriberNo ?? '',
      destAddress: s.destAddress,
      disposalMethod: s.disposalMethod,
      sourceManifests: links,
    },
  };
}
