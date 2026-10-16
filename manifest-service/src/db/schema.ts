import {
  boolean, date, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';

const qty = (name: string) => numeric(name, { precision: 14, scale: 3, mode: 'number' });
const day = (name: string) => date(name, { mode: 'string' });
const stamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// ---- 認証 ----
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  loginId: text('login_id').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'staff'] }).notNull().default('staff'),
  active: boolean('active').notNull().default(true),
  ...stamps,
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // トークンのSHA-256
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ---- マスタ ----
/** 自社（処分業者）情報。1行のみ */
export const company = pgTable('company', {
  id: integer('id').primaryKey().default(1),
  name: text('name').notNull().default(''),
  address: text('address').notNull().default(''),
  tel: text('tel').notNull().default(''),
  representative: text('representative').notNull().default(''),
  jwnetSubscriberNo: text('jwnet_subscriber_no').notNull().default(''), // JWNET加入者番号
  ledgerStartMonth: integer('ledger_start_month').notNull().default(4), // 帳簿の締め（年度開始月）
});

/** 自社の処分事業場（帳簿は事業場ごと） */
export const facilities = pgTable('facilities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  permitNo: text('permit_no').notNull().default(''),
  permitAuthority: text('permit_authority').notNull().default(''),
  permitExpiry: day('permit_expiry'),
  methods: text('methods').notNull().default(''), // 許可された処分方法（カンマ区切り）
  isFinalDisposal: boolean('is_final_disposal').notNull().default(false), // 最終処分場か
  active: boolean('active').notNull().default(true),
  ...stamps,
});

/** 取引先（排出事業者・収集運搬業者・委託先処分業者） */
export const partners = pgTable('partners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  tel: text('tel').notNull().default(''),
  isEmitter: boolean('is_emitter').notNull().default(false),
  isTransporter: boolean('is_transporter').notNull().default(false),
  isDisposer: boolean('is_disposer').notNull().default(false),
  permitNo: text('permit_no').notNull().default(''),
  permitAuthority: text('permit_authority').notNull().default(''),
  permitExpiry: day('permit_expiry'),
  jwnetSubscriberNo: text('jwnet_subscriber_no').notNull().default(''),
  note: text('note').notNull().default(''),
  active: boolean('active').notNull().default(true),
  ...stamps,
});

/** 排出事業場（排出事業者の工場・現場） */
export const emitterSites = pgTable('emitter_sites', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id').notNull().references(() => partners.id),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  ...stamps,
});

/** 委託契約（受託：排出事業者から / 委託：二次の委託先へ） */
export const contracts = pgTable('contracts', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id').notNull().references(() => partners.id),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  title: text('title').notNull(),
  wasteTypes: text('waste_types').notNull().default(''),
  startDate: day('start_date'),
  endDate: day('end_date'),
  note: text('note').notNull().default(''),
  ...stamps,
});

// ---- 一次マニフェスト（受託） ----
export const manifests = pgTable('manifests', {
  id: serial('id').primaryKey(),
  facilityId: integer('facility_id').notNull().references(() => facilities.id),
  medium: text('medium', { enum: ['paper', 'electronic'] }).notNull(),
  manifestNo: text('manifest_no').notNull(), // 交付番号 / 電子は登録番号
  issueDate: day('issue_date').notNull(), // 交付日 / 引渡し日
  emitterId: integer('emitter_id').notNull().references(() => partners.id),
  emitterSiteId: integer('emitter_site_id').references(() => emitterSites.id),
  transporterId: integer('transporter_id').references(() => partners.id),
  wasteType: text('waste_type').notNull(),
  wasteName: text('waste_name').notNull().default(''), // 名称（任意）
  special: boolean('special').notNull().default(false),
  declaredQty: qty('declared_qty'),
  declaredUnit: text('declared_unit').notNull().default('t'),
  packaging: text('packaging').notNull().default(''),
  // 受入れ
  receivedDate: day('received_date'),
  receivedQtyT: qty('received_qty_t'), // 受入量（t, 計量値）
  // 処分
  disposalMethod: text('disposal_method').notNull().default(''),
  disposalEndDate: day('disposal_end_date'),
  disposedQtyT: qty('disposed_qty_t'),
  // 処分終了の通知（紙：C2票・D票の送付 / 電子：処分終了報告）
  c2SentDate: day('c2_sent_date'),
  dSentDate: day('d_sent_date'),
  disposalReportedDate: day('disposal_reported_date'),
  // 最終処分
  finalNoticeReceivedDate: day('final_notice_received_date'), // 最終処分終了の報告を受けた日
  finalDisposalDate: day('final_disposal_date'),
  finalDisposalPlace: text('final_disposal_place').notNull().default(''),
  eSentDate: day('e_sent_date'), // 紙：E票送付
  finalReportedDate: day('final_reported_date'), // 電子：最終処分終了報告
  note: text('note').notNull().default(''),
  createdBy: integer('created_by').references(() => users.id),
  ...stamps,
}, (t) => [uniqueIndex('manifests_no_idx').on(t.medium, t.manifestNo)]);

// ---- 二次マニフェスト（処分後物の委託） ----
export const secondaryManifests = pgTable('secondary_manifests', {
  id: serial('id').primaryKey(),
  facilityId: integer('facility_id').notNull().references(() => facilities.id),
  medium: text('medium', { enum: ['paper', 'electronic'] }).notNull(),
  manifestNo: text('manifest_no').notNull(),
  issueDate: day('issue_date').notNull(), // 交付日 / 引渡し日
  registeredDate: day('registered_date'), // 電子：JWNET登録日
  wasteType: text('waste_type').notNull(),
  wasteName: text('waste_name').notNull().default(''),
  special: boolean('special').notNull().default(false),
  qtyT: qty('qty_t').notNull(), // 持出量（t）
  transporterId: integer('transporter_id').references(() => partners.id),
  disposerId: integer('disposer_id').notNull().references(() => partners.id),
  destAddress: text('dest_address').notNull().default(''), // 持出先（処分事業場）
  disposalMethod: text('disposal_method').notNull().default(''),
  isFinal: boolean('is_final').notNull().default(true), // 持出先が最終処分か
  // 返送票 / 終了報告の受領
  b2Date: day('b2_date'),
  dDate: day('d_date'),
  eDate: day('e_date'),
  finalDisposalDate: day('final_disposal_date'),
  finalDisposalPlace: text('final_disposal_place').notNull().default(''),
  reportedToAuthority: day('reported_to_authority'), // 措置内容等報告書の提出日
  note: text('note').notNull().default(''),
  createdBy: integer('created_by').references(() => users.id),
  ...stamps,
}, (t) => [uniqueIndex('secondary_no_idx').on(t.medium, t.manifestNo)]);

/** 一次と二次の紐付け（どの受託分を二次で持ち出したか） */
export const secondaryLinks = pgTable('secondary_links', {
  secondaryId: integer('secondary_id').notNull().references(() => secondaryManifests.id, { onDelete: 'cascade' }),
  manifestId: integer('manifest_id').notNull().references(() => manifests.id),
  allocatedQtyT: qty('allocated_qty_t'),
}, (t) => [primaryKey({ columns: [t.secondaryId, t.manifestId] })]);

// ---- 帳簿の閉鎖 ----
export const ledgerClosures = pgTable('ledger_closures', {
  facilityId: integer('facility_id').notNull().references(() => facilities.id),
  fiscalYear: integer('fiscal_year').notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }).notNull().defaultNow(),
  closedBy: integer('closed_by').references(() => users.id),
}, (t) => [primaryKey({ columns: [t.facilityId, t.fiscalYear] })]);

// ---- JWNET 送信キュー ----
export const jwnetMessages = pgTable('jwnet_messages', {
  id: serial('id').primaryKey(),
  kind: text('kind', { enum: ['disposal_end', 'final_disposal_end', 'register_secondary'] }).notNull(),
  manifestId: integer('manifest_id').references(() => manifests.id),
  secondaryId: integer('secondary_id').references(() => secondaryManifests.id),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['pending', 'sent', 'accepted', 'error', 'manual_done'] }).notNull().default('pending'),
  response: text('response').notNull().default(''),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

// ---- 操作履歴 ----
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull().default(''),
  before: jsonb('before'),
  after: jsonb('after'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export type Manifest = typeof manifests.$inferSelect;
export type SecondaryManifest = typeof secondaryManifests.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Facility = typeof facilities.$inferSelect;
export type User = typeof users.$inferSelect;
