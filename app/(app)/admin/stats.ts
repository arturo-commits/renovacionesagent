import "server-only";
import { getDb } from "@/lib/db";
import { progressFor } from "@/lib/learning";

export type CourseStats = {
  id: number; title: string; published: number; mandatory: number; hours: number;
  enrolled: number; started: number; completed: number; avg_progress: number; avg_score: number | null; time_sec: number;
};

export function courseStats(): CourseStats[] {
  const db = getDb();
  const courses = db
    .prepare(
      `SELECT c.id, c.title, c.published, c.mandatory, c.hours,
        COUNT(e.id) AS enrolled,
        SUM(CASE WHEN e.status = 'en_curso' THEN 1 ELSE 0 END) AS started,
        SUM(CASE WHEN e.status = 'completado' THEN 1 ELSE 0 END) AS completed,
        AVG(e.final_score) AS avg_score,
        COALESCE(SUM(e.time_spent_sec), 0) AS time_sec
       FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id
       GROUP BY c.id ORDER BY c.mandatory DESC, c.id`
    )
    .all() as Omit<CourseStats, "avg_progress">[];
  return courses.map((c) => {
    const ens = db.prepare("SELECT id FROM enrollments WHERE course_id = ?").all(c.id) as { id: number }[];
    const avg = ens.length ? Math.round(ens.reduce((a, e) => a + progressFor(e.id, c.id).percent, 0) / ens.length) : 0;
    return { ...c, started: c.started ?? 0, completed: c.completed ?? 0, avg_progress: avg, avg_score: c.avg_score == null ? null : Math.round(c.avg_score) };
  });
}

export type ReportRow = {
  enrollment_id: number; user_id: number; first_name: string; last_name: string; email: string; nif: string | null;
  company: string | null; department: string | null; course_id: number; course: string; hours: number; status: string;
  enrolled_at: string; started_at: string | null; last_access_at: string | null; completed_at: string | null;
  time_spent_sec: number; final_score: number | null; due_at: string | null; progress: number;
};

export function enrollmentReport(filters: { courseId?: number; status?: string; department?: string; groupId?: number; scope?: string[] | null } = {}): ReportRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filters.courseId) { where.push("e.course_id = ?"); args.push(filters.courseId); }
  if (filters.status) { where.push("e.status = ?"); args.push(filters.status); }
  if (filters.department) { where.push("u.department = ?"); args.push(filters.department); }
  if (filters.scope) { where.push(`u.department IN (${filters.scope.map(() => "?").join(",")})`); args.push(...filters.scope); }
  if (filters.groupId) {
    where.push("e.user_id IN (SELECT user_id FROM group_members WHERE group_id = ?) AND e.course_id IN (SELECT course_id FROM group_courses WHERE group_id = ?)");
    args.push(filters.groupId, filters.groupId);
  }
  const rows = getDb()
    .prepare(
      `SELECT e.id AS enrollment_id, u.id AS user_id, u.first_name, u.last_name, u.email, u.nif, u.company, u.department,
        c.id AS course_id, c.title AS course, c.hours, e.status, e.enrolled_at, e.started_at, e.last_access_at, e.completed_at,
        e.time_spent_sec, e.final_score, e.due_at
       FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY u.last_name, u.first_name, c.title`
    )
    .all(...args) as Omit<ReportRow, "progress">[];
  return rows.map((r) => ({ ...r, progress: progressFor(r.enrollment_id, r.course_id).percent }));
}

export { departments } from "@/lib/students";
