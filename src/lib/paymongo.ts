// Server-side PayMongo client. Do NOT import from client components.
const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader() {
  const secret = process.env.PAYMONGO_SECRET_KEY;
  if (!secret) throw new Error("PAYMONGO_SECRET_KEY is not set");
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

export type PayMongoLineItem = {
  name: string;
  quantity: number;
  amount: number; // centavos
  currency: "PHP";
  description?: string;
  images?: string[];
};

export type CreateCheckoutSessionInput = {
  lineItems: PayMongoLineItem[];
  paymentMethodTypes: string[]; // e.g. ["gcash","grab_pay","paymaya","qrph"]
  successUrl: string;
  cancelUrl: string;
  referenceNumber: string; // our Order id as string
  description?: string;
  billing?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, string>;
};

export type PayMongoCheckoutSession = {
  id: string;
  attributes: {
    checkout_url: string;
    payment_intent?: {
      id?: string;
      attributes?: {
        status?: string;
        payments?: Array<{
          id: string;
          attributes: { status: string; amount: number };
        }>;
      };
    };
    payments?: Array<{
      id: string;
      attributes: { status: string; amount: number };
    }>;
    status?: string;
  };
};

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<PayMongoCheckoutSession> {
  const body = {
    data: {
      attributes: {
        line_items: input.lineItems.map((li) => ({
          name: li.name,
          quantity: li.quantity,
          amount: li.amount,
          currency: li.currency,
          description: li.description,
          images: li.images,
        })),
        payment_method_types: input.paymentMethodTypes,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference_number: input.referenceNumber,
        description: input.description,
        billing: input.billing,
        metadata: input.metadata,
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
      },
    },
  };

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayMongo checkout session failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: PayMongoCheckoutSession };
  return json.data;
}

export async function retrieveCheckoutSession(
  id: string,
): Promise<PayMongoCheckoutSession> {
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${id}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayMongo retrieve failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: PayMongoCheckoutSession };
  return json.data;
}

// Extract a paid payment id from a checkout session, if any
export function getPaidPaymentId(
  session: PayMongoCheckoutSession,
): { paymentId: string; amount: number } | null {
  const direct = session.attributes.payments?.find(
    (p) => p.attributes.status === "paid",
  );
  if (direct) return { paymentId: direct.id, amount: direct.attributes.amount };

  const nested = session.attributes.payment_intent?.attributes?.payments?.find(
    (p) => p.attributes.status === "paid",
  );
  if (nested) return { paymentId: nested.id, amount: nested.attributes.amount };

  return null;
}
