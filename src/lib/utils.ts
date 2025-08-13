export const parseCommaSeparatedList = (value: string): string[] => 
  value.split(",").map(item => item.trim()).filter(Boolean);