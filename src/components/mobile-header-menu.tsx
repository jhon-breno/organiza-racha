"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, PlusCircle, X } from "lucide-react";
import { signOutAction } from "@/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, getInitials } from "@/lib/utils";

const MENU_ANIMATION_MS = 300;

type MobileHeaderMenuProps = {
  user?: {
    name?: string | null;
    image?: string | null;
  } | null;
};

export function MobileHeaderMenu({ user }: MobileHeaderMenuProps) {
  const isLoggedIn = Boolean(user);

  const firstName = user?.name?.trim().split(" ")[0] || "Atleta";

  return (
    <div className="md:hidden">
      <DrawerContent
        user={user}
        firstName={firstName}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}

function DrawerContent({
  user,
  firstName,
  isLoggedIn,
}: {
  user?: { name?: string | null; image?: string | null } | null;
  firstName: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  function openMenu() {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }

  function closeMenu() {
    setOpen(false);
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimeoutRef.current = null;
    }, MENU_ANIMATION_MS);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (drawerRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <button
        aria-label="Abrir menu"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
        onClick={openMenu}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted ? (
        <div className="fixed inset-0 z-50">
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-all duration-300 ease-out",
              open ? "opacity-100" : "opacity-0 backdrop-blur-0",
            )}
          />

          <aside
            ref={drawerRef}
            className={cn(
              "absolute right-0 top-0 flex h-dvh w-[90vw] max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl will-change-transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              open
                ? "translate-x-0 opacity-100 scale-100"
                : "translate-x-5 opacity-0 scale-[0.985]",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
              <p className="text-base font-bold text-slate-950">Menu</p>
              <button
                aria-label="Fechar menu"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                onClick={closeMenu}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 bg-white px-4 py-4">
              {isLoggedIn ? (
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-teal-600 text-sm font-bold text-white">
                    {user?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={user?.name ?? "Avatar"}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        src={user.image.trim()}
                      />
                    ) : (
                      getInitials(user?.name)
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                      Bem-vindo
                    </p>
                    <p className="text-base font-bold text-slate-950">
                      {firstName}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-bold text-slate-950">
                    Seja bem-vindo
                  </p>
                  <Link
                    className={buttonVariants({ size: "sm" })}
                    href="/auth/signin"
                    onClick={closeMenu}
                  >
                    Entrar
                  </Link>
                </div>
              )}
            </div>

            <nav className="flex flex-1 flex-col gap-2 bg-white px-4 py-4">
              <Link
                className={buttonVariants({
                  variant: "ghost",
                  className: "justify-start",
                })}
                href="/"
                onClick={closeMenu}
              >
                Início
              </Link>

              {isLoggedIn ? (
                <>
                  <Link
                    className={buttonVariants({
                      variant: "ghost",
                      className: "justify-start",
                    })}
                    href="/minhas-inscricoes"
                    onClick={closeMenu}
                  >
                    Minhas inscrições
                  </Link>
                  <Link
                    className={buttonVariants({
                      variant: "ghost",
                      className: "justify-start",
                    })}
                    href="/dashboard"
                    onClick={closeMenu}
                  >
                    Painel do organizador
                  </Link>
                  <Link
                    className={buttonVariants({
                      variant: "outline",
                      className: "justify-start",
                    })}
                    href="/dashboard/rachas/new"
                    onClick={closeMenu}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Novo racha
                  </Link>
                </>
              ) : null}
            </nav>

            {isLoggedIn ? (
              <div className="border-t border-slate-200 bg-white px-4 py-4">
                <form action={signOutAction}>
                  <Button className="w-full justify-start" variant="secondary">
                    Sair
                  </Button>
                </form>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
