import Stripe from "stripe";
import Twilio from "twilio";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilio = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) { return res.status(400).send("Webhook error"); }

  if (event.type === "checkout.session.completed") {
    const caller = event.data.object.metadata.caller;
    await twilio.calls.create({
      url: "http://twimlets.com/echo?Twiml=" + encodeURIComponent(
        `<Response><Say>Connecting…</Say><Dial>${process.env.YOUR_REAL_PHONE_NUMBER}</Dial></Response>`
      ),
      to: caller,
      from: process.env.TWILIO_NUMBER
    });
  }
  res.json({ received: true });
}