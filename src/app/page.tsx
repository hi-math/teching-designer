import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import LoginForm from "@/components/LoginForm";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function Home() {
  return (
    <div className={jakarta.className}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
