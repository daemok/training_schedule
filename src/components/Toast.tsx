"use client";

interface Props {
  message: string;
}

/** 화면 하단 중앙에 잠깐 떴다 사라지는 확인 메시지. 표시/해제 타이밍은 호출 측에서 관리한다. */
export function Toast({ message }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-50 dark:text-black">
        {message}
      </div>
    </div>
  );
}
