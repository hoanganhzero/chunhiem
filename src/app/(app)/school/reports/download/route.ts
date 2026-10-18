import { notFound } from "next/navigation";
import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { xlsxResponse } from "@/lib/excel";
import { BUILTIN_REPORTS, builtinTemplate, type BuiltinReport } from "@/lib/reports";

export async function GET(req: Request) {
  const { schoolId } = await requireSchoolAdmin();
  const url = new URL(req.url);
  const builtin = url.searchParams.get("builtin");
  if (builtin && builtin in BUILTIN_REPORTS) {
    const buf = await builtinTemplate(builtin as BuiltinReport, schoolId);
    return xlsxResponse(buf, `Mau_${builtin}.xlsx`);
  }
  const t = await db.reportTemplate.findFirst({ where: { id: url.searchParams.get("id") ?? "", schoolId } });
  if (!t) notFound();
  return xlsxResponse(Buffer.from(t.data), t.fileName);
}
