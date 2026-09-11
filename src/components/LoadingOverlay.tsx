/**
 * 데이터 조회/저장/삭제/다운로드 등 로딩 중임을 사용자가 명확히 인지할 수 있도록
 * 해당 영역(또는 화면 전체) 위에 반투명 레이어 + 스피너를 덮어 보여준다.
 *
 * 기본값(`fullscreen=false`)은 `position: relative`인 가장 가까운 부모 요소를 기준으로
 * 그 영역만 덮는다 — 감싸는 컨테이너에 `relative` 클래스를 함께 지정해야 한다.
 * `fullscreen`이면 뷰포트 전체를 덮는다(예: 파일 다운로드처럼 화면 전반에 영향을 주는 동작).
 */
export function LoadingOverlay({
  label = "불러오는 중...",
  fullscreen = false,
}: {
  label?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`z-30 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-white/70 backdrop-blur-[1px] dark:bg-black/60 ${
        fullscreen ? "fixed inset-0 z-50" : "absolute inset-0"
      }`}
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-black dark:border-zinc-700 dark:border-t-zinc-50" />
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
    </div>
  );
}
