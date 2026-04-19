"use client";

import LegalLayout from "../components/LegalLayout";

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="April 20, 2026">
      <p>
        At Fatila, we want you to be completely satisfied with our service. This Refund Policy outlines when and
        how you can request a refund for your Fatila subscription.
      </p>

      <div className="highlight-box">
        <p style={{ marginBottom: 0 }}>
          <strong>Quick Summary:</strong> We offer a <strong>14-day money-back guarantee</strong> for new
          subscribers. If you're not satisfied within 14 days of your initial purchase, email{" "}
          <a href="mailto:billing@fatilaai.com">billing@fatilaai.com</a> for a full refund.
        </p>
      </div>

      <h2>1. 14-Day Money-Back Guarantee</h2>
      <p>
        New subscribers to any paid Fatila plan may request a full refund within <strong>14 calendar days</strong>{" "}
        of their initial purchase, provided that:
      </p>
      <ul>
        <li>The request is submitted within 14 days of the original transaction date</li>
        <li>You have not violated our <a href="/terms">Terms of Service</a></li>
        <li>You have not used excessive platform credits (see Section 5 below)</li>
      </ul>
      <p>
        Refunds are processed to the original payment method via our payment processor, Paddle, typically within
        5-10 business days.
      </p>

      <h2>2. How to Request a Refund</h2>
      <ol>
        <li>
          Email us at <a href="mailto:billing@fatilaai.com">billing@fatilaai.com</a> from the email address
          associated with your Fatila account
        </li>
        <li>Include your order/transaction ID (found in your Paddle receipt email)</li>
        <li>Briefly describe your reason for the refund (optional, but helps us improve)</li>
      </ol>
      <p>We aim to respond within 2 business days.</p>

      <h2>3. Subscription Cancellation vs. Refunds</h2>
      <p>Please note the distinction between cancellation and refund:</p>
      <ul>
        <li>
          <strong>Cancellation</strong> stops future billing. Your subscription remains active until the end of
          the current billing period, then terminates. This can be done anytime from your account dashboard.
        </li>
        <li>
          <strong>Refund</strong> returns money already paid. Refunds are subject to the terms in this policy.
        </li>
      </ul>

      <h2>4. Renewal Refunds</h2>
      <p>
        Subscriptions auto-renew at the end of each billing period. If an auto-renewal charge occurs and you
        wish to cancel:
      </p>
      <ul>
        <li>You may request a refund of the renewal charge within <strong>7 days</strong> of the renewal date</li>
        <li>After 7 days, renewal charges are non-refundable, but you may cancel to prevent future renewals</li>
      </ul>
      <p>We recommend cancelling at least 24 hours before your renewal date to avoid charges.</p>

      <h2>5. Heavy Usage Exception</h2>
      <p>To prevent abuse, refund eligibility may be limited or denied if:</p>
      <ul>
        <li>You have used more than <strong>25% of your plan's monthly lead credits</strong> before requesting a refund</li>
        <li>You have downloaded or exported significant data</li>
        <li>You have used the Service for commercial purposes during the trial period</li>
      </ul>

      <h2>6. Annual Plan Refunds</h2>
      <p>
        Annual subscriptions are eligible for the 14-day money-back guarantee from the original purchase date.
        After 14 days:
      </p>
      <ul>
        <li>
          Annual plan refunds are calculated on a prorated basis, minus any applicable discount you received for
          choosing the annual plan
        </li>
        <li>
          Prorated refunds are issued at our discretion and may be denied for accounts with policy violations
        </li>
      </ul>

      <h2>7. Non-Refundable Situations</h2>
      <p>Refunds will NOT be issued in the following cases:</p>
      <ul>
        <li>Requests made more than 14 days after the initial purchase (with the exception of the 7-day renewal window)</li>
        <li>Account terminated for violation of our Terms of Service</li>
        <li>Dissatisfaction with public data availability (we source from public directories and cannot guarantee specific results)</li>
        <li>Free tier usage (no payment made)</li>
        <li>Add-on credits or one-time purchases after they have been used</li>
      </ul>

      <h2>8. Disputed Charges</h2>
      <p>
        If you believe a charge is incorrect, please contact us first at{" "}
        <a href="mailto:billing@fatilaai.com">billing@fatilaai.com</a> before initiating a chargeback with your
        bank. We will work quickly to resolve billing disputes.
      </p>
      <p>
        <strong>Please note:</strong> Initiating a chargeback without first contacting us may result in immediate
        account suspension.
      </p>

      <h2>9. Payment Processor Information</h2>
      <p>
        All payments and refunds are processed through <strong>Paddle.com Market Limited</strong>, our Merchant
        of Record. Paddle may have additional terms regarding refunds — see{" "}
        <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
          Paddle's Buyer Terms
        </a>.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Refund Policy from time to time. Changes will be posted on this page with an updated
        "Last updated" date. Refund requests will be evaluated based on the policy in effect at the time of your
        purchase.
      </p>

      <h2>11. Contact Us</h2>
      <div className="highlight-box">
        <p style={{ marginBottom: 0 }}>
          <strong>Fatila — Billing Support</strong>
          <br />
          Email: <a href="mailto:billing@fatilaai.com">billing@fatilaai.com</a>
          <br />
          Response time: Within 2 business days
          <br />
          Website: <a href="https://fatilaai.com">fatilaai.com</a>
        </p>
      </div>
    </LegalLayout>
  );
}
