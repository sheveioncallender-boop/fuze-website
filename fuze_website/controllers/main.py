import html
import json
import logging
import re
import secrets
import time
from datetime import timedelta
from urllib.parse import urlencode

from markupsafe import Markup

from odoo import fields, http
from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment.controllers.portal import PaymentPortal
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request


_logger = logging.getLogger(__name__)


class FuzeWebsite(http.Controller):
    """Branded Fuze pages backed by Odoo products, POS orders and kitchen tickets."""

    LOCATIONS = {
        "east": {
            "name": "East Gates Mall",
            "short": "East Gates",
            "phone": "868-292-FUZE",
            "address": "Trincity Central Road / College Road, Trincity",
        },
        "bagshot": {
            "name": "Bagshot BoxPark",
            "short": "Bagshot",
            "phone": "868-336-FUZE",
            "address": "9 Saddle Road, Maraval",
        },
    }
    CATEGORY_NOTES = {
        "Burgers & Sandwiches": "All served with fries.",
        "Wraps": "All served with fries.",
        "Waffles": "All served with fries.",
        "Refreshers": "Made fresh and served cold.",
        "Milkshakes": "Hand-spun and topped with house-made vanilla whipped cream.",
    }
    CATEGORY_IDS = {
        "Burgers & Sandwiches": "burgers",
        "Wraps": "wraps",
        "Waffles": "waffles",
        "Stir-Fry Ramen": "ramen",
        "Stir Fry Ramen": "ramen",
        "Signature Meals": "signature",
        "Sides": "sides",
        "Premium Sides": "premium-sides",
        "Lasagne": "lasagnes",
        "Snack Bar": "snack-bar",
        "Salads": "salads",
        "Salad": "salads",
        "Fuze Bowls": "bowls",
        "Pasta": "pasta",
        "Refreshers": "refreshers",
        "Milkshakes": "milkshakes",
    }

    @http.route(["/", "/fuze"], type="http", auth="public", website=True, sitemap=True)
    def fuze_home(self, **kwargs):
        return request.render("fuze_website.fuze_home_page")

    @http.route("/menu", type="http", auth="public", website=True, sitemap=True)
    def fuze_menu(self, **kwargs):
        return request.render(
            "fuze_website.fuze_menu_page",
            {"fuze_menu_json": Markup(json.dumps(self._website_menu()))},
        )

    @http.route("/our-fuze", type="http", auth="public", website=True, sitemap=True)
    def fuze_story(self, **kwargs):
        return request.render("fuze_website.fuze_story_page")

    @http.route("/locations", type="http", auth="public", website=True, sitemap=True)
    def fuze_locations(self, **kwargs):
        return request.render("fuze_website.fuze_locations_page")

    @http.route("/contact", type="http", auth="public", website=True, sitemap=True)
    def fuze_contact(self, **kwargs):
        return request.render("fuze_website.fuze_contact_page")

    @http.route("/checkout", type="http", auth="public", website=True, sitemap=False)
    def fuze_checkout(self, **kwargs):
        configs = request.env["pos.config"].sudo().search(
            [
                ("company_id", "=", request.env.company.id),
                ("fuze_branch_code", "!=", False),
                ("fuze_online_ordering", "=", True),
            ]
        )
        branch_config = {
            config.fuze_branch_code: {
                "deliveryEnabled": config.fuze_delivery_enabled,
                "deliveryFee": config.fuze_delivery_fee,
            }
            for config in configs
        }
        return request.render(
            "fuze_website.fuze_checkout_page",
            {"fuze_checkout_json": Markup(json.dumps(branch_config))},
        )

    @http.route(
        "/fuze/api/order/create",
        type="http",
        auth="public",
        website=True,
        methods=["POST"],
        csrf=False,
    )
    def create_order(self, **kwargs):
        if (request.httprequest.content_length or 0) > 250_000:
            return self._json_response(413, False, "This order is too large to submit.")
        try:
            payload = request.get_json_data()
        except Exception:
            payload = None
        if not isinstance(payload, dict):
            return self._json_response(400, False, "The order details could not be read.")
        if self._clean(payload.get("website"), 100):
            return self._json_response(200, True, "Your order was received.")

        now = int(time.time())
        last_submission = int(request.session.get("fuze_order_last_submission", 0) or 0)
        if last_submission and now - last_submission < 5:
            return self._json_response(429, False, "Please wait a few seconds before submitting again.")

        try:
            values = self._validate_order_payload(payload)
            order = self._create_pos_order(values)
        except (ValidationError, UserError) as error:
            return self._json_response(422, False, str(error))
        except Exception:
            _logger.exception("Fuze website POS order creation failed")
            return self._json_response(500, False, "The order could not be created right now. Please call Fuze.")

        request.session["fuze_order_last_submission"] = now
        response = {
            "ok": True,
            "message": "Your Fuze order was created.",
            "orderId": order.id,
            "reference": order.fuze_order_reference,
            "total": order.amount_total,
            "currency": order.currency_id.name,
            "location": order.config_id.fuze_branch_display_name or order.config_id.name,
            "fulfilment": order.fuze_fulfilment,
            "paymentState": order.fuze_payment_state,
        }
        if values["payment_method"] == "online":
            access_token = payment_utils.generate_access_token(
                order.partner_id.id, order.amount_total, order.currency_id.id
            )
            payment_values = {
                "reference": order.fuze_order_reference,
                "amount": "%.2f" % order.amount_total,
                "currency_id": order.currency_id.id,
                "partner_id": order.partner_id.id,
                "company_id": order.company_id.id,
                "access_token": access_token,
                "fuze_order": order.id,
                "fuze_token": order.fuze_access_token,
            }
            response["paymentUrl"] = "/payment/pay?%s" % urlencode(payment_values)
            response["message"] = "Continue to the secure Odoo payment provider."
        return request.make_json_response(
            response,
            headers=[("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff")],
        )

    @http.route("/fuze/payment/confirmation", type="http", auth="public", website=True, sitemap=False)
    def payment_confirmation(self, tx_id=None, access_token=None, **kwargs):
        transaction = request.env["payment.transaction"].sudo().browse(self._safe_int(tx_id))
        if not transaction.exists() or not payment_utils.check_access_token(
            access_token, transaction.partner_id.id, transaction.amount, transaction.currency_id.id
        ):
            return request.not_found()
        order = transaction.fuze_pos_order_id
        if not order:
            return request.not_found()
        return request.render(
            "fuze_website.fuze_payment_confirmation",
            {
                "order": order,
                "status_url": "/fuze/api/order/status?%s"
                % urlencode({"order_id": order.id, "token": order.fuze_access_token}),
            },
        )

    @http.route("/fuze/api/order/status", type="http", auth="public", website=True, methods=["GET"], csrf=False)
    def order_status(self, order_id=None, token=None, **kwargs):
        order = request.env["pos.order"].sudo().browse(self._safe_int(order_id))
        if not order.exists() or not secrets.compare_digest(order.fuze_access_token or "", token or ""):
            return self._json_response(404, False, "Order not found.")
        return request.make_json_response(
            {
                "ok": True,
                "reference": order.fuze_order_reference,
                "paymentState": order.fuze_payment_state,
                "kitchenStage": order.fuze_kitchen_stage,
                "total": order.amount_total,
            },
            headers=[("Cache-Control", "no-store")],
        )

    @http.route("/fuze/contact/submit", type="http", auth="public", website=True, methods=["POST"], csrf=False)
    def submit_contact(self, **kwargs):
        if (request.httprequest.content_length or 0) > 100_000:
            return self._json_response(413, False, "This message is too large.")
        try:
            payload = request.get_json_data()
        except Exception:
            payload = None
        if not isinstance(payload, dict):
            return self._json_response(400, False, "The message could not be read.")
        if self._clean(payload.get("website"), 100):
            return self._json_response(200, True, "Thank you. Your message was received.")

        name = self._clean(payload.get("customerName"), 100)
        email = self._clean(payload.get("customerEmail"), 160)
        phone = self._clean(payload.get("customerPhone"), 40)
        enquiry = self._clean(payload.get("enquiryType"), 80)
        location = self._clean(payload.get("locationId"), 40)
        message = self._clean(payload.get("message"), 3000)
        if len(name) < 2 or not self._valid_email(email) or len(message) < 10:
            return self._json_response(422, False, "Enter your name, a valid email and a complete message.")
        recipient = request.env["ir.config_parameter"].sudo().get_param(
            "fuze_website.order_email", "freshlyfuzed@gmail.com"
        )
        if not self._valid_email(recipient):
            return self._json_response(500, False, "The Fuze inbox is not configured.")
        body = (
            "<h2>New Fuze website enquiry</h2><p><strong>Name:</strong> %s<br>"
            "<strong>Email:</strong> %s<br><strong>Phone:</strong> %s<br>"
            "<strong>Location:</strong> %s<br><strong>Enquiry:</strong> %s</p><p>%s</p>"
        ) % tuple(html.escape(value) for value in (name, email, phone, location, enquiry, message))
        try:
            mail = request.env["mail.mail"].sudo().create(
                {
                    "subject": "Fuze website enquiry — %s — %s" % (enquiry, name),
                    "body_html": body,
                    "email_to": recipient,
                    "email_from": request.env.company.email or recipient,
                    "reply_to": "%s <%s>" % (name, email),
                }
            )
            mail.send(raise_exception=True)
        except Exception:
            _logger.exception("Fuze contact email failed")
            return self._json_response(500, False, "Email delivery is not available right now.")
        return self._json_response(200, True, "Thanks — your message has been sent to Fuze.")

    @http.route("/fuze/kitchen", type="http", auth="user", website=False)
    def kitchen_display(self, display_id=None, **kwargs):
        self._check_kitchen_access()
        display = self._get_display(display_id)
        bootstrap = self._kds_bootstrap(display)
        return request.render(
            "fuze_website.fuze_kitchen_display",
            {"fuze_kds_bootstrap": Markup(json.dumps(bootstrap)), "display": display},
        )

    @http.route("/fuze/kitchen/orders", type="http", auth="user", methods=["GET"], csrf=False)
    def kitchen_orders(self, display_id=None, **kwargs):
        self._check_kitchen_access()
        display = self._get_display(display_id)
        return request.make_json_response(
            {"ok": True, "orders": self._serialize_kitchen_orders(display)},
            headers=[("Cache-Control", "no-store")],
        )

    @http.route("/fuze/kitchen/order/advance", type="http", auth="user", methods=["POST"])
    def kitchen_advance(self, **kwargs):
        self._check_kitchen_access()
        payload = self._json_payload()
        order = self._authorized_kitchen_order(payload.get("orderId"), payload.get("displayId"))
        order.fuze_advance_kitchen_stage()
        return self._json_response(200, True, "Order moved to the next stage.")

    @http.route(
        "/fuze/kitchen/order/confirm-store-payment",
        type="http",
        auth="user",
        methods=["POST"],
    )
    def kitchen_confirm_store_payment(self, **kwargs):
        self._check_kitchen_access()
        payload = self._json_payload()
        order = self._authorized_kitchen_order(payload.get("orderId"), payload.get("displayId"))
        try:
            order.fuze_confirm_store_card_payment()
        except UserError as error:
            return self._json_response(422, False, str(error))
        return self._json_response(200, True, "Card-at-store payment recorded in Odoo POS.")

    @http.route("/fuze/kitchen/order/cancel-line", type="http", auth="user", methods=["POST"])
    def kitchen_cancel_line(self, **kwargs):
        self._check_kitchen_access()
        payload = self._json_payload()
        order = self._authorized_kitchen_order(payload.get("orderId"), payload.get("displayId"))
        line = order.lines.filtered(lambda item: item.id == self._safe_int(payload.get("lineId")))
        if not line:
            return self._json_response(404, False, "Order item not found.")
        reason = self._clean(payload.get("reason"), 80)
        note = self._clean(payload.get("note"), 240)
        if reason not in {"Out of stock", "Customer requested", "Duplicate item", "Kitchen error"}:
            return self._json_response(422, False, "Choose a valid cancellation reason.")
        line.write(
            {"fuze_cancelled": True, "fuze_cancel_reason": reason + ((" · " + note) if note else "")}
        )
        if all(order.lines.mapped("fuze_cancelled")):
            order.fuze_cancel_order()
        return self._json_response(200, True, "Item cancelled and retained in the order audit trail.")

    def _website_menu(self):
        templates = request.env["product.template"].sudo().search(
            [
                ("fuze_website_published", "=", True),
                ("available_in_pos", "=", True),
                ("sale_ok", "=", True),
                ("active", "=", True),
            ],
            order="fuze_website_sequence, name",
        )
        groups = {}
        for template in templates:
            category = template.pos_categ_ids[:1]
            title = category.name if category else "Fuze Menu"
            key = self.CATEGORY_IDS.get(title, self._slug(title))
            group = groups.setdefault(
                key,
                {"id": key, "title": title, "note": self.CATEGORY_NOTES.get(title, ""), "items": []},
            )
            tags = [tag.strip() for tag in (template.fuze_website_tags or "").split(",") if tag.strip()]
            product = template.product_variant_id
            group["items"].append(
                {
                    "productId": product.id,
                    "key": template.fuze_website_key,
                    "name": template.name,
                    "detail": template.fuze_website_description or template.description_sale or "",
                    "price": template.list_price,
                    "tags": tags,
                    "image": "/web/image/product.product/%s/image_512" % product.id if template.image_1920 else "",
                    "locationIds": template.fuze_pos_config_ids.mapped("fuze_branch_code"),
                }
            )
        return list(groups.values())

    def _validate_order_payload(self, payload):
        name = self._clean(payload.get("customerName"), 100)
        phone = self._clean(payload.get("customerPhone"), 40)
        email = self._clean(payload.get("customerEmail"), 160)
        location_id = self._clean(payload.get("locationId"), 20)
        fulfilment = self._clean(payload.get("fulfilment"), 20)
        payment_method = self._clean(payload.get("paymentMethod"), 20)
        address = self._clean(payload.get("deliveryAddress"), 500)
        order_note = self._clean(payload.get("orderNote"), 500)
        raw_items = payload.get("items")
        if len(name) < 2:
            raise ValidationError("Enter the customer name.")
        if len(phone) < 7:
            raise ValidationError("Enter a valid phone number.")
        if not self._valid_email(email):
            raise ValidationError("Enter a valid email address.")
        if location_id not in self.LOCATIONS:
            raise ValidationError("Choose a valid Fuze location.")
        if fulfilment not in {"pickup", "delivery"}:
            raise ValidationError("Choose pickup or delivery.")
        if payment_method not in {"online", "store"}:
            raise ValidationError("Choose a valid payment method.")
        if payment_method == "store" and fulfilment != "pickup":
            raise ValidationError("Pay at Fuze is available for pickup orders only.")
        if fulfilment == "delivery" and len(address) < 5:
            raise ValidationError("Enter a delivery address.")
        if not isinstance(raw_items, list) or not 1 <= len(raw_items) <= 50:
            raise ValidationError("Add at least one valid menu item.")
        return {
            "name": name,
            "phone": phone,
            "email": email,
            "location_id": location_id,
            "fulfilment": fulfilment,
            "payment_method": payment_method,
            "address": address,
            "order_note": order_note,
            "items": raw_items,
        }

    def _create_pos_order(self, values):
        env = request.env
        config = env["pos.config"].sudo().search(
            [
                ("company_id", "=", env.company.id),
                ("fuze_branch_code", "=", values["location_id"]),
                ("fuze_online_ordering", "=", True),
            ],
            limit=1,
        )
        if not config:
            raise UserError("Online ordering is not configured for this location.")
        if values["fulfilment"] == "delivery" and not config.fuze_delivery_enabled:
            raise UserError("Delivery is not currently available from this location.")
        session = env["pos.session"].sudo().search(
            [("config_id", "=", config.id), ("state", "=", "opened")], order="id desc", limit=1
        )
        if not session:
            raise UserError("This location is not accepting online orders right now.")
        partner = env["res.partner"].sudo().search(
            ["|", ("email", "=ilike", values["email"]), ("phone", "=ilike", values["phone"])], limit=1
        )
        if not partner:
            partner = env["res.partner"].sudo().create(
                {"name": values["name"], "email": values["email"], "phone": values["phone"]}
            )

        currency = config.currency_id
        fiscal_position = config.default_fiscal_position_id
        line_commands = []
        for raw in values["items"]:
            if not isinstance(raw, dict):
                continue
            product_id = self._safe_int(raw.get("productId"))
            product_key = self._clean(raw.get("key"), 120)
            domain = [("product_tmpl_id.fuze_website_published", "=", True), ("available_in_pos", "=", True)]
            domain.append(("id", "=", product_id)) if product_id else domain.append(
                ("product_tmpl_id.fuze_website_key", "=", product_key)
            )
            product = env["product.product"].sudo().search(domain, limit=1)
            if not product:
                raise ValidationError("One of the selected menu items is no longer available.")
            allowed_configs = product.product_tmpl_id.fuze_pos_config_ids
            if allowed_configs and config not in allowed_configs:
                raise ValidationError("%s is not available at the selected location." % product.display_name)
            quantity = self._safe_int(raw.get("quantity"))
            if not 1 <= quantity <= 20:
                raise ValidationError("Choose a valid quantity for %s." % product.display_name)
            price = product.lst_price
            taxes = product.taxes_id.filtered(lambda tax: tax.company_id == config.company_id)
            if fiscal_position:
                taxes = fiscal_position.map_tax(taxes)
            totals = taxes.compute_all(price, currency, quantity, product=product, partner=partner)
            selections = []
            for selection in (raw.get("selections") or [])[:12]:
                if not isinstance(selection, dict):
                    continue
                label = self._clean(selection.get("label"), 80)
                value = self._clean(selection.get("value"), 140)
                if label and value:
                    selections.append("%s: %s" % (label, value))
            note = self._clean(raw.get("note"), 240)
            line_commands.append(
                (
                    0,
                    0,
                    {
                        "product_id": product.id,
                        "full_product_name": product.display_name,
                        "qty": quantity,
                        "price_unit": price,
                        "price_subtotal": totals["total_excluded"],
                        "price_subtotal_incl": totals["total_included"],
                        "tax_ids": [(6, 0, taxes.ids)],
                        "customer_note": note,
                        "fuze_options": "\n".join(selections),
                        "fuze_kitchen_note": note,
                    },
                )
            )
        if not line_commands:
            raise ValidationError("No valid menu items were included.")
        if values["fulfilment"] == "delivery" and config.fuze_delivery_fee:
            delivery_product = env.ref("fuze_website.product_delivery_fee").product_variant_id
            delivery_taxes = delivery_product.taxes_id.filtered(
                lambda tax: tax.company_id == config.company_id
            )
            if fiscal_position:
                delivery_taxes = fiscal_position.map_tax(delivery_taxes)
            delivery_totals = delivery_taxes.compute_all(
                config.fuze_delivery_fee,
                currency,
                1,
                product=delivery_product,
                partner=partner,
            )
            line_commands.append(
                (
                    0,
                    0,
                    {
                        "product_id": delivery_product.id,
                        "full_product_name": "Fuze Delivery Fee",
                        "qty": 1,
                        "price_unit": config.fuze_delivery_fee,
                        "price_subtotal": delivery_totals["total_excluded"],
                        "price_subtotal_incl": delivery_totals["total_included"],
                        "tax_ids": [(6, 0, delivery_taxes.ids)],
                    },
                )
            )
        access_token = secrets.token_urlsafe(32)
        order = env["pos.order"].sudo().create(
            {
                "session_id": session.id,
                "config_id": config.id,
                "company_id": config.company_id.id,
                "user_id": session.user_id.id,
                "partner_id": partner.id,
                "pricelist_id": config.pricelist_id.id,
                "fiscal_position_id": fiscal_position.id,
                "source": "fuze_website",
                "fuze_website_order": True,
                "fuze_kds_order": True,
                "fuze_access_token": access_token,
                "fuze_fulfilment": values["fulfilment"],
                "fuze_delivery_address": values["address"],
                "fuze_customer_name": values["name"],
                "fuze_customer_phone": values["phone"],
                "fuze_customer_email": values["email"],
                "fuze_payment_state": "pending" if values["payment_method"] == "online" else "pay_at_store",
                "fuze_kitchen_stage": "hold" if values["payment_method"] == "online" else "new",
                "general_customer_note": values["order_note"],
                "lines": line_commands,
            }
        )
        order._compute_prices()
        return order

    def _kds_bootstrap(self, display):
        configs = self._display_configs(display)
        stations = display.station_ids or request.env["fuze.kitchen.station"].search([])
        return {
            "displayId": display.id,
            "csrfToken": request.csrf_token(),
            "ordersEndpoint": "/fuze/kitchen/orders",
            "advanceEndpoint": "/fuze/kitchen/order/advance",
            "cancelEndpoint": "/fuze/kitchen/order/cancel-line",
            "storePaymentEndpoint": "/fuze/kitchen/order/confirm-store-payment",
            "orders": self._serialize_kitchen_orders(display),
            "branches": [
                {"id": config.fuze_branch_code, "name": config.fuze_branch_display_name or config.name}
                for config in configs
                if config.fuze_branch_code
            ],
            "stations": [{"id": station.code, "name": station.name} for station in stations],
            "settings": {
                "sound": display.sound_enabled,
                "repeat": display.repeat_sound,
                "repeatSeconds": display.repeat_seconds,
                "volume": display.volume,
                "images": display.show_images,
                "density": display.density,
                "urgentAfter": display.urgent_after,
            },
        }

    def _serialize_kitchen_orders(self, display):
        configs = self._display_configs(display)
        cutoff = fields.Datetime.now() - timedelta(days=2)
        orders = request.env["pos.order"].search(
            [
                ("fuze_kds_order", "=", True),
                ("fuze_kitchen_stage", "!=", "hold"),
                ("config_id", "in", configs.ids),
                ("date_order", ">=", cutoff),
            ],
            order="date_order asc, id asc",
        )
        allowed_stations = display.station_ids
        serialized = [self._serialize_kitchen_order(order, allowed_stations) for order in orders]
        return [ticket for ticket in serialized if ticket["items"]]

    def _serialize_kitchen_order(self, order, allowed_stations):
        reference = order.fuze_order_reference or order.pos_reference or order.name
        digits = re.findall(r"\d+", reference or "")
        sequence = int(digits[-1][-4:]) if digits else order.id
        items = []
        delivery_template = request.env.ref("fuze_website.product_delivery_fee")
        for line in order.lines:
            if line.product_id.product_tmpl_id == delivery_template:
                continue
            stations = line.fuze_station_ids
            if allowed_stations:
                if stations and not (stations & allowed_stations):
                    continue
                stations &= allowed_stations
            station = stations[:1]
            station_code = station.code if station else self._station_for_text(
                "%s %s" % (line.product_id.product_tmpl_id.pos_categ_ids[:1].name, line.product_id.display_name)
            )
            if allowed_stations and station_code not in allowed_stations.mapped("code"):
                continue
            items.append(
                {
                    "id": str(line.id),
                    "qty": line.qty,
                    "name": line.full_product_name or line.product_id.display_name,
                    "station": station_code,
                    "image": "/web/image/product.product/%s/image_256" % line.product_id.id
                    if line.product_id.image_1920
                    else "",
                    "options": [row for row in (line.fuze_options or "").splitlines() if row],
                    "note": line.fuze_kitchen_note or line.customer_note or "",
                    "cancelled": line.fuze_cancelled,
                    "cancelReason": line.fuze_cancel_reason or "",
                }
            )
        paid = order.fuze_payment_state in ("paid_online", "paid_at_store") or order.state in (
            "paid",
            "done",
            "invoiced",
        )
        if order.fuze_payment_state == "paid_online":
            payment_label = "Paid online"
        elif order.fuze_payment_state == "paid_at_store":
            payment_label = "Paid at store"
        elif paid:
            payment_label = "Paid"
        else:
            payment_label = "Card at store"
        return {
            "id": reference,
            "recordId": order.id,
            "sequence": sequence,
            "branch": order.config_id.fuze_branch_code or "east",
            "stage": order.fuze_kitchen_stage,
            "createdAt": int(order.date_order.timestamp() * 1000),
            "customer": order.fuze_customer_name or order.partner_id.name or "Walk-in customer",
            "phone": order.fuze_customer_phone or order.partner_id.phone or "—",
            "fulfilment": order.fuze_fulfilment or "pickup",
            "payment": "paid" if paid else "store",
            "paymentLabel": payment_label,
            "source": "Website" if order.fuze_website_order else "Counter",
            "note": order.general_customer_note or "",
            "items": items,
        }

    def _display_configs(self, display):
        return display.pos_config_ids or request.env["pos.config"].search(
            [("fuze_kds_enabled", "=", True), ("company_id", "in", request.env.companies.ids)]
        )

    def _get_display(self, display_id):
        display = request.env["fuze.kitchen.display"].browse(self._safe_int(display_id))
        if not display.exists():
            display = request.env["fuze.kitchen.display"].search([], limit=1)
        if not display:
            raise UserError("Create a Fuze Kitchen Display in Odoo first.")
        return display

    def _authorized_kitchen_order(self, order_id, display_id):
        display = self._get_display(display_id)
        order = request.env["pos.order"].browse(self._safe_int(order_id))
        if not order.exists() or order.config_id not in self._display_configs(display):
            raise AccessError("This order is not available on the selected kitchen display.")
        return order

    @staticmethod
    def _check_kitchen_access():
        if not request.env.user.has_group("fuze_website.group_fuze_kitchen_user"):
            raise AccessError("You do not have access to the Fuze kitchen display.")

    @staticmethod
    def _json_payload():
        try:
            return request.get_json_data() or {}
        except Exception:
            return {}

    @staticmethod
    def _station_for_text(value):
        value = (value or "").lower()
        if re.search(r"drink|refresher|shake|beverage", value):
            return "drinks"
        if re.search(r"dessert|custard|waffle", value):
            return "dessert"
        if re.search(r"burger|sandwich|steak", value):
            return "grill"
        if re.search(r"fried|fish fry|fries", value):
            return "fryer"
        return "kitchen"

    @staticmethod
    def _slug(value):
        return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-") or "fuze-menu"

    @staticmethod
    def _safe_int(value):
        try:
            return int(value or 0)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _clean(value, limit):
        if not isinstance(value, str):
            return ""
        return re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", value).strip()[:limit]

    @staticmethod
    def _valid_email(value):
        return bool(
            isinstance(value, str)
            and len(value) <= 254
            and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value)
        )

    @staticmethod
    def _json_response(status, ok, message):
        return request.make_json_response(
            {"ok": ok, "message": message},
            status=status,
            headers=[("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff")],
        )


class FuzePaymentPortal(PaymentPortal):
    """Return successful Fuze card payments to the branded confirmation screen."""

    def _get_extra_payment_form_values(self, **kwargs):
        values = super()._get_extra_payment_form_values(**kwargs)
        order_id = FuzeWebsite._safe_int(kwargs.get("fuze_order"))
        token = kwargs.get("fuze_token") or ""
        order = request.env["pos.order"].sudo().browse(order_id)
        if order.exists() and secrets.compare_digest(order.fuze_access_token or "", token):
            values["landing_route"] = "/fuze/payment/confirmation"
        return values
