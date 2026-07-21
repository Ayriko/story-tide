import { ShellBackground } from "../shell-background";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <ShellBackground />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 md:items-end md:px-12 md:py-16 lg:px-20">
        <main className="w-full max-w-md md:w-[32rem]">{children}</main>
      </div>
    </div>
  );
}
