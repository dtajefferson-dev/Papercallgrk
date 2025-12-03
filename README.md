# Papercallgrk

Pay $0.49 to call me — spam dies, I earn.

Papercall lets you publish a Twilio phone number that requires a one-time payment to connect. A legitimate caller pays a small fee (e.g. $0.49) and the call is connected; unwanted spam calls are blocked by default.

Status: Prototype / demo

## Table of contents

- [Demo](#demo)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [How it works](#how-it-works)
- [Important files](#important-files)
- [Security & privacy notes](#security--privacy-notes)
- [License](#license)

## Demo

Share your Twilio number. Callers pay $0.49 to connect. Example (demo): Call +1-[YOUR-TWILIO-NUMBER] to test.

## Features

- Redirect incoming Twilio calls to a payment flow when the caller hasn’t paid recently.
- Stripe Checkout integration for secure payments.
- Webhook to trigger the call connection after successful payment.
- Simple Next.js front end and API routes.

## Prerequisites

- Node.js (recommended 18+)
- A Twilio account (phone number, SID, token)
- A Stripe account (secret key, publishable key, webhook secret)
- A public URL for Stripe webhooks (for local dev use ngrok or similar)

## Quick start

1. Clone the repo:
   ```bash
   git clone https://github.com/dtajefferson-dev/Papercallgrk.git
   cd Papercallgrk
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env.local` file (see below) and fill in the required keys.

4. Run the dev server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Configure Twilio to use your incoming voice webhook (point to `/api/twilio-incoming` on your site).
   Configure Stripe webhooks to point to `/api/stripe-webhook`.

## Environment variables

Create `.env.local` with values like:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TOKEN=your_twilio_auth_token
TWILIO_NUMBER=+1XXXXXXXXXX      # Twilio number used to initiate calls
YOUR_REAL_PHONE_NUMBER=+1YYYYYYYYYY  # The destination number when connecting
```

Important: never commit secrets to git.

## How it works (high level)

1. Twilio receives an incoming call to your Twilio number.
2. Twilio requests your incoming-call webhook (`/api/twilio-incoming`).
3. The webhook checks Stripe for a recent payment (metadata.caller).
   - If the caller already paid within the allowed window, Twilio dials your real phone number.
   - If not, the webhook responds with TwiML that redirects the caller to a payment flow page.
4. Caller is redirected to `/pay?caller=+1...` which creates a Stripe Checkout Session.
5. Caller completes payment on Stripe Checkout.
6. Stripe sends a webhook to `/api/stripe-webhook` when checkout completes.
7. The webhook triggers Twilio to call the originating caller and connect them to your real number.

## Important files and examples

Below are the key examples and minimal snippets to make things clear.

- package.json:
```json
{
  "name": "papercall",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18",
    "react-dom": "^18",
    "@stripe/stripe-js": "^2.3.0",
    "stripe": "^14.0.0",
    "twilio": "^4.20.0"
  }
}
```

- next.config.js:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
```

- pages/_app.js (global styles):
```js
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
```

- pages/index.js (simple landing/demo):
```js
export default function Home() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>🛡️ Papercall: End Spam, Earn from Calls</h1>
      <p>Share your Twilio number: Anyone pays $0.49 to ring through. Spam dies instantly.</p>
      <p><strong>Demo:</strong> Call +1-[YOUR-TWILIO-NUMBER] to test.</p>
    </div>
  );
}
```

- pages/pay.js (client-side redirect to Stripe Checkout):
```js
import { loadStripe } from "@stripe/stripe-js";
import { useEffect } from "react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function PayPage({ caller }) {
  useEffect(() => {
    fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller }),
    })
      .then(res => res.json())
      .then(({ id }) => {
        stripePromise.then(stripe => stripe.redirectToCheckout({ sessionId: id }));
      });
  }, [caller]);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "400px", margin: "auto" }}>
      <h1>🔑 Complete Your Call</h1>
      <p>Pay $0.49 once to connect (valid 24 hours).</p>
      <p>From: {caller}</p>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>Redirecting to payment...</div>
    </div>
  );
}

export async function getServerSideProps({ query }) {
  return {
    props: {
      caller: query.caller || null,
    },
  };
}
```

- pages/success.js and pages/cancel.js (simple messages):
```js
export default function Success() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>✅ Payment Successful!</h1>
      <p>Your call is connecting now. Thanks for supporting spam-free calls!</p>
    </div>
  );
}
```
```js
export default function Cancel() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>❌ Payment Cancelled</h1>
      <p>Call ended. Spam blocked—try again if it's important.</p>
    </div>
  );
}
```

- pages/api/twilio-incoming.js (incoming Twilio webhook handler):
```js
import Twilio from "twilio";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_WINDOW_SECONDS = 24 * 60 * 60; // example: 24 hours

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { From: caller } = req.body;

  // Check for recent successful payments with metadata.caller === caller
  const recentPayments = await stripe.paymentIntents.list({
    limit: 100,
    created: { gte: Math.floor(Date.now() / 1000) - PRICE_WINDOW_SECONDS },
  });

  const alreadyPaid = recentPayments.data.some(
    (pi) => pi.metadata?.caller === caller && pi.status === "succeeded"
  );

  const twiml = new Twilio.twiml.VoiceResponse();

  if (alreadyPaid) {
    twiml.say("Connecting you now—enjoy your spam-free call!");
    twiml.dial(process.env.YOUR_REAL_PHONE_NUMBER);
  } else {
    twiml.say({ voice: "Google.en-US-Standard-C" }, "This call requires a one-time $0.49 payment to connect. You'll be redirected to pay securely.");
    const paymentUrl = `https://${req.headers.host}/pay?caller=${encodeURIComponent(caller)}`;
    twiml.pause({ length: 1 });
    twiml.redirect(paymentUrl);
  }

  res.type("text/xml");
  res.send(twiml.toString());
}
```

- pages/api/create-checkout.js (create Stripe Checkout session):
```js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_PER_CALL = 49; // cents

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { caller } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Papercall Access' },
          unit_amount: PRICE_PER_CALL,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/success?caller=${caller}`,
      cancel_url: `${req.headers.origin}/cancel?caller=${caller}`,
      metadata: { caller },
    });

    res.json({ id: session.id });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
```

- pages/api/stripe-webhook.js (Stripe webhook to call the payer after success):
```js
import Stripe from "stripe";
import Twilio from "twilio";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilioClient = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Note: use raw body (not JSON-parsed) when constructing event
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const caller = session.metadata?.caller;

    await twilioClient.calls.create({
      url: `http://twimlets.com/echo?Twiml=${encodeURIComponent(
        `<Response><Say>Payment confirmed—connecting you now.</Say><Dial>${process.env.YOUR_REAL_PHONE_NUMBER}</Dial></Response>`
      )}`,
      to: caller,
      from: process.env.TWILIO_NUMBER,
    });
  }

  res.json({ received: true });
}
```

- styles/globals.css (basic example):
```css
html, body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}
* { box-sizing: border-box; }
main { padding: 5rem 0; }
```

- .gitignore (important entries):
```
# dependencies
/node_modules

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# env
.env*.local

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

## Security & privacy notes

- Do not log or expose PCI data locally — use Stripe Checkout to avoid handling raw card numbers.
- Protect webhook endpoints; validate Stripe webhook signatures.
- Rate-limit or otherwise protect your Twilio webhook to avoid abuse.
- Consider stricter verification for metadata (prevent spoofing of caller identifiers).
