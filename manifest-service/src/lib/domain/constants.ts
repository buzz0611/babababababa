export const WASTE_TYPES = [
  '燃え殻', '汚泥', '廃油', '廃酸', '廃アルカリ', '廃プラスチック類', 'ゴムくず', '金属くず',
  'ガラスくず・コンクリートくず及び陶磁器くず', '鉱さい', 'がれき類', 'ばいじん', '紙くず', '木くず',
  '繊維くず', '動植物性残さ', '動物系固形不要物', '動物のふん尿', '動物の死体', '13号廃棄物',
  '混合廃棄物', '石綿含有産業廃棄物', '水銀使用製品産業廃棄物',
] as const;

export const SPECIAL_WASTE_TYPES = [
  '廃油（引火性）', '廃酸（腐食性）', '廃アルカリ（腐食性）', '感染性産業廃棄物',
  '廃石綿等', '廃PCB等', '特定有害産業廃棄物',
] as const;

export const ALL_WASTE_TYPES = [...WASTE_TYPES, ...SPECIAL_WASTE_TYPES.map((t) => `【特管】${t}`)];

export const DISPOSAL_METHODS = [
  '破砕', '選別', '圧縮', '切断', '焼却', '溶融', '中和', '脱水', '乾燥', '油水分離',
  '堆肥化', 'RPF化', '固形燃料化', '安定型埋立', '管理型埋立', '遮断型埋立',
] as const;

export const UNITS = ['t', 'kg', 'm3', 'L', '個', '台'] as const;

export const MEDIUM_LABEL = { paper: '紙', electronic: '電子' } as const;
export type Medium = keyof typeof MEDIUM_LABEL;

/** kg は t に換算。体積・個数は換算できないので null */
export const toTon = (qty: number | null | undefined, unit: string): number | null => {
  if (qty == null) return null;
  if (unit === 't') return qty;
  if (unit === 'kg') return qty / 1000;
  return null;
};

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
