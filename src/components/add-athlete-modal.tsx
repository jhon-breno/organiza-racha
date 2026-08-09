"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, UserPlus, UserX, X } from "lucide-react";
import {
  addOrganizerEnrollmentAction,
  searchUsersByPhoneAction,
} from "@/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import {
  levelOptions,
  positionOptions,
  positionOptionsFutebol,
  positionOptionsVolei,
} from "@/lib/constants";
import { detectIsFemaleByName } from "@/lib/gender";
import { formatPhone } from "@/lib/utils";

type AddAthleteModalProps = {
  rachaId: string;
  modality: string;
};

type SearchedUser = {
  id: string;
  name: string;
  nickname: string;
  phone: string;
};

export function AddAthleteModal({ rachaId, modality }: AddAthleteModalProps) {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<"SEARCH" | "CREATE">("SEARCH");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);

  // Create state
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createIsFemale, setCreateIsFemale] = useState(false);
  const [isFemaleTouched, setIsFemaleTouched] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  const availablePositions =
    modality === "FUTEBOL"
      ? positionOptionsFutebol
      : modality === "VOLEI"
        ? positionOptionsVolei
        : positionOptions;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle ESC and click outside
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Debounced search logic
  useEffect(() => {
    if (!open || mode !== "SEARCH") return;

    const trimmed = searchQuery.trim();
    const digits = trimmed.replace(/\D/g, "");

    if (trimmed.length < 2 && digits.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const users = await searchUsersByPhoneAction(searchQuery);
        setSearchResults(users);
        setHasSearched(true);
      } catch (err) {
        console.error("Erro ao buscar usuários:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, open, mode]);

  function handleClose() {
    setOpen(false);
    setMode("SEARCH");
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setSelectedUser(null);
    setCreateName("");
    setCreatePhone("");
  }

  function handleOpenCreateUser(defaultPhone = "") {
    setMode("CREATE");
    setCreatePhone(defaultPhone || searchQuery);
    setCreateName("");
  }

  return (
    <>
      <Button
        className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
        onClick={() => setOpen(true)}
        type="button"
      >
        <UserPlus className="h-4 w-4" />
        Adicionar Atleta
      </Button>

      {open &&
        isMounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              ref={dialogRef}
              aria-labelledby="add-athlete-modal-title"
              aria-modal="true"
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
              role="dialog"
            >
              <button
                aria-label="Fechar"
                className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={handleClose}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>

              {mode === "SEARCH" ? (
                <div className="space-y-6">
                  <div>
                    <h2
                      id="add-athlete-modal-title"
                      className="text-2xl font-bold text-slate-950"
                    >
                      Adicionar Atleta
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Busque o participante por telefone, nome ou apelido para
                      incluir no racha.
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-800">
                      Telefone, Nome ou Apelido do Atleta
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        autoFocus
                        className="pl-10 text-sm"
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (selectedUser) setSelectedUser(null);
                        }}
                        placeholder="Digite o telefone, nome ou apelido..."
                        value={searchQuery}
                      />
                    </div>
                  </div>

                  {/* Selected User Badge */}
                  {selectedUser && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                            {selectedUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              {selectedUser.name}
                            </p>
                            {selectedUser.nickname ? (
                              <p className="text-xs text-slate-500">
                                Apelido: {selectedUser.nickname}
                              </p>
                            ) : null}
                            <p className="text-xs text-slate-600">
                              {formatPhone(selectedUser.phone)}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => setSelectedUser(null)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Alterar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Search Results List */}
                  {!selectedUser && (
                    <div className="space-y-2">
                      {isSearching && (
                        <p className="py-3 text-center text-xs text-slate-500">
                          Buscando atletas...
                        </p>
                      )}

                      {!isSearching && searchResults.length > 0 && (
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                          <p className="text-xs font-medium text-slate-500">
                            Selecione o atleta encontrado:
                          </p>
                          {searchResults.map((user) => (
                            <button
                              key={user.id}
                              className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50"
                              onClick={() => {
                                setSelectedUser(user);
                              }}
                              type="button"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {user.name}
                                  </p>
                                  {user.nickname ? (
                                    <p className="text-xs text-slate-500">
                                      Apelido: {user.nickname}
                                    </p>
                                  ) : null}
                                  <p className="text-xs text-slate-500">
                                    {formatPhone(user.phone)}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-medium text-emerald-600">
                                Selecionar
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Not Found State */}
                      {!isSearching &&
                        hasSearched &&
                        searchResults.length === 0 &&
                        (searchQuery.trim().length >= 2 ||
                          searchQuery.replace(/\D/g, "").length >= 2) && (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-center space-y-3">
                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                              <UserX className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                Nenhum atleta encontrado
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Não encontramos nenhum usuário com esse
                                telefone, nome ou apelido.
                              </p>
                            </div>
                            <Button
                              className="w-full bg-slate-900 text-white hover:bg-slate-800 gap-2"
                              onClick={() => handleOpenCreateUser(searchQuery)}
                              size="sm"
                              type="button"
                            >
                              <UserPlus className="h-4 w-4" />
                              Criar Usuário
                            </Button>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Form to submit selected user */}
                  {selectedUser && (
                    <form
                      action={addOrganizerEnrollmentAction}
                      className="space-y-4 pt-2 border-t border-slate-100"
                    >
                      <input name="rachaId" type="hidden" value={rachaId} />
                      <input
                        name="participantName"
                        type="hidden"
                        value={selectedUser.name}
                      />
                      <input
                        name="participantPhone"
                        type="hidden"
                        value={selectedUser.phone}
                      />

                      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                        Posição
                        <Select
                          defaultValue="Versátil"
                          name="participantPosition"
                        >
                          {availablePositions.map((position) => (
                            <option key={position} value={position}>
                              {position}
                            </option>
                          ))}
                        </Select>
                      </label>

                      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                        Nível
                        <Select defaultValue="STAR_3" name="participantLevel">
                          {levelOptions.map((level) => (
                            <option key={level.value} value={level.value}>
                              {level.visual} {level.label}
                            </option>
                          ))}
                        </Select>
                      </label>

                      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                        Observação (opcional)
                        <textarea
                          className="flex min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          name="notes"
                          placeholder="Ex.: chega 10 min antes..."
                        />
                      </label>

                      <div className="pt-2 flex gap-2">
                        <SubmitButton
                          className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                          pendingLabel="Adicionando..."
                        >
                          Adicionar ao Racha
                        </SubmitButton>
                      </div>
                    </form>
                  )}

                  {/* Quick option to manually create if not searched yet */}
                  {!selectedUser && !hasSearched && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Não encontrou o usuário?</span>
                      <button
                        className="font-semibold text-emerald-600 hover:underline"
                        onClick={() => handleOpenCreateUser("")}
                        type="button"
                      >
                        + Criar Novo Usuário
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* CREATE MODE FORM */
                <div className="space-y-6">
                  <div>
                    <h2
                      id="add-athlete-modal-title"
                      className="text-2xl font-bold text-slate-950"
                    >
                      Criar Novo Usuário
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      O usuário será cadastrado no sistema e adicionado a este
                      racha automaticamente.
                    </p>
                  </div>

                  <form
                    action={addOrganizerEnrollmentAction}
                    className="space-y-4"
                  >
                    <input name="rachaId" type="hidden" value={rachaId} />

                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      Nome Completo*
                      <Input
                        autoFocus
                        name="participantName"
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreateName(val);
                          if (!isFemaleTouched) {
                            setCreateIsFemale(detectIsFemaleByName(val));
                          }
                        }}
                        placeholder="Nome do atleta"
                        required
                        value={createName}
                      />
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 cursor-pointer">
                      <input
                        checked={createIsFemale}
                        className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                        name="isFemale"
                        onChange={(e) => {
                          setCreateIsFemale(e.target.checked);
                          setIsFemaleTouched(true);
                        }}
                        type="checkbox"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Atleta do sexo feminino (Mulher)
                      </span>
                    </label>

                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      Telefone*
                      <PhoneInput
                        name="participantPhone"
                        onChange={(e) => setCreatePhone(e.target.value)}
                        placeholder="85 9 9999-9999"
                        required
                        value={createPhone}
                      />
                    </label>

                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      Posição
                      <Select
                        defaultValue="Versátil"
                        name="participantPosition"
                      >
                        {availablePositions.map((position) => (
                          <option key={position} value={position}>
                            {position}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      Nível
                      <Select defaultValue="STAR_3" name="participantLevel">
                        {levelOptions.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.visual} {level.label}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      Observação (opcional)
                      <textarea
                        className="flex min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        name="notes"
                        placeholder="Ex.: canhoto, joga na zaga..."
                      />
                    </label>

                    <div className="pt-2 space-y-2">
                      <SubmitButton
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                        pendingLabel="Criando e adicionando..."
                      >
                        Criar e Adicionar ao Racha
                      </SubmitButton>

                      <Button
                        className="w-full"
                        onClick={() => setMode("SEARCH")}
                        type="button"
                        variant="ghost"
                      >
                        Voltar para busca
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
