# Fuze Premium Website — Odoo 19

Installable Odoo 19 add-on containing the complete approved Fuze website:

- Home page at `/`
- Full branded menu and cart at `/menu`
- Our Fuze page at `/our-fuze`
- Interactive locations page at `/locations`
- WhatsApp order submission by selected restaurant location
- Email order submission through Odoo Mail
- Responsive desktop and mobile design

## Cloudpepper installation

1. Add the `fuze_website` folder to the root of the Git repository used by the Odoo instance.
2. Commit and push the folder to the deployment branch.
3. In Odoo, enable developer mode and select **Apps → Update Apps List**.
4. Search for **Fuze Premium Website** and install it.
5. Configure and test the Odoo outgoing mail server before testing email orders.

The default order inbox is `freshlyfuzed@gmail.com`. It can be changed in
**Settings → Technical → Parameters → System Parameters** by editing the key
`fuze_website.order_email`.

## Important

The menu cart is intentionally a customer-facing WhatsApp/email order flow. It
does not create a native Odoo sales order or process online payment. Native Odoo
eCommerce checkout can be added as a later integration without redesigning the
website.
