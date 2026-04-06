import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function Home() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
