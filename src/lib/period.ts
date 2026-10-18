/** Khoảng thời gian dùng cho thống kê / báo cáo. semester = 0 nghĩa là cả năm. */
export type Period = { key: string; label: string; from: Date; to: Date; semester: 0 | 1 | 2 };

type Year = { name: string; semester2Start: Date | null };

function bounds(year: Year) {
  const y1 = Number(year.name.slice(0, 4));
  return {
    start: new Date(Date.UTC(y1, 7, 1)), // 01/08
    s2: year.semester2Start ?? new Date(Date.UTC(y1 + 1, 0, 15)), // 15/01
    end: new Date(Date.UTC(y1 + 1, 6, 1)), // 01/07 (không gồm)
  };
}

export function semesterOf(year: Year, date: Date): 1 | 2 {
  return date < bounds(year).s2 ? 1 : 2;
}

/** key: "HK1" | "HK2" | "CN" | "M-2026-10" */
export function getPeriod(year: Year, key: string | undefined): Period {
  const b = bounds(year);
  const m = key?.match(/^M-(\d{4})-(\d{2})$/);
  if (m) {
    const from = new Date(Date.UTC(+m[1], +m[2] - 1, 1));
    const to = new Date(Date.UTC(+m[1], +m[2], 1));
    return { key: key!, label: `Tháng ${+m[2]}/${m[1]}`, from, to, semester: semesterOf(year, from) };
  }
  if (key === "HK2") return { key, label: "Học kỳ II", from: b.s2, to: b.end, semester: 2 };
  if (key === "CN") return { key, label: "Cả năm", from: b.start, to: b.end, semester: 0 };
  return { key: "HK1", label: "Học kỳ I", from: b.start, to: b.s2, semester: 1 };
}

export function periodOptions(year: Year) {
  const b = bounds(year);
  const opts: { key: string; label: string }[] = [
    { key: "HK1", label: "Học kỳ I" },
    { key: "HK2", label: "Học kỳ II" },
    { key: "CN", label: "Cả năm" },
  ];
  for (let d = new Date(b.start); d < b.end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    opts.push({ key: `M-${d.getUTCFullYear()}-${mm}`, label: `Tháng ${d.getUTCMonth() + 1}/${d.getUTCFullYear()}` });
  }
  return opts;
}
