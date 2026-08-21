import logging

from odoo import api, fields, models
from odoo.exceptions import UserError


_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = "pos.order"

    source = fields.Selection(selection_add=[("fuze_website", "Fuze Website")], ondelete={"fuze_website": "set default"})
    fuze_kds_order = fields.Boolean(string="Show on Fuze KDS", index=True, copy=False)
    fuze_website_order = fields.Boolean(index=True, copy=False)
    fuze_order_reference = fields.Char(string="Fuze Order Reference", index=True, copy=False)
    fuze_access_token = fields.Char(copy=False, groups="base.group_system")
    fuze_fulfilment = fields.Selection(
        [("pickup", "Pickup"), ("delivery", "Delivery"), ("dine_in", "Dine In")],
        string="Fulfilment",
        default="pickup",
    )
    fuze_delivery_address = fields.Text()
    fuze_customer_name = fields.Char()
    fuze_customer_phone = fields.Char()
    fuze_customer_email = fields.Char()
    fuze_payment_state = fields.Selection(
        [
            ("pending", "Pending"),
            ("paid_online", "Paid Online"),
            ("pay_at_store", "Pay at Store"),
            ("paid_at_store", "Paid at Store"),
            ("failed", "Failed"),
            ("refunded", "Refunded"),
        ],
        default="pending",
        copy=False,
        index=True,
    )
    fuze_payment_reference = fields.Char(copy=False)
    fuze_store_paid_at = fields.Datetime(string="Card at Store Paid At", copy=False)
    fuze_store_paid_by = fields.Many2one("res.users", string="Card at Store Confirmed By", copy=False)
    fuze_kitchen_stage = fields.Selection(
        [
            ("hold", "Awaiting Payment"),
            ("new", "New"),
            ("acknowledged", "Acknowledged"),
            ("preparing", "Preparing"),
            ("ready", "Ready"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
        ],
        default="new",
        copy=False,
        index=True,
    )
    fuze_acknowledged_at = fields.Datetime(copy=False)
    fuze_preparing_at = fields.Datetime(copy=False)
    fuze_ready_at = fields.Datetime(copy=False)
    fuze_completed_at = fields.Datetime(copy=False)
    fuze_acknowledged_by = fields.Many2one("res.users", copy=False)
    fuze_preparing_by = fields.Many2one("res.users", copy=False)
    fuze_ready_by = fields.Many2one("res.users", copy=False)
    fuze_completed_by = fields.Many2one("res.users", copy=False)

    _fuze_order_reference_unique = models.Constraint(
        "UNIQUE(fuze_order_reference)",
        "The Fuze order reference must be unique.",
    )

    @api.model_create_multi
    def create(self, vals_list):
        configs = self.env["pos.config"].browse(
            [vals.get("config_id") for vals in vals_list if vals.get("config_id")]
        )
        config_map = {config.id: config for config in configs}
        for vals in vals_list:
            config = config_map.get(vals.get("config_id"))
            if config and config.fuze_kds_enabled:
                vals.setdefault("fuze_kds_order", True)
                vals.setdefault("fuze_kitchen_stage", "new")
        orders = super().create(vals_list)
        sequence = self.env["ir.sequence"].sudo()
        for order in orders:
            if order.fuze_kds_order and not order.fuze_order_reference:
                order.fuze_order_reference = sequence.next_by_code("fuze.website.order") or order.pos_reference or order.name
        return orders

    def fuze_advance_kitchen_stage(self):
        stage_map = {
            "new": ("acknowledged", "fuze_acknowledged_at", "fuze_acknowledged_by"),
            "acknowledged": ("preparing", "fuze_preparing_at", "fuze_preparing_by"),
            "preparing": ("ready", "fuze_ready_at", "fuze_ready_by"),
            "ready": ("completed", "fuze_completed_at", "fuze_completed_by"),
        }
        now = fields.Datetime.now()
        for order in self:
            next_values = stage_map.get(order.fuze_kitchen_stage)
            if next_values:
                stage, time_field, user_field = next_values
                order.write({"fuze_kitchen_stage": stage, time_field: now, user_field: self.env.user.id})
        return True

    def fuze_cancel_order(self):
        self.write({"fuze_kitchen_stage": "cancelled"})
        return True

    def fuze_confirm_store_card_payment(self):
        """Record an externally approved in-store card terminal payment in native POS."""
        self.ensure_one()
        if self.fuze_payment_state == "paid_at_store":
            return True
        if self.fuze_payment_state != "pay_at_store":
            raise UserError("This order is not waiting for a card payment at the restaurant.")
        if self.state != "draft":
            raise UserError("Only a draft POS order can receive this payment.")
        method = self.config_id.fuze_store_payment_method_id
        if not method:
            raise UserError("Configure the Card at Store POS Payment Method on this Fuze location first.")
        due = self.amount_total - self.amount_paid
        if due <= 0:
            raise UserError("This POS order has no remaining amount to pay.")
        self.add_payment(
            {
                "name": self.fuze_order_reference or self.pos_reference or self.name,
                "amount": due,
                "payment_date": fields.Datetime.now(),
                "payment_method_id": method.id,
            }
        )
        self.action_pos_order_paid()
        self.write(
            {
                "fuze_payment_state": "paid_at_store",
                "fuze_payment_reference": self.fuze_order_reference or self.pos_reference,
                "fuze_store_paid_at": fields.Datetime.now(),
                "fuze_store_paid_by": self.env.user.id,
            }
        )
        return True

    def _fuze_capture_online_payment(self, transaction):
        self.ensure_one()
        if self.fuze_payment_state == "paid_online":
            return
        values = {
            "fuze_payment_state": "paid_online",
            "fuze_payment_reference": transaction.reference,
            "fuze_kds_order": True,
            "fuze_kitchen_stage": "new",
        }
        self.write(values)
        method = self.config_id.fuze_online_payment_method_id
        if not method or self.state not in ("draft",):
            return
        try:
            self.add_payment(
                {
                    "name": transaction.reference,
                    "amount": self.amount_total,
                    "payment_date": fields.Datetime.now(),
                    "payment_method_id": method.id,
                }
            )
            self.action_pos_order_paid()
        except Exception:
            _logger.exception(
                "Online payment %s was captured but POS order %s could not be finalized automatically.",
                transaction.reference,
                self.display_name,
            )


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    fuze_station_ids = fields.Many2many(
        "fuze.kitchen.station",
        "fuze_pos_line_station_rel",
        "line_id",
        "station_id",
        string="Preparation Stations",
        copy=False,
    )
    fuze_options = fields.Text(copy=False)
    fuze_kitchen_note = fields.Text(copy=False)
    fuze_cancelled = fields.Boolean(copy=False)
    fuze_cancel_reason = fields.Char(copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        products = self.env["product.product"].browse(
            [vals.get("product_id") for vals in vals_list if vals.get("product_id")]
        )
        product_map = {product.id: product for product in products}
        for vals in vals_list:
            if vals.get("fuze_station_ids"):
                continue
            product = product_map.get(vals.get("product_id"))
            if not product:
                continue
            stations = product.product_tmpl_id.fuze_station_ids
            product_categories = product.product_tmpl_id.pos_categ_ids
            if not stations and product_categories:
                stations = self.env["fuze.kitchen.station"].search(
                    [("pos_category_ids", "in", product_categories.ids)]
                )
            if stations:
                vals["fuze_station_ids"] = [(6, 0, stations.ids)]
        return super().create(vals_list)
