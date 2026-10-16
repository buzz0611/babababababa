import type { JwnetPayload } from './payload';

export interface SendResult {
  status: 'accepted' | 'sent' | 'error' | 'manual';
  message: string;
}

/**
 * JWNET との接続口。実装を差し替えて使う。
 *  - mock   : 開発・デモ用。送信すると即「受付済」になる
 *  - manual : JWNETのWeb画面で担当者が手入力する運用。送信内容を画面に表示し、入力後に「入力済」にする
 *  - edi    : JWNET EDI方式（全銀協標準プロトコル拡張Z手順等によるファイル交換）。
 *             EDI利用申込のうえ JWNET から「EDI方式接続仕様書」を入手して実装する（未実装）
 */
export interface JwnetGateway {
  readonly mode: 'mock' | 'manual' | 'edi';
  send(payload: JwnetPayload): Promise<SendResult>;
}

class MockGateway implements JwnetGateway {
  readonly mode = 'mock' as const;
  async send(p: JwnetPayload): Promise<SendResult> {
    return { status: 'accepted', message: `[モック] ${p.report.manifestNo} を受け付けました` };
  }
}

class ManualGateway implements JwnetGateway {
  readonly mode = 'manual' as const;
  async send(): Promise<SendResult> {
    return { status: 'manual', message: 'JWNETの画面で入力し、完了したら「入力済にする」を押してください' };
  }
}

class EdiGateway implements JwnetGateway {
  readonly mode = 'edi' as const;
  async send(): Promise<SendResult> {
    return { status: 'error', message: 'EDI接続は未実装です。JWNETのEDI方式接続仕様書に基づいて実装が必要です' };
  }
}

export function getGateway(mode = process.env.JWNET_MODE): JwnetGateway {
  if (mode === 'manual') return new ManualGateway();
  if (mode === 'edi') return new EdiGateway();
  return new MockGateway();
}
