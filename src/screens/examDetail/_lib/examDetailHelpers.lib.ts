export function wantsAutomaticPrint(search: string) {
  return new URLSearchParams(search).get("print") === "1";
}
