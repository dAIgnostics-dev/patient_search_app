export interface DiagnosisCatalogItem {
  code: string;
  display: string;
}

export const DIAGNOSIS_CATALOG: DiagnosisCatalogItem[] = [
  { code: 'I10', display: 'Hipertenzija' },
  { code: 'E11', display: 'Dijabetes melitus tip 2' },
  { code: 'J45', display: 'Astma' },
  { code: 'G43', display: 'Migrena' },
  { code: 'R51', display: 'Glavobolja' },
  { code: 'M54', display: 'Bol u leđima' },
  { code: 'C00', display: 'Zloćudna novotvorina usne' },
];
