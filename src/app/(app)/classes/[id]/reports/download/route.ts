import { notFound } from "next/navigation";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { xlsxResponse } from "@/lib/excel";
import { BUILTIN_REPORTS, buildReportData, builtinTemplate, fillTemplate, type BuiltinReport } from "@/lib/reports";

/** ?mau=builtin:DS_LOP | id:<templateId> (hoặc ?builtin=DS_LOP), &ky=HK1|HK2|CN|M-yyyy-mm */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const url = new URL(req.url);
  const mau = url.searchParams.get("mau") ?? `builtin:${url.searchParams.get("builtin") ?? "DS_LOP"}`;
  const [kind, ref] = mau.split(":");

  let template: Buffer;
  let name: string;
  if (kind === "builtin" && ref in BUILTIN_REPORTS) {
    template = await builtinTemplate(ref as BuiltinReport, cls.schoolId);
    name = BUILTIN_REPORTS[ref as BuiltinReport];
  } else {
    const t = await db.reportTemplate.findFirst({ where: { id: ref ?? "", schoolId: cls.schoolId } });
    if (!t) notFound();
    template = Buffer.from(t.data);
    name = t.name;
  }
  const data = await buildReportData(cls.id, url.searchParams.get("ky") ?? undefined);
  const out = await fillTemplate(template, data);
  return xlsxResponse(out, `${name} - Lop ${cls.name} - ${data.period.label}.xlsx`);
}
