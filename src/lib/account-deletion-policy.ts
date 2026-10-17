export function ownAccountDeletionAllowed(input: {
  role: string;
  email: string;
  confirmEmail: string;
}) {
  return (
    input.role === "CUSTOMER" &&
    input.email.trim().toLowerCase() === input.confirmEmail.trim().toLowerCase()
  );
}
