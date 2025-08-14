import { parseCommaSeparatedList } from "../../src/lib/utils";

describe("Utils Unit Tests", () => {
  describe("parseCommaSeparatedList", () => {
    it("should parse comma-separated values", () => {
      expect(parseCommaSeparatedList("a,b,c")).toEqual(["a", "b", "c"]);
    });

    it("should handle whitespace", () => {
      expect(parseCommaSeparatedList(" a , b , c ")).toEqual(["a", "b", "c"]);
    });

    it("should filter empty values", () => {
      expect(parseCommaSeparatedList("a,,b,")).toEqual(["a", "b"]);
    });

    it("should handle empty string", () => {
      expect(parseCommaSeparatedList("")).toEqual([]);
    });

    it("should handle undefined input", () => {
      expect(parseCommaSeparatedList(undefined)).toEqual([]);
    });

  });
});
