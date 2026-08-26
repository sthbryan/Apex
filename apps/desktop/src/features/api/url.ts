export interface Pair {
  key: string;
  value: string;
}

export function readPairs(text: string): Pair[] {
  return text
    .split("&")
    .filter((piece) => piece !== "")
    .map((piece) => {
      const at = piece.indexOf("=");
      return at === -1
        ? { key: piece, value: "" }
        : { key: piece.slice(0, at), value: piece.slice(at + 1) };
    });
}

export function writePairs(pairs: Pair[]): string {
  return pairs
    .filter((pair) => pair.key !== "")
    .map((pair) => (pair.value === "" ? pair.key : `${pair.key}=${pair.value}`))
    .join("&");
}

export function readParams(url: string): Pair[] {
  return readPairs(cut(url).query);
}

export function writeParams(url: string, pairs: Pair[]): string {
  const { base, hash } = cut(url);
  const query = writePairs(pairs);
  return query === "" ? `${base}${hash}` : `${base}?${query}${hash}`;
}

function cut(url: string): { base: string; query: string; hash: string } {
  const cross = url.indexOf("#");
  const hash = cross === -1 ? "" : url.slice(cross);
  const head = cross === -1 ? url : url.slice(0, cross);
  const mark = head.indexOf("?");
  return mark === -1
    ? { base: head, query: "", hash }
    : { base: head.slice(0, mark), query: head.slice(mark + 1), hash };
}

export function record(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    if (pair.key !== "") {
      out[pair.key] = pair.value;
    }
  }
  return out;
}
