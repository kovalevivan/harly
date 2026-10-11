const rules = new Intl.PluralRules("ru-RU");

/** Russian noun forms after a count, including 0, 21, 22 and 11–14. */
export function russianPlural(count: number, one: string, few: string, many: string): string {
  const category = rules.select(count);
  return category === "one" ? one : category === "few" ? few : many;
}
