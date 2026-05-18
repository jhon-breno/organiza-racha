type EnrollmentWithPosition = {
  participantPosition?: string | null;
};

type EnrollmentWithStatus = EnrollmentWithPosition & {
  status: string;
  paymentStatus: string;
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