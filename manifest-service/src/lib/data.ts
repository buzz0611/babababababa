import 'server-only';
import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '@/db';
import { fiscalYear, todayJst, type DateStr } from './domain/dates';
import { primaryTasks, secondaryTasks, worstState, type Task, type TaskState } from './domain/deadlines';

const { manifests, secondaryManifests, secondaryLinks, partners, facilities, emitterSites } = schema;

export async function getCompany() {
  const [c] = await db.select().from(schema.company).where(eq(schema.company.id, 1));
  if (c) return c;
  const [created] = await db.insert(schema.company).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(schema.company))[0];
}

export const listFacilities = (activeOnly = false) =>
  db.select().from(facilities).where(activeOnly ? eq(facilities.active, true) : undefined).orderBy(asc(facilities.id));

export type PartnerRole = 'emitter' | 'transporter' | 'disposer';
export function listPartners(role?: PartnerRole) {
  const cond = role === 'emitter' ? eq(partners.isEmitter, true)
    : role === 'transporter' ? eq(partners.isTransporter, true)
      : role === 'disposer' ? eq(partners.isDisposer, true) : undefined;
  return db.select().from(partners).where(cond).orderBy(asc(partners.name));
}

export const listEmitterSites = () => db.select().from(emitterSites).orderBy(asc(emitterSites.name));

// ---- 一次マニフェスト ----
const emitter = alias(partners, 'emitter');
const transporter = alias(partners, 'transporter');

export type ManifestRow = typeof manifests.$inferSelect & {
  emitterName: string;
  transporterName: string | null;
  siteName: string | null;
  facilityName: string;
  isFinalFacility: boolean;
  tasks: Task[];
  state: TaskState;
};

export async function loadManifests(opts: { ids?: number[]; facilityId?: number } = {}): Promise<ManifestRow[]> {
  const conds: SQL[] = [];
  if (opts.ids) conds.push(opts.ids.length ? inArray(manifests.id, opts.ids) : eq(manifests.id, -1));
  if (opts.facilityId) conds.push(eq(manifests.facilityId, opts.facilityId));
  const rows = await db
    .select({
      m: manifests,
      emitterName: emitter.name,
      transporterName: transporter.name,
      siteName: emitterSites.name,
      facilityName: facilities.name,
      isFinalFacility: facilities.isFinalDisposal,
    })
    .from(manifests)
    .innerJoin(emitter, eq(emitter.id, manifests.emitterId))
    .innerJoin(facilities, eq(facilities.id, manifests.facilityId))
    .leftJoin(transporter, eq(transporter.id, manifests.transporterId))
    .leftJoin(emitterSites, eq(emitterSites.id, manifests.emitterSiteId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(manifests.issueDate), desc(manifests.id));
  const today = todayJst();
  return rows.map((r) => {
    const tasks = primaryTasks(r.m, today, r.isFinalFacility);
    return { ...r.m, emitterName: r.emitterName, transporterName: r.transporterName, siteName: r.siteName, facilityName: r.facilityName, isFinalFacility: r.isFinalFacility, tasks, state: worstState(tasks) };
  });
}

// ---- 二次マニフェスト ----
const disposer = alias(partners, 'disposer');

export type SecondaryRow = typeof secondaryManifests.$inferSelect & {
  disposerName: string;
  transporterName: string | null;
  facilityName: string;
  tasks: Task[];
  state: TaskState;
};

export async function loadSecondaries(opts: { ids?: number[]; facilityId?: number } = {}): Promise<SecondaryRow[]> {
  const conds: SQL[] = [];
  if (opts.ids) conds.push(opts.ids.length ? inArray(secondaryManifests.id, opts.ids) : eq(secondaryManifests.id, -1));
  if (opts.facilityId) conds.push(eq(secondaryManifests.facilityId, opts.facilityId));
  const rows = await db
    .select({ s: secondaryManifests, disposerName: disposer.name, transporterName: transporter.name, facilityName: facilities.name })
    .from(secondaryManifests)
    .innerJoin(disposer, eq(disposer.id, secondaryManifests.disposerId))
    .innerJoin(facilities, eq(facilities.id, secondaryManifests.facilityId))
    .leftJoin(transporter, eq(transporter.id, secondaryManifests.transporterId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(secondaryManifests.issueDate), desc(secondaryManifests.id));
  const today = todayJst();
  return rows.map((r) => {
    const tasks = secondaryTasks(r.s, today);
    return { ...r.s, disposerName: r.disposerName, transporterName: r.transporterName, facilityName: r.facilityName, tasks, state: worstState(tasks) };
  });
}

export async function linksForSecondary(secondaryId: number) {
  return db.select().from(secondaryLinks).where(eq(secondaryLinks.secondaryId, secondaryId));
}
export async function linksForManifest(manifestId: number) {
  return db.select().from(secondaryLinks).where(eq(secondaryLinks.manifestId, manifestId));
}

// ---- 帳簿の閉鎖 ----
export async function closedYears(facilityId: number): Promise<Set<number>> {
  const rows = await db.select().from(schema.ledgerClosures).where(eq(schema.ledgerClosures.facilityId, facilityId));
  return new Set(rows.map((r) => r.fiscalYear));
}

/** 閉鎖済みの帳簿年度に属する日付が含まれていればその年度を返す */
export async function findClosedYear(facilityId: number, dates: (DateStr | null | undefined)[]): Promise<number | null> {
  const closed = await closedYears(facilityId);
  if (!closed.size) return null;
  const { ledgerStartMonth } = await getCompany();
  for (const d of dates) {
    if (d && closed.has(fiscalYear(d, ledgerStartMonth))) return fiscalYear(d, ledgerStartMonth);
  }
  return null;
}
