// Registry of signature request templates. Adding a new template is a
// single-file edit: append a SignatureTemplate to the array.
//
// The render() function gets the application's data and returns the
// snapshot body text. The signer signs THAT exact text — future edits
// to the template don't retroactively change anything signed.

export type SignatureTemplate = {
  key: string;
  label: string;
  defaultTitle: string;
  defaultTargetSubfolder: string;
  defaultRoles: string[];
  render: (vars: TemplateVars) => string;
};

export type TemplateVars = {
  applicantName: string;
  markText: string;
  goodsServicesSummary: string;
  attorneyName: string;
};

const consentToRegister: SignatureTemplate = {
  key: "consent_to_register",
  label: "Consent to Register (surname mark)",
  defaultTitle: "Consent to Register",
  defaultTargetSubfolder: "01 Application",
  defaultRoles: ["Consenter"],
  render: ({ applicantName, markText, goodsServicesSummary }) =>
    `CONSENT TO REGISTER

I, ${applicantName || "[NAME]"}, hereby consent to the registration of the trademark "${markText || "[MARK]"}" with the United States Patent and Trademark Office in connection with ${goodsServicesSummary || "[goods/services]"}.

I acknowledge that my surname (or other personal identifier) appears in the mark, and I voluntarily consent to its use and registration as a trademark by the applicant.

This consent is given freely and without coercion. I understand that the applicant will rely on this consent in pursuing federal registration of the mark, and that the U.S. Patent and Trademark Office may rely on this consent in approving registration.

By signing below, I confirm that the statements made above are true to the best of my knowledge and belief.`,
};

const custom: SignatureTemplate = {
  key: "custom",
  label: "Custom (compose freeform / upload file)",
  defaultTitle: "Signature requested",
  defaultTargetSubfolder: "02 Filing Documents",
  defaultRoles: [],
  render: () => "",
};

export const SIGNATURE_TEMPLATES: SignatureTemplate[] = [
  consentToRegister,
  custom,
];

export function getTemplate(key: string | null | undefined): SignatureTemplate {
  if (!key) return custom;
  return SIGNATURE_TEMPLATES.find((t) => t.key === key) ?? custom;
}

export const SIGNATURE_REQUEST_VERSION = "v1-2026-05";
