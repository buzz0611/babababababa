import { describe, expect, it } from 'vitest';
import { checkManifestNo, normalizeManifestNo, paperCheckDigit } from '@/lib/domain/manifest-no';

describe('交付番号', () => {
  it('チェックデジットは先頭10桁を7で割った余り', () => {
    expect(paperCheckDigit('3012300101')).toBe(6);
    expect(checkManifestNo('30123001016', 'paper')).toBeNull();
  });
  it('末尾が合わなければ正しい値を示す', () => {
    expect(checkManifestNo('30123001017', 'paper')).toContain('「6」');
  });
  it('11桁以外はエラー', () => {
    expect(checkManifestNo('3012300101', 'paper')).toContain('11桁');
    expect(checkManifestNo('A0000010101', 'paper')).toContain('11桁');
  });
  it('全角数字・ハイフン・空白を整える', () => {
    expect(normalizeManifestNo('３０１２３-００１０ １６')).toBe('30123001016');
  });
  it('電子は数字のみ確認', () => {
    expect(checkManifestNo('9000123456', 'electronic')).toBeNull();
    expect(checkManifestNo('90001X', 'electronic')).not.toBeNull();
  });
});
