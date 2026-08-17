export function suggestName(agent: string): string {
  const when = new Date();
  const stamp = `${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
  return `${agent}-${stamp}`;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "…"
  );
}
