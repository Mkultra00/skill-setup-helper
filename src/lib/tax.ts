export const TAX_STATES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split(
    "|",
  );
export interface TaxFinding {
  title: string;
  explanation: string;
  authority: string;
  effectivePeriod: string;
  sources: string[];
}
export interface TaxSection {
  jurisdiction: string;
  findings: TaxFinding[];
  missingFacts: string[];
  error?: string;
}
export interface TaxReport {
  researchedAt: string;
  taxYear: number;
  state: string;
  sections: TaxSection[];
  demo: boolean;
}
