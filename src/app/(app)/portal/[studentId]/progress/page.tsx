import Link from "next/link";
import { requireFamilyAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { CLASS_ROLES, terms } from "@/lib/constants";
import { leaderboard, weekLabel, weekStart } from "@/lib/emulation";
import { buildProgress } from "@/lib/progress";
import { Highlights, ProgressView, TeamBoard } from "@/components/Emulation";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Thi đua & tiến bộ" };
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default async function ProgressPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user, student } = await requireFamilyAccess(studentId);
  const school = await db.school.findUniqueOrThrow({ where: { id: student.schoolId }, select: { type: true } });
  const t = terms(school.type);
  const start = weekStart();
  const [board, progress, group] = await Promise.all([
    leaderboard(student.classId, start),
    buildProgress(student.id),
    student.groupId ? db.classGroup.findUnique({ where: { id: student.groupId } }) : null,
  ]);
  const me = board.people.find((p) => p.id === student.id);
  const teamRank = board.teams.findIndex((x) => x.id === student.groupId) + 1;
  const avg = board.people.length ? Math.round((board.people.reduce((n, p) => n + p.points, 0) / board.people.length) * 10) / 10 : 0;
  const isParent = user.role === "PARENT";
  const who = isParent ? "con" : "em";

  return (
    <>
      <PageHeader
        back={{ href: `/portal/${student.id}`, label: student.fullName }}
        title="Thi đua & tiến bộ"
        sub={`Lớp ${student.class.name}${group ? ` · ${group.name}` : ""}${student.classRole ? ` · ${CLASS_ROLES[student.classRole as keyof typeof CLASS_ROLES]?.label}` : ""}`}
      />

      <div className="card hero">
        <div className="score-hero">
          <div>
            <div className="hero-sub small">Điểm thi đua tuần {weekLabel(start)}</div>
            <div className="score-big">{sign(me?.points ?? 0)}</div>
          </div>
          <div className="hero-sub" style={{ flex: 1, minWidth: 200 }}>
            Trung bình lớp: <strong>{sign(avg)}</strong>
            {me && me.delta !== 0 && <> · So với tuần trước: <strong>{me.delta > 0 ? `↑ ${me.delta}` : `↓ ${-me.delta}`}</strong></>}
            {teamRank > 0 && <><br />{group?.name} đang xếp <strong>hạng {teamRank}/{board.teams.length}</strong> trong lớp</>}
          </div>
        </div>
      </div>

      <p className="small muted" style={{ marginTop: -4 }}>
        {isParent
          ? `Trang này giúp phụ huynh thấy ${who} đang làm tốt điều gì, còn hạn chế ở đâu và đã chuyển biến ra sao — để cùng nhà trường động viên, nhắc nhở kịp thời.`
          : "Mỗi ngày tiến bộ một chút! Xem điểm mạnh của em và những điều cần cố gắng."}
        {" "}<Link href={`/portal/${student.id}/messages`}>{isParent ? "Trao đổi với GVCN →" : "Xem thông báo →"}</Link>
      </p>

      <ProgressView p={progress} learner={who} />

      <div className="grid two">
        <div className="card">
          <h2>🏆 Thi đua giữa các tổ</h2>
          <TeamBoard board={board} highlight={student.groupId} />
        </div>
        <div className="card"><Highlights board={board} /></div>
      </div>
      <p className="small muted">Điểm thi đua do GVCN và cán sự lớp ghi nhận (GVCN duyệt). Bảng chỉ nêu gương tích cực; điểm chi tiết của từng {t.learnerLower} chỉ {t.learnerLower} đó, phụ huynh và GVCN xem được.</p>
    </>
  );
}
