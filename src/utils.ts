// Map language codes to flag rendering codes
const LANG_TO_FLAG: Record<string, string> = {
  en: "us",
  fr: "fr",
  de: "de",
  es: "es",
  it: "it",
  pt: "pt",
  nl: "nl",
  pl: "pl",
  el: "gr",
  ar: "sa",
  ja: "jp",
  zh: "cn",
  vi: "vn",
  ko: "kr",
};

export function langToFlag(langCode: string): string {
  return LANG_TO_FLAG[langCode] ?? langCode;
}
