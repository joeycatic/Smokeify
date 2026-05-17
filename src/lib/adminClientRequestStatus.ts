const ADMIN_REQUEST_STATUS_EVENT = "smokeify:admin-request-status";

export type AdminRequestStatusDetail = {
  kind: "warning" | "error";
  message: string;
  detail: string;
};

export function reportAdminRequestStatus(detail: AdminRequestStatusDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AdminRequestStatusDetail>(ADMIN_REQUEST_STATUS_EVENT, {
      detail,
    }),
  );
}

export function subscribeAdminRequestStatus(
  listener: (detail: AdminRequestStatusDetail) => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AdminRequestStatusDetail>;
    if (!customEvent.detail) return;
    listener(customEvent.detail);
  };

  window.addEventListener(ADMIN_REQUEST_STATUS_EVENT, handler);
  return () => window.removeEventListener(ADMIN_REQUEST_STATUS_EVENT, handler);
}
