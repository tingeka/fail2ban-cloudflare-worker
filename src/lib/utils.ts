export const parseCommaSeparatedList = (value: string | undefined): string[] => {
  if (!value) return [];
  return value.split(",").map(item => item.trim()).filter(Boolean);
};