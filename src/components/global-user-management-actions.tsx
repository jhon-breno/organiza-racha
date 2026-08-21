"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  adminDeleteUserAction,
  adminSetUserPasswordAction,
  adminUpdateUserProfileAction,
} from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeShort, formatPhone } from "@/lib/utils";

type UserRowData = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string | null;
  emailVerified: string | null;
  phone: string | null;
  image: string | null;
  isFemale: boolean;
  mustChangePassword: boolean;
  pixKey: string | null;
  pixBankName: string | null;
  pixHolderName: string | null;
  passwordHash: string | null;
  passwordResetToken: string | null;
  passwordResetExpires: string | null;
  createdAt: string;
  updatedAt: string;
};

type GlobalUserManagementActionsProps = {
  user: UserRowData;
};

function formatNullableDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return formatDateTimeShort(parsed);
}

function EditUserModal({
  user,
  onClose,
}: {
  user: UserRowData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black text-slate-950">
              Editar usuário
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Atualize os dados globais da conta.
            </p>
          </div>
          <Button onClick={onClose} type="button" variant="ghost">
            Fechar
          </Button>
        </div>

        <form action={adminUpdateUserProfileAction} className="mt-5 space-y-4">
          <input name="userId" type="hidden" value={user.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Nome
              <Input defaultValue={user.name ?? ""} name="name" required />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Apelido
              <Input defaultValue={user.nickname ?? ""} name="nickname" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              E-mail
              <Input
                defaultValue={user.email ?? ""}
                name="email"
                type="email"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Telefone
              <Input defaultValue={user.phone ?? ""} name="phone" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
              URL da foto
              <Input defaultValue={user.image ?? ""} name="image" type="url" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Chave PIX
              <Input defaultValue={user.pixKey ?? ""} name="pixKey" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Banco PIX
              <Input defaultValue={user.pixBankName ?? ""} name="pixBankName" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
              Titular PIX
              <Input
                defaultValue={user.pixHolderName ?? ""}
                name="pixHolderName"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Mulher
              <select
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                defaultValue={user.isFemale ? "true" : "false"}
                name="isFemale"
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Exigir troca de senha
              <select
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                defaultValue={user.mustChangePassword ? "true" : "false"}
                name="mustChangePassword"
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Salvando...">
              Salvar alterações
            </SubmitButton>
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteUserModal({
  user,
  onClose,
}: {
  user: UserRowData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-slate-950">Confirmar deleção</h3>
        <p className="mt-2 text-sm text-slate-600">
          Esta ação remove permanentemente o usuário e dados relacionados.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Usuário: <strong>{user.name || "Sem nome"}</strong>
        </p>

        <form action={adminDeleteUserAction} className="mt-4 space-y-3">
          <input name="userId" type="hidden" value={user.id} />
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Digite <strong>DELETAR</strong> para confirmar
            <Input name="confirmationText" placeholder="DELETAR" required />
          </label>

          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Deletando..." variant="danger">
              Deletar usuário
            </SubmitButton>
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GlobalUserManagementActions({
  user,
}: GlobalUserManagementActionsProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);
  const passwordRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!openPassword) {
      return;
    }

    passwordRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [openPassword]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-bold text-slate-950">
            {user.name || "Sem nome"}
          </p>
          <p className="text-sm text-slate-600">
            Apelido: {user.nickname || "Sem apelido"}
          </p>
          <p className="text-sm text-slate-600">{user.email || "Sem e-mail"}</p>
          <p className="text-sm text-slate-600">
            {user.phone ? formatPhone(user.phone) : "Sem telefone"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            className={
              user.mustChangePassword
                ? "bg-amber-100 text-amber-900"
                : "bg-emerald-100 text-emerald-800"
            }
          >
            {user.mustChangePassword
              ? "Troca de senha pendente"
              : "Senha regular"}
          </Badge>
          <Badge
            className={
              user.isFemale
                ? "bg-pink-100 text-pink-800"
                : "bg-slate-100 text-slate-700"
            }
          >
            {user.isFemale ? "Mulher: Sim" : "Mulher: Não"}
          </Badge>
          <Badge
            className={
              user.passwordHash
                ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-700"
            }
          >
            {user.passwordHash ? "Senha cadastrada" : "Sem senha"}
          </Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
        <p>
          <span className="font-semibold">E-mail verificado:</span>{" "}
          {user.emailVerified ? formatNullableDate(user.emailVerified) : "Não"}
        </p>
        <p>
          <span className="font-semibold">Foto:</span>{" "}
          {user.image || "Não informada"}
        </p>
        <p>
          <span className="font-semibold">Chave PIX:</span>{" "}
          {user.pixKey || "Não informada"}
        </p>
        <p>
          <span className="font-semibold">Banco PIX:</span>{" "}
          {user.pixBankName || "Não informado"}
        </p>
        <p>
          <span className="font-semibold">Titular PIX:</span>{" "}
          {user.pixHolderName || "Não informado"}
        </p>
        <p>
          <span className="font-semibold">Reset ativo:</span>{" "}
          {user.passwordResetToken ? "Sim" : "Não"}
        </p>
        <p>
          <span className="font-semibold">Expiração reset:</span>{" "}
          {formatNullableDate(user.passwordResetExpires)}
        </p>
        <p>
          <span className="font-semibold">Criado em:</span>{" "}
          {formatNullableDate(user.createdAt)}
        </p>
        <p>
          <span className="font-semibold">Atualizado em:</span>{" "}
          {formatNullableDate(user.updatedAt)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setOpenEdit(true)} type="button">
          Editar
        </Button>
        <Button
          onClick={() => setOpenDelete(true)}
          type="button"
          variant="danger"
        >
          Deletar
        </Button>
        <Button
          onClick={() => setOpenPassword((current) => !current)}
          type="button"
          variant="outline"
        >
          {openPassword ? "Fechar reset de senha" : "Resetar senha"}
        </Button>
      </div>

      {openPassword ? (
        <form
          action={adminSetUserPasswordAction}
          className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"
          ref={passwordRef}
        >
          <input name="userId" type="hidden" value={user.id} />
          <Input
            autoComplete="new-password"
            name="password"
            placeholder="Nova senha temporária"
            required
            type="password"
          />
          <Input
            autoComplete="new-password"
            name="confirmPassword"
            placeholder="Confirmar nova senha"
            required
            type="password"
          />
          <SubmitButton pendingLabel="Redefinindo...">
            Resetar senha
          </SubmitButton>
        </form>
      ) : null}

      {isMounted && openEdit
        ? createPortal(
            <EditUserModal onClose={() => setOpenEdit(false)} user={user} />,
            document.body,
          )
        : null}

      {isMounted && openDelete
        ? createPortal(
            <DeleteUserModal
              onClose={() => setOpenDelete(false)}
              user={user}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
