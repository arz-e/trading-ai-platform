export function containsKeyword(text, keyword) {
  const normalizedText = String(text ?? "").toLowerCase();
  const normalizedKeyword = String(keyword ?? "").toLowerCase().trim();

  if (!normalizedKeyword) {
    return false;
  }

  const escaped = normalizedKeyword
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^a-z0-9]+");

  if (!escaped) {
    return false;
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");

  return pattern.test(normalizedText);
}

export function containsAnyKeyword(text, keywords = []) {
  return keywords.some((keyword) => containsKeyword(text, keyword));
}
