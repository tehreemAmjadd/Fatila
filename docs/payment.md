# Payment & Subscription System Documentation

## Overview

This document explains the complete payment and subscription flow of the system, including Stripe integration, APIs, and event handling.

#  Payment Flow

1. User selects a subscription plan (Starter / Pro / Business)
2. User is redirected to Stripe Checkout page
3. User completes payment using card details
4. On successful payment, Stripe triggers a webhook event
5. Backend webhook receives the event and verifies it
6. User subscription data is updated in the database
7. Dashboard UI reflects the updated plan and subscription status

#  APIs Used

### 1. `/api/create-checkout-session`

* Creates a Stripe checkout session
* Sends user to Stripe hosted payment page

### 2. `/api/webhook`

* Handles Stripe webhook events
* Verifies event signature
* Updates database accordingly

### 3. `/api/get-user`

* Fetches user data from database
* Returns plan and subscription status

### 4. `/api/subscription/update-plan`

* Updates user subscription plan (upgrade/downgrade)
* Communicates with Stripe subscription API

### 5. `/api/subscription/cancel`

* Cancels active subscription
* Updates database status to "canceled"

#  Stripe Events Handled

###  `checkout.session.completed`

* Triggered when payment is successful
* Used to create or activate subscription

###  `customer.subscription.updated`

* Triggered when user upgrades/downgrades plan
* Updates plan details in database

###  `customer.subscription.deleted`

* Triggered when subscription is canceled
* Marks subscription as inactive/canceled

# Database Fields (Example)

* `email` → user email
* `plan` → starter / pro / business
* `subscriptionStatus` → active / canceled / inactive
* `stripeCustomerId` → Stripe customer ID
* `stripeSubscriptionId` → Stripe subscription ID

#  Edge Cases Handled

* Duplicate subscriptions prevented
* Failed payments handled gracefully
* Unauthorized users redirected to login
* UI updates after backend changes
* Subscription cancellation synced with Stripe

#  Final Notes

* Stripe is used in test mode for development
* Webhooks are essential for syncing backend data
* Always verify webhook signatures for security

