import { describe, expect, it } from "vitest";
import {
  assignTwoGramRegion,
  isHotMunicipality,
  type HotSetInput,
} from "./searchHotSet";

function muni(
  partial: Partial<HotSetInput> & Pick<HotSetInput, "code" | "name" | "prefectureCode">,
): HotSetInput {
  return {
    hasWard: 0,
    isWard: 0,
    ...partial,
  };
}

describe("isHotMunicipality / assignTwoGramRegion", () => {
  it.each([
    {
      label: "saitama full pref",
      input: muni({ code: "111007", name: "さいたま市", prefectureCode: "11" }),
      hot: true,
      region: "saitama",
    },
    {
      label: "tokyo full pref (special ward)",
      input: muni({ code: "131016", name: "千代田区", prefectureCode: "13" }),
      hot: true,
      region: "tokyo",
    },
    {
      label: "kanagawa full pref",
      input: muni({ code: "141003", name: "横浜市", prefectureCode: "14" }),
      hot: true,
      region: "kanagawa",
    },
    {
      label: "osaka full pref",
      input: muni({ code: "271004", name: "大阪市", prefectureCode: "27" }),
      hot: true,
      region: "osaka",
    },
    {
      label: "designated city body via hasWard flag",
      input: muni({
        code: "011002",
        name: "札幌市",
        prefectureCode: "01",
        hasWard: 1,
      }),
      hot: true,
      region: "designated-other",
    },
    {
      label: "designated city ward via isWard flag",
      input: muni({
        code: "011011",
        name: "札幌市中央区",
        prefectureCode: "01",
        isWard: 1,
      }),
      hot: true,
      region: "designated-other",
    },
    {
      label: "designated city ward via name pattern (flags off)",
      input: muni({
        code: "011011",
        name: "札幌市中央区",
        prefectureCode: "01",
      }),
      hot: true,
      region: "designated-other",
    },
    {
      label: "aichi all-cities pref",
      input: muni({ code: "231002", name: "名古屋市", prefectureCode: "23" }),
      hot: true,
      region: "chukyo",
    },
    {
      label: "mie all-cities pref",
      input: muni({ code: "242014", name: "四日市市", prefectureCode: "24" }),
      hot: true,
      region: "chukyo",
    },
    {
      label: "gifu all-cities pref",
      input: muni({ code: "212016", name: "岐阜市", prefectureCode: "21" }),
      hot: true,
      region: "chukyo",
    },
    {
      label: "hyogo all-cities pref",
      input: muni({ code: "281000", name: "神戸市", prefectureCode: "28" }),
      hot: true,
      region: "hyogo",
    },
    {
      label: "fukuoka all-cities pref",
      input: muni({ code: "401005", name: "北九州市", prefectureCode: "40" }),
      hot: true,
      region: "fukuoka",
    },
    {
      label: "kyoto south city",
      input: muni({ code: "262013", name: "宇治市", prefectureCode: "26" }),
      hot: true,
      region: "kyoto",
    },
    {
      label: "chiba west city",
      input: muni({ code: "122033", name: "市川市", prefectureCode: "12" }),
      hot: true,
      region: "chiba",
    },
    {
      label: "cold okinawa city",
      input: muni({ code: "472018", name: "那覇市", prefectureCode: "47" }),
      hot: false,
      region: null,
    },
    {
      label: "cold kyoto town (not south list)",
      input: muni({ code: "263033", name: "大山崎町", prefectureCode: "26" }),
      hot: false,
      region: null,
    },
    {
      label: "cold chiba east city",
      input: muni({ code: "122271", name: "銚子市", prefectureCode: "12" }),
      hot: false,
      region: null,
    },
  ] as const)("$label", ({ input, hot, region }) => {
    expect(isHotMunicipality(input)).toBe(hot);
    expect(assignTwoGramRegion(input)).toBe(region);
  });

  it("pads single-digit prefecture codes", () => {
    const input = muni({
      code: "011002",
      name: "札幌市",
      prefectureCode: "1",
      hasWard: 1,
    });
    expect(isHotMunicipality(input)).toBe(true);
    expect(assignTwoGramRegion(input)).toBe("designated-other");
  });
});
