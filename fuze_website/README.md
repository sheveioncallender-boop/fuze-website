# Fuze Restaurant Experience — Odoo 19

Production-oriented Odoo 19 add-on that keeps the approved Fuze website, cart,
checkout and kitchen-display design while using Odoo as the operating engine.

## What is included

- Complete Fuze-branded website: Home, Menu, Our Fuze, Locations and Contact.
- Live Odoo product catalogue in the custom `/menu` experience.
- Branded cart and checkout with pickup, optional flat-fee delivery, card online,
  and card at the restaurant.
- Native `pos.order` records with customer, branch, items, quantities,
  customisations, notes, taxes, totals and payment state.
- Odoo Payment Provider handoff. Custom Fuze code never receives or stores card
  numbers.
- Sound-enabled Fuze Kitchen Display at `/fuze/kitchen`, with branch/station
  filters, new-order alerts, preparation stages, void reasons and audit fields.
- Card-at-store confirmation that records the configured POS payment method,
  time and staff member after the physical terminal approves the card.
- 76 starter menu products in 14 POS categories.

## Cloudpepper installation

1. Put the `fuze_website` folder at the root of the Git repository used by the
   Cloudpepper Odoo instance.
2. Commit and push the folder to the deployment branch.
3. Deploy the branch in Cloudpepper.
4. In Odoo, enable developer mode and select **Apps → Update Apps List**.
5. Search for **Fuze Restaurant Experience** and install it.
6. On later code deployments, upgrade the module from Apps or run Odoo with
   `-u fuze_website` for the correct database.

The module depends on Website, Mail, Contacts, Point of Sale, Restaurant POS and
Payment. Odoo installs missing core dependencies automatically.

## Required first-time configuration

### 1. Configure both POS locations

Open each Odoo POS configuration and select the **Fuze Website & Kitchen** tab.

For East Gates:

- Fuze Website Branch: `East Gates Mall`
- Website Branch Name, phone and address
- Accept Website Orders: enabled
- Send Orders to Fuze KDS: enabled

For Bagshot:

- Fuze Website Branch: `Bagshot BoxPark`
- Website Branch Name, phone and address
- Accept Website Orders: enabled
- Send Orders to Fuze KDS: enabled

For each location also select:

- **Online Card POS Payment Method**: the POS method used when Odoo's online
  provider confirms payment.
- **Card at Store POS Payment Method**: the manual POS card method used after
  staff confirm approval on the branch terminal.

Website orders require an open POS session for the selected branch. This keeps
the orders tied to a real restaurant session and Odoo POS reporting.

### 2. Configure online card payments

Install and configure the desired Odoo payment provider, complete its provider
credentials/webhooks, enable test mode, and publish the provider. Test mode must
pass before the provider is changed to production.

The customer leaves the Fuze checkout only for Odoo's secure provider form and
returns to the branded Fuze confirmation page. The provider tokenises/handles
the card; the module does not collect raw card data.

### 3. Optional delivery

On each POS location, enable **Offer Website Delivery** and set its flat
**Website Delivery Fee**. Odoo adds that fee to the POS order and online payment
total. If delivery is disabled for a branch, the branded checkout disables that
choice automatically.

### 4. Kitchen users and displays

Grant staff either:

- **Kitchen Display User**: run the display and move/cancel tickets.
- **Kitchen Display Manager**: also configure displays and stations.

Use **Fuze Restaurant → Kitchen Display** or open `/fuze/kitchen`. The browser
requires one tap on **Start Display** before it can play sound. Alerts repeat at
the configured interval until new tickets are acknowledged.

Preparation stations and display choices are managed under
**Fuze Restaurant → Configuration**. Products can use one or more stations;
category defaults are used when a product has no direct station.

## Adding or updating menu products

Odoo is the single source of truth. Open **Fuze Restaurant → Configuration →
Menu Products**, then create or edit a standard product:

1. Use product type **Service**. This prevents prepared dishes from generating
   stock moves or requiring on-hand quantities.
2. Enable **Available in POS** and keep **Can be Sold** enabled.
3. Set the sales price, taxes and POS category.
4. On the **Fuze Website** tab, enable **Published on Fuze Website**.
5. Enter a unique Website Key, website description, optional tags, sequence,
   available Fuze locations and preparation stations.
6. Save. The custom menu reads Odoo on every page request, so the next refresh
   shows the new name, price, description, category, image and availability.

Uploading an Odoo product image also makes it available to the branded menu and
kitchen ticket. Unpublishing the product removes it from website ordering while
leaving its Odoo history intact.

The starter product data is installed with `noupdate=1`, so normal Odoo edits are
not overwritten during module upgrades.

The existing customisation rules cover the approved Fuze categories: included
fries, pasta sauce, signature sides and tender sauce. Ordinary new dishes work
without code changes. A new paid modifier group or a new kind of multi-choice
option should be added as a later structured Odoo modifier model so its price is
also validated server-side.

## Order and payment flow

1. Customer builds the cart in the Fuze frontend.
2. Odoo re-reads every product and calculates trusted prices/taxes server-side.
3. Odoo creates one native draft POS order in the selected open POS session.
4. Online-card orders remain hidden from production until Odoo confirms the
   payment transaction; then the POS payment is recorded and the KDS ticket is
   released.
5. Card-at-store pickup orders appear immediately with payment due. After the
   physical terminal approves the card, staff select **Confirm card paid** on the
   Fuze display and Odoo finalises the POS payment.
6. Kitchen stage, timestamps, responsible users, cancelled lines and reasons are
   retained in Odoo.

## Contact email

Website contact forms use Odoo Mail. The default recipient is
`freshlyfuzed@gmail.com`. Change it under **Settings → Technical → Parameters →
System Parameters** using the key `fuze_website.order_email`. Configure and test
an Odoo outgoing mail server before production.

## Production test checklist

- Confirm desktop and mobile pages on the final domain.
- Confirm both branches can be selected and have open POS sessions.
- Place one card-at-store pickup order and record the approved terminal payment.
- Place one online-card order in provider test mode; verify one payment
  transaction, one POS order and one KDS ticket.
- Confirm declined/cancelled online payments never reach the active KDS queue.
- Test delivery fee totals for each enabled branch.
- Test new-order sound, repeat alert, stage changes and line cancellation.
- Confirm product edits in Odoo appear on `/menu` after refresh.
- Test outgoing contact email and the payment-provider webhook on the public
  HTTPS domain.

Because this workspace does not include an Odoo 19 server or payment-provider
credentials, the final install, provider callback and physical terminal tests
must be completed on the Cloudpepper staging database before going live.
