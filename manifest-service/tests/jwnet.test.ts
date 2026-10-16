import { describe, expect, it } from 'vitest';
import { parseCsv, readImportRows, toCsv } from '@/lib/jwnet/csv';
import { validatePayload } from '@/lib/jwnet/payload';

describe('CSV', () => {
  it('引用符・改行・BOMを扱う', () => {
    expect(parseCsv('﻿a,"b,c","d""e"\r\n"x\ny",z\n')).toEqual([['a', 'b,c', 'd"e'], ['x\ny', 'z']]);
    expect(parseCsv(toCsv([['1', 'a"b']]))).toEqual([['1', 'a"b']]);
  });
  it('見出しの別名で取り込み、日付を正規化', () => {
    const { rows, errors } = readImportRows('マニフェスト番号,交付年月日,排出事業者,種類,数量,単位\n123,2026/4/1,A社,汚泥,1.5,t\n');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ manifestNo: '123', issueDate: '2026-04-01', emitterName: 'A社', wasteType: '汚泥', qty: '1.5', unit: 't', packaging: '' });
  });
  it('必須列がなければエラー', () => {
    expect(readImportRows('登録番号,数量\n1,2').errors).toHaveLength(3);
  });
});

describe('JWNET送信前チェック', () => {
  it('2027年4月から必須の項目を確認', () => {
    const e = validatePayload({
      kind: 'disposal_end',
      report: {
        subscriberNo: '1234567', manifestNo: '1', disposalEndDate: '2026-10-01', receivedDate: null,
        facility: { name: '工場', address: '', permitNo: '' }, disposalMethod: '破砕', disposedQtyT: null, residues: [], isFinalDisposal: false,
      },
    });
    expect(e).toEqual(['処分量が未入力です（2027年4月から必須）', '処分事業場の許可番号が未設定です（2027年4月から必須）']);
  });
});
