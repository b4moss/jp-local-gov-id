import { describe, expect, it } from "vitest";
import dataset from "@b4moss/jp-local-gov-id-data";
import { filterByDesignatedCity } from "./designatedCity";
import type { DesignatedCityMode } from "./types";

const MODES: DesignatedCityMode[] = ["both", "city", "ward"];

type MunicipalityCounts = {
  both: number;
  city: number;
  ward: number;
};

function countsOf(code: string): MunicipalityCounts {
  const pref = dataset.prefectures.prefectures.find((p) => p.code === code);
  expect(pref?.municipalityCounts).toBeDefined();
  return pref!.municipalityCounts as MunicipalityCounts;
}

describe("municipalityCounts in decoded prefectures data", () => {
  it("TC-01: every prefecture has both/city/ward positive integers", () => {
    expect(dataset.prefectures.prefectures).toHaveLength(47);

    for (const pref of dataset.prefectures.prefectures) {
      const counts = pref.municipalityCounts;
      expect(counts).toBeDefined();
      expect(Object.keys(counts!).sort()).toEqual(["both", "city", "ward"]);
      for (const mode of MODES) {
        const n = counts![mode];
        expect(Number.isInteger(n) && n > 0).toBe(true);
      }
    }
  });

  it("TC-02/TC-09: counts match filterByDesignatedCity for every prefecture", () => {
    for (const pref of dataset.prefectures.prefectures) {
      const file = dataset.municipalitiesByCode[pref.code];
      expect(file).toBeDefined();
      const list = file.municipalities;
      const counts = pref.municipalityCounts!;

      expect(counts.both).toBe(list.length);
      for (const mode of MODES) {
        expect(counts[mode]).toBe(filterByDesignatedCity(list, mode).length);
      }
    }
  });

  it("TC-03: Hokkaido designated-city modes differ (195/185/194)", () => {
    const counts = countsOf("01");
    expect(counts).toEqual({ both: 195, city: 185, ward: 194 });
    expect(counts.both).toBeGreaterThan(counts.city);
    expect(counts.both).toBeGreaterThan(counts.ward);
  });

  it("TC-04: Niigata designated-city sample (38/30/37)", () => {
    expect(countsOf("15")).toEqual({ both: 38, city: 30, ward: 37 });
  });

  it("TC-05: prefectures without designated cities keep three equal keys", () => {
    const tokyo = countsOf("13");
    const okinawa = countsOf("47");

    expect(tokyo).toEqual({ both: 62, city: 62, ward: 62 });
    expect(okinawa).toEqual({ both: 41, city: 41, ward: 41 });
    expect(Object.keys(tokyo).sort()).toEqual(["both", "city", "ward"]);
    expect(Object.keys(okinawa).sort()).toEqual(["both", "city", "ward"]);
  });

  it("TC-06: Tokyo special wards remain in all designatedCity modes", () => {
    const list = dataset.municipalitiesByCode["13"].municipalities;
    expect(list.some((m) => m.name === "千代田区")).toBe(true);

    for (const mode of MODES) {
      const filtered = filterByDesignatedCity(list, mode);
      expect(filtered.some((m) => m.name === "千代田区")).toBe(true);
    }

    const counts = countsOf("13");
    expect(counts.both).toBe(counts.city);
    expect(counts.city).toBe(counts.ward);
  });

  it("TC-07: municipalityCounts is not on per-prefecture files or index", () => {
    for (const code of ["01", "13"] as const) {
      const file = dataset.municipalitiesByCode[code] as Record<string, unknown>;
      expect(file).not.toHaveProperty("municipalityCounts");
      for (const m of dataset.municipalitiesByCode[code].municipalities) {
        expect(m).not.toHaveProperty("municipalityCounts");
      }
    }

    expect(dataset.index).not.toHaveProperty("municipalityCounts");
    const indexJson = JSON.stringify(dataset.index);
    expect(indexJson).not.toContain("municipalityCounts");
  });

  it("TC-08: schemaVersion stays 1", () => {
    expect(dataset.prefectures.schemaVersion).toBe(1);
    expect(dataset.index.schemaVersion).toBe(1);
    expect(dataset.municipalitiesByCode["01"].schemaVersion).toBe(1);
  });
});
