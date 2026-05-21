"use client";

import {
  SignatureRequestBlock,
  type SignatureRequestForBlock,
} from "@/components/signature-request-block";
import { signWithToken } from "./actions";

export function SignPageClient({
  token,
  signerEmail,
  request,
}: {
  token: string;
  signerEmail: string;
  request: SignatureRequestForBlock;
}) {
  return (
    <SignatureRequestBlock
      request={request}
      viewerEmail={null}
      compact={false}
      tokenSign={{
        token,
        signerEmail,
        onSign: (signature) => signWithToken({ token, signature }),
      }}
    />
  );
}
