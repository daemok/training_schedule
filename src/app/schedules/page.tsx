import { redirect } from "next/navigation";

/**
 * 매니저/팀장용 스케줄 조회는 /calendar(공용 캘린더)로 통합되었다.
 * 기존 링크/북마크 호환을 위해 리다이렉트만 남겨둔다.
 */
export default function SchedulesRedirectPage() {
  redirect("/calendar");
}
