import Twilio from "twilio";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const caller = req.body.From;

  // Check last 24h payments
  const payments = await stripe.paymentIntents.list({ limit: 100 });
  const paid = payments.data.some(p => p.metadata.caller === caller && p.status === "succeeded");

  const twiml = new Twilio.twiml.VoiceResponse();

  if (paid) {
    twiml.dial(process.env.YOUR_REAL_PHONE_NUMBER);
  } else {
    twiml.say("This call costs 49 cents. Redirecting to payment.");
    const url = `https://${req.headers.host}/pay?caller=${encodeURIComponent(caller)}`;
    twiml.redirect(url);
  }

  res.type("text/xml").send(twiml.toString());
}