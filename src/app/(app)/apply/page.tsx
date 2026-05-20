import { redirect } from "next/navigation";
import { createDraftApplication } from "./actions";

// Entry point for starting a new application.
// Creates a draft row then redirects to the form for that draft.
export default async function NewApplicationPage() {
  const { id } = await createDraftApplication();
  redirect(`/apply/${id}`);
}
