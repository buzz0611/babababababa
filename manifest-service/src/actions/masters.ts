'use server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { audit } from '@/lib/audit';
import { requireAdmin, requireUser } from '@/lib/auth';
import { getCompany } from '@/lib/data';
import { bool, optDate, optInt, str, withMsg } from '@/lib/form';

const fkViolation = (e: unknown) => {
  const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  return code === '23503';
};

export async function saveCompany(fd: FormData) {
  const user = await requireAdmin();
  const before = await getCompany();
  const startMonth = optInt(fd, 'ledgerStartMonth') ?? 4;
  const values = {
    name: str(fd, 'name'), address: str(fd, 'address'), tel: str(fd, 'tel'), representative: str(fd, 'representative'),
    jwnetSubscriberNo: str(fd, 'jwnetSubscriberNo'),
    ledgerStartMonth: Math.min(12, Math.max(1, startMonth)),
  };
  await db.update(schema.company).set(values).where(eq(schema.company.id, 1));
  await audit(user.id, 'update', 'company', 1, before, values);
  redirect(withMsg('/masters', 'ok', '自社情報を保存しました'));
}

export async function saveFacility(fd: FormData) {
  const user = await requireAdmin();
  const id = optInt(fd, 'id');
  const values = {
    name: str(fd, 'name'), address: str(fd, 'address'), permitNo: str(fd, 'permitNo'), permitAuthority: str(fd, 'permitAuthority'),
    permitExpiry: optDate(fd, 'permitExpiry'), methods: str(fd, 'methods'), isFinalDisposal: bool(fd, 'isFinalDisposal'),
    active: id ? bool(fd, 'active') : true, updatedAt: new Date(),
  };
  if (!values.name || !values.address) redirect(withMsg('/masters', 'error', '事業場の名称と所在地は必須です'));
  if (id) {
    const [before] = await db.select().from(schema.facilities).where(eq(schema.facilities.id, id));
    await db.update(schema.facilities).set(values).where(eq(schema.facilities.id, id));
    await audit(user.id, 'update', 'facility', id, before, values);
  } else {
    const [row] = await db.insert(schema.facilities).values(values).returning();
    await audit(user.id, 'create', 'facility', row.id, null, values);
  }
  redirect(withMsg('/masters', 'ok', '処分事業場を保存しました'));
}

function readPartner(fd: FormData) {
  return {
    name: str(fd, 'name'), address: str(fd, 'address'), tel: str(fd, 'tel'),
    isEmitter: bool(fd, 'isEmitter'), isTransporter: bool(fd, 'isTransporter'), isDisposer: bool(fd, 'isDisposer'),
    permitNo: str(fd, 'permitNo'), permitAuthority: str(fd, 'permitAuthority'), permitExpiry: optDate(fd, 'permitExpiry'),
    jwnetSubscriberNo: str(fd, 'jwnetSubscriberNo'), note: str(fd, 'note'), updatedAt: new Date(),
  };
}

export async function savePartner(fd: FormData) {
  const user = await requireUser();
  const id = optInt(fd, 'id');
  const v = readPartner(fd);
  const back = id ? `/masters/partners/${id}` : '/masters/partners';
  if (!v.name) redirect(withMsg(back, 'error', '名称は必須です'));
  if (!v.isEmitter && !v.isTransporter && !v.isDisposer) redirect(withMsg(back, 'error', '区分（排出事業者・収集運搬・処分）を1つ以上選んでください'));
  if (id) {
    const [before] = await db.select().from(schema.partners).where(eq(schema.partners.id, id));
    await db.update(schema.partners).set({ ...v, active: bool(fd, 'active') }).where(eq(schema.partners.id, id));
    await audit(user.id, 'update', 'partner', id, before, v);
    redirect(withMsg(back, 'ok', '保存しました'));
  }
  const [row] = await db.insert(schema.partners).values(v).returning();
  await audit(user.id, 'create', 'partner', row.id, null, v);
  redirect(withMsg(`/masters/partners/${row.id}`, 'ok', '追加しました'));
}

export async function saveEmitterSite(fd: FormData) {
  const user = await requireUser();
  const partnerId = Number(str(fd, 'partnerId'));
  const id = optInt(fd, 'id');
  const values = { partnerId, name: str(fd, 'name'), address: str(fd, 'address'), updatedAt: new Date() };
  const back = `/masters/partners/${partnerId}`;
  if (!values.name) redirect(withMsg(back, 'error', '事業場名は必須です'));
  if (id) await db.update(schema.emitterSites).set(values).where(eq(schema.emitterSites.id, id));
  else await db.insert(schema.emitterSites).values(values);
  await audit(user.id, id ? 'update' : 'create', 'emitter_site', id ?? '', null, values);
  redirect(withMsg(back, 'ok', '排出事業場を保存しました'));
}

export async function deleteEmitterSite(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  const back = `/masters/partners/${str(fd, 'partnerId')}`;
  try {
    await db.delete(schema.emitterSites).where(eq(schema.emitterSites.id, id));
  } catch (e) {
    if (fkViolation(e)) redirect(withMsg(back, 'error', 'マニフェストで使われているため削除できません'));
    throw e;
  }
  await audit(user.id, 'delete', 'emitter_site', id);
  redirect(withMsg(back, 'ok', '削除しました'));
}

export async function saveContract(fd: FormData) {
  const user = await requireUser();
  const partnerId = Number(str(fd, 'partnerId'));
  const id = optInt(fd, 'id');
  const values = {
    partnerId, direction: str(fd, 'direction') === 'outbound' ? 'outbound' as const : 'inbound' as const,
    title: str(fd, 'title'), wasteTypes: str(fd, 'wasteTypes'), startDate: optDate(fd, 'startDate'), endDate: optDate(fd, 'endDate'),
    note: str(fd, 'note'), updatedAt: new Date(),
  };
  const back = `/masters/partners/${partnerId}`;
  if (!values.title) redirect(withMsg(back, 'error', '契約名は必須です'));
  if (id) await db.update(schema.contracts).set(values).where(eq(schema.contracts.id, id));
  else await db.insert(schema.contracts).values(values);
  await audit(user.id, id ? 'update' : 'create', 'contract', id ?? '', null, values);
  redirect(withMsg(back, 'ok', '契約を保存しました'));
}

export async function deleteContract(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  await db.delete(schema.contracts).where(eq(schema.contracts.id, id));
  await audit(user.id, 'delete', 'contract', id);
  redirect(withMsg(`/masters/partners/${str(fd, 'partnerId')}`, 'ok', '削除しました'));
}
