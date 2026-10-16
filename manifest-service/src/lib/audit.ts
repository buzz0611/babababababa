import 'server-only';
import { db, schema } from '@/db';

export async function audit(
  userId: number | null, action: string, entity: string, entityId: string | number,
  before?: unknown, after?: unknown,
) {
  await db.insert(schema.auditLogs).values({
    userId, action, entity, entityId: String(entityId),
    before: before ?? null, after: after ?? null,
  });
}
