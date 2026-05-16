import { HttpError, env } from "../_shared/runtime.ts";

export const isAdminAccessGranted = (inputCode: string | undefined) => {
  const accessCode = env().ADMIN_ACCESS_CODE?.trim();
  return Boolean(accessCode) && inputCode?.trim() === accessCode;
};

export const assertAdminAccess = (adminCode: string | undefined) => {
  if (!isAdminAccessGranted(adminCode)) {
    throw new HttpError("Unauthorized", 401, "UNAUTHORIZED_ADMIN");
  }
};
