# Papercallgrk
Pay $0.49 to call me — spam dies, I earn
# Papercall - Coming Soon

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
  },
  "devDependencies": {
    "eslint": "^8",
    "eslint-config-next": "14.0.0"
  }
}
/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}export default function Home() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>🛡️ Papercall: End Spam, Earn from Calls</h1>
      <p>Share your Twilio number: Anyone pays $0.49 to ring through. Spam dies instantly.</p>
      <p><strong>Demo:</strong> Call +1-[YOUR-TWILIO-NUMBER] to test.</p>
    </div>
  );
}import { loadStripe } from "@stripe/stripe-js";
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
}export default function Success() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>✅ Payment Successful!</h1>
      <p>Your call is connecting now. Thanks for supporting spam-free calls!</p>
    </div>
  );
}export default function Cancel() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>❌ Payment Cancelled</h1>
      <p>Call ended. Spam blocked—try again if it's important.</p>
    </div>
  );
}import Twilio from "twilio";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilioClient = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const PRICE_PER_CALL = 49;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { From: caller, To: myNumber } = req.body;

  const recentPayments = await stripe.paymentIntents.list({
    limit: 100,
    created: { gte: Math.floor(Date.now() / 1000) - 86400 },
  });

  const alreadyPaid = recentPayments.data.some(
    (pi) => pi.metadata.caller === caller && pi.status === "succeeded"
  );

  const twiml = new Twilio.twiml.VoiceResponse();

  if (alreadyPaid) {
    twiml.say("Connecting you now—enjoy your spam-free call!");
    twiml.dial(process.env.YOUR_REAL_PHONE_NUMBER);
  } else {
    twiml.say({
      voice: "Google.en-US-Standard-C",
    }, "This call requires a one-time $0.49 payment to connect. You'll be redirected to pay securely.");

    const paymentUrl = `https://${req.headers.host}/pay?caller=${encodeURIComponent(caller)}`;
    twiml.pause({ length: 1 });
    twiml.redirect(paymentUrl);
  }

  res.type("text/xml");
  res.send(twiml.toString());
}import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_PER_CALL = 49;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { caller } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Papercall Access',
            },
            unit_amount: PRICE_PER_CALL,
          },
          quantity: 1,
        },
      ],
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
}import Stripe from "stripe";
import Twilio from "twilio";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilioClient = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const caller = session.metadata.caller;

    await twilioClient.calls.create({
      url: `http://twimlets.com/echo?Twiml=${encodeURIComponent(
        `<Response><Say>Payment confirmed—connecting you now.</Say><Dial>${process.env.YOUR_REAL_PHONE_NUMBER}</Dial></Response>`
      )}`,
      to: caller,
      from: process.env.TWILIO_NUMBER,
    });
  }

  res.json({ received: true });
}html,
body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
}

* {
  box-sizing: border-box;
}

main {
  padding: 5rem 0;
  flex: 1;
}# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

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

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
