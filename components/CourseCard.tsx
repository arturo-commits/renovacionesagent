import Link from "next/link";
import { Icon } from "./Icon";
import { ProgressBar } from "./Progress";
import { PRODUCT_ILLUSTRATION, PRODUCT_LABEL, STATUS_LABEL, type Course, type Enrollment, type Progress } from "@/lib/learning";

export function CourseCard({
  course,
  enrollment,
  progress,
  units,
}: {
  course: Course;
  enrollment?: Pick<Enrollment, "status"> | null;
  progress?: Progress;
  units?: number;
}) {
  const status = enrollment?.status;
  return (
    <Link href={`/cursos/${course.id}`} className="card course-card">
      <div className="course-art">
        <span className="tag badge solid">{PRODUCT_LABEL[course.product] ?? course.product}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PRODUCT_ILLUSTRATION[course.product] ?? PRODUCT_ILLUSTRATION.general} alt="" />
      </div>
      <div className="course-body">
        <h3>{course.title}</h3>
        <div className="course-meta">
          <span className="nowrap">
            <Icon name="clock" size={13} /> {course.hours} h
          </span>
          <span>{course.modality}</span>
          {units != null && <span>{units} unidades</span>}
          {course.mandatory ? <span className="badge warn">Obligatorio</span> : null}
        </div>
        <div className="course-foot">
          {status ? (
            <>
              <ProgressBar percent={progress?.percent ?? 0} />
              <span className={`badge ${status === "completado" ? "ok" : status === "en_curso" ? "" : "grey"}`} style={{ alignSelf: "flex-start" }}>
                {STATUS_LABEL[status]}
              </span>
            </>
          ) : (
            <span className="muted small">{course.subtitle}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
