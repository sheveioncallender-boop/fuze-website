import html
import logging
import re
import secrets
import time

from odoo import http
from odoo.http import request


_logger = logging.getLogger(__name__)


class FuzeWebsite(http.Controller):
    """Public Fuze pages and the Odoo-backed email order endpoint."""

    LOCATIONS = {
        "east": {"name": "East Gates Mall", "phone": "868-292-FUZE"},
        "bagshot": {"name": "Bagshot BoxPark", "phone": "868-336-FUZE"},
    }

    @http.route(["/", "/fuze"], type="http", auth="public", website=True, sitemap=True)
    def fuze_home(self, **kwargs):
        return request.render("fuze_website.fuze_home_page")

    @http.route("/menu", type="http", auth="public", website=True, sitemap=True)
    def fuze_menu(self, **kwargs):
        return request.render("fuze_website.fuze_menu_page")

    @http.route("/our-fuze", type="http", auth="public", website=True, sitemap=True)
    def fuze_story(self, **kwargs):
        return request.render("fuze_website.fuze_story_page")

    @http.route("/locations", type="http", auth="public", website=True, sitemap=True)
    def fuze_locations(self, **kwargs):
        return request.render("fuze_website.fuze_locations_page")

    @http.route(
        "/fuze/order/email",
        type="http",
        auth="public",
        website=True,
        methods=["POST"],
        csrf=False,
    )
    def submit_email_order(self, **kwargs):
        http_request = request.httprequest
        if (http_request.content_length or 0) > 200_000:
            return self._json_response(413, False, "This order is too large to submit.")

        try:
            payload = request.get_json_data()
        except Exception:
            payload = None
        if not isinstance(payload, dict):
            return self._json_response(400, False, "The order details could not be read.")

        # Honeypot: bots fill this hidden field, real customers do not.
        if self._clean(payload.get("website"), 100):
            return self._json_response(200, True, "Your order was received.")

        now = int(time.time())
        last_submission = int(request.session.get("fuze_order_last_submission", 0) or 0)
        if last_submission and now - last_submission < 8:
            return self._json_response(429, False, "Please wait a few seconds before submitting again.")

        recipient = request.env["ir.config_parameter"].sudo().get_param(
            "fuze_website.order_email", "freshlyfuzed@gmail.com"
        )
        if not self._valid_email(recipient):
            return self._json_response(500, False, "The order inbox is not configured.")

        name = self._clean(payload.get("customerName"), 100)
        phone = self._clean(payload.get("customerPhone"), 40)
        email = self._clean(payload.get("customerEmail"), 160)
        location_id = self._clean(payload.get("locationId"), 20)
        order_type = self._clean(payload.get("orderType"), 40)
        delivery_address = self._clean(payload.get("deliveryAddress"), 500)
        order_note = self._clean(payload.get("orderNote"), 500)
        raw_items = payload.get("items")

        errors = []
        if len(name) < 2:
            errors.append("Enter your full name.")
        if len(phone) < 7:
            errors.append("Enter a valid phone number.")
        if not self._valid_email(email):
            errors.append("Enter a valid email address.")
        if location_id not in self.LOCATIONS:
            errors.append("Choose a valid Fuze location.")
        if order_type not in {"Pickup", "Delivery enquiry"}:
            errors.append("Choose a valid order type.")
        if order_type == "Delivery enquiry" and len(delivery_address) < 5:
            errors.append("Enter the delivery address.")
        if not isinstance(raw_items, list) or not 1 <= len(raw_items) <= 50:
            errors.append("Add at least one valid item.")
        if errors:
            return self._json_response(422, False, " ".join(errors))

        rows = []
        subtotal = 0.0
        for raw_item in raw_items:
            parsed = self._parse_item(raw_item)
            if not parsed:
                continue
            subtotal += parsed["line_total"]
            rows.append(parsed)

        if not rows:
            return self._json_response(422, False, "No valid menu items were included.")

        location = self.LOCATIONS[location_id]
        order_id = "FZ-%s-%s" % (time.strftime("%y%m%d-%H%M%S"), secrets.token_hex(3).upper())
        subject = "Fuze website order %s — %s" % (order_id, location["name"])
        body_html = self._build_email_body(
            order_id=order_id,
            location=location,
            customer_name=name,
            phone=phone,
            email=email,
            order_type=order_type,
            delivery_address=delivery_address,
            order_note=order_note,
            rows=rows,
            subtotal=subtotal,
        )

        company_email = self._clean(request.env.company.email, 160)
        email_from = company_email if self._valid_email(company_email) else recipient
        try:
            mail = request.env["mail.mail"].sudo().create(
                {
                    "subject": subject,
                    "body_html": body_html,
                    "email_to": recipient,
                    "email_from": email_from,
                    "reply_to": "%s <%s>" % (name, email),
                }
            )
            mail.send(raise_exception=True)
        except Exception:
            _logger.exception("Fuze website order email failed")
            return self._json_response(500, False, "Email delivery is not available right now.")

        request.session["fuze_order_last_submission"] = now
        return self._json_response(
            200,
            True,
            "Order %s was emailed to Fuze. Please wait for confirmation." % order_id,
            order_id=order_id,
        )

    @staticmethod
    def _clean(value, limit):
        if not isinstance(value, str):
            return ""
        value = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", value).strip()
        return value[:limit]

    @staticmethod
    def _valid_email(value):
        return bool(
            isinstance(value, str)
            and len(value) <= 254
            and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value)
        )

    def _parse_item(self, raw_item):
        if not isinstance(raw_item, dict):
            return None
        name = self._clean(raw_item.get("name"), 140)
        category = self._clean(raw_item.get("category"), 100)
        note = self._clean(raw_item.get("note"), 240)
        try:
            quantity = int(raw_item.get("quantity"))
            price = float(raw_item.get("price"))
        except (TypeError, ValueError):
            return None
        if not name or not 1 <= quantity <= 20 or not 0 <= price <= 10_000:
            return None

        details = []
        selections = raw_item.get("selections")
        if isinstance(selections, list):
            for selection in selections[:10]:
                if not isinstance(selection, dict):
                    continue
                label = self._clean(selection.get("label"), 80)
                value = self._clean(selection.get("value"), 140)
                if label and value:
                    details.append("%s: %s" % (label, value))
        if note:
            details.append("Item note: %s" % note)
        return {
            "name": name,
            "category": category,
            "quantity": quantity,
            "price": price,
            "line_total": quantity * price,
            "details": details,
        }

    @staticmethod
    def _money(amount):
        return "{:,.2f}".format(amount).rstrip("0").rstrip(".")

    def _build_email_body(
        self,
        order_id,
        location,
        customer_name,
        phone,
        email,
        order_type,
        delivery_address,
        order_note,
        rows,
        subtotal,
    ):
        esc = html.escape
        order_rows = []
        for row in rows:
            detail_html = ""
            if row["details"]:
                detail_html = (
                    '<div style="margin-top:5px;color:#6d6071;font-size:12px">%s</div>'
                    % esc(" · ".join(row["details"]))
                )
            order_rows.append(
                '<tr><td style="padding:12px;border-bottom:1px solid #eee">'
                '<strong>%s × %s</strong><br><span style="color:#8a7d8d;font-size:12px">%s</span>%s'
                '</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">$%s</td></tr>'
                % (
                    row["quantity"],
                    esc(row["name"]),
                    esc(row["category"]),
                    detail_html,
                    self._money(row["line_total"]),
                )
            )

        delivery_html = ""
        if order_type == "Delivery enquiry":
            delivery_html = "<p><strong>Delivery address:</strong><br>%s</p>" % esc(delivery_address).replace("\n", "<br>")
        note_html = ""
        if order_note:
            note_html = "<p><strong>Order note:</strong><br>%s</p>" % esc(order_note).replace("\n", "<br>")

        return (
            '<div style="margin:0;background:#f6f2f0;font-family:Arial,sans-serif;color:#241c29;padding:28px">'
            '<div style="max-width:680px;margin:0 auto">'
            '<div style="background:#2d0055;color:#fff;padding:28px;border-top:6px solid #ff4b12">'
            '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ff6b31">Fuze Restaurant</div>'
            '<h1 style="margin:8px 0 0;font-size:30px">New website order</h1><p>%s</p></div>'
            '<div style="background:#fff;padding:28px">'
            '<p><strong>Location:</strong> %s (%s)</p>'
            '<p><strong>Customer:</strong> %s<br><strong>Phone:</strong> %s<br><strong>Email:</strong> %s</p>'
            '<p><strong>Order type:</strong> %s</p>%s%s'
            '<table style="width:100%%;border-collapse:collapse;margin-top:22px">%s</table>'
            '<p style="font-size:24px;text-align:right;color:#ff4b12"><strong>Submitted subtotal: $%s TTD</strong></p>'
            '<p style="padding:14px;background:#fff3ed;color:#6d2a12;font-size:12px;line-height:1.5">'
            'Please verify menu pricing and availability before confirming this order with the customer.</p>'
            '</div></div></div>'
        ) % (
            esc(order_id),
            esc(location["name"]),
            esc(location["phone"]),
            esc(customer_name),
            esc(phone),
            esc(email),
            esc(order_type),
            delivery_html,
            note_html,
            "".join(order_rows),
            self._money(subtotal),
        )

    @staticmethod
    def _json_response(status, ok, message, order_id=None):
        payload = {"ok": ok, "message": message}
        if order_id:
            payload["orderId"] = order_id
        return request.make_json_response(
            payload,
            status=status,
            headers=[("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff")],
        )
