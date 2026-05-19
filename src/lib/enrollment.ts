type EnrollmentWithPosition = {
  participantPosition?: string | null;
};

type EnrollmentWithStatus = EnrollmentWithPosition & {
  status: string;
  paymentStatus: string;
};

type EnrollmentWithCreatedAt = EnrollmentWithStatus & {
  createdAt: Date | string;
};

export function isGoalkeeperPosition(position?: string | null) {
  return position?.trim().toLowerCase() === "goleiro";
}

export function isGoalkeeperEnrollment(enrollment: EnrollmentWithPosition) {
  return isGoalkeeperPosition(enrollment.participantPosition);
}

export function isVisibleEnrollment(enrollment: {
  status: string;
  paymentStatus: string;
}) {
  return (
    enrollment.status !== "CANCELED" && enrollment.paymentStatus !== "REFUNDED"
  );
}

export function isConfirmedEnrollment(enrollment: EnrollmentWithStatus) {
  return (
    enrollment.status === "ACTIVE" &&
    (enrollment.paymentStatus === "PAID" || isGoalkeeperEnrollment(enrollment))
  );
}

export function getEnrollmentStatusLabel(enrollment: EnrollmentWithStatus) {
  if (enrollment.status === "CANCELED") {
    return "Cancelado";
  }
  if (enrollment.paymentStatus === "REFUNDED") {
    return "Cancelado";
  }
  if (enrollment.paymentStatus === "REFUND_REQUESTED") {
    return "Aguardando reembolso";
  }
  if (enrollment.status === "WAITLIST") {
    return "Lista de espera";
  }
  if (isConfirmedEnrollment(enrollment)) {
    return "Confirmado";
  }
  if (
    enrollment.status === "ACTIVE" &&
    enrollment.paymentStatus === "PROOF_SENT"
  ) {
    return "Pagamento em análise";
  }
  if (
    enrollment.status === "ACTIVE" &&
    enrollment.paymentStatus === "PENDING"
  ) {
    return "Aguardando pagamento";
  }
  return "Pendente";
}

export function getEnrollmentStatusEmoji(enrollment: EnrollmentWithStatus) {
  const label = getEnrollmentStatusLabel(enrollment);

  if (label === "Confirmado") {
    return "✅";
  }
  if (
    label === "Aguardando pagamento" ||
    label === "Pagamento em análise" ||
    label === "Aguardando reembolso" ||
    label === "Pendente"
  ) {
    return "⏳";
  }
  if (label === "Lista de espera") {
    return "🪑";
  }
  return "❌";
}

function getEnrollmentSortPriority(enrollment: EnrollmentWithStatus) {
  const label = getEnrollmentStatusLabel(enrollment);

  if (label === "Confirmado") {
    return 0;
  }
  if (label === "Pagamento em análise") {
    return 1;
  }
  if (label === "Aguardando pagamento") {
    return 2;
  }
  if (label === "Lista de espera") {
    return 3;
  }
  if (label === "Aguardando reembolso") {
    return 4;
  }
  if (label === "Pendente") {
    return 5;
  }
  return 6;
}

export function compareEnrollmentsForExport(
  left: EnrollmentWithCreatedAt,
  right: EnrollmentWithCreatedAt,
) {
  const priorityDifference =
    getEnrollmentSortPriority(left) - getEnrollmentSortPriority(right);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return (
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

export function isAwaitingPaymentEnrollment(enrollment: EnrollmentWithStatus) {
  return (
    enrollment.status === "ACTIVE" &&
    (enrollment.paymentStatus === "PENDING" ||
      enrollment.paymentStatus === "PROOF_SENT") &&
    !isGoalkeeperEnrollment(enrollment)
  );
}

export function countsTowardAthleteLimit(enrollment: EnrollmentWithStatus) {
  return enrollment.status === "ACTIVE" && !isGoalkeeperEnrollment(enrollment);
}