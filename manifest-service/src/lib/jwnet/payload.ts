import type { DateStr } from '../domain/dates';

/**
 * JWNET へ送る報告内容。
 * 2027年4月1日施行の省令改正で、処分終了報告・最終処分終了報告に
 * 「処分事業場の情報」「処分方法・処分量」「中間処理後物の種類・量」が必須になるため、それらを含めて組み立てる。
 */

export interface FacilityInfo { name: string; address: string; permitNo: string }

export interface DisposalEndReport {
  subscriberNo: string; // 処分業者の加入者番号
  manifestNo: string; // 登録番号
  disposalEndDate: DateStr;
  receivedDate: DateStr | null;
  facility: FacilityInfo;
  disposalMethod: string;
  disposedQtyT: number | null;
  /** 中間処理後物（二次マニフェストで持ち出したもの） */
  residues: { wasteType: string; qtyT: number | null; destination: string }[];
  /** 自社が最終処分した場合は同時に最終処分終了も報告する */
  isFinalDisposal: boolean;
}

export interface FinalDisposalEndReport {
  subscriberNo: string;
  manifestNo: string;
  finalDisposalDate: DateStr;
  finalDisposalPlace: string;
  /** 最終処分までに関わった処分事業場（自社＋二次委託先） */
  facilities: FacilityInfo[];
}

export interface SecondaryRegistration {
  subscriberNo: string; // 排出事業者としての加入者番号
  manifestNo: string;
  handoverDate: DateStr;
  wasteType: string;
  wasteName: string;
  qtyT: number;
  transporterSubscriberNo: string;
  disposerSubscriberNo: string;
  destAddress: string;
  disposalMethod: string;
  /** 元の受託マニフェスト（登録番号）。紙の場合は交付番号 */
  sourceManifests: { manifestNo: string; allocatedQtyT: number | null }[];
}

export type JwnetPayload =
  | { kind: 'disposal_end'; report: DisposalEndReport }
  | { kind: 'final_disposal_end'; report: FinalDisposalEndReport }
  | { kind: 'register_secondary'; report: SecondaryRegistration };

/** 送信前チェック。空配列なら送信可 */
export function validatePayload(p: JwnetPayload): string[] {
  const e: string[] = [];
  const r = p.report;
  if (!r.subscriberNo) e.push('自社のJWNET加入者番号が未設定です（マスタ＞自社情報）');
  if (!r.manifestNo) e.push('登録番号がありません');
  if (p.kind === 'disposal_end') {
    if (!p.report.disposalMethod) e.push('処分方法が未入力です');
    if (p.report.disposedQtyT == null) e.push('処分量が未入力です（2027年4月から必須）');
    if (!p.report.facility.permitNo) e.push('処分事業場の許可番号が未設定です（2027年4月から必須）');
  }
  if (p.kind === 'final_disposal_end') {
    if (!p.report.finalDisposalPlace) e.push('最終処分の場所が未入力です');
  }
  if (p.kind === 'register_secondary') {
    if (!p.report.disposerSubscriberNo) e.push('委託先処分業者のJWNET加入者番号が未設定です');
  }
  return e;
}

export const KIND_LABEL: Record<JwnetPayload['kind'], string> = {
  disposal_end: '処分終了報告',
  final_disposal_end: '最終処分終了報告',
  register_secondary: '二次マニフェスト登録',
};
