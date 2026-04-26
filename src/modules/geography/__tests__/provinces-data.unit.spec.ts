import {
  PROVINCES,
  CANTONS_BY_PROVINCE,
  buildCantonRows,
} from "../../../scripts/seed-geography-data";

describe("INEC provinces seed", () => {
  it("contiene las 24 provincias", () => {
    expect(PROVINCES).toHaveLength(24);
  });

  it("códigos van de 01 a 24 sin duplicados", () => {
    const codes = PROVINCES.map((p) => p.code).sort();
    const expected = Array.from({ length: 24 }, (_, i) =>
      String(i + 1).padStart(2, "0")
    );
    expect(codes).toEqual(expected);
  });

  it("incluye provincias clave", () => {
    const names = PROVINCES.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(["Pichincha", "Guayas", "Azuay", "Galápagos"])
    );
  });
});

describe("INEC cantons seed", () => {
  const rows = buildCantonRows();

  it("contiene 221 cantones en total", () => {
    expect(rows).toHaveLength(221);
  });

  it("cada provincia tiene un array de cantones definido", () => {
    for (const p of PROVINCES) {
      expect(CANTONS_BY_PROVINCE[p.code]).toBeDefined();
      expect(CANTONS_BY_PROVINCE[p.code].length).toBeGreaterThan(0);
    }
  });

  it("códigos de cantón son únicos", () => {
    const codes = rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("códigos siguen formato <province_code><nn>", () => {
    for (const r of rows) {
      expect(r.code).toMatch(/^\d{4}$/);
      expect(r.code.startsWith(r.province_code)).toBe(true);
    }
  });

  it("incluye cantones clave", () => {
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Quito",
        "Guayaquil",
        "Cuenca",
        "Manta",
        "Santo Domingo",
        "La Concordia",
      ])
    );
  });
});
